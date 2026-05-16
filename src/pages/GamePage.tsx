import { useParams, useNavigate } from 'react-router-dom'
import { Chessboard } from 'react-chessboard'
import { useGameStore } from '@/stores/gameStore'
import { useBoardStore } from '@/stores/boardStore'
import { useEffect, useMemo, useState } from 'react'
import Button from '@/components/Button'
import Card from '@/components/Card'

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

  const { getTheme, getAllPieceUrls } = useBoardStore()
  const theme = getTheme()
  const pieceUrls = getAllPieceUrls()

  const [dragSquare, setDragSquare] = useState<string | null>(null)

  useEffect(() => {
    resetGame()
  }, [roomId, resetGame])

  const onDragStart = (sourceSquare: string) => {
    setDragSquare(sourceSquare)
  }

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    setDragSquare(null)
    return makeMove(sourceSquare, targetSquare)
  }

  const onSquareClick = (square: string) => {
    selectSquare(square)
  }

  const dragHighlights = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {}

    if (dragSquare) {
      const moves = game.moves({ square: dragSquare, verbose: true })
      styles[dragSquare] = { backgroundColor: theme.highlightSelected }
      moves.forEach((move) => {
        if (move.captured) {
          styles[move.to] = {
            background: `radial-gradient(circle, transparent 55%, ${theme.highlightCapture} 55%, ${theme.highlightCapture} 70%, transparent 70%)`,
          }
        } else {
          styles[move.to] = {
            background: `radial-gradient(circle, ${theme.highlightPossible} 25%, transparent 25%)`,
            boxShadow: `0 0 0 2px ${theme.highlightPossibleShadow}`,
          }
        }
      })
    }

    return styles
  }, [dragSquare, game, theme])

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {}

    if (lastMove && !dragSquare) {
      styles[lastMove.from] = { backgroundColor: `${theme.highlightPossible}40` }
      styles[lastMove.to] = { backgroundColor: `${theme.highlightPossible}40` }
    }

    if (checkSquare) {
      styles[checkSquare] = {
        background: `radial-gradient(circle, ${theme.highlightCapture} 0%, transparent 70%)`,
      }
    }

    if (selectedSquare && !dragSquare) {
      styles[selectedSquare] = { backgroundColor: theme.highlightSelected }
      legalMoves.forEach((sq) => {
        const isCapture = game.get(sq as any) !== null
        if (isCapture) {
          styles[sq] = {
            background: `radial-gradient(circle, transparent 55%, ${theme.highlightCapture} 55%, ${theme.highlightCapture} 70%, transparent 70%)`,
          }
        } else {
          styles[sq] = {
            background: `radial-gradient(circle, ${theme.highlightPossible} 25%, transparent 25%)`,
            boxShadow: `0 0 0 2px ${theme.highlightPossibleShadow}`,
          }
        }
      })
    }

    return { ...styles, ...dragHighlights }
  }, [lastMove, checkSquare, selectedSquare, legalMoves, dragHighlights, dragSquare, game, theme])

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
        <div className="flex flex-col lg:flex-row gap-[var(--game-layout-gap)] items-start justify-center">
          <div className="flex-1 max-w-[var(--game-main-column-width)] mx-auto lg:mx-0 w-full">
            <div className="mb-[var(--space-16)] text-center lg:text-left">
              <h2 className={`text-[var(--font-size-lg)] font-bold ${statusClasses[status]}`}>
                {statusText}
              </h2>
            </div>
            <div className="w-full max-w-[min(100%,760px)] mx-auto">
              <Chessboard
                position={game.fen()}
                onPieceDragStart={onDragStart}
                onPieceDrop={onDrop}
                onSquareClick={onSquareClick}
                boardOrientation="white"
                customDarkSquareStyle={{ backgroundColor: theme.blackSquare }}
                customLightSquareStyle={{ backgroundColor: theme.whiteSquare }}
                customSquareStyles={customSquareStyles}
                customPieces={pieceUrls}
              />
            </div>
          </div>

          <div className="w-full lg:w-[var(--game-side-column-width)]">
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
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
