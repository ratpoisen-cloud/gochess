import { useState, useEffect, useRef, useCallback } from 'react'
import { createEngine, type EngineAPI } from '@/lib/engine'
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

export function useGameSync(roomCode: string | undefined, user: User | null, authLoading: boolean) {
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
  const rematch = useRematch(gameDocId, user, (gameId) => {
    window.location.href = `/game/${gameId}`
  })

  const addReaction = useReactionStore((s) => s.addReaction)

  // Refs
  const gameRef = useRef(game)
  const lastPgnRef = useRef('')
  const opponentJoinedRef = useRef(false)
  const localMoveRef = useRef(false)

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
    return data.message === 'resign'
      ? `${data.winner === 'white' ? 'Чёрные' : 'Белые'} сдались`
      : data.message === 'draw' ? 'Ничья'
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
    timer.setTimerFromSnapshot(newData, myColor)

    // Game over
    if (newData.game_state === 'game_over') {
      if (!gameOver) {
        setGameOver(true)
        setResultText(parseResult(newData))
        setWinnerColor(null)
        if (newData.game_mode !== 'fog_of_war') {
          soundManager.play('checkmate')
        }

        const currentGame = createEngine()
        if (newData.pgn) {
          try { currentGame.loadPgn(newData.pgn) } catch {
            if (newData.fen) currentGame.load(newData.fen)
          }
        } else if (newData.fen) {
          currentGame.load(newData.fen)
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

    // Sync PGN
    if (newData.pgn && newData.pgn !== lastPgnRef.current) {
      const g = createEngine()
      try {
        g.loadPgn(newData.pgn)
        updateGameState(g)
        lastPgnRef.current = g.pgn()

        if (!localMoveRef.current) {
          soundManager.play('move')
          useReactionStore.getState().resetMoveCounter()
        }
        localMoveRef.current = false

        setVisibleSquares(
          newData.game_mode === 'fog_of_war' && myColor
            ? getVisibleSquares(g, myColor)
            : null,
        )
      } catch {
        // PGN parse error, ignore
      }
    } else if (!newData.pgn && lastPgnRef.current !== '') {
      const g = createEngine()
      updateGameState(g)
      lastPgnRef.current = ''
      setVisibleSquares(
        newData.game_mode === 'fog_of_war' && myColor
          ? getVisibleSquares(g, myColor)
          : null,
      )
    }

    // Turn
    if (newData.turn) {
      setIsMyTurn(newData.turn === myColor)
    }

    // Requests
    requests.setRequestsFromSnapshot(newData)

    // Rematch
    rematch.setRematchFromSnapshot(newData, user)

    // Reactions
    if (newData.reactions && Array.isArray(newData.reactions)) {
      const currentReactions = useReactionStore.getState().reactions
      if (newData.reactions.length > currentReactions.length) {
        const latest = newData.reactions[newData.reactions.length - 1]
        if (latest.playerId !== user?.uid) {
          addReaction(latest)
        }
      }
    }

    setLoading(false)
  }, [gameOver, user, addReaction, updateGameState, gameDocId, timer, requests, rematch])

  // 1. Room initialisation
  useRoomJoin(roomCode, user, authLoading, setGameDocId, setError, setLoading)

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

    const g = createEngine()
    if (gameRef.current.pgn()) {
      g.loadPgn(gameRef.current.pgn())
    }

    try {
      const result = g.move({ from, to, promotion })
      if (!result) return false

      const newPgn = g.pgn()
      const prevPgn = lastPgnRef.current
      const wasMyTurn = isMyTurn

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

          if (freshData.turn !== g.turn() && !gameOverNow) {
            return 'stale'
          }

          transaction.update(gameRef2, updateData)
          return 'ok'
        })

        if (txnResult === 'stale') {
          localMoveRef.current = false
          const rollback = createEngine()
          if (prevPgn) rollback.loadPgn(prevPgn)
          updateGameState(rollback)
          lastPgnRef.current = prevPgn
          setIsMyTurn(wasMyTurn)
          if (gameMode === 'fog_of_war' && playerColor) {
            setVisibleSquares(getVisibleSquares(rollback, playerColor))
          }
          return false
        }

        useReactionStore.getState().resetMoveCounter()

        if (!gameOverNow) {
          soundManager.play(result.captured ? 'capture' : 'move')
        } else if (gameMode !== 'fog_of_war') {
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
    undoRequest: requests.undoRequest,
    drawRequest: requests.drawRequest,
    rematchGameId: rematch.rematchGameId,
    isRematchProposed: rematch.isRematchProposed,
    makeMove,
    handleResign,
    handleRematch: () => rematch.handleRematch(playerColor),
    handleAcceptUndo: () => requests.handleAcceptUndo(lastPgnRef.current),
    handleRejectUndo: requests.handleRejectUndo,
    handleAcceptDraw: requests.handleAcceptDraw,
    updateGameState,
    setGameOver,
    setResultText,
    setWinnerColor,
    setEndGameState,
    setVisibleSquares,
  }
}
