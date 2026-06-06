import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Chess, type Move } from 'chess.js'
import { db } from '@/lib/firebase'
import { 
  doc, 
  onSnapshot, 
  updateDoc, 
  query, 
  collection, 
  where, 
  getDocs, 
  getDoc, 
  limit, 
  runTransaction 
} from 'firebase/firestore'
import LoadingScreen from '@/components/LoadingScreen'
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
import AuthModal from '@/components/AuthModal'
import type { GameStatus, GameData } from '@/types'

const BASE = import.meta.env.BASE_URL || '/'

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export default function GamePage() {
  const { user, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { getPieceUrl } = useBoardStore()
  const { roomCode } = useParams<{ roomCode: string }>()

  // Game Core State
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
  const [gameDocId, setGameDocId] = useState<string | null>(null)
  
  // UI State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gameOver, setGameOver] = useState(false)
  const [resultText, setResultText] = useState('')
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [reactionSquare, setReactionSquare] = useState<string | null>(null)
  const [reactionPos, setReactionPos] = useState<{ x: number; y: number } | null>(null)
  const [opponentJoined, setOpponentJoined] = useState(false)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  
  const { addToast } = useToast()
  const [showResignConfirm, setShowResignConfirm] = useState(false)
  const [copied, setCopied] = useState(false)

  const [undoRequest, setUndoRequest] = useState<GameData['undo_request']>(null)
  const [drawRequest, setDrawRequest] = useState<GameData['draw_request']>(null)
  
  const addReaction = useReactionStore((s) => s.addReaction)

  const boardContainerRef = useRef<HTMLDivElement>(null)
  const { stableWidth } = useBoardWidth(boardContainerRef, !loading)
  const gameRef = useRef(game)
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

  const parseResult = (data: GameData) => {
    if (data.game_state !== 'game_over') return ''
    return data.message === 'resign'
      ? `${data.winner === 'white' ? 'Чёрные' : 'Белые'} сдались`
      : data.message === 'draw' ? 'Ничья'
      : data.winner === 'white' ? 'Белые победили'
      : data.winner === 'black' ? 'Чёрные победили'
      : 'Игра окончена'
  }

  // 1. Initial Document Lookup & Room Joining
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      setIsAuthModalOpen(true)
      return
    }
    if (!roomCode) return

    let cancelled = false

    const initRoom = async () => {
      try {
        console.log('[Game] Looking for room:', roomCode)
        const q = query(collection(db, 'games'), where('room_code', '==', roomCode), limit(1))
        const snapshot = await getDocs(q)
        
        if (snapshot.empty) {
          console.warn('[Game] Room not found')
          if (!cancelled) {
            setError('Комната не найдена')
            setLoading(false)
          }
          return
        }

        const gameDoc = snapshot.docs[0]
        const data = gameDoc.data() as GameData
        
        // Handle Join Transaction if necessary
        if (!data.white_player_id && data.black_player_id !== user.uid) {
           await runTransaction(db, async (transaction) => {
             transaction.update(gameDoc.ref, {
               white_player_id: user.uid,
               white_name: user.displayName || 'Игрок',
             })
           })
        } else if (!data.black_player_id && data.white_player_id !== user.uid) {
           await runTransaction(db, async (transaction) => {
             transaction.update(gameDoc.ref, {
               black_player_id: user.uid,
               black_name: user.displayName || 'Игрок',
             })
           })
        } else if (data.white_player_id !== user.uid && data.black_player_id !== user.uid) {
           console.warn('[Game] Room is full')
           if (!cancelled) {
             setError('Комната уже заполнена')
             setLoading(false)
           }
           return
        }

        if (cancelled) return
        console.log('[Game] Room initialized, setting doc ID:', gameDoc.id)
        setGameDocId(gameDoc.id)
        // Note: loading remains true until first snapshot
      } catch (err: any) {
        console.error('[Game] Initialization error:', err)
        if (!cancelled) {
          setError('Ошибка входа в комнату')
          setLoading(false)
        }
      }
    }

    initRoom()
    return () => { cancelled = true }
  }, [roomCode, user, authLoading])

  // 2. Realtime Listener & State Synchronization
  useEffect(() => {
    if (!gameDocId || !user) return

    console.log('[Game] Starting listener for:', gameDocId)
    const unsubscribe = onSnapshot(doc(db, 'games', gameDocId), (snapshot) => {
      const newData = snapshot.data() as GameData
      if (!newData) {
        console.warn('[Game] Snapshot is empty')
        return
      }

      console.log('[Firestore] Update received')

      // Determine local identity
      let myColor: 'w' | 'b' | null = null
      let opponent: string = ''
      let joined: boolean = false

      if (newData.white_player_id === user.uid) {
        myColor = 'w'
        opponent = newData.black_name || ''
        joined = !!newData.black_player_id
      } else if (newData.black_player_id === user.uid) {
        myColor = 'b'
        opponent = newData.white_name || ''
        joined = !!newData.white_player_id
      }

      setPlayerColor(myColor)
      setOpponentName(opponent)
      setOpponentJoined(joined)
      opponentJoinedRef.current = joined

      // Game Over logic
      if (newData.game_state === 'game_over') {
        if (!gameOver) {
          setGameOver(true)
          setResultText(parseResult(newData))
          soundManager.play('checkmate')
        }
      } else {
        setGameOver(false)
        setResultText('')
      }

      // Sync PGN / Move history
      if (newData.pgn && newData.pgn !== lastPgnRef.current) {
        const g = new Chess()
        try {
          g.loadPgn(newData.pgn)
          updateGameState(g)
          lastPgnRef.current = g.pgn()
          soundManager.play('move')
          useReactionStore.getState().resetMoveCounter()
        } catch (e) {
          console.error('[Game] PGN load error:', e)
        }
      } else if (!newData.pgn && lastPgnRef.current !== '') {
        // Reset to initial state
        const g = new Chess()
        updateGameState(g)
        lastPgnRef.current = ''
      }

      // Turn management
      if (newData.turn) {
        setIsMyTurn(newData.turn === myColor)
      }

      // Requests
      setUndoRequest(newData.undo_request)
      setDrawRequest(newData.draw_request)

      // Reactions
      if (newData.reactions && Array.isArray(newData.reactions)) {
        const currentReactions = useReactionStore.getState().reactions
        if (newData.reactions.length > currentReactions.length) {
          const latest = newData.reactions[newData.reactions.length - 1]
          if (latest.playerId !== user.uid) {
            addReaction(latest)
          }
        }
      }

      // FINALLY: Clear loading state on first successful data receive
      setLoading(false)
      console.log('[Game] Loading finished')
    }, (err) => {
      console.error('[Game] Snapshot error:', err)
      setError('Потеряно соединение с сервером')
      setLoading(false)
    })

    return () => {
      console.log('[Game] Stopping listener')
      unsubscribe()
    }
  }, [gameDocId, user, updateGameState, gameOver, addReaction])

  const makeMove = useCallback(async (from: string, to: string, promotion?: string) => {
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
      
      // Responsive local update
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

      try {
        await updateDoc(doc(db, 'games', gameDocId), updateData)
        useReactionStore.getState().resetMoveCounter()
        
        if (!gameOverNow) {
          soundManager.play(result.captured ? 'capture' : 'move')
        } else {
          soundManager.play('checkmate')
        }
      } catch (err) {
        console.error('[Game] Move sync failed:', err)
        // Rollback on failure
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
  }, [isMyTurn, gameDocId, gameOver, updateGameState, addToast])

  const onDrop = useCallback((from: string, to: string) => {
    if (!isMyTurn || gameOver) return false
    
    if (checkPromotion(from, to)) {
      if (legalMoves.includes(to)) {
        setPendingPromotion({ from, to })
        return true
      }
    }
    
    makeMove(from, to)
    return true
  }, [makeMove, isMyTurn, gameOver, legalMoves])

  const onSquareClick = useCallback((square: string) => {
    if (gameOver || !isMyTurn) return

    const g = gameRef.current
    const piece = g.get(square as any)

    if (selectedSquare) {
      const isLegal = legalMoves.includes(square)
      if (isLegal) {
        if (checkPromotion(selectedSquare, square)) {
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
    if (!gameDocId || !playerColor || gameOver) return
    try {
      await updateDoc(doc(db, 'games', gameDocId), {
        game_state: 'game_over',
        winner: playerColor === 'w' ? 'black' : 'white',
        message: 'resign',
      })
      addToast('Вы сдались', 'info')
    } catch {
      addToast('Ошибка при сдаче', 'error')
    }
  }

  const handleReactionSquare = (square: string, clientX: number, clientY: number) => {
    setReactionSquare(square)
    setReactionPos({ x: clientX, y: clientY })
    setShowReactionPicker(true)
  }

  const handleEmojiSelect = async (emojiUrl: string) => {
    if (!gameDocId || !user || !reactionSquare || !playerColor) return

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
      await runTransaction(db, async (transaction) => {
        const gameRef = doc(db, 'games', gameDocId)
        const freshDoc = await transaction.get(gameRef)
        const reactions = freshDoc.data()?.reactions || []
        transaction.update(gameRef, {
          reactions: [...reactions, reaction].slice(-20)
        })
      })
    } catch (err) {
      console.error('[Game] Reaction sync failed:', err)
      addToast('Ошибка отправки реакции', 'error')
    }
  }

  const handleAcceptUndo = async () => {
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
      
      await updateDoc(doc(db, 'games', gameDocId), {
        pgn: g.pgn(),
        fen: g.fen(),
        turn: g.turn(),
        last_move_time: Date.now(),
        undo_request: null
      })
    } catch {
      addToast('Ошибка при отмене хода', 'error')
    }
  }

  const handleRejectUndo = async () => {
    if (!gameDocId) return
    try {
      await updateDoc(doc(db, 'games', gameDocId), { undo_request: null })
      setUndoRequest(null)
    } catch {
      addToast('Ошибка сети', 'error')
    }
  }

  const handleAcceptDraw = async () => {
    if (!gameDocId || !drawRequest) return
    try {
      await updateDoc(doc(db, 'games', gameDocId), {
        game_state: 'game_over',
        winner: null,
        message: 'draw',
        draw_request: null
      })
    } catch {
      addToast('Ошибка при согласии на ничью', 'error')
    }
  }

  // Render logic
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg p-6 text-center">
        <h2 className="text-xl font-bold text-text mb-4">{error}</h2>
        <Button onClick={() => navigate('/')}>Вернуться в лобби</Button>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg p-6 text-center">
        <h2 className="text-xl font-bold text-text mb-4">Требуется вход</h2>
        <Button onClick={() => setIsAuthModalOpen(true)}>Войти</Button>
        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      </div>
    )
  }

  if (loading) return <LoadingScreen isLoading={true} />

  return (
    <div className="min-h-[100dvh] flex flex-col bg-bg">
      <header className="px-[var(--space-24)] py-[var(--space-32)] bg-bg">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-[var(--space-12)]">
          <Link to="/">
            <img
              src={`${BASE}logo/gochess_wordmark_dark.svg`}
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

      <main className="max-w-[1200px] mx-auto px-[var(--space-24)] py-[var(--space-48)] flex-1 w-full">
        <div className="game-layout-container">
          <div className="game-main-column">
            <div 
              className="mx-auto mb-[var(--space-12)] grid grid-cols-3 items-center px-[var(--space-8)]"
              style={{ width: stableWidth || '100%', maxWidth: '100%' }}
            >
              <div className="flex items-center gap-[var(--space-8)] text-[var(--font-size-sm)] font-bold">
                <span className="text-[var(--accent-brand)] truncate">
                  {opponentJoined ? (opponentName || 'Соперник') : 'Ожидание...'}
                </span>
                {opponentJoined && <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />}
              </div>

              <div className="text-center flex justify-center">
                {(status === 'check' || status === 'checkmate' || status === 'stalemate' || status === 'draw') && (
                  <h2 className={`text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse ${
                    status === 'check' || status === 'checkmate' ? 'text-[var(--danger)]' : 'text-text-secondary'
                  }`}>
                    {status === 'check' ? 'Шах!' : status === 'checkmate' ? 'Мат!' : 'Ничья'}
                  </h2>
                )}
              </div>

              <div className="text-right">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${
                  isMyTurn && !gameOver ? 'text-[var(--accent-brand)] animate-pulse' : 'text-text-secondary opacity-60'
                }`}>
                  {gameOver ? 'Игра окончена' : isMyTurn ? 'Ваш ход' : 'Ход соперника'}
                </span>
              </div>
            </div>

            <div ref={boardContainerRef} className="board-container relative">
              {(() => {
                const fb = boardContainerRef.current?.clientWidth || 600
                const w = stableWidth > 0 ? stableWidth : fb
                return (
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
                      boardWidth={w}
                      boardOrientation={playerColor === 'b' ? 'black' : 'white'}
                    />

                    {pendingPromotion && (
                      <div className="absolute inset-0 z-[100] bg-black/20 flex items-center justify-center">
                        <div className="bg-[var(--surface-elevated)] p-4 rounded-[var(--radius-14)] shadow-2xl flex gap-4">
                          {(['q', 'r', 'b', 'n'] as const).map((piece) => (
                            <button
                              key={piece}
                              onClick={() => {
                                makeMove(pendingPromotion.from, pendingPromotion.to, piece)
                                setPendingPromotion(null)
                              }}
                              className="w-16 h-16 hover:bg-white/10 rounded-lg transition-colors p-2"
                            >
                              <img 
                                src={getPieceUrl(`${playerColor}${piece.toUpperCase()}`)} 
                                alt={piece} 
                                className="w-full h-full object-contain"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
            
            {gameOver && resultText && (
              <div className="mt-4 p-4 bg-[var(--surface-elevated)] rounded-lg text-center animate-modal-pixel-in">
                <p className="text-[var(--font-size-md)] font-bold text-[var(--accent-brand)] uppercase tracking-widest">
                  {resultText}
                </p>
              </div>
            )}
          </div>

          <div className="game-side-column space-y-[var(--space-20)]">
            {!opponentJoined && (
              <Card padding="sm" className="border-[var(--accent-brand)] shadow-[0_0_20px_rgba(126,184,126,0.1)]">
                <div className="flex items-center justify-between mb-[var(--space-12)]">
                  <h3 className="text-[var(--font-size-sm)] font-bold text-[var(--accent-brand)] uppercase tracking-widest">Пригласить друга</h3>
                  <span className="w-2 h-2 rounded-full bg-[var(--accent-brand)] animate-pulse" />
                </div>
                <div className="space-y-[var(--space-12)]">
                  <div className="flex items-center gap-[var(--space-8)] p-[var(--space-8)] rounded-[var(--radius-8)] bg-[rgba(0,0,0,0.2)] border border-[var(--border)]">
                    <input
                      type="text"
                      readOnly
                      value={window.location.href}
                      className="flex-1 min-w-0 bg-transparent text-[10px] text-text-secondary outline-none truncate select-all font-mono"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href)
                        setCopied(true)
                        addToast('Ссылка скопирована', 'success')
                        setTimeout(() => setCopied(false), 2000)
                      }}
                      className="shrink-0 px-2 py-1 rounded-[var(--radius-4)] text-[9px] font-bold uppercase tracking-wider transition-all"
                      style={{
                        background: copied ? 'var(--success)' : 'var(--accent-brand)',
                        color: 'black'
                      }}
                    >
                      {copied ? 'OK' : 'Копия'}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent('Сыграем в шахматы?')}`, '_blank')}
                      className="flex-1 py-2 rounded-[var(--radius-8)] bg-[rgba(255,255,255,0.03)] border border-[var(--border)] text-[9px] font-bold uppercase tracking-widest text-text-secondary hover:text-[var(--accent-brand)] hover:border-[var(--accent-brand)] transition-all"
                    >
                      Telegram
                    </button>
                    <button 
                      onClick={() => window.open(`https://vk.com/share.php?url=${encodeURIComponent(window.location.href)}`, '_blank')}
                      className="flex-1 py-2 rounded-[var(--radius-8)] bg-[rgba(255,255,255,0.03)] border border-[var(--border)] text-[9px] font-bold uppercase tracking-widest text-text-secondary hover:text-[var(--accent-brand)] hover:border-[var(--accent-brand)] transition-all"
                    >
                      ВКонтакте
                    </button>
                  </div>
                </div>
              </Card>
            )}

            <Card padding="sm">
              <div className="flex items-center justify-between mb-[var(--space-12)]">
                <h3 className="text-[var(--font-size-sm)] font-semibold text-text">Ходы</h3>
                <span className="text-[10px] text-text-secondary uppercase tracking-widest opacity-60">
                  {moveHistory.length} полуходов
                </span>
              </div>
              <div className="max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                <div className="flex flex-wrap gap-2">
                  {moveHistory.length === 0 ? (
                    <p className="text-[10px] text-text-secondary opacity-40 italic w-full text-center py-4">
                      Ожидание первого хода...
                    </p>
                  ) : (
                    moveHistory.map((move, i) => (
                      <span key={i} className="text-[11px] font-mono">
                        {i % 2 === 0 && <span className="text-text-secondary mr-1">{Math.floor(i / 2) + 1}.</span>}
                        <span className="text-text font-bold">{move}</span>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-[var(--space-12)]">
              <Button 
                variant="primary" 
                size="sm" 
                fullWidth 
                onClick={() => {
                  if (!gameDocId || !user || gameOver || moveHistory.length === 0) return
                  updateDoc(doc(db, 'games', gameDocId), {
                    undo_request: { from_id: user.uid, created_at: Date.now() }
                  }).catch(() => addToast('Ошибка при отправке запроса', 'error'))
                }}
                disabled={gameOver || moveHistory.length === 0}
              >
                Отмена
              </Button>
              <Button 
                variant="primary" 
                size="sm" 
                fullWidth 
                onClick={() => {
                  if (!gameDocId || !user || gameOver || !opponentJoined) return
                  updateDoc(doc(db, 'games', gameDocId), {
                    draw_request: { from_id: user.uid, created_at: Date.now() }
                  }).catch(() => addToast('Ошибка при предложении ничьей', 'error'))
                }}
                disabled={gameOver || !opponentJoined}
              >
                Ничья
              </Button>
            </div>
            <Button 
              variant="primary" 
              size="sm" 
              fullWidth 
              className="hover:!bg-[var(--danger-soft)]"
              onClick={() => setShowResignConfirm(true)}
              disabled={gameOver}
            >
              Сдаться
            </Button>
          </div>
        </div>
      </main>

      <Footer />

      {/* Modals & Pickers */}
      {showReactionPicker && reactionPos && (
        <ReactionPicker
          anchorX={reactionPos.x}
          anchorY={reactionPos.y}
          onSelect={handleEmojiSelect}
          onClose={() => setShowReactionPicker(false)}
        />
      )}

      <RequestModal
        isOpen={!!(undoRequest && user && undoRequest.from_id !== user.uid)}
        title="Запрос отмены"
        description="Соперник просит отменить последний ход"
        onAccept={handleAcceptUndo}
        onReject={handleRejectUndo}
      />

      <RequestModal
        isOpen={!!(drawRequest && user && drawRequest.from_id !== user.uid)}
        title="Предложение ничьей"
        description="Соперник предлагает ничью"
        onAccept={handleAcceptDraw}
        onReject={() => gameDocId && updateDoc(doc(db, 'games', gameDocId), { draw_request: null })}
      />

      <ConfirmDialog
        isOpen={showResignConfirm}
        title="Сдаться?"
        onConfirm={handleResign}
        onCancel={() => setShowResignConfirm(false)}
      />
    </div>
  )
}

function ConfirmDialog({ isOpen, title, onConfirm, onCancel }: any) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <Card className="max-w-[320px] w-full animate-modal-pixel-in">
        <h3 className="text-center font-bold mb-6">{title}</h3>
        <div className="flex flex-col gap-2">
          <Button variant="primary" fullWidth onClick={() => { onConfirm(); onCancel(); }}>Да</Button>
          <Button variant="primary" fullWidth onClick={onCancel} className="bg-transparent opacity-60">Нет</Button>
        </div>
      </Card>
    </div>
  )
}
