import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { type Move } from 'chess.js'
import { db } from '@/lib/firebase'
import { doc, updateDoc, runTransaction } from 'firebase/firestore'
import LoadingScreen from '@/components/LoadingScreen'
import { useAuth } from '@/hooks/useAuth'
import { useBoardWidth } from '@/hooks/useBoardWidth'
import { useGameSync } from '@/hooks/useGameSync'
import { useReactionStore, type Reaction } from '@/stores/reactionStore'
import { useBoardStore } from '@/stores/boardStore'
import ChessBoard from '@/components/board/ChessBoard'
import ChessTimer from '@/components/board/ChessTimer'
import Button from '@/components/Button'
import SettingsDropdown from '@/components/SettingsDropdown'
import UserMenu from '@/components/UserMenu'
import ReactionPicker from '@/components/ReactionPicker'
import { useToast } from '@/components/Toast'
import RequestModal from '@/components/RequestModal'
import Card from '@/components/Card'
import Footer from '@/components/Footer'
import AuthModal from '@/components/AuthModal'
import PixelConfetti from '@/components/PixelConfetti'
import FogRulesModal from '@/components/FogRulesModal'

const BASE = import.meta.env.BASE_URL || '/'

export default function GamePage() {
  const { user, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { getPieceUrl, getTheme } = useBoardStore()
  const { roomCode } = useParams<{ roomCode: string }>()

  const sync = useGameSync(roomCode, user, authLoading)

  // UI-only state
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoves, setLegalMoves] = useState<string[]>([])
  const [isRulesOpen, setIsRulesOpen] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [reactionSquare, setReactionSquare] = useState<string | null>(null)
  const [reactionPos, setReactionPos] = useState<{ x: number; y: number } | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [showResignConfirm, setShowResignConfirm] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pgnCopied, setPgnCopied] = useState(false)

  const {
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
  } = sync

  const { addToast } = useToast()
  const boardContainerRef = useRef<HTMLDivElement>(null)
  const { stableWidth } = useBoardWidth(boardContainerRef, !loading)

  const checkPromotion = (from: string, to: string): boolean => {
    const piece = game.get(from as any)
    if (piece?.type !== 'p') return false
    if (piece.color === 'w' && to[1] === '8') return true
    if (piece.color === 'b' && to[1] === '1') return true
    return false
  }

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

    const g = game
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
  }, [gameOver, isMyTurn, selectedSquare, legalMoves, playerColor, makeMove, game])

  const handleReactionSquare = (square: string, clientX: number, clientY: number) => {
    setReactionSquare(square)
    setReactionPos({ x: clientX, y: clientY })
    setShowReactionPicker(true)
  }

  const handleEmojiSelect = async (emojiUrl: string) => {
    if (!gameDocId || !user || !reactionSquare || !playerColor) return

    const reaction: Reaction = {
      id: Math.random().toString(36).slice(2, 10),
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
          reactions: [...reactions, reaction].slice(-20),
        })
      })
    } catch {
      addToast('Ошибка отправки реакции', 'error')
    }
  }

  useEffect(() => {
    if (rematchGameId) {
      addToast('Реванш создан! Переход...', 'success')
      const timer = setTimeout(() => navigate(`/game/${rematchGameId}`), 1500)
      return () => clearTimeout(timer)
    }
  }, [rematchGameId, navigate, addToast])

  const copyPgn = () => {
    try {
      navigator.clipboard.writeText(game.pgn())
      setPgnCopied(true)
      addToast('PGN скопирован', 'success')
      setTimeout(() => setPgnCopied(false), 2000)
    } catch {
      addToast('Ошибка копирования', 'error')
    }
  }

  // Render
  if (authLoading && !user) return <LoadingScreen isLoading={true} />
  if (error) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-bg p-6 text-center">
        <h2 className="text-xl font-bold text-text mb-4">{error}</h2>
        <Button onClick={() => navigate('/')}>Вернуться в лобби</Button>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-bg p-6 text-center">
        <h2 className="text-xl font-bold text-text mb-4">Требуется вход</h2>
        <Button onClick={() => setIsAuthModalOpen(true)}>Войти</Button>
        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      </div>
    )
  }

  if (loading) return <LoadingScreen isLoading={true} />

  return (
    <div className="min-h-[100dvh] flex flex-col bg-bg">
      <header className="px-[var(--space-24)] max-sm:px-[var(--space-8)] py-[var(--space-32)] max-sm:py-[var(--space-16)] bg-bg">
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

      <main className="max-w-[1200px] mx-auto px-[var(--space-24)] max-sm:px-[var(--space-8)] py-[var(--space-48)] max-sm:py-[var(--space-24)] flex-1 w-full">
        <div className="game-layout-container">
          <div className="game-main-column">
            {timeControl && (
              <div className="mx-auto mb-4" style={{ width: stableWidth || '100%', maxWidth: '100%' }}>
                <ChessTimer
                  timeLeft={playerColor === 'w' ? (blackTimeLeft || 0) : (whiteTimeLeft || 0)}
                  isActive={!isMyTurn && !gameOver && timerStatus === 'active'}
                  label={opponentJoined ? opponentName : 'Соперник'}
                  increment={timeControl.increment}
                />
              </div>
            )}

            <div
              className="mx-auto mb-[var(--space-12)] grid grid-cols-3 items-center px-[var(--space-8)]"
              style={{ width: stableWidth || '100%', maxWidth: '100%' }}
            >
              <div className="flex items-center gap-[var(--space-8)] text-[var(--font-size-sm)] font-bold">
                <span className="text-[var(--accent-brand)] truncate">
                  {opponentJoined ? (opponentName || 'Соперник') : 'Ожидание...'}
                </span>
                {opponentJoined && <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />}
                {gameMode === 'fog_of_war' && (
                  <span className="text-[12px]" title="Туман войны">☁️</span>
                )}
              </div>

              <div className="text-center flex flex-col items-center justify-center gap-1">
                {gameMode === 'fog_of_war' && !gameOver && (
                  <button
                    onClick={() => setIsRulesOpen(true)}
                    className="text-[9px] font-bold text-text-secondary uppercase tracking-[0.2em] hover:text-[var(--accent-brand)] transition-colors"
                  >
                    Правила
                  </button>
                )}

                {(status === 'check' || status === 'checkmate' || status === 'stalemate' || status === 'draw') && (
                  <h2 className={`text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse ${
                    status === 'check' || status === 'checkmate' ? 'text-[var(--danger)]' : 'text-text-secondary'
                  }`}>
                    {gameMode === 'fog_of_war'
                      ? (status === 'draw' || status === 'stalemate' ? 'Ничья' : '')
                      : (status === 'check' ? 'Шах!' : status === 'checkmate' ? 'Мат!' : 'Ничья')
                    }
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
              {gameOver && !resultText.includes('Ничья') && !resultText.includes('договоренности') && stableWidth > 0 && playerColor === winnerColor && (
                <PixelConfetti boardMode lightSquareColor={getTheme().whiteSquare} darkSquareColor={getTheme().blackSquare} />
              )}
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
                    boardOrientation={playerColor === 'b' ? 'black' : 'white'}
                    defeatedKingSquare={endGameState?.defeated}
                    endGameEmojis={endGameState?.emojis}
                    visibleSquares={visibleSquares}
                    gameOverGray={gameOver && !resultText.includes('Ничья') && !resultText.includes('договоренности') && playerColor !== winnerColor}
                    arePiecesDraggable={!gameOver}
                  />

                  {pendingPromotion && (
                    <div className="absolute inset-0 z-[100] bg-black/20 flex items-center justify-center">
                      <div className="bg-[var(--surface-elevated)] max-sm:p-2 max-sm:gap-2 sm:p-4 sm:gap-4 rounded-[var(--radius-14)] shadow-2xl flex">
                        {(['q', 'r', 'b', 'n'] as const).map((piece) => (
                          <button
                            key={piece}
                            onClick={() => {
                              makeMove(pendingPromotion.from, pendingPromotion.to, piece)
                              setPendingPromotion(null)
                            }}
                            className="max-sm:w-12 max-sm:h-12 sm:w-16 sm:h-16 hover:bg-white/10 rounded-lg transition-colors p-1"
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
              ) : (
                <div className="w-full h-full aspect-square flex items-center justify-center bg-[var(--surface-elevated)] rounded-xl animate-pulse">
                  <div className="text-[var(--font-size-xs)] text-text-secondary opacity-50 text-center p-4">
                    Загрузка шахматной доски...
                  </div>
                </div>
              )}
            </div>

            {timeControl && (
              <div className="mx-auto mt-4" style={{ width: stableWidth || '100%', maxWidth: '100%' }}>
                <ChessTimer
                  timeLeft={playerColor === 'w' ? (whiteTimeLeft || 0) : (blackTimeLeft || 0)}
                  isActive={isMyTurn && !gameOver && timerStatus === 'active'}
                  label="Ваше время"
                  increment={timeControl.increment}
                />
              </div>
            )}

            {gameOver && resultText && (
              <div
                className="mx-auto mt-4 py-[var(--space-12)] px-[var(--space-16)] bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[var(--radius-14)] text-center animate-modal-pixel-in shadow-xl"
                style={{ width: stableWidth || '100%', maxWidth: '100%' }}
              >
                <p className="text-[var(--font-size-sm)] font-bold text-[var(--accent-brand)] uppercase tracking-[0.2em]">
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
                        color: 'black',
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
                <div className="flex items-center gap-2">
                  <h3 className="text-[var(--font-size-sm)] font-semibold text-text">Ходы</h3>
                  <button
                    onClick={copyPgn}
                    title="Копировать PGN"
                    className={`p-1 rounded hover:bg-white/5 transition-colors ${pgnCopied ? 'text-[var(--success)]' : 'text-text-secondary'}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
                <span className="text-[10px] text-text-secondary uppercase tracking-widest opacity-60">
                  {moveHistory.length} полуходов
                </span>
              </div>
              <div className="max-h-[200px] max-sm:max-h-[25dvh] overflow-y-auto custom-scrollbar pr-2">
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
              {!gameOver ? (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    onClick={() => {
                      if (!gameDocId || !user || gameOver || moveHistory.length === 0) return
                      updateDoc(doc(db, 'games', gameDocId), {
                        undo_request: { from_id: user.uid, created_at: Date.now() },
                      }).catch(() => addToast('Ошибка при отправке запроса', 'error'))
                    }}
                    disabled={moveHistory.length === 0 || (!!(undoRequest && user && undoRequest.from_id === user.uid))}
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
                        draw_request: { from_id: user.uid, created_at: Date.now() },
                      }).catch(() => addToast('Ошибка при предложении ничьей', 'error'))
                    }}
                    disabled={!opponentJoined}
                  >
                    Ничья
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  onClick={handleRematch}
                  className="col-span-2 border-[var(--accent-brand)] border"
                  disabled={rematchGameId !== null}
                >
                  {rematchGameId ? 'Переход...' : isRematchProposed ? 'Принять реванш' : 'Реванш'}
                </Button>
              )}
            </div>
            {!gameOver && (
              <Button
                variant="primary"
                size="sm"
                fullWidth
                className="hover:!bg-[var(--danger-soft)]"
                onClick={() => setShowResignConfirm(true)}
              >
                Сдаться
              </Button>
            )}
          </div>
        </div>
      </main>

      <Footer />

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

      <FogRulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
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
          <Button variant="primary" fullWidth onClick={() => { onConfirm(); onCancel() }}>Да</Button>
          <Button variant="primary" fullWidth onClick={onCancel} className="bg-transparent opacity-60">Нет</Button>
        </div>
      </Card>
    </div>
  )
}
