import { useParams, useNavigate } from 'react-router-dom'
import { Chessboard } from 'react-chessboard'
import { useGameStore } from '@/stores/gameStore'
import { useBoardStore } from '@/stores/boardStore'
import { useReactionStore } from '@/stores/reactionStore'
import { useToast } from '@/components/Toast'
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import Button from '@/components/Button'
import Card from '@/components/Card'
import ReactionPicker from '@/components/ReactionPicker'

export default function GamePage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const {
    game,
    status,
    currentTurn,
    selectedSquare,
    legalMoves,
    lastMove,
    checkSquare,
    moveHistory,
    makeMove,
    selectSquare,
    resetGame,
  } = useGameStore()

  const { getTheme, getPieceUrl, selectedPieceSet } = useBoardStore()
  const theme = getTheme()

  const customPieces = useMemo(() => {
    const pieces: Record<string, (args: { isDragging: boolean; squareWidth: number }) => React.ReactElement> = {}
    const codes = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP']
    codes.forEach((code) => {
      pieces[code] = () => (
        <img
          src={getPieceUrl(code)}
          alt={code}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          draggable={false}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )
    })
    return pieces
  }, [getPieceUrl, selectedPieceSet])

  const { activeReactions, addReaction, canSendReaction, clearExpired } = useReactionStore()
  const { addToast } = useToast()

  const [reactionPickerSquare, setReactionPickerSquare] = useState<string | null>(null)
  const [boardRect, setBoardRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    resetGame()
  }, [roomId, resetGame])

  useEffect(() => {
    const interval = setInterval(() => {
      clearExpired()
    }, 1000)
    return () => clearInterval(interval)
  }, [clearExpired])

  useEffect(() => {
    const updateRect = () => {
      if (boardContainerRef.current) {
        setBoardRect(boardContainerRef.current.getBoundingClientRect())
      }
    }
    updateRect()
    window.addEventListener('resize', updateRect)
    return () => window.removeEventListener('resize', updateRect)
  }, [])

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    return makeMove(sourceSquare, targetSquare)
  }

  const onSquareClick = (square: string) => {
    selectSquare(square)
  }

  const handleReactionSelect = useCallback((square: string, emoji: string) => {
    const cycleKey = `${currentTurn}_${moveHistory.length}`
    const existing = activeReactions.find(
      (r) => r.square === square && r.expiresAt > Date.now()
    )

    if (existing) {
      addToast('На этой клетке уже есть реакция', 'warning')
      setReactionPickerSquare(null)
      return
    }

    if (!canSendReaction(cycleKey)) {
      addToast('Лимит реакций: до 5 за текущий ходовой цикл', 'warning')
      setReactionPickerSquare(null)
      return
    }

    addReaction(square, emoji, currentTurn)
    setReactionPickerSquare(null)
  }, [currentTurn, moveHistory.length, activeReactions, canSendReaction, addReaction, addToast])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const squareEl = (e.target as HTMLElement).closest('[data-square]')
    if (squareEl) {
      const square = squareEl.getAttribute('data-square')
      if (square) {
        setReactionPickerSquare(square)
      }
    }
  }, [])

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {}

    if (lastMove) {
      styles[lastMove.from] = {
        boxShadow: `inset 0 0 0 4px ${theme.highlightPossible}`,
        borderRadius: '4px',
      }
      styles[lastMove.to] = {
        boxShadow: `inset 0 0 0 4px ${theme.highlightPossible}`,
        borderRadius: '4px',
      }
    }

    if (checkSquare) {
      styles[checkSquare] = {
        boxShadow: `inset 0 0 0 4px ${theme.highlightCapture}, 0 0 16px ${theme.highlightCaptureShadow}`,
        borderRadius: '4px',
      }
    }

    if (selectedSquare) {
      styles[selectedSquare] = {
        boxShadow: `inset 0 0 0 4px ${theme.highlightSelected}`,
      }
      legalMoves.forEach((sq) => {
        const isCapture = game.get(sq as any) !== null
        if (isCapture) {
          styles[sq] = {
            boxShadow: `inset 0 0 0 4px ${theme.highlightCapture}`,
            background: `linear-gradient(to bottom, transparent 0%, transparent 100%), radial-gradient(circle, ${theme.highlightCapture} 25%, transparent 25%)`,
            backgroundSize: '100% 100%, 85% 85%',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }
        } else {
          styles[sq] = {
            background: `radial-gradient(circle, ${theme.highlightPossible} 28%, transparent 28%)`,
            boxShadow: `0 0 8px ${theme.highlightPossibleShadow}`,
          }
        }
      })
    }

    return styles
  }, [lastMove, checkSquare, selectedSquare, legalMoves, game, theme])

  const statusText = status === 'checkmate' ? 'Мат!'
    : status === 'stalemate' ? 'Пат — ничья'
    : status === 'draw' ? 'Ничья'
    : status === 'check' ? 'Шах!'
    : currentTurn === 'w' ? 'Ход белых' : 'Ход чёрных'

  const statusClasses = {
    checkmate: 'text-[var(--danger)]',
    stalemate: 'text-text-secondary',
    draw: 'text-text-secondary',
    check: 'text-[var(--danger)]',
    playing: currentTurn === 'w' ? 'text-[var(--accent)]' : 'text-text',
  }

  const [boardWidth, setBoardWidth] = useState(760)
  const boardContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateWidth = () => {
      if (boardContainerRef.current) {
        setBoardWidth(boardContainerRef.current.clientWidth)
      }
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="border-b border-[color-mix(in_srgb,var(--border)_60%,transparent)] px-[var(--space-20)] py-[var(--space-16)]">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            ← В лобби
          </Button>
          <h1 className="text-[var(--font-size-md)] font-bold text-text tracking-[0.02em]">
            {roomId !== 'new' ? `Комната: ${roomId}` : 'Новая игра'}
          </h1>
          <div className="w-[100px]" />
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-[var(--space-20)] py-[var(--space-24)] flex-1">
        <div className="flex flex-col game:flex-row gap-[var(--game-layout-gap)] items-start justify-center">
          <div className="flex-1 max-w-[var(--game-main-column-width)] mx-auto game:mx-0 w-full">
            <div className="mb-[var(--space-16)] text-center game:text-left">
              <h2 className={`text-[var(--font-size-lg)] font-bold ${statusClasses[status]}`}>
                {statusText}
              </h2>
            </div>
            <div ref={boardContainerRef} className="w-full max-w-[min(100%,760px)] mx-auto relative" onContextMenu={handleContextMenu}>
              {boardWidth > 0 && (
                <Chessboard
                  position={game.fen()}
                  onPieceDrop={onDrop}
                  onSquareClick={onSquareClick}
                  boardOrientation="white"
                  boardWidth={boardWidth}
                  customDarkSquareStyle={{ backgroundColor: theme.blackSquare }}
                  customLightSquareStyle={{ backgroundColor: theme.whiteSquare }}
                  customSquareStyles={customSquareStyles}
                  customPieces={customPieces}
                />
              )}

              {activeReactions
                .filter((r) => r.expiresAt > Date.now())
                .map((reaction) => {
                  const files = 'abcdefgh'
                  const fileIndex = files.indexOf(reaction.square[0])
                  const rank = parseInt(reaction.square[1], 10)
                  const timeLeft = reaction.expiresAt - Date.now()
                  const opacity = Math.min(1, timeLeft / 2000)

                  return (
                    <div
                      key={reaction.id}
                      className="absolute pointer-events-none flex items-center justify-center"
                      style={{
                        left: `${(fileIndex / 8) * 100}%`,
                        top: `${((8 - rank) / 8) * 100}%`,
                        width: `${100 / 8}%`,
                        height: `${100 / 8}%`,
                        opacity,
                        transition: 'opacity 0.3s ease',
                      }}
                    >
                      <span className="text-[24px] md:text-[32px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                        {reaction.emoji}
                      </span>
                    </div>
                  )
                })}
            </div>

            {reactionPickerSquare && (
              <ReactionPicker
                square={reactionPickerSquare}
                onSelect={handleReactionSelect}
                onClose={() => setReactionPickerSquare(null)}
                boardRect={boardRect}
              />
            )}
          </div>

          <div className="w-full game:w-[var(--game-side-column-width)]">
            <Card padding="sm" className="mb-[var(--space-14)]">
              <h3 className="text-[var(--font-size-sm)] font-semibold mb-[var(--space-12)] text-text">
                История ходов
              </h3>
              <div
                className="max-h-[350px] overflow-y-auto space-y-1 text-[var(--font-size-xs)]"
                style={{ background: 'var(--move-list-bg)', borderRadius: 'var(--radius-12)', padding: 'var(--space-12)' }}
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

            <Card padding="sm">
              <h3 className="text-[var(--font-size-sm)] font-semibold mb-[var(--space-12)] text-text">
                Информация
              </h3>
              <div className="space-y-[var(--space-8)] text-[var(--font-size-xs)] text-text-secondary">
                <p>
                  FEN:{' '}
                  <span className="text-text font-mono text-[10px] break-all">
                    {game.fen().slice(0, 40)}...
                  </span>
                </p>
                <p className="text-text-secondary text-[10px]">
                  Правый клик на клетке — добавить реакцию
                </p>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
