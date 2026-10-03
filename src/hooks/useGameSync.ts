import { useState, useEffect, useRef, useCallback } from 'react'
import { createEngine, type EngineAPI } from '@/lib/engine'
import { type SpellName, FREE_ACTIONS, TERMINAL_ACTIONS } from '@/lib/spellChessEngine'
import { db } from '@/lib/firebase'
import {
  doc,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore'
import { useReactionStore } from '@/stores/reactionStore'
import { getKingSquare } from '@/stores/gameStore'
import { getVisibleSquares } from '@/lib/chessFog'
import { soundManager } from '@/lib/soundManager'
import { useToast } from '@/components/Toast'
import { useGameTimer } from './useGameTimer'
import { useGameRequest } from './useGameRequest'
import { useRematch } from './useRematch'
import { useRoomJoin } from './useRoomJoin'
import type { GameStatus, GameData, GameMode, User } from '@/types'

const BASE = import.meta.env.BASE_URL || '/'

export function useGameSync(roomCode: string | undefined, user: User | null, authLoading: boolean, navigate?: (path: string) => void) {
  const { addToast } = useToast()

  // Core game state
  const [game, setGame] = useState(createEngine())
  const [status, setStatus] = useState<GameStatus>('playing')
  const [moveHistory, setMoveHistory] = useState<string[]>([])
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [checkSquare, setCheckSquare] = useState<string | null>(null)
  const [isMyTurn, setIsMyTurn] = useState(false)
  const [playerColor, setPlayerColor] = useState<'w' | 'b' | null>(null)
  const [opponentName, setOpponentName] = useState('')
  const [gameDocId, setGameDocId] = useState<string | null>(null)

  // UI meta
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gameOver, setGameOver] = useState(false)
  const [resultText, setResultText] = useState('')
  const [winnerColor, setWinnerColor] = useState<'w' | 'b' | null>(null)
  const [opponentJoined, setOpponentJoined] = useState(false)
  const [gameMode, setGameMode] = useState<GameMode>('classic')
  const [visibleSquares, setVisibleSquares] = useState<string[] | null>(null)
  const [endGameState, setEndGameState] = useState<{
    defeated: string | null
    emojis: { square: string; url: string }[]
  } | null>(null)

  // Extracted hooks
  const timer = useGameTimer(gameDocId)
  const requests = useGameRequest(gameDocId)
  const onRematchReady = useCallback((gameId: string) => {
    if (navigate) navigate(`/game/${gameId}`)
    else window.location.href = `/game/${gameId}`
  }, [navigate])
  const rematch = useRematch(gameDocId, user, onRematchReady)
  const { setTimerFromSnapshot } = timer
  const { setRequestsFromSnapshot } = requests
  const { setRematchFromSnapshot } = rematch

  // Spell state (spell_chess mode)
  const [spellStateJson, setSpellStateJson] = useState<string | null>(null)
  const [hasCastSpellThisTurn, setHasCastSpellThisTurn] = useState(false)
  const lastSpellStateJsonRef = useRef<string | null>(null)

  const addReaction = useReactionStore((s) => s.addReaction)

  // Refs
  const gameRef = useRef(game)
  const lastPgnRef = useRef('')
  const opponentJoinedRef = useRef(false)
  const localMoveRef = useRef(false)
  const lastReactionTimestampRef = useRef(0)
  const isMyTurnRef = useRef(isMyTurn)
  useEffect(() => { isMyTurnRef.current = isMyTurn }, [isMyTurn])
  const initialSnapshotRef = useRef(true)

  const getCheckSquare = (g: EngineAPI): string | null => {
    if (!g.inCheck()) return null
    const turn = g.turn()
    const board = g.board()
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c]
        if (piece && piece.type === 'k' && piece.color === turn) {
          return `${'abcdefgh'[c]}${8 - r}`
        }
      }
    }
    return null
  }

  const parseResult = (data: GameData) => {
    if (data.game_state !== 'game_over') return ''
    if (data.message === 'timeout') {
      return `Время вышло! ${data.winner === 'white' ? 'Белые' : 'Чёрные'} победили`
    }
    if (data.message === 'king_capture') {
      return `${data.winner === 'white' ? 'Белые' : 'Чёрные'} захватили короля!`
    }
    if (data.message === 'atomic_blast') {
      return `${data.winner === 'white' ? 'Белые' : 'Чёрные'} уничтожили короля взрывом!`
    }
    return data.message === 'resign'
      ? `${data.winner === 'white' ? 'Чёрные' : 'Белые'} сдались`
      : (data.message === 'draw' || data.message === 'stalemate') ? 'Ничья'
      : data.winner === 'white' ? 'Белые победили'
      : data.winner === 'black' ? 'Чёрные победили'
      : 'Игра окончена'
  }

  const updateGameState = useCallback((g: EngineAPI) => {
    setGame(g)
    gameRef.current = g
    setStatus(
      g.isCheckmate() ? 'checkmate'
        : g.isStalemate() ? 'stalemate'
        : g.isDraw() ? 'draw'
        : g.inCheck() ? 'check'
        : 'playing',
    )
    const verbose = g.history({ verbose: true }) as { from: string; to: string }[]
    setMoveHistory(g.history())
    setLastMove(verbose.length > 0 ? { from: verbose[verbose.length - 1].from, to: verbose[verbose.length - 1].to } : null)
    setCheckSquare(getCheckSquare(g))
  }, [])

  const processSnapshotData = useCallback((newData: GameData) => {
    if (!newData) return
    const isFirstSnapshot = initialSnapshotRef.current
    initialSnapshotRef.current = false

    let myColor: 'w' | 'b' | null = null
    let opponent = ''
    let joined = false

    if (newData.white_player_id === user?.uid) {
      myColor = 'w'
      opponent = newData.black_name || ''
      joined = !!newData.black_player_id
    } else if (newData.black_player_id === user?.uid) {
      myColor = 'b'
      opponent = newData.white_name || ''
      joined = !!newData.white_player_id
    }

    setPlayerColor(myColor)
    setOpponentName(opponent)
    setOpponentJoined(joined)
    setGameMode(newData.game_mode || 'classic')
    opponentJoinedRef.current = joined

    // Timer sync
    setTimerFromSnapshot(newData, myColor)

    // Game over
    if (newData.game_state === 'game_over') {
      if (!gameOver) {
        setGameOver(true)
        setResultText(parseResult(newData))
        setWinnerColor(null)
        if (!isFirstSnapshot && newData.game_mode !== 'fog_of_war' && newData.message !== 'king_capture') {
          soundManager.play('checkmate')
        }

        const gameOverMode = newData.game_mode === 'spell_chess' ? 'spell'
          : newData.game_mode === 'atomic_chess' ? 'atomic'
          : undefined
        const currentGame = createEngine(gameOverMode, newData.fen || undefined)
        if (newData.pgn) {
          try { currentGame.loadPgn(newData.pgn) } catch {
            if (newData.fen) currentGame.load(newData.fen)
          }
        } else if (newData.fen) {
          currentGame.load(newData.fen)
        }
        if (newData.game_mode === 'spell_chess' && newData.spell_state_json) {
          try {
            ;(currentGame as any).applySpellStateJSON?.(newData.spell_state_json)
          } catch {
            // Malformed spell state from a remote write — keep the position from FEN
          }
        }

        const whiteKingSquare = getKingSquare(currentGame, 'w')
        const blackKingSquare = getKingSquare(currentGame, 'b')

        if (newData.message === 'resign') {
          const loserColor = newData.winner === 'white' ? 'b' : 'w'
          const wc = newData.winner === 'white' ? 'w' : 'b'
          setWinnerColor(wc)
          const kingSq = getKingSquare(currentGame, loserColor)
          const winnerKingSq = getKingSquare(currentGame, wc)
          setEndGameState({
            defeated: kingSq,
            emojis: [
              ...(kingSq ? [{ square: kingSq, url: `${BASE}emojis/end game/surrender.png` }] : []),
              ...(winnerKingSq ? [{ square: winnerKingSq, url: `${BASE}emojis/end game/win.png` }] : []),
            ],
          })
        } else if (newData.message === 'checkmate') {
          const loserColor = currentGame.turn()
          const wc = currentGame.turn() === 'w' ? 'b' : 'w'
          setWinnerColor(wc)
          const kingSq = getKingSquare(currentGame, loserColor)
          const winnerKingSq = getKingSquare(currentGame, wc)
          setEndGameState({
            defeated: kingSq,
            emojis: [
              ...(kingSq ? [{ square: kingSq, url: `${BASE}emojis/end game/chekmate.png` }] : []),
              ...(winnerKingSq ? [{ square: winnerKingSq, url: `${BASE}emojis/end game/win.png` }] : []),
            ],
          })
        } else if (newData.message === 'king_capture') {
          const wc = newData.winner === 'white' ? 'w' : 'b'
          setWinnerColor(wc)
          const kingSq = getKingSquare(currentGame, wc === 'w' ? 'b' : 'w')
          const winnerKingSq = getKingSquare(currentGame, wc)
          setEndGameState({
            defeated: kingSq,
            emojis: [
              ...(kingSq ? [{ square: kingSq, url: `${BASE}emojis/end game/chekmate.png` }] : []),
              ...(winnerKingSq ? [{ square: winnerKingSq, url: `${BASE}emojis/end game/win.png` }] : []),
            ],
          })
        } else if (newData.message === 'timeout') {
          // Without this branch winnerColor stayed null, so GamePage greyscaled
          // the winner's board as a loss and skipped the victory confetti.
          const wc = newData.winner === 'white' ? 'w' : 'b'
          setWinnerColor(wc)
          const kingSq = getKingSquare(currentGame, wc === 'w' ? 'b' : 'w')
          const winnerKingSq = getKingSquare(currentGame, wc)
          setEndGameState({
            defeated: kingSq,
            emojis: [
              ...(kingSq ? [{ square: kingSq, url: `${BASE}emojis/end game/surrender.png` }] : []),
              ...(winnerKingSq ? [{ square: winnerKingSq, url: `${BASE}emojis/end game/win.png` }] : []),
            ],
          })
        } else if (newData.message === 'draw' || newData.message === 'stalemate') {
          setWinnerColor(null)
          setEndGameState({
            defeated: null,
            emojis: [
              ...(whiteKingSquare ? [{ square: whiteKingSquare, url: `${BASE}emojis/end game/draw.png` }] : []),
              ...(blackKingSquare ? [{ square: blackKingSquare, url: `${BASE}emojis/end game/draw.png` }] : []),
            ],
          })
        }
      }
    } else {
      setGameOver(false)
      setResultText('')
      setEndGameState(null)
      setWinnerColor(null)
    }

    // Sync PGN (spell and atomic mode sync via spell_state_json)
    const isSpell = newData.game_mode === 'spell_chess'
    const isAtomic = newData.game_mode === 'atomic_chess'
    
    if (isSpell && newData.spell_state_json && newData.spell_state_json !== lastSpellStateJsonRef.current) {
      if (!localMoveRef.current) {
        const g = createEngine('spell', newData.fen || undefined)
        if (newData.spell_state_json) {
          try {
            ;(g as any).applySpellStateJSON?.(newData.spell_state_json)
          } catch {
            // Malformed spell state from a remote write — keep the position from FEN
          }
        }
        updateGameState(g)
      }
      lastSpellStateJsonRef.current = newData.spell_state_json
      setSpellStateJson(newData.spell_state_json)

      if (!localMoveRef.current && !isFirstSnapshot) {
        soundManager.play('move')
        useReactionStore.getState().resetMoveCounter()
      }
      lastPgnRef.current = newData.pgn || lastPgnRef.current
      localMoveRef.current = false
    } else if (isSpell && !newData.spell_state_json && lastSpellStateJsonRef.current === null) {
      // First mount: SSJ is null, initialize SpellChessEngine
      if (!localMoveRef.current) {
        const g = createEngine('spell', newData.fen || undefined)
        updateGameState(g)
        const defaultSsj = (g as any).spellStateToJSON()
        lastSpellStateJsonRef.current = defaultSsj
        setSpellStateJson(defaultSsj)
      }
      lastPgnRef.current = newData.pgn || lastPgnRef.current
    } else if (isAtomic && newData.spell_state_json && newData.spell_state_json !== lastSpellStateJsonRef.current) {
      if (!localMoveRef.current) {
        const g = createEngine('atomic', newData.fen || undefined)
        if (newData.spell_state_json) {
          try {
            const state = JSON.parse(newData.spell_state_json)
            ;(g as any).setAtomicState?.(state)
          } catch {}
        }
        updateGameState(g)
      }
      lastSpellStateJsonRef.current = newData.spell_state_json
      setSpellStateJson(newData.spell_state_json)

      if (!localMoveRef.current && !isFirstSnapshot) {
        soundManager.play('move')
        useReactionStore.getState().resetMoveCounter()
      }
      lastPgnRef.current = newData.pgn || lastPgnRef.current
      localMoveRef.current = false
    } else if (!isSpell && !isAtomic && newData.pgn && newData.pgn !== lastPgnRef.current) {
      const g = createEngine()
      try {
        g.loadPgn(newData.pgn)
        updateGameState(g)
        lastPgnRef.current = g.pgn()

        if (newData.game_mode === 'fog_of_war' && myColor) {
          setVisibleSquares(getVisibleSquares(g, myColor))
        }
      } catch {
        // PGN parse error, ignore
      }

      if (!localMoveRef.current && !isFirstSnapshot) {
        soundManager.play('move')
        useReactionStore.getState().resetMoveCounter()
      }
      localMoveRef.current = false
    } else if (!isSpell && !isAtomic && !newData.pgn && lastPgnRef.current !== '') {
      if (!localMoveRef.current) {
        const g = createEngine()
        updateGameState(g)
        setVisibleSquares(
          newData.game_mode === 'fog_of_war' && myColor
            ? getVisibleSquares(g, myColor)
            : null,
        )
      }
      lastPgnRef.current = ''
    }

    // Turn
    if (newData.turn) {
      const newIsMyTurn = newData.turn === myColor
      if (newIsMyTurn && !isMyTurnRef.current) {
        setHasCastSpellThisTurn(false)
      }
      setIsMyTurn(newIsMyTurn)
    }

    // Requests
    setRequestsFromSnapshot(newData)

    // Rematch
    setRematchFromSnapshot(newData, user)

    // Reactions
    if (newData.reactions && Array.isArray(newData.reactions)) {
      for (const r of newData.reactions) {
        if (r.createdAt > lastReactionTimestampRef.current && r.playerId !== user?.uid) {
          addReaction(r)
        }
      }
      if (newData.reactions.length > 0) {
        const maxTs = Math.max(...newData.reactions.map((r: any) => r.createdAt))
        if (maxTs > lastReactionTimestampRef.current) {
          lastReactionTimestampRef.current = maxTs
        }
      }
    }

    setLoading(false)
  }, [gameOver, user, addReaction, updateGameState, gameDocId, setTimerFromSnapshot, setRequestsFromSnapshot, setRematchFromSnapshot])

  // 1. Room initialisation
  useRoomJoin(roomCode, user, authLoading, setGameDocId, setError, setLoading)

  // 1b. Reset per-room state. useRematch navigates to /game/{newId} while this
  // hook stays mounted, so stale refs would otherwise make the new room render
  // the old board (the spell re-init branch requires a null spell state ref).
  const prevRoomCodeRef = useRef(roomCode)
  useEffect(() => {
    if (prevRoomCodeRef.current === roomCode) return
    prevRoomCodeRef.current = roomCode

    gameRef.current = createEngine()
    lastPgnRef.current = ''
    opponentJoinedRef.current = false
    localMoveRef.current = false
    lastReactionTimestampRef.current = 0
    initialSnapshotRef.current = true
    lastSpellStateJsonRef.current = null

    setMoveHistory([])
    setLastMove(null)
    setCheckSquare(null)
    setIsMyTurn(false)
    setSpellStateJson(null)
    setHasCastSpellThisTurn(false)
    setVisibleSquares(null)
    setOpponentJoined(false)
    setGameOver(false)
    setResultText('')
    setWinnerColor(null)
    setEndGameState(null)
    setStatus('playing')
    setPlayerColor(null)
    setGameMode('classic')
    setOpponentName('')
    // Classic is untimed, and setTimerFromSnapshot early-returns on a document
    // without time_control — so without an explicit reset a rapid room's clock
    // would keep rendering in the next classic room.
    timer.resetTimer()
    rematch.resetRematch()
  }, [roomCode])

  // 2. Firestore listener
  useEffect(() => {
    if (!gameDocId || !user) return

    const unsubscribe = onSnapshot(
      doc(db, 'games', gameDocId),
      (snapshot) => {
        const newData = snapshot.data() as GameData
        processSnapshotData(newData)
      },
      () => {
        setError('Потеряно соединение с сервером')
        setLoading(false)
      },
    )

    return () => {
      unsubscribe()
    }
  }, [gameDocId, user, processSnapshotData])

  // 3. makeMove
  const makeMove = useCallback(async (from: string, to: string, promotion?: string): Promise<boolean> => {
    if (!isMyTurn || !gameDocId || gameOver) return false

    const isSpell = gameMode === 'spell_chess'
    const isAtomic = gameMode === 'atomic_chess'

    // --- Atomic mode move ---
    if (isAtomic) {
      const g = createEngine('atomic', gameRef.current.fen() || undefined) as any
      if (lastSpellStateJsonRef.current) {
        try {
          g.setAtomicState(JSON.parse(lastSpellStateJsonRef.current))
        } catch {}
      }

      const moveResult = g.move({ from, to, promotion })
      if (!moveResult) return false

      const preMoveTurn = gameRef.current.turn()
      const prevFen = gameRef.current.fen()
      const prevSsj = lastSpellStateJsonRef.current

      // Optimistic local update
      updateGameState(g)
      const newSsj = JSON.stringify(g.getAtomicState())
      lastSpellStateJsonRef.current = newSsj
      setSpellStateJson(newSsj)
      setIsMyTurn(false)

      const board = g.board()
      let wK = false, bK = false
      board.flat().forEach((p: any) => {
        if (p?.type === 'k') {
          if (p.color === 'w') wK = true
          if (p.color === 'b') bK = true
        }
      })
      const gameOverNow = !wK || !bK || g.isGameOver()

      const updateData: Record<string, any> = {
        fen: g.fen(),
        turn: g.turn(),
        spell_state_json: newSsj,
        pgn: g.pgn(),
        last_move_time: Date.now(),
      }

      if (gameOverNow) {
        updateData.game_state = 'game_over'
        updateData.winner = !bK ? 'white' : 'black'
        updateData.message = 'atomic_blast'
      }

      try {
        localMoveRef.current = true
        const gameRef2 = doc(db, 'games', gameDocId)
        const txnResult = await runTransaction(db, async (transaction) => {
          const freshDoc = await transaction.get(gameRef2)
          const freshData = freshDoc.data()
          if (!freshData) return 'error'
          if (freshData.turn !== preMoveTurn && !gameOverNow) return 'stale'
          transaction.update(gameRef2, updateData)
          return 'ok'
        })

        if (txnResult === 'stale') {
          localMoveRef.current = false
          const rollback = createEngine('atomic', prevFen || undefined)
          if (prevSsj) {
            try { (rollback as any).setAtomicState(JSON.parse(prevSsj)) } catch {}
          }
          updateGameState(rollback)
          lastSpellStateJsonRef.current = prevSsj
          setSpellStateJson(prevSsj)
          setIsMyTurn(true)
          return false
        }

        useReactionStore.getState().resetMoveCounter()
        soundManager.play('move')
      } catch {
        localMoveRef.current = false
        const rollback = createEngine('atomic', prevFen || undefined)
        if (prevSsj) {
           try { (rollback as any).setAtomicState(JSON.parse(prevSsj)) } catch {}
        }
        updateGameState(rollback)
        lastSpellStateJsonRef.current = prevSsj
        setSpellStateJson(prevSsj)
        setIsMyTurn(true)
        return false
      }
      return true
    }

    // --- Spell mode move ---
    if (isSpell) {
      const g = createEngine('spell', gameRef.current.fen() || undefined)
      if (lastSpellStateJsonRef.current) {
        ;(g as any).applySpellStateJSON?.(lastSpellStateJsonRef.current)
      }

      try {
        const success = g.move({ from, to, promotion })
        if (!success) return false

        const prevFen = gameRef.current.fen()
        const prevSsj = lastSpellStateJsonRef.current
        const preMoveTurn = gameRef.current.turn()

        // Optimistic local update
        updateGameState(g)
        const newSsj = (g as any).spellStateToJSON()
        lastSpellStateJsonRef.current = newSsj
        setSpellStateJson(newSsj)
        setIsMyTurn(false)

        const gameOverResult = (g as any).isGameOver()
        const gameOverNow = gameOverResult !== null

        const updateData: Record<string, any> = {
          fen: g.fen(),
          turn: g.turn(),
          spell_state_json: newSsj,
          pgn: g.pgn(),
          last_move_time: Date.now(),
        }

        if (gameOverNow) {
          updateData.game_state = 'game_over'
          updateData.winner = gameOverResult === 'draw' ? null : (gameOverResult === 'white' ? 'white' : 'black')
          updateData.message = gameOverResult === 'draw' ? 'draw' : 'king_capture'
        }

        try {
          localMoveRef.current = true
          const gameRef2 = doc(db, 'games', gameDocId)
          const txnResult = await runTransaction(db, async (transaction) => {
            const freshDoc = await transaction.get(gameRef2)
            const freshData = freshDoc.data()
            if (!freshData) return 'error'
            if (freshData.turn !== preMoveTurn && !gameOverNow) return 'stale'
            transaction.update(gameRef2, updateData)
            return 'ok'
          })

          if (txnResult === 'stale') {
            localMoveRef.current = false
            const rollback = createEngine('spell', prevFen || undefined)
            if (prevSsj) { (rollback as any).applySpellStateJSON?.(prevSsj) }
            updateGameState(rollback)
            lastSpellStateJsonRef.current = prevSsj
            setSpellStateJson(prevSsj)
            setIsMyTurn(true)
            return false
          }

          useReactionStore.getState().resetMoveCounter()
          soundManager.play('move')
        } catch {
          localMoveRef.current = false
          const rollback = createEngine('spell', prevFen || undefined)
          if (prevSsj) { (rollback as any).applySpellStateJSON?.(prevSsj) }
          updateGameState(rollback)
          lastSpellStateJsonRef.current = prevSsj
          setSpellStateJson(prevSsj)
          setIsMyTurn(true)
          addToast('Ошибка синхронизации хода', 'error')
        }

        return true
      } catch {
        return false
      }
    }

    // --- Standard / Fog mode move ---
    // The flag already fell before this move: it must not be written at
    // all — only the timeout result. (Previously the move landed together
    // with game_over, leaving a position the loser never had time for.)
    if (timer.isTimeout(playerColor)) {
      const expectedTurn = gameRef.current.turn()
      try {
        await runTransaction(db, async (transaction) => {
          const ref = doc(db, 'games', gameDocId)
          const snap = await transaction.get(ref)
          const data = snap.data()
          if (!data || data.game_state === 'game_over') return
          if (data.turn !== expectedTurn) return
          transaction.update(ref, {
            game_state: 'game_over',
            winner: playerColor === 'w' ? 'black' : 'white',
            message: 'timeout',
          })
        })
      } catch { /* снапшот приведёт партию к финальному состоянию */ }
      addToast('Время вышло', 'error')
      return false
    }

    const g = createEngine()
    const currentPgn = gameRef.current.pgn()
    if (currentPgn) {
      try {
        g.loadPgn(currentPgn)
      } catch {
        const currentFen = gameRef.current.fen()
        if (currentFen) g.load(currentFen)
      }
    }

    try {
      const result = g.move({ from, to, promotion })
      if (!result) return false

      const newPgn = g.pgn()
      const prevPgn = lastPgnRef.current
      const wasMyTurn = isMyTurn
      const oldTurn = gameRef.current.turn()

      // Optimistic local update
      lastPgnRef.current = newPgn
      updateGameState(g)
      setIsMyTurn(false)

      if (gameMode === 'fog_of_war' && playerColor) {
        setVisibleSquares(getVisibleSquares(g, playerColor))
      }

      const isCheckmate = g.isCheckmate()
      const isStalemate = g.isStalemate()
      const isDraw = g.isDraw()
      const gameOverNow = isCheckmate || isStalemate || isDraw

      const winner = isCheckmate
        ? (g.turn() === 'w' ? 'black' : 'white')
        : null

      const updateData: Record<string, any> = {
        pgn: newPgn,
        fen: g.fen(),
        turn: g.turn(),
        last_move_time: Date.now(),
      }

      // Timer deduction
      const timerUpdate = timer.buildTimerUpdate(playerColor)
      if (timerUpdate) {
        Object.assign(updateData, timerUpdate)
      }

      const isTimeout = timer.isTimeout(playerColor)

      if (gameOverNow || isTimeout) {
        updateData.game_state = 'game_over'
        if (isTimeout) {
          updateData.winner = playerColor === 'w' ? 'black' : 'white'
          updateData.message = 'timeout'
        } else {
          updateData.winner = winner
          updateData.message = isCheckmate ? 'checkmate'
            : isStalemate ? 'stalemate'
            : 'draw'
        }
      }

      try {
        localMoveRef.current = true

        const gameRef2 = doc(db, 'games', gameDocId)
        const txnResult = await runTransaction(db, async (transaction) => {
          const freshDoc = await transaction.get(gameRef2)
          const freshData = freshDoc.data()
          if (!freshData) return 'error'

          // Партия уже завершена (сдача/ничья/флаг пишут game_state, НЕ меняя
          // turn) — ход после конца не записываем, результат не перезаписываем.
          if (freshData.game_state === 'game_over') {
            return 'over'
          }
          if (freshData.turn !== oldTurn && !gameOverNow) {
            return 'stale'
          }

          transaction.update(gameRef2, updateData)
          return 'ok'
        })

        if (txnResult === 'stale' || txnResult === 'over') {
          localMoveRef.current = false
          const rollback = createEngine()
          if (prevPgn) rollback.loadPgn(prevPgn)
          updateGameState(rollback)
          lastPgnRef.current = prevPgn
          setIsMyTurn(wasMyTurn)
          if (gameMode === 'fog_of_war' && playerColor) {
            setVisibleSquares(getVisibleSquares(rollback, playerColor))
          }
          if (txnResult === 'over') {
            addToast('Партия уже завершена', 'warning')
          }
          return false
        }

        if (txnResult === 'error') {
          localMoveRef.current = false
          const rollback = createEngine()
          if (prevPgn) rollback.loadPgn(prevPgn)
          updateGameState(rollback)
          lastPgnRef.current = prevPgn
          setIsMyTurn(wasMyTurn)
          if (gameMode === 'fog_of_war' && playerColor) {
            setVisibleSquares(getVisibleSquares(rollback, playerColor))
          }
          addToast('Ошибка синхронизации хода', 'error')
          return false
        }

        // Clear the flag here rather than relying on the echo snapshot: the
        // PGN we just wrote is byte-identical to lastPgnRef.current, so the
        // snapshot branch is never entered and the flag stayed true forever —
        // which silenced every opponent move and skipped resetMoveCounter().
        localMoveRef.current = false

        useReactionStore.getState().resetMoveCounter()

        if (!gameOverNow) {
          soundManager.play(result.captured ? 'capture' : 'move')
        } else if (isCheckmate && gameMode !== 'fog_of_war') {
          soundManager.play('checkmate')
        }
      } catch {
        localMoveRef.current = false
        const rollback = createEngine()
        if (prevPgn) rollback.loadPgn(prevPgn)
        updateGameState(rollback)
        lastPgnRef.current = prevPgn
        setIsMyTurn(wasMyTurn)
        addToast('Ошибка синхронизации хода', 'error')
      }

      return true
    } catch {
      return false
    }
  }, [isMyTurn, gameDocId, gameOver, updateGameState, addToast, playerColor, gameMode, timer])

  // 4. Resign
  const handleResign = useCallback(async () => {
    if (!gameDocId || !playerColor || gameOver) return
    try {
      await runTransaction(db, async (transaction) => {
        const gameRef2 = doc(db, 'games', gameDocId)
        const freshDoc = await transaction.get(gameRef2)
        const freshData = freshDoc.data()
        if (!freshData || freshData.game_state === 'game_over') return
        transaction.update(gameRef2, {
          game_state: 'game_over',
          winner: playerColor === 'w' ? 'black' : 'white',
          message: 'resign',
        })
      })
      addToast('Вы сдались', 'info')
    } catch {
      addToast('Ошибка при сдаче', 'error')
    }
  }, [gameDocId, playerColor, gameOver, addToast])

  // 5. castSpell
  const castSpell = useCallback(async (spell: SpellName, target?: string, target2?: string): Promise<boolean> => {
    if (!isMyTurn || !gameDocId || gameOver) return false
    const isFree = FREE_ACTIONS.includes(spell)
    if (isFree && hasCastSpellThisTurn) return false

    const g = createEngine('spell', gameRef.current.fen() || undefined)
    if (lastSpellStateJsonRef.current) {
      ;(g as any).applySpellStateJSON?.(lastSpellStateJsonRef.current)
    }

    const prevFen = gameRef.current.fen()
    const prevSsj = lastSpellStateJsonRef.current
    const preMoveTurn = gameRef.current.turn()

    try {
      let success = false
      const se = g as any
      switch (spell) {
        case 'freeze': success = target ? se.castFreeze(target) : false; break
        case 'jump': success = target ? se.castJump(target) : false; break
        case 'blast': success = target ? se.castBlast(target) : false; break
        case 'shield': success = target ? se.castShield(target) : false; break
        case 'portal': success = (target && target2) ? se.castPortal(target, target2) : false; break
        case 'berserk': success = (target && target2) ? se.castBerserk(target, target2) : false; break
        case 'divineGrace': success = target ? se.castDivineGrace(target) : false; break
        case 'shadowGrave': success = target ? se.castShadowGrave(target) : false; break
        case 'mirage': success = (target && target2) ? se.castMirage(target, target2) : false; break
      }
      if (!success) return false

      // Optimistic local update
      updateGameState(g)
      const newSsj = se.spellStateToJSON()
      lastSpellStateJsonRef.current = newSsj
      setSpellStateJson(newSsj)

      const isTerminal = TERMINAL_ACTIONS.includes(spell)
      if (isTerminal) {
        setHasCastSpellThisTurn(false)
        setIsMyTurn(false)

        const gameOverResult = se.isGameOver()
        const gameOverNow = gameOverResult !== null

        const updateData: Record<string, any> = {
          fen: g.fen(),
          turn: g.turn(),
          spell_state_json: newSsj,
          pgn: g.pgn(),
          last_move_time: Date.now(),
        }

        if (gameOverNow) {
          updateData.game_state = 'game_over'
          updateData.winner = gameOverResult === 'draw' ? null : (gameOverResult === 'white' ? 'white' : 'black')
          updateData.message = gameOverResult === 'draw' ? 'draw' : 'king_capture'
        }

        localMoveRef.current = true
        const gameRef2 = doc(db, 'games', gameDocId)
        const txnResult = await runTransaction(db, async (transaction) => {
          const freshDoc = await transaction.get(gameRef2)
          const freshData = freshDoc.data()
          if (!freshData) return 'error'
          if (freshData.turn !== preMoveTurn && !gameOverNow) return 'stale'
          transaction.update(gameRef2, updateData)
          return 'ok'
        })

        if (txnResult === 'stale' || txnResult === 'error') {
          localMoveRef.current = false
          const rollback = createEngine('spell', prevFen || undefined)
          if (prevSsj) { (rollback as any).applySpellStateJSON?.(prevSsj) }
          updateGameState(rollback)
          lastSpellStateJsonRef.current = prevSsj
          setSpellStateJson(prevSsj)
          setIsMyTurn(true)
          setHasCastSpellThisTurn(false)
          addToast('Ошибка синхронизации хода', 'error')
          return false
        }

        localMoveRef.current = false
        useReactionStore.getState().resetMoveCounter()
      } else {
        setHasCastSpellThisTurn(true)
        // Free action: sync spell state only (turn unchanged)
        localMoveRef.current = true
        const wasWritten = await runTransaction(db, async (transaction) => {
          const ref = doc(db, 'games', gameDocId)
          const freshDoc = await transaction.get(ref)
          const freshData = freshDoc.data()
          if (!freshData) return false
          if (freshData.turn !== preMoveTurn) return false
          transaction.update(ref, { spell_state_json: newSsj })
          return true
        })
        if (!wasWritten) {
          localMoveRef.current = false
          // Rollback optimistic update: gameRef already has the new state,
          // but the transaction didn't write. We keep the local state
          // and wait for the next snapshot from the actual game state.
        } else {
          localMoveRef.current = false
        }
      }

      soundManager.play('move')
      return true
    } catch {
      localMoveRef.current = false
      addToast('Ошибка при применении заклинания', 'error')
      return false
    }
  }, [isMyTurn, gameDocId, gameOver, hasCastSpellThisTurn, updateGameState, addToast])

  return {
    game,
    status,
    moveHistory,
    lastMove,
    checkSquare,
    isMyTurn,
    playerColor,
    opponentName,
    opponentJoined,
    gameMode,
    visibleSquares,
    loading,
    error,
    gameOver,
    resultText,
    winnerColor,
    endGameState,
    gameDocId,
    whiteTimeLeft: timer.whiteTimeLeft,
    blackTimeLeft: timer.blackTimeLeft,
    lastTimerUpdate: timer.lastTimerUpdate,
    timerStatus: timer.timerStatus,
    timeControl: timer.timeControl,
    flagTimeoutNow: timer.flagTimeoutNow,
    undoRequest: requests.undoRequest,
    drawRequest: requests.drawRequest,
    rematchGameId: rematch.rematchGameId,
    isRematchProposed: rematch.isRematchProposed,
    makeMove,
    handleResign,
    handleRematch: () => rematch.handleRematch(playerColor),
    handleDeclineRematch: rematch.handleDeclineRematch,
    goToRematch: rematch.goToRematch,
    handleAcceptUndo: () => requests.handleAcceptUndo(gameMode),
    handleRejectUndo: requests.handleRejectUndo,
    handleAcceptDraw: requests.handleAcceptDraw,
    updateGameState,
    setGameOver,
    setResultText,
    setWinnerColor,
    setEndGameState,
    setVisibleSquares,
    // Spell-specific
    spellStateJson,
    hasCastSpellThisTurn,
    castSpell: gameMode === 'spell_chess' ? castSpell : null,
  }
}
