import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import GameLayout from '@/components/GameLayout'
import ChessBoard from '@/components/board/ChessBoard'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import PixelConfetti from '@/components/PixelConfetti'
import PromotionPicker from '@/components/PromotionPicker'
import { createEngine, type EngineAPI } from '@/lib/engine'
import { PUZZLES, PUZZLE_THEMES, type Puzzle } from '@/lib/puzzlesData'
import { usePuzzleStore } from '@/stores/puzzleStore'
import { useBoardStore } from '@/stores/boardStore'
import { useBoardWidth } from '@/hooks/useBoardWidth'
import { soundManager } from '@/lib/soundManager'

export default function IchiPuzzlesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { getTheme } = useBoardStore()

  const {
    currentStreak,
    maxStreak,
    selectedCategory,
    markSolved,
    failPuzzle,
    setCategory,
    isSolved,
  } = usePuzzleStore()

  // Filter puzzles based on selectedCategory
  const filteredPuzzles = useMemo(() => {
    if (selectedCategory === 'all') return PUZZLES
    return PUZZLES.filter(p => p.theme === selectedCategory)
  }, [selectedCategory])

  const [puzzleIndex, setPuzzleIndex] = useState(0)
  const currentPuzzle: Puzzle = filteredPuzzles[puzzleIndex] || filteredPuzzles[0] || PUZZLES[0]

  // Engine state
  const [engine, setEngine] = useState<EngineAPI>(() => createEngine('standard', currentPuzzle.fen))
  const [fen, setFen] = useState(() => currentPuzzle.fen)
  const [stepIndex, setStepIndex] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'hint'; message: string } | null>(null)
  
  // 2-level hint: 1 = source square, 2 = source + target square
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0)
  const [hintSquare, setHintSquare] = useState<string | null>(null)
  const [hintTargetSquare, setHintTargetSquare] = useState<string | null>(null)

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoves, setLegalMoves] = useState<string[]>([])
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [checkSquare, setCheckSquare] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null)
  const [isListModalOpen, setIsListModalOpen] = useState(false)

  const boardContainerRef = useRef<HTMLDivElement>(null)
  const botTimerRef = useRef<NodeJS.Timeout | null>(null)
  const { stableWidth, immediateWidth } = useBoardWidth(boardContainerRef, true)
  const currentBoardWidth = immediateWidth || stableWidth

  const updateCheckSquare = useCallback((eng: EngineAPI) => {
    if (eng.inCheck()) {
      const turn = eng.turn()
      for (const file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
        for (const rank of ['1', '2', '3', '4', '5', '6', '7', '8']) {
          const sq = `${file}${rank}`
          const piece = eng.get(sq as any)
          if (piece && piece.type === 'k' && piece.color === turn) {
            setCheckSquare(sq)
            return
          }
        }
      }
    } else {
      setCheckSquare(null)
    }
  }, [])

  const loadPuzzle = useCallback((targetPuzzle: Puzzle) => {
    if (botTimerRef.current) {
      clearTimeout(botTimerRef.current)
      botTimerRef.current = null
    }
    const newEngine = createEngine('standard', targetPuzzle.fen)
    setEngine(newEngine)
    setFen(targetPuzzle.fen)
    setStepIndex(0)
    setIsCompleted(false)
    setIsThinking(false)
    setFeedback(null)
    setHintLevel(0)
    setHintSquare(null)
    setHintTargetSquare(null)
    setSelectedSquare(null)
    setLegalMoves([])
    setLastMove(null)
    updateCheckSquare(newEngine)
    setShowConfetti(false)
  }, [updateCheckSquare])

  // Clean up bot timer on unmount
  useEffect(() => {
    return () => {
      if (botTimerRef.current) {
        clearTimeout(botTimerRef.current)
        botTimerRef.current = null
      }
    }
  }, [])

  // Keep index within bounds when category changes
  useEffect(() => {
    setPuzzleIndex(0)
  }, [selectedCategory])

  useEffect(() => {
    if (currentPuzzle) {
      loadPuzzle(currentPuzzle)
    }
  }, [puzzleIndex, currentPuzzle, loadPuzzle])

  const checkPromotion = (from: string, to: string): boolean => {
    const piece = engine.get(from as any)
    if (piece?.type !== 'p') return false
    if (piece.color === 'w' && to[1] === '8') return true
    if (piece.color === 'b' && to[1] === '1') return true
    return false
  }

  const handlePlayerMove = useCallback((from: string, to: string, promotion?: string) => {
    if (isCompleted || isThinking) return false

    const expectedUci = currentPuzzle.solution[stepIndex]
    if (!expectedUci) return false

    const expectedFrom = expectedUci.slice(0, 2)
    const expectedTo = expectedUci.slice(2, 4)
    const expectedPromo = expectedUci.length > 4 ? expectedUci.slice(4, 5) : undefined

    const isMatch = from === expectedFrom && to === expectedTo && (!expectedPromo || promotion === expectedPromo)

    if (!isMatch) {
      failPuzzle()
      setFeedback({
        type: 'error',
        message: 'Неверный ход. Попробуйте другой вариант!'
      })
      setSelectedSquare(null)
      setLegalMoves([])
      setHintSquare(null)
      setHintTargetSquare(null)
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
    setHintLevel(0)
    setHintSquare(null)
    setHintTargetSquare(null)
    updateCheckSquare(engine)

    const nextStep = stepIndex + 1

    if (nextStep >= currentPuzzle.solution.length) {
      // Puzzle solved!
      setIsCompleted(true)
      setShowConfetti(true)
      markSolved(currentPuzzle.id)
      soundManager.play('checkmate')
      setFeedback({
        type: 'success',
        message: 'Великолепно! Задача решена верно!'
      })
      setStepIndex(nextStep)
      return true
    }

    // Multi-step puzzle: bot reply
    setIsThinking(true)
    setStepIndex(nextStep)
    setFeedback({
      type: 'hint',
      message: 'Верно! Соперник отвечает...'
    })

    const botUci = currentPuzzle.solution[nextStep]
    if (botUci) {
      if (botTimerRef.current) clearTimeout(botTimerRef.current)
      botTimerRef.current = setTimeout(() => {
        const bFrom = botUci.slice(0, 2)
        const bTo = botUci.slice(2, 4)
        const bPromo = botUci.length > 4 ? botUci.slice(4, 5) : undefined
        engine.move({ from: bFrom, to: bTo, promotion: bPromo })
        soundManager.play(engine.inCheck() ? 'check' : 'move')
        setFen(engine.fen())
        setLastMove({ from: bFrom, to: bTo })
        setStepIndex(nextStep + 1)
        setFeedback(null)
        setIsThinking(false)
        updateCheckSquare(engine)
        botTimerRef.current = null
      }, 500)
    }

    return true
  }, [engine, isCompleted, isThinking, currentPuzzle, stepIndex, failPuzzle, markSolved, updateCheckSquare])

  const onSquareClick = useCallback((square: string) => {
    if (isCompleted || isThinking) return

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
    if (piece && piece.color === currentPuzzle.playerColor) {
      setSelectedSquare(square)
      const moves = engine.moves({ square: square as any, verbose: true })
      setLegalMoves(moves.map((m: any) => m.to))
    } else {
      setSelectedSquare(null)
      setLegalMoves([])
    }
  }, [isCompleted, isThinking, selectedSquare, legalMoves, engine, currentPuzzle, handlePlayerMove])

  // Two-level hints
  const handleHint = () => {
    if (isCompleted) return
    const expectedUci = currentPuzzle.solution[stepIndex]
    if (!expectedUci) return

    const fromSq = expectedUci.slice(0, 2)
    const toSq = expectedUci.slice(2, 4)

    if (hintLevel === 0) {
      // Level 1: show source piece + text hint
      setHintLevel(1)
      setHintSquare(fromSq)
      setFeedback({
        type: 'hint',
        message: currentPuzzle.hint
      })
    } else {
      // Level 2: show destination square as well
      setHintLevel(2)
      setHintSquare(fromSq)
      setHintTargetSquare(toSq)
      setFeedback({
        type: 'hint',
        message: `Ходите фигурой с ${fromSq.toUpperCase()} на ${toSq.toUpperCase()}`
      })
    }
  }

  const handleNextPuzzle = () => {
    if (puzzleIndex < filteredPuzzles.length - 1) {
      setPuzzleIndex(prev => prev + 1)
    } else {
      setPuzzleIndex(0)
    }
  }

  const handlePrevPuzzle = () => {
    if (puzzleIndex > 0) {
      setPuzzleIndex(prev => prev - 1)
    } else {
      setPuzzleIndex(filteredPuzzles.length - 1)
    }
  }

  // Calculate stats for current category
  const categoryTotal = filteredPuzzles.length
  const categorySolved = filteredPuzzles.filter(p => isSolved(p.id)).length
  const isCurrentSolved = isSolved(currentPuzzle.id)

  const customSquareStyles: Record<string, React.CSSProperties> = {}
  if (hintSquare) {
    customSquareStyles[hintSquare] = {
      boxShadow: 'inset 0 0 0 3px var(--accent-brand), 0 0 12px rgba(163, 193, 143, 0.7)',
      backgroundColor: 'rgba(163, 193, 143, 0.3)',
    }
  }
  if (hintTargetSquare) {
    customSquareStyles[hintTargetSquare] = {
      boxShadow: 'inset 0 0 0 3px var(--success), 0 0 12px rgba(126, 184, 126, 0.8)',
      backgroundColor: 'rgba(126, 184, 126, 0.35)',
    }
  }

  return (
    <GameLayout user={user}>
      <div className="game-layout-container">
        <div className="game-main-column">
          {/* Category Tabs */}
          <div 
            className="mx-auto mb-[var(--space-12)] flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar px-[var(--space-8)]"
            style={{ width: currentBoardWidth || '100%', maxWidth: '100%' }}
          >
            {PUZZLE_THEMES.map((theme) => {
              const isSelected = selectedCategory === theme.id
              const count = theme.id === 'all' 
                ? PUZZLES.filter(p => isSolved(p.id)).length 
                : PUZZLES.filter(p => p.theme === theme.id && isSolved(p.id)).length
              const total = theme.id === 'all' 
                ? PUZZLES.length 
                : PUZZLES.filter(p => p.theme === theme.id).length

              return (
                <button
                  key={theme.id}
                  onClick={() => setCategory(theme.id)}
                  className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1.5 rounded-[var(--radius-4)] transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    isSelected 
                      ? 'bg-[var(--accent-brand)] text-bg shadow-sm' 
                      : 'bg-transparent text-text-secondary border border-[var(--border)] hover:border-[var(--accent-brand)]/50 hover:text-text'
                  }`}
                >
                  <span>{theme.label}</span>
                  <span className={`text-[9px] opacity-75 ${isSelected ? 'text-bg font-extrabold' : 'text-text-secondary'}`}>
                    ({count}/{total})
                  </span>
                </button>
              )
            })}
          </div>

          {/* Top Bar above Board */}
          <div 
            className="mx-auto mb-[var(--space-12)] flex items-center justify-between px-[var(--space-8)]"
            style={{ width: currentBoardWidth || '100%', maxWidth: '100%' }}
          >
            <div className="flex items-center gap-[var(--space-8)] text-[var(--font-size-sm)] font-bold min-w-0">
              <span className="text-[var(--accent-brand)] truncate">
                {currentPuzzle.title}
              </span>
              {isCurrentSolved && (
                <span className="text-[10px] font-bold text-[var(--success)] bg-[var(--success)]/15 border border-[var(--success)]/40 px-1.5 py-0.5 rounded shrink-0">
                  ✓ РЕШЕНА
                </span>
              )}
            </div>

            <div className="text-right flex items-center gap-3 shrink-0">
              {/* Streak Badge */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--accent-brand)]/10 border border-[var(--accent-brand)]/30 text-[10px] font-bold text-[var(--accent-brand)]">
                <span className="text-[9px] uppercase tracking-wider text-text-secondary">СЕРИЯ:</span>
                <span>{currentStreak}</span>
                {maxStreak > 0 && (
                  <span className="text-[9px] text-text-secondary opacity-75">
                    (Рекорд: {maxStreak})
                  </span>
                )}
              </div>

              {/* Quick List Button */}
              <button
                onClick={() => setIsListModalOpen(true)}
                className="text-[10px] font-bold uppercase tracking-widest text-text-secondary hover:text-[var(--accent-brand)] border border-[var(--border)] px-2 py-1 rounded transition-colors"
              >
                Задача {puzzleIndex + 1}/{categoryTotal}
              </button>
            </div>
          </div>

          {/* Board Container */}
          <div 
            ref={boardContainerRef}
            className="board-container relative"
          >
            {showConfetti && currentBoardWidth > 0 && (
              <PixelConfetti boardMode lightSquareColor={getTheme().whiteSquare} darkSquareColor={getTheme().blackSquare} />
            )}
            {currentBoardWidth > 0 ? (
              <>
                <ChessBoard
                  game={engine}
                  position={fen}
                  lastMove={lastMove}
                  checkSquare={checkSquare}
                  selectedSquare={selectedSquare}
                  legalMoves={legalMoves}
                  onDrop={(src, tgt) => {
                    if (isCompleted || isThinking) return false
                    if (checkPromotion(src, tgt)) {
                      setPendingPromotion({ from: src, to: tgt })
                      return true
                    }
                    return handlePlayerMove(src, tgt)
                  }}
                  onSquareClick={onSquareClick}
                  boardWidth={currentBoardWidth}
                  boardOrientation={currentPuzzle.playerColor === 'w' ? 'white' : 'black'}
                  customSquareStyles={customSquareStyles}
                />

                {pendingPromotion && (
                  <PromotionPicker
                    to={pendingPromotion.to}
                    color={currentPuzzle.playerColor}
                    onSelect={(piece) => {
                      handlePlayerMove(pendingPromotion.from, pendingPromotion.to, piece)
                      setPendingPromotion(null)
                    }}
                    onCancel={() => setPendingPromotion(null)}
                  />
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[var(--surface-elevated)] rounded-xl animate-pulse">
                <div className="text-[var(--font-size-xs)] text-text-secondary opacity-50 text-center p-4">
                  Загрузка шахматной доски...
                </div>
              </div>
            )}
          </div>

          {/* Feedback & Explanation Card */}
          {feedback && (
            <div 
              className={`mx-auto mt-[var(--space-12)] p-[var(--space-12)] rounded-[var(--radius-8)] border text-center animate-fade-in ${
                feedback.type === 'success' 
                  ? 'border-[var(--success)] bg-[var(--success)]/15 text-[var(--success)]' 
                  : feedback.type === 'error'
                  ? 'border-[var(--danger)] bg-[var(--danger)]/15 text-[var(--danger)]'
                  : 'border-[var(--accent-brand)]/40 bg-[var(--accent-brand)]/10 text-[var(--accent-brand)]'
              }`}
              style={{ width: currentBoardWidth || '100%', maxWidth: '100%' }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider">
                {feedback.message}
              </p>
              {isCompleted && currentPuzzle.explanation && (
                <p className="mt-2 text-[11px] text-text font-normal normal-case leading-relaxed opacity-90 border-t border-[var(--border)] pt-2">
                  <span className="font-semibold text-[var(--success)]">Разбор мотива:</span> {currentPuzzle.explanation}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Side Column */}
        <div className="game-side-column">
          <Card padding="sm">
            <div className="flex items-center justify-between mb-[var(--space-12)]">
              <h3 className="text-[var(--font-size-sm)] font-semibold text-text uppercase tracking-widest text-[11px]">
                Тактическая задача
              </h3>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                currentPuzzle.difficulty === 'easy' ? 'bg-[var(--success)]/20 text-[var(--success)]' :
                currentPuzzle.difficulty === 'medium' ? 'bg-[var(--accent-brand)]/20 text-[var(--accent-brand)]' :
                'bg-[var(--danger)]/20 text-[var(--danger)]'
              }`}>
                {currentPuzzle.difficulty === 'easy' ? 'Лёгкая' : currentPuzzle.difficulty === 'medium' ? 'Средняя' : 'Сложная'}
              </span>
            </div>

            <p className="text-text-secondary text-[12px] leading-relaxed mb-[var(--space-16)]">
              {currentPuzzle.description}
            </p>

            {/* Category Progress Stats */}
            <div className="mb-[var(--space-16)] p-2.5 rounded-[var(--radius-8)] border border-[var(--border)] bg-bg/40 flex items-center justify-between text-[11px]">
              <span className="text-text-secondary">Прогресс темы:</span>
              <span className="font-bold text-[var(--accent-brand)]">
                {categorySolved} из {categoryTotal} ({Math.round((categorySolved / categoryTotal) * 100)}%)
              </span>
            </div>

            <div className="space-y-2 mb-[var(--space-16)]">
              {isCompleted ? (
                <Button 
                  variant="primary" 
                  size="sm" 
                  fullWidth 
                  onClick={handleNextPuzzle}
                  className="border border-[var(--accent-brand)]/50 hover:border-[var(--accent-brand)]"
                >
                  Следующая задача →
                </Button>
              ) : (
                <Button 
                  variant="primary" 
                  size="sm" 
                  fullWidth 
                  onClick={handleHint}
                  className="border border-[var(--accent-brand)]/50 hover:border-[var(--accent-brand)]"
                >
                  {hintLevel === 0 ? 'Подсказка' : hintLevel === 1 ? 'Показать клетку' : 'Подсказка показана'}
                </Button>
              )}

              <Button 
                variant="outline" 
                size="sm" 
                fullWidth 
                onClick={() => loadPuzzle(currentPuzzle)}
              >
                Начать заново
              </Button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handlePrevPuzzle}
                >
                  ← Назад
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleNextPuzzle}
                >
                  Вперёд →
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                fullWidth
                onClick={() => setIsListModalOpen(true)}
                className="mt-2 text-[10px]"
              >
                Все задачи категории ({categoryTotal})
              </Button>
            </div>

            <div className="mt-[var(--space-16)] pt-[var(--space-8)] border-t border-[var(--border)]">
              <Button variant="outline" size="sm" fullWidth onClick={() => navigate('/ichi')}>
                Назад к Ичи
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Puzzle Selector Modal */}
      <Modal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        title="Каталог задач"
      >
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-[11px] text-text-secondary uppercase tracking-wider">
            Выберите задачу для решения:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredPuzzles.map((p, idx) => {
              const isItemSolved = isSolved(p.id)
              const isCurrent = p.id === currentPuzzle.id

              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setPuzzleIndex(idx)
                    setIsListModalOpen(false)
                  }}
                  className={`p-2.5 rounded-[var(--radius-8)] border text-left flex items-center justify-between gap-2 transition-all ${
                    isCurrent 
                      ? 'border-[var(--accent-brand)] bg-[var(--accent-brand)]/15 text-white' 
                      : isItemSolved
                      ? 'border-[var(--success)]/40 bg-[var(--success)]/5 hover:border-[var(--success)]'
                      : 'border-[var(--border)] bg-bg/50 hover:border-white/40'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-text-secondary opacity-70">
                        #{idx + 1}
                      </span>
                      <span className="text-[11px] font-bold truncate">
                        {p.title}
                      </span>
                    </div>
                    <span className="text-[9px] uppercase tracking-wider text-text-secondary opacity-60">
                      {p.difficulty === 'easy' ? 'Лёгкая' : p.difficulty === 'medium' ? 'Средняя' : 'Сложная'}
                    </span>
                  </div>

                  {isItemSolved ? (
                    <span className="text-[12px] font-bold text-[var(--success)] shrink-0">
                      ✓
                    </span>
                  ) : (
                    <span className="w-2 h-2 rounded-full border border-text-secondary opacity-30 shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </Modal>
    </GameLayout>
  )
}
