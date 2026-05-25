import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import ChessBoard from '@/components/board/ChessBoard'
import { useGameStore } from '@/stores/gameStore'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useBoardWidth } from '@/hooks/useBoardWidth'
import Card from '@/components/Card'
import CustomSelect from '@/components/CustomSelect'
import SettingsDropdown from '@/components/SettingsDropdown'
import UserMenu from '@/components/UserMenu'
import Footer from '@/components/Footer'
import type { BotLevel } from '@/types'

export default function BotPage() {
  const { user } = useAuth()
  const { game, status, currentTurn, selectedSquare, legalMoves, lastMove, checkSquare, moveHistory, isGameOver, makeMove, selectSquare, resetGame, saveGame } = useGameStore()
  const [initialized, setInitialized] = useState(false)
  const gameRef = useRef(game)
  const savedRef = useRef(false)
  
  const boardContainerRef = useRef<HTMLDivElement>(null)
  const { stableWidth } = useBoardWidth(boardContainerRef, true)

  useEffect(() => {
    if (!initialized) {
      resetGame()
      setInitialized(true)
    }
  }, [])

  const [level, setLevel] = useState<BotLevel>('medium')
  const [isBotThinking, setIsBotThinking] = useState(false)

  useEffect(() => {
    gameRef.current = game
  }, [game])

  useEffect(() => {
    if (isGameOver && !savedRef.current) {
      savedRef.current = true
      saveGame('bot', level)
    }
    if (!isGameOver) {
      savedRef.current = false
    }
  }, [isGameOver, saveGame, level])

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
            <CustomSelect
              value={level}
              onChange={(val) => setLevel(val as BotLevel)}
              options={[
                { value: 'easy', label: 'Лёгкий' },
                { value: 'medium', label: 'Средний' },
                { value: 'hard', label: 'Сильный' },
              ]}
            />
            {user && <UserMenu />}
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-[var(--space-24)] py-[var(--space-48)] flex-1 w-full">
        <div className="game-layout-container">
          <div className="game-main-column">
            <div className="mb-[var(--space-16)] text-center game:text-left">
              <h2 className={`text-[var(--font-size-lg)] font-bold ${statusClasses[status]}`}>
                {statusText}
              </h2>
            </div>
            <div
              ref={boardContainerRef}
              className="board-container"
            >
              {stableWidth > 0 ? (
                <ChessBoard
                  game={game}
                  lastMove={lastMove}
                  checkSquare={checkSquare}
                  selectedSquare={selectedSquare}
                  legalMoves={legalMoves}
                  onDrop={onDrop}
                  onSquareClick={onSquareClick}
                  boardWidth={stableWidth}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[var(--surface-elevated)] rounded-12 animate-pulse">
                  <div className="text-[var(--font-size-xs)] text-text-secondary opacity-50 text-center p-4">
                    Загрузка шахматной доски...
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="game-side-column">
            <Card padding="sm">
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

      <Footer />
    </div>
  )
}
