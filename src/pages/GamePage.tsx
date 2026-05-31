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
  limit, 
  runTransaction 
} from 'firebase/firestore'
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

const BASE = import.meta.env.BASE_URL || '/'

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
  const [gameDocId, setGameDocId] = useState<string | null>(null)
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

  // Initial Load and Join Logic
  useEffect(() => {
    if (!user || !roomCode) return

    let cancelled = false

    const loadAndJoin = async () => {
      try {
        const q = query(collection(db, 'games'), where('room_code', '==', roomCode), limit(1))
        const snapshot = await getDocs(q)
        
        if (snapshot.empty) {
          if (!cancelled) {
            setError('Комната не найдена')
            setLoading(false)
          }
          return
        }

        const gameDoc = snapshot.docs[0]
        const data = gameDoc.data() as GameData
        const docId = gameDoc.id
        setGameDocId(docId)

        let assignedColor: 'w' | 'b' | null = null
        let currentOpponent = ''
        let currentJoined = false

        if (data.white_player_id === user.uid) {
          assignedColor = 'w'
          currentOpponent = data.black_name || ''
          currentJoined = !!data.black_player_id
        } else if (data.black_player_id === user.uid) {
          assignedColor = 'b'
          currentOpponent = data.white_name || ''
          currentJoined = !!data.white_player_id
        } else if (!data.white_player_id || !data.black_player_id) {
          // Join as the empty slot
          await runTransaction(db, async (transaction) => {
            const freshDoc = await transaction.get(gameDoc.ref)
            const freshData = freshDoc.data() as GameData

            if (!freshData.white_player_id) {
              transaction.update(gameDoc.ref, {
                white_player_id: user.uid,
                white_name: user.displayName || 'Игрок',
              })
              assignedColor = 'w'
              currentOpponent = freshData.black_name || ''
              currentJoined = !!freshData.black_player_id
            } else if (!freshData.black_player_id) {
              transaction.update(gameDoc.ref, {
                black_player_id: user.uid,
                black_name: user.displayName || 'Игрок',
              })
              assignedColor = 'b'
              currentOpponent = freshData.white_name || ''
              currentJoined = !!freshData.white_player_id
            } else {
              throw new Error('Room is full')
            }
          })
        } else {
          if (!cancelled) {
            setError('Комната уже заполнена')
            setLoading(false)
          }
          return
        }

        if (cancelled) return

        setPlayerColor(assignedColor)
        setOpponentName(currentOpponent)
        setOpponentJoined(currentJoined)
        opponentJoinedRef.current = currentJoined
        setIsMyTurn(data.turn === assignedColor)

        const g = new Chess()
        if (data.pgn) g.loadPgn(data.pgn)
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
      } catch (err: any) {
        console.error('[Game] Load/Join error:', err)
        if (!cancelled) {
          setError(err.message === 'Room is full' ? 'Комната уже заполнена' : 'Ошибка загрузки игры')
          setLoading(false)
        }
      }
    }

    loadAndJoin()

    return () => { cancelled = true }
  }, [roomCode, user, updateGameState])

  // Realtime Subscription
  useEffect(() => {
    if (!gameDocId) return

    const unsubscribe = onSnapshot(doc(db, 'games', gameDocId), (snapshot) => {
      const newData = snapshot.data() as GameData
      if (!newData) return

      console.log('[Firestore] Update received:', newData)

      // Opponent joining
      if (playerColor === 'w' && newData.black_player_id && !opponentJoinedRef.current) {
        setOpponentJoined(true)
        opponentJoinedRef.current = true
        setOpponentName(newData.black_name || 'Соперник')
      }
      if (playerColor === 'b' && newData.white_player_id && !opponentJoinedRef.current) {
        setOpponentJoined(true)
        opponentJoinedRef.current = true
        setOpponentName(newData.white_name || 'Соперник')
      }

      // Game Over
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
      }

      // Moves
      if (newData.pgn && newData.pgn !== lastPgnRef.current) {
        const g = new Chess()
        try {
          g.loadPgn(newData.pgn)
          updateGameState(g)
          lastPgnRef.current = g.pgn()
          soundManager.play('move')
          useReactionStore.getState().resetMoveCounter()
        } catch { /* ignore */ }
      }

      // Requests
      setUndoRequest(newData.undo_request)
      setDrawRequest(newData.draw_request)
      setRematchRequest(newData.rematch_request)

      // Turn
      if (newData.turn && playerColor) {
        setIsMyTurn(newData.turn === playerColor)
      }

      // Reactions
      if (newData.reactions && Array.isArray(newData.reactions)) {
        const currentReactions = useReactionStore.getState().reactions
        if (newData.reactions.length > currentReactions.length && user) {
          const latest = newData.reactions[newData.reactions.length - 1]
          if (latest.playerId !== user.uid) {
            addReaction(latest)
          }
        }
      }
    })

    return () => unsubscribe()
  }, [gameDocId, user, playerColor, updateGameState, gameOver])

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
      
      // Update local state first for responsiveness
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
        // Rollback
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

  const handleUndoRequest = async () => {
    if (!gameDocId || !user || gameOver) return
    if (moveHistory.length === 0) return
    try {
      await updateDoc(doc(db, 'games', gameDocId), {
        undo_request: { from_id: user.uid, created_at: Date.now() }
      })
    } catch {
      addToast('Ошибка при отправке запроса', 'error')
    }
  }

  const handleAcceptUndo = async () => {
    if (!gameDocId || !undoRequest) return
    try {
      const g = new Chess()
      g.loadPgn(lastPgnRef.current)
      const halfMoves = g.history().length
      g.undo()
      if (halfMoves >= 2) g.undo()
      
      const newPgn = g.pgn()
      
      await updateDoc(doc(db, 'games', gameDocId), {
        pgn: newPgn,
        fen: g.fen(),
        turn: g.turn(),
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

  const handleDrawRequest = async () => {
    if (!gameDocId || !user || gameOver || !opponentJoined) return
    try {
      await updateDoc(doc(db, 'games', gameDocId), {
        draw_request: { from_id: user.uid, created_at: Date.now() }
      })
    } catch {
      addToast('Ошибка при предложении ничьей', 'error')
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

  if (loading) return <LoadingScreen isLoading={true} />
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg p-6 text-center">
        <h2 className="text-xl font-bold text-text mb-4">{error}</h2>
        <Button onClick={() => navigate('/')}>Вернуться в лобби</Button>
      </div>
    )
  }

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
            </div>
          </div>

          <div className="game-side-column space-y-[var(--space-20)]">
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
                onClick={() => setShowUndoConfirm(true)}
                disabled={gameOver || moveHistory.length === 0}
              >
                Отмена
              </Button>
              <Button 
                variant="primary" 
                size="sm" 
                fullWidth 
                onClick={() => setShowDrawConfirm(true)}
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
          x={reactionPos.x}
          y={reactionPos.y}
          onSelect={handleEmojiSelect}
          onClose={() => setShowReactionPicker(false)}
        />
      )}

      <RequestModal
        isOpen={undoRequest && undoRequest.from_id !== user.uid}
        title="Запрос отмены"
        description="Соперник просит отменить последний ход"
        onAccept={handleAcceptUndo}
        onReject={handleRejectUndo}
      />

      <RequestModal
        isOpen={drawRequest && drawRequest.from_id !== user.uid}
        title="Предложение ничьей"
        description="Соперник предлагает ничью"
        onAccept={handleAcceptDraw}
        onReject={() => updateDoc(doc(db, 'games', gameDocId!), { draw_request: null })}
      />

      <ConfirmDialog
        isOpen={showResignConfirm}
        title="Сдаться?"
        onConfirm={handleResign}
        onCancel={() => setShowResignConfirm(false)}
      />
      
      {/* ... other confirm dialogs ... */}
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
