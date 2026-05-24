import { useNavigate } from 'react-router-dom'
import ChessBoard from '@/components/board/ChessBoard'
import { useGameStore } from '@/stores/gameStore'
import { useState, useEffect, useRef } from 'react'
import { useBoardWidth } from '@/hooks/useBoardWidth'
import Card from '@/components/Card'
import SettingsDropdown from '@/components/SettingsDropdown'
import UserMenu from '@/components/UserMenu'
import { useAuth } from '@/hooks/useAuth'

export default function LocalPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { game, status, currentTurn, selectedSquare, legalMoves, lastMove, checkSquare, moveHistory, isGameOver, makeMove, selectSquare, resetGame, saveGame } = useGameStore()
  const [initialized, setInitialized] = useState(false)
  const savedRef = useRef(false)

  const boardContainerRef = useRef<HTMLDivElement>(null)
  const { stableWidth } = useBoardWidth(boardContainerRef, true)

  useEffect(() => {
    if (!initialized) {
      resetGame()
      setInitialized(true)
    }
  }, [])

  useEffect(() => {
    if (isGameOver && !savedRef.current) {
      savedRef.current = true
      saveGame('local')
    }
    if (!isGameOver) {
      savedRef.current = false
    }
  }, [isGameOver, saveGame])

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    return makeMove(sourceSquare, targetSquare)
  }

  const onSquareClick = (square: string) => {
    selectSquare(square)
  }

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
    <div className="min-h-[100dvh] flex flex-col bg-bg">
      <header className="px-[var(--space-24)] py-[var(--space-32)] bg-bg">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-[var(--space-12)]">
          <button 
            onClick={() => navigate('/')}
            className="text-[10px] font-bold text-text-secondary hover:text-text transition-colors uppercase tracking-widest"
            style={{ fontFamily: 'var(--font-family-ui)' }}
          >
            В лобби
          </button>
          <h1 className="text-[var(--font-size-md)] font-bold text-text tracking-[0.02em] uppercase">
            Игра вдвоём
          </h1>
            <div className="flex items-center gap-[var(--space-12)]">
              <SettingsDropdown />
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
    </div>
  )
}
