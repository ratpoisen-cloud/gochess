import { useState, useEffect, useRef, useCallback } from 'react'
import { Chess } from 'chess.js'
import { db } from '@/lib/firebase'
import {
  doc,
  onSnapshot,
  updateDoc,
  collection,
  where,
  query,
  getDocs,
  getDoc,
  runTransaction,
  serverTimestamp,
  limit,
} from 'firebase/firestore'
import { useReactionStore } from '@/stores/reactionStore'
import { getKingSquare } from '@/stores/gameStore'
import { getVisibleSquares } from '@/lib/chessFog'
import { soundManager } from '@/lib/soundManager'
import { useToast } from '@/components/Toast'
import type { GameStatus, GameData, GameMode } from '@/types'

const BASE = import.meta.env.BASE_URL || '/'

export function useGameSync(roomCode: string | undefined, user: any, authLoading: boolean) {
  const { addToast } = useToast()

  // Core game state
  const [game, setGame] = useState(new Chess())
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

  // Timers (rapid mode)
  const [whiteTimeLeft, setWhiteTimeLeft] = useState<number | null>(null)
  const [blackTimeLeft, setBlackTimeLeft] = useState<number | null>(null)
  const [lastTimerUpdate, setLastTimerUpdate] = useState<number | null>(null)
  const [timerStatus, setTimerStatus] = useState<'active' | 'paused' | null>(null)
  const [timeControl, setTimeControl] = useState<GameData['time_control']>(null)

  // Requests
  const [undoRequest, setUndoRequest] = useState<GameData['undo_request']>(null)
  const [drawRequest, setDrawRequest] = useState<GameData['draw_request']>(null)

  // Rematch
  const [isRematchProposed, setIsRematchProposed] = useState(false)
  const [rematchGameId, setRematchGameId] = useState<string | null>(null)

  const addReaction = useReactionStore((s) => s.addReaction)

  // Refs
  const gameRef = useRef(game)
  const lastPgnRef = useRef('')
  const opponentJoinedRef = useRef(false)
  const localMoveRef = useRef(false)

  const getCheckSquare = (g: Chess): string | null => {
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

  const updateGameState = useCallback((g: Chess) => {
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
    if (newData.time_control) {
      setTimeControl(newData.time_control)
      setWhiteTimeLeft(newData.white_time_left ?? null)
      setBlackTimeLeft(newData.black_time_left ?? null)
      setLastTimerUpdate(newData.last_timer_update ?? null)
      setTimerStatus(newData.timer_status ?? null)

      if (newData.game_state !== 'game_over' && newData.timer_status === 'active' && newData.last_timer_update) {
        const now = Date.now()
        const elapsed = now - newData.last_timer_update
        const turn = newData.turn
        const timeLeft = turn === 'w' ? newData.white_time_left : newData.black_time_left

        if (timeLeft !== null && timeLeft !== undefined && (timeLeft - elapsed) <= -1000) {
          if (turn !== myColor && gameDocId) {
            updateDoc(doc(db, 'games', gameDocId), {
              game_state: 'game_over',
              winner: myColor === 'w' ? 'white' : 'black',
              message: 'timeout',
            })
          }
        }
      }
    }

    // Game over
    if (newData.game_state === 'game_over') {
      if (!gameOver) {
        setGameOver(true)
        setResultText(parseResult(newData))
        setWinnerColor(null)
        if (newData.game_mode !== 'fog_of_war') {
          soundManager.play('checkmate')
        }

        const currentGame = new Chess()
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
      setLoading(false)
    } else {
      setGameOver(false)
      setResultText('')
      setEndGameState(null)
      setWinnerColor(null)
      setLoading(false)
    }

    // Sync PGN
    if (newData.pgn && newData.pgn !== lastPgnRef.current) {
      const g = new Chess()
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
      const g = new Chess()
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
    setUndoRequest(newData.undo_request)
    setDrawRequest(newData.draw_request)

    // Rematch
    if (newData.rematch_game_id) {
      setRematchGameId(newData.rematch_game_id)
    } else if (newData.rematch_proposed_by && newData.rematch_proposed_by !== user?.uid) {
      setIsRematchProposed(true)
    }

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
  }, [gameOver, user, addReaction, updateGameState, gameDocId])

  // 1. Room initialisation
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    if (!roomCode) return

    let cancelled = false

    const initRoom = async () => {
      try {
        const docRef = doc(db, 'games', roomCode)
        let docSnap = await getDoc(docRef)

        let gameDoc = null
        let data = null

        if (docSnap.exists()) {
          gameDoc = docSnap
          data = docSnap.data() as GameData
        } else {
          const q = query(collection(db, 'games'), where('room_code', '==', roomCode), limit(1))
          const snapshot = await getDocs(q)
          if (!snapshot.empty) {
            gameDoc = snapshot.docs[0]
            data = gameDoc.data() as GameData
          }
        }

        if (!gameDoc || !data) {
          if (!cancelled) {
            setError('Комната не найдена')
            setLoading(false)
          }
          return
        }

        // Join via transaction
        if (!data.white_player_id && data.black_player_id !== user.uid) {
          await runTransaction(db, async (transaction) => {
            const freshDoc = await transaction.get(gameDoc.ref)
            const freshData = freshDoc.data()
            if (!freshData) return
            if (!freshData.white_player_id && freshData.black_player_id !== user.uid) {
              transaction.update(gameDoc.ref, {
                white_player_id: user.uid,
                white_name: user.displayName || 'Игрок',
              })
            }
          })
        } else if (!data.black_player_id && data.white_player_id !== user.uid) {
          await runTransaction(db, async (transaction) => {
            const freshDoc = await transaction.get(gameDoc.ref)
            const freshData = freshDoc.data()
            if (!freshData) return
            if (!freshData.black_player_id && freshData.white_player_id !== user.uid) {
              transaction.update(gameDoc.ref, {
                black_player_id: user.uid,
                black_name: user.displayName || 'Игрок',
              })
            }
          })
        } else if (data.white_player_id !== user.uid && data.black_player_id !== user.uid) {
          if (!cancelled) {
            setError('Комната уже заполнена')
            setLoading(false)
          }
          return
        }

        if (cancelled) return
        setGameDocId(gameDoc.id)
      } catch {
        if (!cancelled) {
          setError('Ошибка входа в комнату')
          setLoading(false)
        }
      }
    }

    initRoom()
    return () => { cancelled = true }
  }, [roomCode, user, authLoading])

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

  // 3. Rematch redirect
  useEffect(() => {
    if (rematchGameId) {
      addToast('Реванш создан! Переход...', 'success')
      const timer = setTimeout(() => {
        window.location.href = `/game/${rematchGameId}`
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [rematchGameId, addToast])

  // 4. makeMove
  const makeMove = useCallback(async (from: string, to: string, promotion?: string): Promise<boolean> => {
    if (!isMyTurn || !gameDocId || gameOver) return false

    const g = new Chess()
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

      const updateData: any = {
        pgn: newPgn,
        fen: g.fen(),
        turn: g.turn(),
        last_move_time: Date.now(),
      }

      // Rapid time deduction
      if (timeControl && lastTimerUpdate) {
        const now = Date.now()
        const elapsed = now - lastTimerUpdate
        const playerTimeKey = playerColor === 'w' ? 'white_time_left' : 'black_time_left'
        const currentTimeLeft = playerColor === 'w' ? whiteTimeLeft : blackTimeLeft

        if (currentTimeLeft !== null) {
          const timeLeft = Math.max(0, currentTimeLeft - elapsed + (timeControl.increment * 1000))
          updateData[playerTimeKey] = timeLeft
          updateData.last_timer_update = now
          updateData.timer_status = 'active'

          if (timeLeft <= 0) {
            updateData.game_state = 'game_over'
            updateData.winner = playerColor === 'w' ? 'black' : 'white'
            updateData.message = 'timeout'
          }
        }
      } else if (timeControl && !lastTimerUpdate) {
        updateData.last_timer_update = Date.now()
        updateData.timer_status = 'active'
      }

      if (gameOverNow) {
        updateData.game_state = 'game_over'
        updateData.winner = winner
        updateData.message = isCheckmate ? 'checkmate'
          : isStalemate ? 'stalemate'
          : 'draw'
      }

      try {
        localMoveRef.current = true

        // Use transaction to prevent race conditions
        const gameRef2 = doc(db, 'games', gameDocId)
        const txnResult = await runTransaction(db, async (transaction) => {
          const freshDoc = await transaction.get(gameRef2)
          const freshData = freshDoc.data()
          if (!freshData) return 'error'

          // Verify turn hasn't changed (opponent didn't move first)
          if (freshData.turn !== g.turn() && !gameOverNow) {
            return 'stale'
          }

          transaction.update(gameRef2, updateData)
          return 'ok'
        })

        if (txnResult === 'stale') {
          // Opponent moved first — rollback local state
          localMoveRef.current = false
          const rollback = new Chess()
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
        const rollback = new Chess()
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
  }, [isMyTurn, gameDocId, gameOver, updateGameState, addToast, timeControl, lastTimerUpdate, playerColor, whiteTimeLeft, blackTimeLeft, gameMode])

  // 5. Resign
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

  // 6. Rematch
  const handleRematch = useCallback(async () => {
    if (!gameDocId || !user || !playerColor) return

    try {
      await runTransaction(db, async (transaction) => {
        const docRef = doc(db, 'games', gameDocId)
        const freshDoc = await transaction.get(docRef)
        const data = freshDoc.data() as GameData
        if (!data) return

        if (data.rematch_game_id) return

        if (data.rematch_proposed_by && data.rematch_proposed_by !== user.uid) {
          const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
          const newGameData = {
            room_code: newRoomCode,
            white_player_id: data.black_player_id,
            white_name: data.black_name || 'Игрок',
            black_player_id: data.white_player_id,
            black_name: data.white_name || 'Игрок',
            game_type: 'online',
            game_mode: data.game_mode || 'classic',
            pgn: '',
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            game_state: 'active',
            turn: 'w',
            created_at: serverTimestamp(),
            last_move_time: serverTimestamp(),
            reactions: [],
            undo_request: null,
            draw_request: null,
            rematch_proposed_by: null,
            rematch_game_id: null,
          }
          const newGameRef = doc(collection(db, 'games'))
          transaction.set(newGameRef, newGameData)
          transaction.update(docRef, { rematch_game_id: newGameRef.id })
        } else {
          transaction.update(docRef, { rematch_proposed_by: user.uid })
        }
      })

      const snap = await getDoc(doc(db, 'games', gameDocId))
      if (snap.data()?.rematch_proposed_by === user.uid && !snap.data()?.rematch_game_id) {
        addToast('Предложение реванша отправлено', 'info')
      }
    } catch {
      addToast('Ошибка при создании реванша', 'error')
    }
  }, [gameDocId, user, playerColor, addToast])

  // 7. Undo
  const handleAcceptUndo = useCallback(async () => {
    if (!gameDocId || !undoRequest) return
    try {
      const snap = await getDoc(doc(db, 'games', gameDocId))
      const data = snap.data()
      const requestorColor = undoRequest.from_id === data?.white_player_id ? 'w' : 'b'

      const g = new Chess()
      g.loadPgn(lastPgnRef.current)

      if (requestorColor === g.turn()) {
        g.undo()
        g.undo()
      } else {
        g.undo()
      }

      await runTransaction(db, async (transaction) => {
        const gameRef2 = doc(db, 'games', gameDocId)
        const freshDoc = await transaction.get(gameRef2)
        if (!freshDoc.exists()) return
        transaction.update(gameRef2, {
          pgn: g.pgn(),
          fen: g.fen(),
          turn: g.turn(),
          last_move_time: Date.now(),
          undo_request: null,
        })
      })
    } catch {
      addToast('Ошибка при отмене хода', 'error')
    }
  }, [gameDocId, undoRequest, addToast])

  const handleRejectUndo = useCallback(async () => {
    if (!gameDocId) return
    try {
      await updateDoc(doc(db, 'games', gameDocId), { undo_request: null })
    } catch {
      addToast('Ошибка сети', 'error')
    }
  }, [gameDocId, addToast])

  // 8. Draw
  const handleAcceptDraw = useCallback(async () => {
    if (!gameDocId || !drawRequest) return
    try {
      await runTransaction(db, async (transaction) => {
        const gameRef2 = doc(db, 'games', gameDocId)
        const freshDoc = await transaction.get(gameRef2)
        if (!freshDoc.exists()) return
        transaction.update(gameRef2, {
          game_state: 'game_over',
          winner: null,
          message: 'draw',
          draw_request: null,
        })
      })
    } catch {
      addToast('Ошибка при согласии на ничью', 'error')
    }
  }, [gameDocId, drawRequest, addToast])

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
    whiteTimeLeft,
    blackTimeLeft,
    lastTimerUpdate,
    timerStatus,
    timeControl,
    undoRequest,
    drawRequest,
    rematchGameId,
    isRematchProposed,
    makeMove,
    handleResign,
    handleRematch,
    handleAcceptUndo,
    handleRejectUndo,
    handleAcceptDraw,
    updateGameState,
  }
}
