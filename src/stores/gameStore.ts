import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Chess, type Move } from 'chess.js'
import type { GameStatus, Color } from '@/types'
import { soundManager } from '@/lib/soundManager'
import { db } from '@/lib/firebase'
import { collection, addDoc, updateDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore'
import { useAuthStore } from './authStore'

interface GameState {
  game: Chess
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

  initGame: () => void
  makeMove: (from: string, to: string, promotion?: string) => boolean
  selectSquare: (square: string) => void
  undoMove: () => void
  resetGame: () => void
  setStatus: (status: GameStatus) => void
  setPlayerColor: (color: Color) => void
  createBotGameDoc: (level: string) => Promise<string | null>
  updateBotGameDoc: () => Promise<void>
  loadBotGameFromFirestore: (docId: string) => Promise<{ level: string; playerColor: Color } | null>
  saveGame: (gameType: 'bot' | 'local' | 'online', botLevel?: string) => Promise<void>
}

const getCheckSquare = (game: Chess): string | null => {
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

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      game: new Chess(),
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

      initGame: () => {
        set({
          game: new Chess(),
          status: 'playing',
          currentTurn: 'w',
          selectedSquare: null,
          legalMoves: [],
          moveHistory: [],
          isGameOver: false,
          lastMove: null,
          checkSquare: null,
          botGameDocId: null,
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
        const piece = game.get(square as any)

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

      undoMove: () => {
        const { game } = get()
        game.undo()
        set({
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
        if (!user) return null

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
          console.log('[Store] Bot game doc created:', gameRef.id)
          return gameRef.id
        } catch (err) {
          console.error('[Store] Error creating bot game doc:', err)
          return null
        }
      },

      updateBotGameDoc: async () => {
        const { game, botGameDocId } = get()
        if (!botGameDocId) return

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
        if (!user) return null

        try {
          const snap = await getDoc(doc(db, 'games', docId))
          if (!snap.exists()) return null

          const data = snap.data()
          if (data.game_type !== 'bot' || data.game_state === 'game_over') return null

          const chess = new Chess()
          if (data.pgn) {
            try { chess.loadPgn(data.pgn) } catch {
              if (data.fen) chess.load(data.fen)
            }
          } else if (data.fen) {
            chess.load(data.fen)
          }

          const playerColor = data.white_player_id === user.uid ? 'w' as Color : 'b' as Color

          set({
            game: chess,
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
            lastMove: null,
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
        if (!user) return

        const winner = status === 'checkmate'
          ? (game.turn() === 'w' ? 'black' : 'white')
          : status === 'stalemate' || status === 'draw' ? 'draw' : null

        const message = status === 'checkmate' ? 'checkmate'
          : status === 'stalemate' ? 'stalemate'
          : status === 'draw' ? 'draw' : null

        const moves = game.history({ verbose: true }) as Move[]

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
            console.log('[Store] Bot game finalized:', botGameDocId)
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
            console.log('[Store] Game saved to Firestore:', gameRef.id)
          }
        } catch (err) {
          console.error('[Store] Error saving game:', err)
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
            const chess = new Chess()
            if (data.state.moveHistory && Array.isArray(data.state.moveHistory)) {
              for (const m of data.state.moveHistory) {
                try {
                  chess.move(m)
                } catch {
                  break
                }
              }
            }
            return {
              ...data,
              state: {
                ...data.state,
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
      // @ts-expect-error - partialize excludes 'game'
      partialize: (state) => {
        const { game, ...rest } = state
        return rest
      },
    }
  )
)
