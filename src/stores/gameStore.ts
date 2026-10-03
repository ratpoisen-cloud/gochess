import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createEngine, type EngineAPI, type Move } from '@/lib/engine'
import type { GameStatus, Color } from '@/types'
import { soundManager } from '@/lib/soundManager'
import { db } from '@/lib/firebase'
import { collection, addDoc, updateDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore'
import { useAuthStore } from './authStore'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

interface GameState {
  game: EngineAPI
  fen: string
  status: GameStatus
  currentTurn: Color
  selectedSquare: string | null
  legalMoves: string[]
  moveHistory: string[]
  isMyTurn: boolean
  playerColor: Color | null
  isGameOver: boolean
  lastMove: { from: string; to: string } | null
  checkSquare: string | null
  botGameDocId: string | null
  /**
   * Fingerprint of the last successfully written end-game document
   * (`gameType|docId|fen|status`). Guards against `saveGame` re-creating or
   * re-writing the same finished game on every page mount after a reload.
   */
  savedEndGameState: string | null

  initGame: () => void
  makeMove: (from: string, to: string, promotion?: string) => boolean
  selectSquare: (square: string) => void
  undoMove: (takeback?: boolean) => void
  resetGame: () => void
  setStatus: (status: GameStatus) => void
  setPlayerColor: (color: Color) => void
  createBotGameDoc: (level: string) => Promise<string | null>
  updateBotGameDoc: () => Promise<void>
  loadBotGameFromFirestore: (docId: string) => Promise<{ level: string; playerColor: Color } | null>
  saveGame: (gameType: 'bot' | 'local' | 'online', botLevel?: string) => Promise<void>
}

export const getKingSquare = (game: EngineAPI, color: 'w' | 'b'): string | null => {
  const board = game.board()
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c]
      if (piece && piece.type === 'k' && piece.color === color) {
        const files = 'abcdefgh'
        return `${files[c]}${8 - r}`
      }
    }
  }
  return null
}

const getCheckSquare = (game: EngineAPI): string | null => {
  if (!game.inCheck()) return null
  const turn = game.turn()
  const board = game.board()
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c]
      if (piece && piece.type === 'k' && piece.color === turn) {
        const files = 'abcdefgh'
        return `${files[c]}${8 - r}`
      }
    }
  }
  return null
}

const buildSaveKey = (gameType: string, docId: string | null, fen: string, status: string): string =>
  `${gameType}|${docId ?? ''}|${fen}|${status}`

/**
 * Rebuild an engine for a persisted position. History sources (PGN, then a
 * SAN list) are tried first and accepted only when the replayed position
 * matches the stored FEN — a FEN-only engine has no history, so PGN copies,
 * undo and the move list would all break after a reload.
 */
