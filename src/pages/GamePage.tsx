import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Chess, type Move } from 'chess.js'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/realtime-js'
import { useAuth } from '@/hooks/useAuth'
import { useBoardWidth } from '@/hooks/useBoardWidth'
import { useReactionStore, type Reaction } from '@/stores/reactionStore'
import { useBoardStore } from '@/stores/boardStore'
import { soundManager } from '@/lib/soundManager'
import ChessBoard from '@/components/board/ChessBoard'
import Button from '@/components/Button'
import SettingsDropdown from '@/components/SettingsDropdown'
import UserMenu from '@/components/UserMenu'
import ReactionPicker from '@/components/ReactionPicker'
import { useToast } from '@/components/Toast'
import RequestModal from '@/components/RequestModal'
import Card from '@/components/Card'
import Footer from '@/components/Footer'
import type { GameStatus, GameData } from '@/types'

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export default function GamePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { getPieceUrl } = useBoardStore()
  const { roomCode } = useParams<{ roomCode: string }>()

  const [game, setGame] = useState(new Chess())
  const [status, setStatus] = useState<GameStatus>('playing')
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoves, setLegalMoves] = useState<string[]>([])
  const [moveHistory, setMoveHistory] = useState<string[]>([])
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [checkSquare, setCheckSquare] = useState<string | null>(null)
  const [isMyTurn, setIsMyTurn] = useState(false)
  const [playerColor, setPlayerColor] = useState<'w' | 'b' | null>(null)
  const [opponentName, setOpponentName] = useState('')
  const [gameId, setGameId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gameOver, setGameOver] = useState(false)
  const [resultText, setResultText] = useState('')
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [reactionSquare, setReactionSquare] = useState<string | null>(null)
  const [reactionPos, setReactionPos] = useState<{ x: number; y: number } | null>(null)
  const [opponentJoined, setOpponentJoined] = useState(false)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null)
  const { addToast } = useToast()
  
  const [showUndoConfirm, setShowUndoConfirm] = useState(false)
  const [showDrawConfirm, setShowDrawConfirm] = useState(false)
  const [showResignConfirm, setShowResignConfirm] = useState(false)

  const [undoRequest, setUndoRequest] = useState<GameData['undo_request']>(null)
  const [drawRequest, setDrawRequest] = useState<GameData['draw_request']>(null)
  const [rematchRequest, setRematchRequest] = useState<GameData['rematch_request']>(null)
  
  const addReaction = useReactionStore((s) => s.addReaction)

  const boardContainerRef = useRef<HTMLDivElement>(null)
  const { stableWidth } = useBoardWidth(boardContainerRef, !loading)
  const gameRef = useRef(game)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const lastPgnRef = useRef('')
  const opponentJoinedRef = useRef(false)

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

  const checkPromotion = (from: string, to: string): boolean => {
    const piece = game.get(from as any)
    if (piece?.type !== 'p') return false
    if (piece.color === 'w' && to[1] === '8') return true
    if (piece.color === 'b' && to[1] === '1') return true
    return false
  }

  const updateGameState = useCallback((g: Chess) => {
    setGame(g)
    gameRef.current = g
    setStatus(
      g.isCheckmate() ? 'checkmate'
        : g.isStalemate() ? 'stalemate'
        : g.isDraw() ? 'draw'
        : g.inCheck() ? 'check'
        : 'playing'
    )
    setMoveHistory(g.history())
    setLastMove(null)
    setCheckSquare(getCheckSquare(g))
    setSelectedSquare(null)
    setLegalMoves([])
  }, [])

  // Load game from Supabase
  useEffect(() => {
    if (!user || !supabase || !roomCode) {
      return
    }

    const sb = supabase!
    let cancelled = false

    const load = async () => {
      try {
        const { data, error: fetchError } = await sb
          .from('games')
          .select('id,room_code,pgn,game_state,turn,message,winner,white_player_id,black_player_id,white_name,black_name,undo_request,draw_request,rematch_request,reactions')
          .eq('room_code', roomCode)
          .maybeSingle()

        if (fetchError || !data) {
          if (!cancelled) {
            setError(fetchError ? 'Комната не найдена' : 'Не удалось загрузить игру')
            setLoading(false)
          }
          return
        }

        if (cancelled) return
        setGameId(data.id)
        
        // Load initial requests
        setUndoRequest(data.undo_request)
        setDrawRequest(data.draw_request)
        setRematchRequest(data.rematch_request)

        if (data.white_player_id === user.uid) {
          setPlayerColor('w')
          setOpponentName(data.black_name || '')
          setOpponentJoined(!!data.black_player_id)
          opponentJoinedRef.current = !!data.black_player_id
          setIsMyTurn(data.turn === 'w')
        } else if (data.black_player_id === user.uid) {
          setPlayerColor('b')
          setOpponentName(data.white_name || '')
          setOpponentJoined(!!data.white_player_id)
          opponentJoinedRef.current = !!data.white_player_id
          setIsMyTurn(data.turn === 'b')
        } else if (!data.black_player_id || !data.white_player_id) {
          // Try atomic RPC first, fall back to direct UPDATE
          let joined = false
          let joinColor: 'w' | 'b' = 'b'
          let joinOpponent = ''

          // Try RPC
          const { data: joinResult, error: joinError } = await sb.rpc(
            'join_game_player_with_color',
            {
              p_room_code: roomCode,
              p_uid: user.uid,
              p_name: user.displayName,
            }
          )

          if (!joinError && joinResult) {
            let parsed: any
            try { parsed = JSON.parse(typeof joinResult === 'string' ? joinResult : JSON.stringify(joinResult)) } catch { parsed = joinResult }
            if (parsed && !parsed.error) {
              joined = true
              joinColor = (parsed.color || 'b') as 'w' | 'b'
              joinOpponent = parsed.opponent_name || ''
            }
          }

          // Fallback: direct UPDATE if RPC failed (e.g., PostgREST cache miss)
          if (!joined) {
            if (!data.black_player_id) {
              const { error: updateError } = await sb
                .from('games')
                .update({
                  black_player_id: user.uid,
                  black_name: user.displayName,
                })
                .eq('id', data.id)
              if (!updateError) {
                joined = true
                joinColor = 'b'
                joinOpponent = data.white_name || ''
              }
            } else if (!data.white_player_id) {
              const { error: updateError } = await sb
                .from('games')
                .update({
                  white_player_id: user.uid,
                  white_name: user.displayName,
                })
                .eq('id', data.id)
              if (!updateError) {
                joined = true
                joinColor = 'w'
                joinOpponent = data.black_name || ''
              }
            }
          }

          if (!joined) {
            if (!cancelled) {
              setError('Не удалось присоединиться к игре')
              setLoading(false)
            }
            return
          }

          if (!cancelled) {
            setPlayerColor(joinColor)
            setOpponentName(joinOpponent)
            setOpponentJoined(false)
            opponentJoinedRef.current = false
            setIsMyTurn(joinColor === 'w')
          }
        } else {
          if (!cancelled) {
            setError('Комната уже заполнена')
            setLoading(false)
          }
          return
        }

        if (cancelled) return

        const g = new Chess()
        if (data.pgn) {
          g.loadPgn(data.pgn)
        }
        lastPgnRef.current = g.pgn()
        updateGameState(g)
        setLoading(false)

        if (data.game_state === 'game_over') {
          setGameOver(true)
          setResultText(
            data.message === 'resign'
              ? `${data.winner === 'white' ? 'Чёрные' : 'Белые'} сдались`
              : data.message === 'draw' ? 'Ничья'
              : data.winner === 'white' ? 'Белые победили'
              : data.winner === 'black' ? 'Чёрные победили'
              : 'Игра окончена'
          )
        }
      } catch (err) {
        console.error('[Game] Load exception:', err)
        if (!cancelled) {
          setError('Ошибка загрузки игры')
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
      if (channelRef.current) {
        supabase?.removeChannel(channelRef.current)
      }
    }
  }, [roomCode, user, updateGameState])

  // Subscribe to Realtime
  useEffect(() => {
    if (!gameId || !supabase) return

    const channel = supabase
      .channel(`game-${gameId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload: any) => {
          const newData = payload.new
          console.log('[Realtime] Update received:', newData)

          if (playerColor === 'w' && newData.black_player_id && !opponentJoinedRef.current) {
            setOpponentJoined(true)
            opponentJoinedRef.current = true
            setOpponentName(newData.black_name || 'Соперник')
            setIsMyTurn(newData.turn === 'w')
          }
          if (playerColor === 'b' && newData.white_player_id && !opponentJoinedRef.current) {
            setOpponentJoined(true)
            opponentJoinedRef.current = true
            setOpponentName(newData.white_name || 'Соперник')
            setIsMyTurn(newData.turn === 'b')
          }

          if (newData.game_state === 'game_over' && !gameOver) {
            setGameOver(true)
            setResultText(
              newData.message === 'resign'
                ? `${newData.winner === 'white' ? 'Чёрные' : 'Белые'} сдались`
                : newData.message === 'draw' ? 'Ничья'
                : newData.winner === 'white' ? 'Белые победили'
                : newData.winner === 'black' ? 'Чёрные победили'
                : 'Игра окончена'
            )
            return
          }

          if (newData.pgn && newData.pgn !== lastPgnRef.current) {
            const g = new Chess()
            try {
              g.loadPgn(newData.pgn)
              updateGameState(g)
              lastPgnRef.current = g.pgn()
              setIsMyTurn(newData.turn === playerColor)
              soundManager.play('move')
              useReactionStore.getState().resetMoveCounter()
            } catch { /* ignore */ }
          }

          if (newData.undo_request !== undefined) setUndoRequest(newData.undo_request)
          if (newData.draw_request !== undefined) setDrawRequest(newData.draw_request)
          if (newData.rematch_request !== undefined) setRematchRequest(newData.rematch_request)

          if (newData.reactions && Array.isArray(newData.reactions)) {
            const currentReactions = useReactionStore.getState().reactions
            if (newData.reactions.length > currentReactions.length && user) {
              const latest = newData.reactions[newData.reactions.length - 1]
              if (latest.playerId !== user.uid) {
                addReaction(latest)
              }
            }
          }

          if (newData.turn && playerColor) {
            setIsMyTurn(newData.turn === playerColor)
          }
        }
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      supabase?.removeChannel(channel)
    }
  }, [gameId, user, playerColor, updateGameState, gameOver])

  const makeMove = useCallback((from: string, to: string, promotion?: string) => {
    if (!isMyTurn || !gameId || gameOver || !supabase) return false

    const g = new Chess()
    if (gameRef.current.pgn()) {
      g.loadPgn(gameRef.current.pgn())
    }

    try {
      const result = g.move({ from, to, promotion })
      if (!result) return false

      const newPgn = g.pgn()
      lastPgnRef.current = newPgn
      const prevPgn = gameRef.current.pgn()
      const wasMyTurn = isMyTurn
      updateGameState(g)
      setIsMyTurn(false)

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
      }

      if (gameOverNow) {
        updateData.game_state = 'game_over'
        updateData.winner = winner
        updateData.message = isCheckmate ? 'checkmate'
          : isStalemate ? 'stalemate'
          : 'draw'
      }

      // Sync to Supabase with retry (async, doesn't block UI)
      ;(async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          const { error } = await supabase!.from('games').update(updateData).eq('id', gameId!)
          if (!error) {
            useReactionStore.getState().resetMoveCounter()
            return
          }
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
          }
        }
        // All retries failed — rollback local state
        try {
          const rollback = new Chess()
          if (prevPgn) rollback.loadPgn(prevPgn)
          updateGameState(rollback)
          lastPgnRef.current = prevPgn || ''
          setIsMyTurn(wasMyTurn)
          addToast('Ошибка синхронизации хода. Попробуйте ещё раз.', 'error')
        } catch { /* ignore rollback errors */ }
      })()

      if (!gameOverNow) {
        soundManager.play(result.captured ? 'capture' : 'move')
      } else {
        soundManager.play('checkmate')
      }

      return true
    } catch {
      return false
    }
  }, [isMyTurn, gameId, gameOver, supabase, updateGameState, addToast])

  const onDrop = useCallback((from: string, to: string) => {
    if (!isMyTurn || gameOver) return false
    
    if (checkPromotion(from, to)) {
      if (legalMoves.includes(to)) {
        setPendingPromotion({ from, to })
        return true
      }
    }
    
    return makeMove(from, to)
  }, [makeMove, isMyTurn, gameOver, legalMoves])

  const onSquareClick = useCallback((square: string) => {
    if (gameOver || !isMyTurn) return

    const g = gameRef.current
    const piece = g.get(square as any)

    if (selectedSquare) {
      const isLegal = legalMoves.includes(square)
      if (isLegal) {
        const movingPiece = g.get(selectedSquare as any)
        if (movingPiece && movingPiece.type === 'p' && (square[1] === '8' || square[1] === '1')) {
          setPendingPromotion({ from: selectedSquare, to: square })
          return
        }
        makeMove(selectedSquare, square)
        return
      }
      if (piece && piece.color === playerColor) {
        const moves = g.moves({ square: square as any, verbose: true }) as Move[]
        setSelectedSquare(square)
        setLegalMoves(moves.map((m) => m.to))
        return
      }
      setSelectedSquare(null)
      setLegalMoves([])
      return
    }

    if (piece && piece.color === playerColor) {
      const moves = g.moves({ square: square as any, verbose: true }) as Move[]
      setSelectedSquare(square)
      setLegalMoves(moves.map((m) => m.to))
    }
  }, [gameOver, isMyTurn, selectedSquare, legalMoves, playerColor, makeMove])

  const handleResign = async () => {
    if (!gameId || !supabase || !playerColor || gameOver) return
    try {
      await supabase.from('games').update({
        game_state: 'game_over',
        winner: playerColor === 'w' ? 'black' : 'white',
        message: 'resign',
      }).eq('id', gameId)
      setGameOver(true)
      setResultText('Вы сдались')
    } catch {
      addToast('Ошибка при сдаче', 'error')
    }
  }

  const handleReactionSquare = (square: string, clientX: number, clientY: number) => {
    setReactionSquare(square)
    setReactionPos({ x: clientX, y: clientY })
    setShowReactionPicker(true)
  }

  const localReactionsRef = useRef<Reaction[]>([])

  const handleEmojiSelect = async (emojiUrl: string) => {
    if (!gameId || !user || !supabase || !reactionSquare || !playerColor) return

    const reaction: Reaction = {
      id: generateId(),
      square: reactionSquare,
      emojiUrl,
      playerId: user.uid,
      createdAt: Date.now(),
    }

    const result = useReactionStore.getState().addReaction(reaction, playerColor)
    if (result === 'limit_reached') {
      addToast('Не более 5 реакций за ход', 'warning')
      return
    }
    if (result !== 'ok') return
    setShowReactionPicker(false)
    setReactionSquare(null)

    try {
      // Track locally and write directly — no SELECT needed
      localReactionsRef.current = [...localReactionsRef.current, reaction].slice(-20)
      await supabase.from('games').update({
        reactions: localReactionsRef.current,
      }).eq('id', gameId)
    } catch {
      addToast('Ошибка отправки реакции', 'error')
    }
  }

  const handleUndoRequest = async () => {
    if (!gameId || !user || !supabase || gameOver) return
    if (moveHistory.length === 0) return
    try {
      const { error } = await supabase.from('games').update({
        undo_request: { from_id: user.uid, created_at: Date.now() }
      }).eq('id', gameId)
      if (error) addToast('Ошибка при отправке запроса', 'error')
    } catch {
      addToast('Ошибка при отправке запроса', 'error')
    }
  }

  const handleAcceptUndo = async () => {
    if (!gameId || !user || !supabase || !undoRequest) return
    try {
      const g = new Chess()
      g.loadPgn(lastPgnRef.current)
      g.undo()
      g.undo()
      
      const newPgn = g.pgn()
      const newFen = g.fen()
      
      await supabase.from('games').update({
        pgn: newPgn,
        fen: newFen,
        turn: g.turn(),
        undo_request: null
      }).eq('id', gameId)
      
      updateGameState(g)
      lastPgnRef.current = newPgn
      setUndoRequest(null)
    } catch {
      addToast('Ошибка при отмене хода', 'error')
    }
  }

  const handleRejectUndo = async () => {
    if (!gameId || !supabase) return
    try {
      await supabase.from('games').update({ undo_request: null }).eq('id', gameId)
      setUndoRequest(null)
    } catch {
      addToast('Ошибка сети', 'error')
    }
  }

  const handleDrawRequest = async () => {
    if (!gameId || !user || !supabase || gameOver || !opponentJoined) return
    try {
      await supabase.from('games').update({
        draw_request: { from_id: user.uid, created_at: Date.now() }
      }).eq('id', gameId)
    } catch {
      addToast('Ошибка при предложении ничьей', 'error')
    }
  }

  const handleAcceptDraw = async () => {
    if (!gameId || !supabase || !drawRequest) return
    try {
      await supabase.from('games').update({
        game_state: 'game_over',
        winner: null,
        message: 'draw',
        draw_request: null
      }).eq('id', gameId)
      setDrawRequest(null)
    } catch {
      addToast('Ошибка при принятии ничьей', 'error')
    }
  }

  const handleRejectDraw = async () => {
    if (!gameId || !supabase) return
    try {
      await supabase.from('games').update({ draw_request: null }).eq('id', gameId)
      setDrawRequest(null)
    } catch {
      addToast('Ошибка сети', 'error')
    }
  }

  const handleRematchRequest = async () => {
    if (!gameId || !user || !supabase || !gameOver) return
    try {
      const newCode = Math.random().toString(36).slice(2, 8).toUpperCase()
      await supabase.from('games').update({
        rematch_request: { from_id: user.uid, proposed_room_id: newCode, created_at: Date.now() }
      }).eq('id', gameId)
    } catch {
      addToast('Ошибка при запросе реванша', 'error')
    }
  }

  const handleAcceptRematch = async () => {
    if (!gameId || !user || !supabase || !rematchRequest) return
    
    const newRoomCode = rematchRequest.proposed_room_id
    
    try {
      // Clear rematch_request first, then create new game
      await supabase.from('games').update({ rematch_request: null }).eq('id', gameId)
      
      const { error: insertError } = await supabase.from('games').insert({
        room_code: newRoomCode,
        white_player_id: playerColor === 'b' ? user.uid : null,
        white_name: playerColor === 'b' ? user.displayName : '',
        black_player_id: playerColor === 'w' ? user.uid : null,
        black_name: playerColor === 'w' ? user.displayName : '',
        game_type: 'online',
        pgn: new Chess().pgn(),
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        turn: 'w',
        game_state: 'playing',
      })

      if (insertError) {
        console.error('Rematch error:', insertError)
        addToast('Ошибка при создании реванша', 'error')
        return
      }

      setRematchRequest(null)
      navigate(`/game/${newRoomCode}`)
    } catch {
      addToast('Ошибка при создании реванша', 'error')
    }
  }

  const handleRejectRematch = async () => {
    if (!gameId || !supabase) return
    try {
      await supabase.from('games').update({ rematch_request: null }).eq('id', gameId)
      setRematchRequest(null)
    } catch {
      addToast('Ошибка сети', 'error')
    }
  }

  const statusClasses: Record<string, string> = {
    checkmate: 'text-[var(--danger)]',
    stalemate: 'text-text-secondary',
    draw: 'text-text-secondary',
    check: 'text-[var(--danger)]',
    playing: isMyTurn ? 'text-[var(--accent-brand)]' : 'text-text-secondary',
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-bg">
        <p className="text-text-secondary text-[var(--font-size-sm)] animate-pulse">Загрузка игры...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-bg">
        <div className="text-center space-y-[var(--space-16)]">
          <p className="text-[var(--danger)] text-[var(--font-size-sm)]">{error}</p>
          <Button onClick={() => navigate('/')}>В лобби</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-bg">
      <header className="px-[var(--space-24)] py-[var(--space-32)] bg-bg">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-[var(--space-12)]">
          <Link to="/">
            <img
              src={`${import.meta.env.BASE_URL || '/'}logo/gochess_wordmark_dark.svg`}
              alt="GoChess"
              className="h-[28px] w-auto"
            />
          </Link>
          <div className="flex items-center gap-[var(--space-12)]">
            <SettingsDropdown />
            {user && <UserMenu />}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-[var(--space-24)] py-[var(--space-48)] flex-1 w-full">
        <div className="game-layout-container">
            <div className="game-main-column">
              <div 
                className="mx-auto mb-[var(--space-12)] grid grid-cols-3 items-center px-[var(--space-8)]"
                style={{ width: stableWidth || '100%', maxWidth: '100%' }}
              >
                {/* Left: Opponent Info */}
                <div className="flex items-center gap-[var(--space-8)] text-[var(--font-size-sm)] font-bold">
                  <img 
                    src={`${import.meta.env.BASE_URL || '/'}emojis/multi_new.png`} 
                    alt="vs" 
                    className="w-5 h-5 object-contain opacity-90"
                  />
                  <span className={`truncate ${!opponentJoined ? 'text-text-secondary animate-pulse' : 'text-[var(--accent-brand)]'}`}>
                    {opponentJoined ? (opponentName || 'Соперник') : 'Ожидание соперника...'}
                  </span>
                </div>

                {/* Center: Notifications (Check, Results) */}
                <div className="text-center flex justify-center">
                  {(status === 'check' || status === 'checkmate' || status === 'stalemate' || status === 'draw') && (
                    <h2 className={`text-[10px] font-bold ${statusClasses[status]} uppercase tracking-[0.2em] animate-pulse`}>
                      {status === 'check' ? 'Шах!' : status === 'checkmate' ? 'Мат!' : 'Ничья'}
                    </h2>
                  )}
                </div>

                {/* Right: Turn Status */}
                <div className="text-right">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${
                    isMyTurn ? 'text-[var(--accent-brand)] animate-pulse' : 'text-text opacity-60'
                  }`}>
                    {isMyTurn ? 'Ваш ход' : 'Ход соперника'}
                  </span>
                </div>
              </div>

              <div ref={boardContainerRef} className="board-container">
                {stableWidth > 0 ? (
                  <>
                    <ChessBoard
                      game={game}
                      lastMove={lastMove}
                      checkSquare={checkSquare}
                      selectedSquare={selectedSquare}
                      legalMoves={legalMoves}
                      onDrop={onDrop}
                      onSquareClick={onSquareClick}
                      onReactionSquare={handleReactionSquare}
                      boardWidth={stableWidth}
                      boardOrientation={playerColor === 'w' ? 'white' : 'black'}
                    />

                    {/* Promotion Overlay */}
                    {pendingPromotion && (() => {
                      const square = pendingPromotion.to
                      const col = square[0].charCodeAt(0) - 97
                      const rank = parseInt(square[1])
                      
                      let leftIdx = col
                      let isAtTop = rank === 8
                      
                      if (playerColor === 'b') {
                        leftIdx = 7 - col
                        isAtTop = rank === 1
                      }

                      return (
                        <div
                          className="absolute inset-0 z-[100] cursor-default bg-black/10"
                          onClick={() => setPendingPromotion(null)}
                        >
                          <div 
                            className="absolute flex flex-col shadow-2xl shadow-black/80 overflow-hidden animate-modal-pixel-in"
                            style={{
                              left: `${leftIdx * 12.5}%`,
                              top: isAtTop ? 0 : 'auto',
                              bottom: isAtTop ? 'auto' : 0,
                              width: '12.5%',
                              height: '50%',
                              backgroundColor: 'rgba(18, 20, 18, 0.96)',
                              border: '1px solid rgba(255, 255, 255, 0.12)',
                              borderRadius: 'var(--radius-14)',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {(['q', 'r', 'b', 'n'] as const).map((piece) => {
                              const code = `${playerColor}${piece.toUpperCase()}` as const
                              return (
                                <button
                                  key={piece}
                                  onClick={() => {
                                    makeMove(pendingPromotion.from, pendingPromotion.to, piece)
                                    setPendingPromotion(null)
                                    onSquareClick(pendingPromotion.to)
                                  }}
                                  className="flex-1 flex items-center justify-center transition-colors group"
                                  style={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(232, 232, 216, 0.08)'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
                                  }}
                                >
                                  <img
                                    src={getPieceUrl(code)}
                                    alt={piece}
                                    className="w-[85%] h-[85%] object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] group-hover:scale-110 transition-transform"
                                    draggable={false}
                                  />
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center animate-pulse">
                    <div className="text-[var(--font-size-xs)] text-text-secondary opacity-50 text-center p-4">
                      Загрузка доски...
                    </div>
                  </div>
                )}
              </div>

                {gameOver ? (
                  <div className="mt-[var(--space-16)] text-center space-y-[var(--space-12)]">
                    <p className={`text-[var(--font-size-lg)] font-bold ${
                      resultText === 'Ничья' || resultText === 'Вы сдались'
                        ? 'text-text-secondary'
                        : 'text-[var(--accent-brand)]'
                    }`}>
                      {resultText}
                    </p>
                    <div className="flex justify-center gap-[var(--space-12)]">
                      <Button variant="primary" onClick={handleRematchRequest}>
                        Реванш
                      </Button>
                      <Button variant="outline" onClick={() => navigate('/')}>
                        В лобби
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div 
                    className="mx-auto mt-[var(--space-12)] flex justify-between gap-[var(--space-12)]"
                    style={{ width: stableWidth || '100%', maxWidth: '100%' }}
                  >
                    <Button variant="outline" size="sm" onClick={() => setShowUndoConfirm(true)} className="flex-1 max-w-[160px]">
                      Отмена хода
                    </Button>
                    <div className="flex gap-[var(--space-12)] flex-1 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setShowDrawConfirm(true)} className="flex-1 max-w-[120px]">
                        Ничья
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setShowResignConfirm(true)} className="flex-1 max-w-[120px]">
                        Сдаться
                      </Button>
                    </div>
                  </div>
                )}
            </div>

            <div className="game-side-column">
              <Card padding="sm" className="mb-[var(--space-16)]">
                <h3 className="text-[var(--font-size-sm)] font-semibold mb-[var(--space-12)] text-text">
                  История ходов
                </h3>
                <div
                  className="max-h-[350px] overflow-y-auto space-y-1 text-[var(--font-size-xs)]"
                  style={{ background: 'var(--bg)', borderRadius: 'var(--radius-8)', padding: 'var(--space-12)' }}
                >
                  {moveHistory.length === 0 ? (
                    <p className="text-text-secondary text-center py-[var(--space-16)]">Нет ходов</p>
                  ) : (
                    moveHistory.map((move, i) => (
                      <span key={i} className="inline-block mr-[var(--space-8)]">
                        {i % 2 === 0 && (
                          <span className="text-text-secondary mr-[var(--space-4)]">{Math.floor(i / 2) + 1}.</span>
                        )}
                        <span className="text-text">{move}</span>
                      </span>
                    ))
                  )}
                </div>
              </Card>

              {!opponentJoined && (
                <Card padding="sm" className="animate-modal-pixel-in">
                  <h3 className="text-[10px] font-bold text-[var(--accent-brand)] uppercase tracking-widest mb-[var(--space-16)]">
                    Пригласить друга
                  </h3>
                  
                  <div 
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href)
                      useReactionStore.getState().addReaction({
                        id: generateId(),
                        square: 'h1',
                        emojiUrl: `${import.meta.env.BASE_URL || '/'}emojis/Emojis_48x48_87.png`,
                        playerId: user?.uid || '',
                        createdAt: Date.now()
                      })
                    }}
                    className="group relative flex items-center h-[44px] px-3 rounded-[var(--radius-8)] border border-[var(--border)] mb-3 bg-[var(--bg)] cursor-pointer hover:border-[rgba(232,232,216,0.3)] transition-all"
                    title="Нажми, чтобы скопировать"
                  >
                    <input
                      type="text"
                      readOnly
                      value={window.location.href}
                      className="flex-1 bg-transparent text-[10px] text-text-secondary outline-none truncate cursor-pointer group-hover:text-text transition-colors"
                    />
                    <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity text-[8px] uppercase font-bold text-[var(--accent-brand)] bg-[var(--bg)] px-1">
                      Копировать
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent('Сыграем в шахматы?')}`, '_blank')}
                      className="text-[8px] uppercase tracking-[0.15em] font-bold"
                    >
                      телеграм
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => window.open(`https://vk.com/share.php?url=${encodeURIComponent(window.location.href)}`, '_blank')}
                      className="text-[8px] uppercase tracking-[0.15em] font-bold"
                    >
                      вконтакте
                    </Button>
                  </div>
                </Card>
              )}
            </div>
        </div>
      </main>

      {/* Global Modals/Overlays */}
      {showReactionPicker && reactionPos && (
        <ReactionPicker
          onSelect={handleEmojiSelect}
          onClose={() => {
            setShowReactionPicker(false)
            setReactionSquare(null)
          }}
          boardWidth={stableWidth}
          anchorX={reactionPos.x}
          anchorY={reactionPos.y}
        />
      )}

      {/* Request Modals */}
      {showUndoConfirm && (
        <RequestModal
          isOpen={true}
          title="Отмена хода"
          description="Вы уверены, что хотите предложить отмену хода?"
          acceptText="Предложить"
          onAccept={() => { handleUndoRequest(); setShowUndoConfirm(false) }}
          onReject={() => setShowUndoConfirm(false)}
        />
      )}

      {showDrawConfirm && (
        <RequestModal
          isOpen={true}
          title="Ничья"
          description="Вы уверены, что хотите предложить ничью?"
          acceptText="Предложить"
          onAccept={() => { handleDrawRequest(); setShowDrawConfirm(false) }}
          onReject={() => setShowDrawConfirm(false)}
        />
      )}

      {showResignConfirm && (
        <RequestModal
          isOpen={true}
          title="Сдаться"
          description="Вы уверены, что хотите признать поражение?"
          acceptText="Да, сдаться"
          onAccept={() => { handleResign(); setShowResignConfirm(false) }}
          onReject={() => setShowResignConfirm(false)}
        />
      )}

      {undoRequest && undoRequest.from_id !== user?.uid && (
        <RequestModal
          isOpen={true}
          title="Отмена хода"
          description="Соперник просит отменить последний ход. Вы согласны?"
          onAccept={handleAcceptUndo}
          onReject={handleRejectUndo}
        />
      )}

      {drawRequest && drawRequest.from_id !== user?.uid && (
        <RequestModal
          isOpen={true}
          title="Предложение ничьи"
          description="Соперник предлагает закончить партию вничью."
          onAccept={handleAcceptDraw}
          onReject={handleRejectDraw}
        />
      )}

      {rematchRequest && rematchRequest.from_id !== user?.uid && (
        <RequestModal
          isOpen={true}
          title="Реванш"
          description="Соперник предлагает сыграть еще раз."
          onAccept={handleAcceptRematch}
          onReject={handleRejectRematch}
        />
      )}

      <Footer />
    </div>
  )
}
