import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import GameLayout from '@/components/GameLayout'
import ChessBoard from '@/components/board/ChessBoard'
import Card from '@/components/Card'
import Button from '@/components/Button'
import PixelConfetti from '@/components/PixelConfetti'
import PromotionPicker from '@/components/PromotionPicker'
import { createEngine, type EngineAPI } from '@/lib/engine'
import { PUZZLES, type Puzzle } from '@/lib/puzzlesData'
import { useBoardWidth } from '@/hooks/useBoardWidth'
import { soundManager } from '@/lib/soundManager'

export default function IchiPuzzlesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [puzzleIndex, setPuzzleIndex] = useState(0)
  const puzzle = PUZZLES[puzzleIndex] || PUZZLES[0]

  const [engine, setEngine] = useState<EngineAPI>(() => createEngine('standard', puzzle.fen))
  const [fen, setFen] = useState(() => puzzle.fen)
  const [stepIndex, setStepIndex] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'hint'; message: string } | null>(null)
  const [hintSquare, setHintSquare] = useState<string | null>(null)

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoves, setLegalMoves] = useState<string[]>([])
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [checkSquare, setCheckSquare] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null)

  const boardContainerRef = useRef<HTMLDivElement>(null)
  const { stableWidth } = useBoardWidth(boardContainerRef, true)

  const loadPuzzle = useCallback((targetPuzzle: Puzzle) => {
    const newEngine = createEngine('standard', targetPuzzle.fen)
    setEngine(newEngine)
    setFen(targetPuzzle.fen)
    setStepIndex(0)
    setIsCompleted(false)
    setFeedback(null)
    setHintSquare(null)
    setSelectedSquare(null)
    setLegalMoves([])
    setLastMove(null)
    setCheckSquare(null)
    setShowConfetti(false)
  }, [])

  useEffect(() => {
    loadPuzzle(puzzle)
  }, [puzzleIndex, loadPuzzle])

  const checkPromotion = (from: string, to: string): boolean => {
    const piece = engine.get(from as any)
    if (piece?.type !== 'p') return false
    if (piece.color === 'w' && to[1] === '8') return true
    if (piece.color === 'b' && to[1] === '1') return true
    return false
  }

  const handlePlayerMove = useCallback((from: string, to: string, promotion?: string) => {
    if (isCompleted) return false

    const expectedUci = puzzle.solution[stepIndex]
    if (!expectedUci) return false

    const expectedFrom = expectedUci.slice(0, 2)
    const expectedTo = expectedUci.slice(2, 4)
    const expectedPromo = expectedUci.length > 4 ? expectedUci.slice(4, 5) : undefined

    const isMatch = from === expectedFrom && to === expectedTo && (!expectedPromo || promotion === expectedPromo)

    if (!isMatch) {
      soundManager.play('check')
      setFeedback({
        type: 'error',
        message: 'Неверный ход. Попробуйте другой вариант!'
      })
      setSelectedSquare(null)
      setLegalMoves([])
      return false
    }

    // Move is correct!
    const moveRes = engine.move({ from, to, promotion })
    if (!moveRes) return false

    soundManager.play(engine.inCheck() ? 'check' : 'move')
    setFen(engine.fen())
    setLastMove({ from, to })
    setSelectedSquare(null)
    setLegalMoves([])
    setHintSquare(null)

    const nextStep = stepIndex + 1

    if (nextStep >= puzzle.solution.length) {
      // Puzzle solved!
      setIsCompleted(true)
      setShowConfetti(true)
      soundManager.play('checkmate')
      setFeedback({
        type: 'success',
        message: 'Великолепно! Задача решена верно! 🎉'
      })
      setStepIndex(nextStep)
      return true
    }

    // Multi-step puzzle: bot reply
    setStepIndex(nextStep)
    setFeedback({
      type: 'hint',
      message: 'Верно! Соперник отвечает...'
    })

    const botUci = puzzle.solution[nextStep]
    if (botUci) {
      setTimeout(() => {
        const bFrom = botUci.slice(0, 2)
        const bTo = botUci.slice(2, 4)
        const bPromo = botUci.length > 4 ? botUci.slice(4, 5) : undefined
        engine.move({ from: bFrom, to: bTo, promotion: bPromo })
        soundManager.play(engine.inCheck() ? 'check' : 'move')
        setFen(engine.fen())
        setLastMove({ from: bFrom, to: bTo })
        setStepIndex(nextStep + 1)
        setFeedback(null)
      }, 500)
    }

    return true
  }, [engine, isCompleted, puzzle, stepIndex])

  const onSquareClick = (square: string) => {
    if (isCompleted) return

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null)
        setLegalMoves([])
        return
      }

      if (checkPromotion(selectedSquare, square) && legalMoves.includes(square)) {
        setPendingPromotion({ from: selectedSquare, to: square })
        return
      }

      if (legalMoves.includes(square)) {
        handlePlayerMove(selectedSquare, square)
        return
      }
    }

    const piece = engine.get(square as any)
    if (piece && piece.color === puzzle.playerColor) {
      setSelectedSquare(square)
      const moves = engine.moves({ square: square as any, verbose: true })
      setLegalMoves(moves.map((m: any) => m.to))
    } else {
      setSelectedSquare(null)
      setLegalMoves([])
    }
  }

  const handleHint = () => {
    if (isCompleted) return
    const expectedUci = puzzle.solution[stepIndex]
    if (expectedUci) {
      const fromSq = expectedUci.slice(0, 2)
      setHintSquare(fromSq)
      setFeedback({
        type: 'hint',
        message: puzzle.hint
      })
    }
  }

  const handleNextPuzzle = () => {
    if (puzzleIndex < PUZZLES.length - 1) {
      setPuzzleIndex(prev => prev + 1)
    } else {
      setPuzzleIndex(0)
    }
  }

  const handlePrevPuzzle = () => {
    if (puzzleIndex > 0) {
      setPuzzleIndex(prev => prev - 1)
    } else {
      setPuzzleIndex(PUZZLES.length - 1)
    }
  }

  const customSquareStyles: Record<string, React.CSSProperties> = {}
  if (hintSquare) {
    customSquareStyles[hintSquare] = {
      boxShadow: 'inset 0 0 0 3px #a3c18f, 0 0 12px rgba(163, 193, 143, 0.7)',
      backgroundColor: 'rgba(163, 193, 143, 0.3)',
    }
  }

  return (
    <GameLayout user={user}>
      {showConfetti && <PixelConfetti />}

      <div className="game-layout-container">
        <div className="game-main-column">
          <div 
            className="mx-auto mb-[var(--space-12)] flex items-center justify-between px-[var(--space-8)]"
            style={{ width: stableWidth || '100%', maxWidth: '100%' }}
          >
            <div className="flex items-center gap-[var(--space-8)] text-[var(--font-size-sm)] font-bold">
              <img 
                src={`${import.meta.env.BASE_URL || '/'}emojis/tournament_new.png`} 
                alt="puzzle" 
                className="w-5 h-5 object-contain"
              />
              <span className="text-[var(--accent-brand)] truncate">
                {puzzle.title}
              </span>
            </div>

            <div className="text-right flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary opacity-80">
                Задача {puzzleIndex + 1} / {PUZZLES.length}
              </span>
            </div>
          </div>

          <div 
            ref={boardContainerRef}
            className="relative flex justify-center items-center select-none"
            style={{ width: '100%' }}
          >
            <ChessBoard
              game={engine}
              position={fen}
              lastMove={lastMove}
              checkSquare={checkSquare}
              selectedSquare={selectedSquare}
              legalMoves={legalMoves}
              onDrop={(src, tgt) => {
                if (checkPromotion(src, tgt)) {
                  setPendingPromotion({ from: src, to: tgt })
                  return true
                }
                return handlePlayerMove(src, tgt)
              }}
              onSquareClick={onSquareClick}
              boardWidth={stableWidth}
              boardOrientation={puzzle.playerColor === 'w' ? 'white' : 'black'}
              customSquareStyles={customSquareStyles}
            />

            {pendingPromotion && (
              <PromotionPicker
                to={pendingPromotion.to}
                color={puzzle.playerColor}
                onSelect={(piece) => {
                  handlePlayerMove(pendingPromotion.from, pendingPromotion.to, piece)
                  setPendingPromotion(null)
                }}
                onCancel={() => setPendingPromotion(null)}
              />
            )}
          </div>

          {feedback && (
            <div 
              className={`mx-auto mt-[var(--space-12)] p-[var(--space-12)] rounded-[var(--radius-8)] border text-center animate-fade-in ${
                feedback.type === 'success' 
                  ? 'border-[var(--success)] bg-[var(--success)]/15 text-[var(--success)]' 
                  : feedback.type === 'error'
                  ? 'border-[var(--danger)] bg-[var(--danger)]/15 text-[var(--danger)]'
                  : 'border-[var(--accent-brand)]/40 bg-[var(--accent-brand)]/10 text-[var(--accent-brand)]'
              }`}
              style={{ width: stableWidth || '100%', maxWidth: '100%' }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider">
                {feedback.message}
              </p>
            </div>
          )}
        </div>

        <div className="game-side-column">
          <Card padding="sm">
            <div className="flex items-center justify-between mb-[var(--space-12)]">
              <h3 className="text-[var(--font-size-sm)] font-semibold text-text">
                Тактическая задача
              </h3>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                puzzle.difficulty === 'easy' ? 'bg-[var(--success)]/20 text-[var(--success)]' :
                puzzle.difficulty === 'medium' ? 'bg-[var(--accent-brand)]/20 text-[var(--accent-brand)]' :
                'bg-[var(--danger)]/20 text-[var(--danger)]'
              }`}>
                {puzzle.difficulty === 'easy' ? 'Лёгкая' : puzzle.difficulty === 'medium' ? 'Средняя' : 'Сложная'}
              </span>
            </div>

            <p className="text-text-secondary text-[12px] leading-relaxed mb-[var(--space-16)]">
              {puzzle.description}
            </p>

            <div className="space-y-2 mb-[var(--space-16)]">
              {isCompleted ? (
                <Button 
                  variant="primary" 
                  size="sm"
                  fullWidth 
                  onClick={handleNextPuzzle}
                  className="border border-[var(--accent-brand)]/50 hover:border-[var(--accent-brand)]"
                >
                  Следующая задача
                </Button>
              ) : (
                <Button 
                  variant="primary" 
                  size="sm"
                  fullWidth 
                  onClick={handleHint}
                  className="border border-[var(--accent-brand)]/50 hover:border-[var(--accent-brand)]"
                >
                  Подсказка
                </Button>
              )}

              <Button 
                variant="outline" 
                size="sm"
                fullWidth 
                onClick={() => loadPuzzle(puzzle)}
              >
                Начать заново
              </Button>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handlePrevPuzzle}
                >
                  Назад
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleNextPuzzle}
                >
                  Вперёд
                </Button>
              </div>
            </div>

            <div className="mt-[var(--space-16)] pt-[var(--space-8)] border-t border-[var(--border)]">
              <Button variant="outline" size="sm" fullWidth onClick={() => navigate('/ichi')}>
                Назад к Ичи
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </GameLayout>
  )
}
