import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Chess, type Move } from 'chess.js'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useBoardWidth } from '@/hooks/useBoardWidth'
import { useReactionStore, type Reaction } from '@/stores/reactionStore'
import { soundManager } from '@/lib/soundManager'
import ChessBoard from '@/components/board/ChessBoard'
import Card from '@/components/Card'
import Button from '@/components/Button'
import SettingsDropdown from '@/components/SettingsDropdown'
import UserMenu from '@/components/UserMenu'
import type { GameStatus } from '@/types'

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
  const [opponentJoined, setOpponentJoined] = useState(false)
  const addReaction = useReactionStore((s) => s.addReaction)

  const boardContainerRef = useRef<HTMLDivElement>(null)
  const { stableWidth } = useBoardWidth(boardContainerRef)
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

    let cancelled = false

    const load = async () => {
      try {
        console.log('[Game] Loading room:', roomCode, 'user:', user.uid)
        console.log('[Game] SELECT games WHERE room_code =', roomCode)

        const { data, error: fetchError } = await supabase
          .from('games')
          .select('*')
          .eq('room_code', roomCode)
          .maybeSingle()

        if (fetchError || !data) {
          console.error('[Game] SELECT error:', fetchError || 'no data')
          if (!cancelled) {
            setError(fetchError ? 'Комната не найдена' : 'Не удалось загрузить игру')
            setLoading(false)
          }
          return
        }

        console.log('[Game] Room found:', data.id, 'white:', data.white_player_id?.slice(0, 8), 'black:', data.black_player_id?.slice(0, 8))

        if (cancelled) return
        setGameId(data.id)

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
          const { error: joinError } = await supabase
            .from('games')
            .update({
              black_player_id: user.uid,
              black_name: user.displayName,
            })
            .eq('id', data.id)

          if (joinError) {
            console.error('[Game] Join error:', JSON.stringify(joinError, null, 2), joinError)
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
          const { error: joinError } = await supabase
            .from('games')
            .update({
              white_player_id: user.uid,
              white_name: user.displayName,
            })
            .eq('id', data.id)

          if (joinError) {
            console.error('[Game] Join error:', JSON.stringify(joinError, null, 2), joinError)
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

  // Subscribe to Realtime
  useEffect(() => {
    if (!gameId || !supabase) return

    const channel = supabase
      .channel(`game-${gameId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload: any) => {
          const newData = payload.new

          // Check if opponent joined
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
              setIsMyTurn(true)
              soundManager.play('move')
            } catch { /* ignore */ }
          }

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
        last_move_time: Date.now(),
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

  const handleDrawOffer = async () => {
    if (!gameId || !supabase || gameOver) return

    const { data } = await supabase
      .from('games')
      .select('message')
      .eq('id', gameId)
      .single()

    if (data?.message === 'draw_offer') {
      await supabase.from('games').update({
        game_state: 'game_over',
        winner: 'draw',
        message: 'draw',
      }).eq('id', gameId)
      setGameOver(true)
      setResultText('Ничья')
    } else {
      await supabase.from('games').update({
        message: 'draw_offer',
      }).eq('id', gameId)
    }
  }

  const handleRematch = async () => {
    if (!user || !roomCode || !supabase || !playerColor) return

    const code = Math.random().toString(36).slice(2, 8).toUpperCase()
    const { error } = await supabase.from('games').insert({
      room_code: code,
      white_player_id: playerColor === 'w' ? user.uid : null,
      white_name: playerColor === 'w' ? user.displayName : '',
      black_player_id: playerColor === 'b' ? user.uid : null,
      black_name: playerColor === 'b' ? user.displayName : '',
      game_type: 'online',
      pgn: '',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      game_state: 'active',
      turn: 'w',
    })

    if (!error) {
      navigate(`/game/${code}`)
    }
  }

  const handleEmojiSelect = async (emoji: string) => {
    if (!gameId || !user || !supabase || !reactionSquare) return

    const reaction: Reaction = {
      id: generateId(),
      square: reactionSquare,
      emoji,
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

  const statusText = status === 'checkmate' ? 'Мат!'
    : status === 'stalemate' ? 'Пат — ничья'
    : status === 'draw' ? 'Ничья'
    : status === 'check' ? 'Шах!'
    : isMyTurn ? 'Ваш ход'
    : 'Ход соперника'

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
        {!opponentJoined && (
          <div className="text-center space-y-[var(--space-16)]">
            <p className="text-text-secondary text-[var(--font-size-sm)]">
              Ожидание соперника...
            </p>
            <div className="flex items-center justify-center gap-[var(--space-8)]">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-brand)] animate-pulse" />
              <span className="text-text-secondary text-[var(--font-size-xs)]">
                Пришли ссылку другу, чтобы начать
              </span>
            </div>
            <div className="max-w-[400px] mx-auto">
              <div className="flex items-center gap-[var(--space-8)] p-[var(--space-12)] rounded-[var(--radius-8)]"
                style={{ background: 'color-mix(in srgb, var(--accent-brand) 10%, var(--bg))', border: '1px solid color-mix(in srgb, var(--accent-brand) 30%, var(--border))' }}
              >
                <input
                  type="text"
                  readOnly
                  value={window.location.href}
                  className="flex-1 bg-transparent text-text text-[var(--font-size-xs)] outline-none truncate select-all"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href)
                  }}
                  className="shrink-0 px-[var(--space-12)] py-[var(--space-6)] rounded-[var(--radius-4)] text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    background: 'color-mix(in srgb, var(--accent-brand) 20%, var(--bg))',
                    color: 'var(--accent-brand)',
                  }}
                >
                  Копировать
                </button>
              </div>
            </div>
            <p className="text-text-secondary text-[var(--font-size-xs)]">
              Вы играете <span className="text-[var(--accent-brand)] font-bold">{playerColor === 'w' ? 'белыми' : 'чёрными'}</span>
            </p>
          </div>
        )}
        <div className="game-layout-container" style={{ display: opponentJoined ? '' : 'none' }}>
            <div className="game-main-column">
              <div className="mb-[var(--space-16)] text-center game:text-left flex items-center justify-between">
                <h2 className={`text-[var(--font-size-lg)] font-bold ${statusClasses[status] || ''}`}>
                  {statusText}
                </h2>
                <div className="flex items-center gap-[var(--space-8)]">
                  <span className="text-[10px] text-text-secondary uppercase tracking-wider">
                    {playerColor === 'w' ? 'Белые' : 'Чёрные'}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${isMyTurn ? 'bg-[var(--accent-brand)] animate-pulse' : 'bg-text-secondary'}`} />
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

              {gameOver && (
                <div className="mt-[var(--space-16)] text-center space-y-[var(--space-12)]">
                  <p className={`text-[var(--font-size-lg)] font-bold ${
                    resultText === 'Ничья' || resultText === 'Вы сдались'
                      ? 'text-text-secondary'
                      : 'text-[var(--accent-brand)]'
                  }`}>
                    {resultText}
                  </p>
                  <div className="flex justify-center gap-[var(--space-12)]">
                    <Button variant="outline" onClick={handleRematch}>
                      Реванш
                    </Button>
                    <Button onClick={() => navigate('/')}>
                      В лобби
                    </Button>
                  </div>
                </div>
              )}

              {!gameOver && (
                <div className="mt-[var(--space-16)] flex justify-center gap-[var(--space-12)]">
                  <Button variant="outline" onClick={handleDrawOffer}>
                    Ничья
                  </Button>
                  <Button variant="danger" onClick={handleResign}>
                    Сдаться
                  </Button>
                </div>
              )}

              {!gameOver && (
                <div className="mt-[var(--space-12)]">
                  {showReactionPicker ? (
                    <div className="relative">
                      {reactionSquare ? (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[100]">
                          <div className="bg-[var(--bg)] border border-[color-mix(in_srgb,var(--accent-brand)_30%,var(--border))] rounded-[var(--radius-8)] p-2">
                            <div className="grid grid-cols-6 gap-1">
                              {['😄', '😎', '🔥', '💀', '😱', '🥶', '💪', '😅', '😢', '👀', '🎉', '😤', '🤝', '♟️', '⭐', '❤️'].map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleEmojiSelect(emoji)}
                                  className="w-7 h-7 flex items-center justify-center text-sm hover:bg-[color-mix(in_srgb,var(--accent-brand)_20%,transparent)] rounded-[var(--radius-4)] transition-colors"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <button
                            onClick={() => setShowReactionPicker(false)}
                            className="text-[10px] text-text-secondary hover:text-text transition-colors uppercase tracking-widest"
                          >
                            Закрыть реакции
                          </button>
                          <p className="text-[9px] text-text-secondary mt-1">
                            Нажми на клетку доски, чтобы оставить реакцию
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center">
                      <button
                        onClick={() => setShowReactionPicker(true)}
                        className="text-[10px] text-text-secondary hover:text-text transition-colors uppercase tracking-widest"
                      >
                        Реакции
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="game-side-column">
              <Card padding="sm">
                <h3 className="text-[var(--font-size-sm)] font-semibold mb-[var(--space-12)] text-text">
                  Игроки
                </h3>
                <div className="space-y-[var(--space-8)] mb-[var(--space-16)]">
                  <div className="flex items-center justify-between text-[var(--font-size-xs)]">
                    <span className="flex items-center gap-[var(--space-6)]">
                      <span className="w-2 h-2 rounded-full bg-white inline-block border border-[var(--border)]" />
                      {playerColor === 'w' ? 'Вы' : opponentName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--font-size-xs)]">
                    <span className="flex items-center gap-[var(--space-6)]">
                      <span className="w-2 h-2 rounded-full bg-black inline-block border border-[var(--border)]" />
                      {playerColor === 'b' ? 'Вы' : opponentName}
                    </span>
                  </div>
                </div>

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
            </div>
        </div>
      </main>
    </div>
  )
}
