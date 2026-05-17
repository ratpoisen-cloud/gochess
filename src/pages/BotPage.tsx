import { useNavigate } from 'react-router-dom'
import ChessBoard from '@/components/board/ChessBoard'
import { useGameStore } from '@/stores/gameStore'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useBoardWidth } from '@/hooks/useBoardWidth'
import Button from '@/components/Button'
import Card from '@/components/Card'
import type { BotLevel } from '@/types'

export default function BotPage() {
  const navigate = useNavigate()
  const { game, status, currentTurn, selectedSquare, legalMoves, lastMove, checkSquare, moveHistory, makeMove, selectSquare, resetGame } = useGameStore()

  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!initialized) {
      resetGame()
      setInitialized(true)
    }
  }, [])

  const boardContainerRef = useRef<HTMLDivElement>(null)
  const boardWidth = useBoardWidth(boardContainerRef)
  const gameRef = useRef(game)

  useEffect(() => {
    gameRef.current = game
  }, [game])

  const [level, setLevel] = useState<BotLevel>('medium')
  const [isBotThinking, setIsBotThinking] = useState(false)

  const onDrop = useCallback((sourceSquare: string, targetSquare: string) => {
    const success = makeMove(sourceSquare, targetSquare)
    if (success) {
      setTimeout(() => {
        setIsBotThinking(true)
        const currentGame = gameRef.current
        const moves = currentGame.moves({ verbose: true })
        if (moves.length > 0 && !currentGame.isGameOver()) {
          const randomMove = moves[Math.floor(Math.random() * moves.length)]
          makeMove(randomMove.from, randomMove.to, randomMove.promotion)
        }
        setIsBotThinking(false)
      }, 500)
    }
    return success
  }, [makeMove])

  const onSquareClick = (square: string) => {
    selectSquare(square)
  }

  const statusText = status === 'checkmate' ? 'Мат!'
    : status === 'stalemate' ? 'Пат — ничья'
    : status === 'draw' ? 'Ничья'
    : status === 'check' ? 'Шах!'
    : isBotThinking ? 'Бот думает...'
    : currentTurn === 'w' ? 'Ход белых' : 'Ход чёрных'

  const statusClasses = {
    checkmate: 'text-[var(--danger)]',
    stalemate: 'text-text-secondary',
    draw: 'text-text-secondary',
    check: 'text-[var(--danger)]',
    playing: isBotThinking ? 'text-[var(--accent)] animate-pulse' : currentTurn === 'w' ? 'text-[var(--accent)]' : 'text-text',
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="border-b border-[color-mix(in_srgb,var(--border)_60%,transparent)] px-[var(--space-20)] py-[var(--space-16)]">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-[var(--space-12)]">
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            ← В лобби
          </Button>
          <h1 className="text-[var(--font-size-md)] font-bold text-text tracking-[0.02em]">
            Игра с ботом
          </h1>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as BotLevel)}
            className="px-[var(--space-12)] py-[var(--space-8)] bg-[var(--surface-elevated)] border border-[color-mix(in_srgb,var(--accent)_14%,var(--border))] rounded-12 text-[var(--font-size-xs)] text-text min-h-[44px]"
          >
            <option value="easy">Лёгкий</option>
            <option value="medium">Средний</option>
            <option value="hard">Сильный</option>
          </select>
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
            <div
              ref={boardContainerRef}
              className="w-full max-w-[min(100%,760px)] mx-auto aspect-square"
            >
              {boardWidth > 0 && (
                <ChessBoard
                  game={game}
                  lastMove={lastMove}
                  checkSquare={checkSquare}
                  selectedSquare={selectedSquare}
                  legalMoves={legalMoves}
                  onDrop={onDrop}
                  onSquareClick={onSquareClick}
                  boardWidth={boardWidth}
                />
              )}
            </div>
          </div>

          <div className="w-full game:w-[var(--game-side-column-width)]">
            <Card padding="sm">
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
          </div>
        </div>
      </main>
    </div>
  )
}