const rebuildEngine = (fen: string, historySources: (string | null | undefined)[]): EngineAPI => {
  for (const src of historySources) {
    if (!src || !src.trim()) continue
    const engine = createEngine()
    try {
      engine.loadPgn(src)
      if (engine.fen() === fen) return engine
    } catch {
      // corrupted source — try the next one
    }
  }
  return createEngine(undefined, fen)
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      game: createEngine(),
      fen: START_FEN,
      status: 'playing',
      currentTurn: 'w',
      selectedSquare: null,
      legalMoves: [],
      moveHistory: [],
      isMyTurn: true,
      playerColor: null,
      isGameOver: false,
      lastMove: null,
      checkSquare: null,
      botGameDocId: null,
      savedEndGameState: null,

      initGame: () => {
        set({
          game: createEngine(),
          fen: START_FEN,
          status: 'playing',
          currentTurn: 'w',
          selectedSquare: null,
          legalMoves: [],
          moveHistory: [],
          isGameOver: false,
          lastMove: null,
          checkSquare: null,
          botGameDocId: null,
          savedEndGameState: null,
        })
      },

      makeMove: (from, to, promotion) => {
        const { game } = get()
        try {
          // If from contains a FEN or PGN, we are syncing from external source
          if (from.includes('/') || from.includes(' ')) {
            game.load(from)
          } else {
            const result = game.move({ from, to, promotion })
            if (!result) return false

            // Sound handling
            if (game.isCheckmate()) {
              soundManager.play('checkmate')
            } else if (game.inCheck()) {
              soundManager.play('check')
            } else if (result.captured) {
              soundManager.play('capture')
            } else {
              soundManager.play('move')
            }
          }

          set({
            fen: game.fen(),
            status: game.isCheckmate() ? 'checkmate'
              : game.isStalemate() ? 'stalemate'
              : game.isDraw() ? 'draw'
              : game.inCheck() ? 'check'
              : 'playing',
            currentTurn: game.turn() as Color,
            selectedSquare: null,
            legalMoves: [],
            moveHistory: game.history(),
            isGameOver: game.isGameOver(),
            lastMove: to ? { from, to } : null,
            checkSquare: getCheckSquare(game),
          })
          return true
        } catch {
          return false
        }
      },

      selectSquare: (square) => {
        const { game, selectedSquare, makeMove } = get()
        const piece = game.get(square)

        if (selectedSquare === square) {
          set({ selectedSquare: null, legalMoves: [] })
          return
        }

        if (selectedSquare) {
          const isLegalMove = get().legalMoves.includes(square)
          if (isLegalMove) {
            if (makeMove(selectedSquare, square)) return
          }
          
          if (piece && piece.color === game.turn()) {
            const moves = game.moves({ verbose: true }) as Move[]
            const filtered = moves.filter((m) => m.from === square)
            set({
              selectedSquare: square,
              legalMoves: filtered.map((m) => m.to),
            })
            return
          }
          set({ selectedSquare: null, legalMoves: [] })
          return
        }

        if (piece && piece.color === game.turn()) {
          const moves = game.moves({ verbose: true }) as Move[]
          const filtered = moves.filter((m) => m.from === square)
          set({
            selectedSquare: square,
            legalMoves: filtered.map((m) => m.to),
          })
        }
      },

      undoMove: (takeback?: boolean) => {
        const { game } = get()
        if (takeback && game.history().length >= 2) {
          game.undo()
          game.undo()
        } else {
          game.undo()
        }
        set({
          fen: game.fen(),
          status: game.inCheck() ? 'check' : 'playing',
          currentTurn: game.turn() as Color,
          moveHistory: game.history(),
          isGameOver: false,
          lastMove: null,
          checkSquare: getCheckSquare(game),
        })
      },

      resetGame: () => {
        get().initGame()
      },

      setStatus: (status) => set({ status }),
      setPlayerColor: (color) => set({ playerColor: color }),

      createBotGameDoc: async (level) => {
        const { game } = get()
        const user = useAuthStore.getState().user
        if (!user || !db) return null

        try {
          const gameRef = await addDoc(collection(db, 'games'), {
            white_player_id: user.uid,
            white_name: user.displayName || 'Игрок',
            black_name: 'Ичи',
            game_type: 'bot',
            bot_level: level,
            pgn: game.pgn(),
            fen: game.fen(),
            game_state: 'active',
            turn: game.turn(),
            winner: null,
            message: null,
            created_at: serverTimestamp(),
            last_move_time: serverTimestamp(),
          })
          set({ botGameDocId: gameRef.id })
          return gameRef.id
        } catch (err) {
          console.error('[Store] Error creating bot game doc:', err)
          return null
        }
      },

      updateBotGameDoc: async () => {
        const { game, botGameDocId } = get()
        if (!botGameDocId || !db) return

        try {
          await updateDoc(doc(db, 'games', botGameDocId), {
            pgn: game.pgn(),
            fen: game.fen(),
            turn: game.turn(),
            last_move_time: Date.now(),
          })
        } catch (err) {
          console.error('[Store] Error updating bot game doc:', err)
        }
      },

      loadBotGameFromFirestore: async (docId) => {
        const user = useAuthStore.getState().user
        if (!user || !db) return null

        try {
          const snap = await getDoc(doc(db, 'games', docId))
          if (!snap.exists()) return null

          const data = snap.data()
          if (data.game_type !== 'bot') return null

          // `pgn` is always at least the header block (truthy even with zero
          // moves), so a header-only PGN must not shadow the real FEN — the
          // replay is validated against the stored position inside the helper.
          const fen: string = typeof data.fen === 'string' && data.fen ? data.fen : START_FEN
          const sans: string | null = Array.isArray(data.move_history_verbose)
            ? data.move_history_verbose
                .map((m: { san?: string }) => m?.san)
                .filter((s: string | undefined): s is string => Boolean(s))
                .join(' ') || null
            : null
          const chess = rebuildEngine(fen, [data.pgn, sans])

          const playerColor = data.white_player_id === user.uid ? 'w' as Color : 'b' as Color

          set({
            game: chess,
            fen: chess.fen(),
            status: chess.isCheckmate() ? 'checkmate'
              : chess.isStalemate() ? 'stalemate'
              : chess.isDraw() ? 'draw'
              : chess.inCheck() ? 'check'
              : 'playing',
            currentTurn: chess.turn() as Color,
            selectedSquare: null,
            legalMoves: [],
            moveHistory: chess.history(),
            isGameOver: chess.isGameOver(),
            lastMove: (() => { const h = chess.history({ verbose: true }); return h.length > 0 ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null })(),
            checkSquare: getCheckSquare(chess),
            botGameDocId: docId,
            playerColor,
          })

          return { level: data.bot_level || 'medium', playerColor }
        } catch (err) {
          console.error('[Store] Error loading bot game:', err)
          return null
        }
      },

      saveGame: async (gameType, botLevel) => {
        const { game, status, botGameDocId } = get()
        const user = useAuthStore.getState().user
        if (!user || !db) return

        // The end-game effect runs on mount too, so a reload of a finished
        // game used to write again (and for local games created a duplicate
        // document every visit). Same position + same outcome = already saved.
        const endFen = game.fen()
        const saveKey = buildSaveKey(gameType, botGameDocId, endFen, status)
        if (get().savedEndGameState === saveKey) return

        const winner = status === 'checkmate'
          ? (game.turn() === 'w' ? 'black' : 'white')
          : status === 'stalemate' || status === 'draw' ? 'draw' : null

        const message = status === 'checkmate' ? 'checkmate'
          : status === 'stalemate' ? 'stalemate'
          : status === 'draw' ? 'draw' : null

        const moves = game.history({ verbose: true }) as Move[]
        let botGameDocIdRef: string | null = null

        try {
          if (botGameDocId) {
            await updateDoc(doc(db, 'games', botGameDocId), {
              pgn: game.pgn(),
              fen: game.fen(),
              game_state: 'game_over',
              turn: game.turn(),
              winner,
              message,
              last_move_time: Date.now(),
              move_history_verbose: moves.map((m, i) => ({
                move_number: i + 1,
                from: m.from,
                to: m.to,
                piece: m.piece,
                captured: m.captured || null,
                promotion: m.promotion || null,
                san: m.san,
                fen_after: m.after,
              }))
            })
          } else {
            const gameRef = await addDoc(collection(db, 'games'), {
              white_player_id: user.uid,
              white_name: user.displayName,
              black_name: gameType === 'bot' ? 'Ичи' : 'Чёрные',
              game_type: gameType,
              bot_level: botLevel || null,
              pgn: game.pgn(),
              fen: game.fen(),
              game_state: 'game_over',
              turn: game.turn(),
              winner,
              message,
              created_at: serverTimestamp(),
              last_move_time: serverTimestamp(),
              move_history_verbose: moves.map((m, i) => ({
                move_number: i + 1,
                from: m.from,
                to: m.to,
                piece: m.piece,
                captured: m.captured || null,
                promotion: m.promotion || null,
                san: m.san,
                fen_after: m.after,
              }))
            })
            botGameDocIdRef = gameRef.id
          }
          set({
            savedEndGameState: buildSaveKey(gameType, botGameDocIdRef ?? botGameDocId, endFen, status),
            ...(botGameDocIdRef ? { botGameDocId: botGameDocIdRef } : {}),
          })
        } catch {
          // Saving is best-effort: the position stays in localStorage and the
          // fingerprint is only written on success, so a retry remains possible.
        }
      },
    }),
    {
      name: 'gochess-game-store',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          try {
            const data = JSON.parse(str)
            const state = data.state || {}
            const fen: string = typeof state.fen === 'string' && state.fen ? state.fen : START_FEN
            const sans: string | null =
              Array.isArray(state.moveHistory) && state.moveHistory.length > 0
                ? state.moveHistory.join(' ')
                : null
            const chess = rebuildEngine(fen, [state.pgn, sans])
            // `pgn` is written by partialize purely as a rebuild source —
            // it is not part of the store state.
            const { pgn: _persistedPgn, ...rest } = state
            return {
              ...data,
              state: {
                ...rest,
                game: chess,
              },
            }
          } catch {
            localStorage.removeItem(name)
            return null
          }
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value))
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
      // @ts-expect-error - 'game' is replaced by its serializable PGN snapshot
      partialize: (state) => {
        const { game, ...rest } = state
        // The engine instance cannot be persisted; its history can. getItem
        // rebuilds the engine from this PGN (falling back to FEN), so a
        // reload no longer loses the move list of a bot/local game.
        return { ...rest, pgn: game.pgn() }
      },
    }
  )
)
