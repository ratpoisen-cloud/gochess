import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Chess, type Move } from 'chess.js'
import { supabase } from '@/lib/supabase'
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
import RequestModal from '@/components/RequestModal'
import Card from '@/components/Card'
import type { GameStatus, GameData } from '@/types'

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export default function GamePage() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

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
  
  const [showUndoConfirm, setShowUndoConfirm] = useState(false)
  const [showDrawConfirm, setShowDrawConfirm] = useState(false)
  const [showResignConfirm, setShowResignConfirm] = useState(false)

  const [undoRequest, setUndoRequest] = useState<GameData['undo_request']>(null)
  const [drawRequest, setDrawRequest] = useState<GameData['draw_request']>(null)
  const [rematchRequest, setRematchRequest] = useState<GameData['rematch_request']>(null)
  
  const addReaction = useReactionStore((s) => s.addReaction)
  const getPieceUrl = useBoardStore((s) => s.getPieceUrl)

  const boardContainerRef = useRef<HTMLDivElement>(null)
  const { stableWidth } = useBoardWidth(boardContainerRef, !loading)
  const gameRef = useRef(game)
  const channelRef = useRef<any>(null)
  const lastPgnRef = useRef('')

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
          .select('*')
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
          setIsMyTurn(data.turn === 'w')
        } else if (data.black_player_id === user.uid) {
          setPlayerColor('b')
          setOpponentName(data.white_name || '')
          setOpponentJoined(!!data.white_player_id)
          setIsMyTurn(data.turn === 'b')
        } else if (!data.black_player_id) {
          const { error: joinError } = await sb
            .from('games')
            .update({
              black_player_id: user.uid,
              black_name: user.displayName,
            })
            .eq('id', data.id)

          if (joinError) {
            if (!cancelled) {
              setError('Не удалось присоединиться к игре (join)')
              setLoading(false)
            }
            return
          }

          if (!cancelled) {
            setPlayerColor('b')
            setOpponentName(data.white_name || '')
            setOpponentJoined(!!data.white_player_id)
            setIsMyTurn(false)
          }
        } else if (!data.white_player_id) {
          const { error: joinError } = await sb
            .from('games')
            .update({
              white_player_id: user.uid,
              white_name: user.displayName,
            })
            .eq('id', data.id)

          if (joinError) {
            if (!cancelled) {
              setError('Не удалось присоединиться к игре')
              setLoading(false)
            }
            return
          }

          if (!cancelled) {
            setPlayerColor('w')
            setOpponentName(data.black_name || '')
            setOpponentJoined(!!data.black_player_id)
            setIsMyTurn(true)
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

  // Poll for opponent while waiting
  useEffect(() => {
    if (!gameId || !supabase || opponentJoined || loading) return

    const sb = supabase!
    const interval = setInterval(async () => {
      const { data } = await sb
        .from('games')
        .select('white_player_id, black_player_id, white_name, black_name, turn')
        .eq('id', gameId)
        .single()

      if (!data) return

      if (playerColor === 'w' && data.black_player_id && !opponentJoined) {
        setOpponentJoined(true)
        setOpponentName(data.black_name || 'Соперник')
        setIsMyTurn(data.turn === 'w')
      }
      if (playerColor === 'b' && data.white_player_id && !opponentJoined) {
        setOpponentJoined(true)
        setOpponentName(data.white_name || 'Соперник')
        setIsMyTurn(data.turn === 'b')
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [gameId, opponentJoined, loading, playerColor])

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

          if (playerColor === 'w' && newData.black_player_id && !opponentJoined) {
            setOpponentJoined(true)
            setOpponentName(newData.black_name || 'Соперник')
            setIsMyTurn(newData.turn === 'w')
          }
          if (playerColor === 'b' && newData.white_player_id && !opponentJoined) {
            setOpponentJoined(true)
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
  }, [gameId, user, playerColor, updateGameState, gameOver, addReaction, opponentJoined])

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

      supabase.from('games').update(updateData).eq('id', gameId).then(({ error }) => {
        if (error) console.error('Move sync error:', error)
      })

      if (!gameOverNow) {
        soundManager.play(result.captured ? 'capture' : 'move')
      } else {
        soundManager.play('checkmate')
      }

      useReactionStore.getState().resetMoveCounter()
      return true
    } catch {
      return false
    }
  }, [isMyTurn, gameId, gameOver, supabase, updateGameState])

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
    await supabase.from('games').update({
      game_state: 'game_over',
      winner: playerColor === 'w' ? 'black' : 'white',
      message: 'resign',
    }).eq('id', gameId)
    setGameOver(true)
    setResultText('Вы сдались')
  }

  const handleReactionSquare = (square: string, clientX: number, clientY: number) => {
    setReactionSquare(square)
    setReactionPos({ x: clientX, y: clientY })
    setShowReactionPicker(true)
  }

  const handleEmojiSelect = async (emojiUrl: string) => {
    if (!gameId || !user || !supabase || !reactionSquare) return

    const reaction: Reaction = {
      id: generateId(),
      square: reactionSquare,
      emojiUrl,
      playerId: user.uid,
      createdAt: Date.now(),
    }

    addReaction(reaction)
    setShowReactionPicker(false)
    setReactionSquare(null)

    const { data: gameData } = await supabase
      .from('games')
      .select('reactions')
      .eq('id', gameId)
      .single()

    const existingReactions: Reaction[] = (gameData as any)?.reactions || []
    const updatedReactions = [...existingReactions, reaction].slice(-20)

    await supabase.from('games').update({
      reactions: updatedReactions,
    }).eq('id', gameId)
  }

  const handleUndoRequest = async () => {
    if (!gameId || !user || !supabase || gameOver) return
    if (moveHistory.length === 0) return
    const { error } = await supabase.from('games').update({
      undo_request: { from_id: user.uid, created_at: Date.now() }
    }).eq('id', gameId)
    if (error) {
      console.error('Undo request error:', error)
      alert('Ошибка при отправке запроса: ' + error.message)
    }
  }

  const handleAcceptUndo = async () => {
    if (!gameId || !user || !supabase || !undoRequest) return
    const g = new Chess()
    g.loadPgn(lastPgnRef.current)
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
  }

  const handleRejectUndo = async () => {
    if (!gameId || !supabase) return
    await supabase.from('games').update({ undo_request: null }).eq('id', gameId)
    setUndoRequest(null)
  }

  const handleDrawRequest = async () => {
    if (!gameId || !user || !supabase || gameOver || !opponentJoined) return
    await supabase.from('games').update({
      draw_request: { from_id: user.uid, created_at: Date.now() }
    }).eq('id', gameId)
  }

  const handleAcceptDraw = async () => {
    if (!gameId || !supabase || !drawRequest) return
    await supabase.from('games').update({
      game_state: 'game_over',
      winner: null,
      message: 'draw',
      draw_request: null
    }).eq('id', gameId)
    setDrawRequest(null)
  }

  const handleRejectDraw = async () => {
    if (!gameId || !supabase) return
    await supabase.from('games').update({ draw_request: null }).eq('id', gameId)
    setDrawRequest(null)
  }

  const handleRematchRequest = async () => {
    if (!gameId || !user || !supabase || !gameOver) return
    const newCode = Math.random().toString(36).slice(2, 8).toUpperCase()
    await supabase.from('games').update({
      rematch_request: { from_id: user.uid, proposed_room_id: newCode, created_at: Date.now() }
    }).eq('id', gameId)
  }

  const handleAcceptRematch = async () => {
    if (!gameId || !user || !supabase || !rematchRequest) return
    
    const newRoomCode = rematchRequest.proposed_room_id
    
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
      return
    }

    await supabase.from('games').update({ rematch_request: null }).eq('id', gameId)
    setRematchRequest(null)
    navigate(`/game/${newRoomCode}`)
  }

  const handleRejectRematch = async () => {
    if (!gameId || !supabase) return
    await supabase.from('games').update({ rematch_request: null }).eq('id', gameId)
    setRematchRequest(null)
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
          <button
            onClick={() => navigate('/')}
            className="text-[10px] font-bold text-text-secondary hover:text-text transition-colors uppercase tracking-widest"
            style={{ fontFamily: 'var(--font-family-ui)' }}
          >
            В лобби
          </button>
          <h1 className="text-[var(--font-size-md)] font-bold text-text tracking-[0.02em] uppercase">
            Игра по сети
          </h1>
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
                    isMyTurn ? 'text-[var(--accent-brand)] animate-pulse' : 'text-text-secondary opacity-60'
                  }`}>
                    {isMyTurn ? 'Ваш ход' : 'Ход соперника'}
                  </span>
                </div>
              </div>

              <div ref={boardContainerRef} className="board-container">
                {stableWidth > 0 ? (
                  <ChessBoard
                    game={game}
                    lastMove={lastMove}
                    checkSquare={checkSquare}
                    selectedSquare={selectedSquare}
                    legalMoves={legalMoves}
                    onDrop={makeMove}
                    onSquareClick={onSquareClick}
                    onReactionSquare={handleReactionSquare}
                    boardWidth={stableWidth}
                    boardOrientation={playerColor === 'w' ? 'white' : 'black'}
                  />
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
                  <h3 className="text-[10px] font-bold text-[var(--accent-brand)] uppercase tracking-widest mb-4">
                    Пригласить друга
                  </h3>
                  
                  <div 
                    className="flex items-center gap-2 p-2 rounded-[var(--radius-8)] border border-[var(--border)] mb-4 bg-[var(--bg)]"
                  >
                    <input
                      type="text"
                      readOnly
                      value={window.location.href}
                      className="flex-1 bg-transparent text-[10px] text-text-secondary outline-none truncate"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href)
                      }}
                      className="px-3 py-1.5 rounded-[var(--radius-4)] text-[9px] font-bold uppercase tracking-wider bg-[var(--accent-brand)] text-[var(--bg)] hover:scale-105 active:scale-95 transition-all"
                    >
                      Копировать
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent('Сыграем в шахматы?')}`, '_blank')}
                      className="flex-1 flex items-center justify-center py-2 rounded-[var(--radius-8)] border border-[var(--border)] hover:bg-[var(--accent-soft)] transition-colors group"
                      title="Telegram"
                    >
                      <svg className="w-4 h-4 text-text-secondary group-hover:text-[#229ED9] transition-colors" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.69-.88-.48-1.38-.78-2.23-1.11-1-.38-.35-1.55.22-2.14.15-.15 2.71-2.48 2.76-2.58.01-.01.01-.05-.01-.03-.02.02-.06.01-.08.01-.07.01-1.13.72-3.19 1.44-.3.1-.57.15-.81.14-.26-.01-.76-.15-1.13-.27-.46-.15-.82-.23-.79-.48.02-.13.34-.26.96-.39 3.76-1.63 6.27-2.7 7.52-3.22.62-.26 1.32-.4 1.76-.4a1 1 0 0 1 .42.06c.1.04.14.11.16.23.01.03.01.12 0 .15z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => window.open(`https://vk.com/share.php?url=${encodeURIComponent(window.location.href)}`, '_blank')}
                      className="flex-1 flex items-center justify-center py-2 rounded-[var(--radius-8)] border border-[var(--border)] hover:bg-[var(--accent-soft)] transition-colors group"
                      title="VK"
                    >
                      <svg className="w-4 h-4 text-text-secondary group-hover:text-[#4C75A3] transition-colors" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M15.074 2H8.926C3.938 2 2 3.938 2 8.926v6.148C2 20.062 3.938 22 8.926 22h6.148c4.988 0 6.926-1.938 6.926-6.926V8.926C22 3.938 20.062 2 15.074 2zm3.328 13.713c0 .12-.045.244-.13.341a.417.417 0 0 1-.314.145h-1.28c-.287 0-.585-.145-.89-.434-.233-.217-.461-.476-.684-.775-.2-.266-.37-.4-.509-.4-.037 0-.083.007-.139.022-.116.035-.205.093-.267.172-.061.079-.092.18-.092.304v.681c0 .12-.045.244-.13.341a.417.417 0 0 1-.314.145h-1.041c-.482 0-1.12-.132-1.916-.395-.826-.271-1.63-.736-2.411-1.396-.781-.659-1.423-1.428-1.925-2.308s-.803-1.745-.904-2.595a.434.434 0 0 1 .129-.364c.086-.09.2-.135.344-.135h1.283c.277 0 .474.127.593.382.412.879.914 1.583 1.507 2.112.593.529 1.05.793 1.371.793.078 0 .142-.016.19-.048.067-.044.116-.11.147-.197.031-.087.047-.267.047-.539v-1.19c-.013-.424-.09-.711-.231-.86-.141-.149-.408-.225-.8-.228a1.21 1.21 0 0 1-.397-.042 3.51 3.51 0 0 1-.097-.034c-.035-.021-.053-.06-.053-.119 0-.097.054-.183.161-.258.194-.135.485-.202.872-.202h1.996c.123 0 .235.045.334.135.099.09.149.21.149.362v2.246c0 .15.021.264.062.344.041.08.09.136.147.169.057.033.109.05.155.05.111 0 .24-.075.385-.224a10.82 1.082 0 0 0 .973-1.229 15.6 15.6 0 0 0 .848-1.637.52.52 0 0 1 .158-.231.42.42 0 0 1 .3-.064h1.284c.123 0 .24.045.351.135.111.09.167.21.167.362 0 .157-.045.32-.136.486a16.63 16.63 0 0 1-.95 1.554c-.21.314-.424.61-.643.887-.219.277-.384.471-.497.583-.112.112-.13.18-.052.203.045.015.118.06.219.135a9.3 9.3 0 0 1 .949.79c.642.592 1.137 1.233 1.485 1.922z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({
                            title: 'GoChess',
                            text: 'Сыграем в шахматы?',
                            url: window.location.href,
                          })
                        }
                      }}
                      className="flex-1 flex items-center justify-center py-2 rounded-[var(--radius-8)] border border-[var(--border)] hover:bg-[var(--accent-soft)] transition-colors group"
                      title="Поделиться"
                    >
                      <span className="text-[12px] opacity-70 group-hover:opacity-100 transition-opacity">🔗</span>
                    </button>
                  </div>
                </Card>
              )}
            </div>
        </div>
      </main>

      {/* Global Modals/Overlays */}
      {showReactionPicker && reactionPos && (
        <div
          className="fixed z-[9999]"
          style={{
            left: reactionPos.x,
            top: reactionPos.y,
            transform: 'translate(-50%, -120%)',
          }}
        >
          <ReactionPicker
            onSelect={handleEmojiSelect}
            onClose={() => {
              setShowReactionPicker(false)
              setReactionSquare(null)
            }}
          />
        </div>
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

      {/* Promotion Modal */}
      {pendingPromotion && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center"
          onClick={() => setPendingPromotion(null)}
          style={{ background: 'rgba(0,0,0,0.5)' }}
        >
          <div
            className="bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-8)] p-4 flex gap-2 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {(['q', 'r', 'b', 'n'] as const).map((piece) => {
              const code = `${playerColor === 'w' ? 'w' : 'b'}${piece.toUpperCase()}` as const
              return (
                <button
                  key={piece}
                  onClick={() => {
                    makeMove(pendingPromotion.from, pendingPromotion.to, piece)
                    setPendingPromotion(null)
                    setSelectedSquare(null)
                    setLegalMoves([])
                  }}
                  className="w-12 h-12 flex items-center justify-center hover:bg-[color-mix(in_srgb,var(--accent-brand)_20%,transparent)] rounded-[var(--radius-4)] transition-colors"
                >
                  <img
                    src={getPieceUrl(code)}
                    alt={piece}
                    className="w-10 h-10"
                    draggable={false}
                  />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
