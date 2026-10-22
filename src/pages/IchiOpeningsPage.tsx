import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import GameLayout from '@/components/GameLayout'
import ChessBoard from '@/components/board/ChessBoard'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import PixelConfetti from '@/components/PixelConfetti'
import { createEngine, type EngineAPI } from '@/lib/engine'
import {
  OPENINGS,
  OPENING_FAMILIES,
  type Opening,
  type OpeningDifficulty,
  type OpeningFamily,
} from '@/lib/openingsData'
import {
  START_FEN,
  formatOpeningLine,
  normalizeSan,
  resolveOpeningSteps,
  stepColor,
  type ResolvedStep,
} from '@/lib/openings'
import { useOpeningStore } from '@/stores/openingStore'
import { useBoardStore } from '@/stores/boardStore'
import { useBoardWidth } from '@/hooks/useBoardWidth'
import { soundManager } from '@/lib/soundManager'

type TabMode = 'trainer' | 'reference'

interface Feedback {
  type: 'success' | 'error' | 'hint'
  title: string
  message: string
}

const FAMILY_LABELS: Record<OpeningFamily, string> = {
  open: 'Открытый',
  'semi-open': 'Полуоткрытый',
  closed: 'Закрытый',
  irregular: 'Нестандартный',
}

const DIFFICULTY_LABELS: Record<OpeningDifficulty, string> = {
  easy: 'Лёгкий',
  medium: 'Средний',
  hard: 'Сложный',
}

const TABS: { id: TabMode; label: string }[] = [
  { id: 'trainer', label: 'Тренажёр' },
  { id: 'reference', label: 'Справочник' },
]

export default function IchiOpeningsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { getTheme } = useBoardStore()
  const [searchParams] = useSearchParams()
  const {
    studiedOpeningIds,
    favoriteOpeningIds,
    selectedFamily,
    markStudied,
    toggleFavorite,
    setFamily,
  } = useOpeningStore()

  // Параметры приходят из хаба Ичи: ?mode=trainer|reference&family=<семейство>&color=w|b.
  const initialMode = searchParams.get('mode')
  const [tab, setTab] = useState<TabMode>(() =>
    initialMode === 'reference' ? 'reference' : 'trainer'
  )
  const [isCatalogOpen, setIsCatalogOpen] = useState(false)
  const colorFilterParam = searchParams.get('color') as 'w' | 'b' | null

  // Блок дебютов выбирается в хабе и приходит в адресе.
  useEffect(() => {
    const requested = searchParams.get('family')
    if (requested) {
      const isKnown =
        requested === 'all' || OPENING_FAMILIES.some((family) => family.id === requested)
      if (isKnown) setFamily(requested as OpeningFamily | 'all')
    }
    const mode = searchParams.get('mode')
    if (mode === 'reference') setTab('reference')
  }, [searchParams, setFamily])

  // ---------------- Тренажёр ----------------
  const [trainerOpeningId, setTrainerOpeningId] = useState(
    () => searchParams.get('opening') ?? OPENINGS[0].id
  )
  const trainerOpening = useMemo(
    () => OPENINGS.find((o) => o.id === trainerOpeningId) ?? OPENINGS[0],
    [trainerOpeningId]
  )
  const trainerSteps = useMemo(() => resolveOpeningSteps(trainerOpening), [trainerOpening])

  const engineRef = useRef<EngineAPI | null>(null)
  if (!engineRef.current) engineRef.current = createEngine('standard', START_FEN)

  const [fen, setFen] = useState(START_FEN)
  const [boardVersion, setBoardVersion] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [checkSquare, setCheckSquare] = useState<string | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoves, setLegalMoves] = useState<string[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [hintLevel, setHintLevel] = useState(0)
  const [hintSquare, setHintSquare] = useState<string | null>(null)
  const [hintTargetSquare, setHintTargetSquare] = useState<string | null>(null)
  const [mistakes, setMistakes] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showDeviations, setShowDeviations] = useState(false)

  // ---------------- Справочник ----------------
  const [referenceOpeningId, setReferenceOpeningId] = useState(OPENINGS[0].id)
  const referenceOpening = useMemo(
    () => OPENINGS.find((o) => o.id === referenceOpeningId) ?? OPENINGS[0],
    [referenceOpeningId]
  )
  const referenceSteps = useMemo(() => resolveOpeningSteps(referenceOpening), [referenceOpening])
  const [studyStep, setStudyStep] = useState(0)

  const filteredOpenings = useMemo(
    () =>
      selectedFamily === 'all'
        ? OPENINGS
        : OPENINGS.filter((o) => o.family === selectedFamily),
    [selectedFamily]
  )

  // ---------------- Доска ----------------
  const boardContainerRef = useRef<HTMLDivElement>(null)
  const { stableWidth, immediateWidth } = useBoardWidth(boardContainerRef, true)
  const currentBoardWidth = immediateWidth || stableWidth

  const studyFen = useMemo(
    () =>
      studyStep === 0
        ? START_FEN
        : referenceSteps[studyStep - 1]?.fenAfter ?? START_FEN,
    [referenceSteps, studyStep]
  )
  const studyEngine = useMemo(() => createEngine('standard', studyFen), [studyFen])
  const studyLastMove = useMemo(() => {
    if (studyStep === 0) return null
    const uci = referenceSteps[studyStep - 1]?.uci ?? ''
    if (uci.length < 4) return null
    return { from: uci.slice(0, 2), to: uci.slice(2, 4) }
  }, [referenceSteps, studyStep])

  const updateCheckSquare = useCallback((eng: EngineAPI) => {
    if (eng.inCheck()) {
      const turn = eng.turn()
      for (const file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
        for (const rank of ['1', '2', '3', '4', '5', '6', '7', '8']) {
          const sq = `${file}${rank}`
          const piece = eng.get(sq as never)
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

  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearAutoTimer = useCallback(() => {
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current)
      autoTimerRef.current = null
    }
  }, [])

  /** Ответ соперника по теории: играем шаг line[index] и переходим к следующему. */
  const scheduleAutoMove = useCallback(
    (index: number, steps: ResolvedStep[], eng: EngineAPI) => {
      clearAutoTimer()
      setIsThinking(true)
      autoTimerRef.current = setTimeout(() => {
        autoTimerRef.current = null
        const step = steps[index]
        if (!step) {
          setIsThinking(false)
          return
        }
        const from = step.uci.slice(0, 2)
        const to = step.uci.slice(2, 4)
        const promotion = step.uci.length > 4 ? step.uci.slice(4, 5) : undefined
        eng.move({ from, to, promotion })
        soundManager.play(eng.inCheck() ? 'check' : 'move')
        setFen(eng.fen())
        setLastMove({ from, to })
        setStepIndex(index + 1)
        setIsThinking(false)
        updateCheckSquare(eng)
      }, 550)
    },
    [clearAutoTimer, updateCheckSquare]
  )

  const loadOpening = useCallback(
    (target: Opening) => {
      clearAutoTimer()
      const eng = createEngine('standard', START_FEN)
      engineRef.current = eng
      setFen(START_FEN)
      setBoardVersion((v) => v + 1)
      setStepIndex(0)
      setLastMove(null)
      setCheckSquare(null)
      setSelectedSquare(null)
      setLegalMoves([])
      setIsThinking(false)
      setIsCompleted(false)
      setFeedback(null)
      setHintLevel(0)
      setHintSquare(null)
      setHintTargetSquare(null)
      setMistakes(0)
      setShowConfetti(false)
      setTrainerOpeningId(target.id)

      const steps = resolveOpeningSteps(target)
      // Дебют за чёрных: первым ходит соперник — играем его автоматически.
      if (steps.length > 0 && stepColor(0) !== target.color) {
        scheduleAutoMove(0, steps, eng)
      }
    },
    [clearAutoTimer, scheduleAutoMove]
  )

  // Первая загрузка дебюта
  useEffect(() => {
    let initial = OPENINGS[0]
    if (colorFilterParam === 'w' || colorFilterParam === 'b') {
      const first = OPENINGS.find((o) => o.color === colorFilterParam)
      if (first) initial = first
    }
    loadOpening(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current)
        autoTimerRef.current = null
      }
    }
  }, [])

  // Линия доиграна — фиксируем результат
  useEffect(() => {
    if (trainerSteps.length > 0 && stepIndex >= trainerSteps.length && !isCompleted) {
      setIsCompleted(true)
      setShowConfetti(true)
      markStudied(trainerOpening.id)
      soundManager.play('checkmate')
    }
  }, [stepIndex, trainerSteps, isCompleted, trainerOpening.id, markStudied])

  const handlePlayerMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      if (isCompleted || isThinking) return false
      const eng = engineRef.current
      const step = trainerSteps[stepIndex]
      if (!eng || !step) return false

      const expectedFrom = step.uci.slice(0, 2)
      const expectedTo = step.uci.slice(2, 4)
      const expectedPromotion = step.uci.length > 4 ? step.uci.slice(4, 5) : undefined
      const isMatch =
        from === expectedFrom &&
        to === expectedTo &&
        (!expectedPromotion || promotion === expectedPromotion)

      if (!isMatch) {
        const candidate = eng
          .moves({ verbose: true })
          .find(
            (m) =>
              m.from === from &&
              m.to === to &&
              (!promotion || !m.promotion || m.promotion === promotion)
          )
        const playedSan = candidate?.san ?? `${from}–${to}`
        const deviation = trainerOpening.deviations.find(
          (d) => d.at === stepIndex && normalizeSan(d.san) === normalizeSan(playedSan)
        )
        setMistakes((prev) => prev + 1)
        setSelectedSquare(null)
        setLegalMoves([])
        setHintLevel(0)
        setHintSquare(null)
        setHintTargetSquare(null)
        soundManager.play('select')
        setFeedback({
          type: 'error',
          title: deviation ? `Ошибка: ${deviation.san}` : `Ход ${playedSan} — не по теории`,
          message: deviation
            ? deviation.comment
            : `В этом дебюте по теории играем ${step.san}. ${trainerOpening.idea}`,
        })
        return false
      }

      const moveRes = eng.move({ from, to, promotion })
      if (!moveRes) return false

      soundManager.play(eng.inCheck() ? 'check' : 'move')
      setFen(eng.fen())
      setLastMove({ from, to })
      setSelectedSquare(null)
      setLegalMoves([])
      setHintLevel(0)
      setHintSquare(null)
      setHintTargetSquare(null)
      updateCheckSquare(eng)

      const nextIndex = stepIndex + 1
      setStepIndex(nextIndex)
      setFeedback({ type: 'success', title: 'Верно!', message: step.comment })

      if (nextIndex < trainerSteps.length && stepColor(nextIndex) !== trainerOpening.color) {
        scheduleAutoMove(nextIndex, trainerSteps, eng)
      }
      return true
    },
    [
      isCompleted,
      isThinking,
      stepIndex,
      trainerSteps,
      trainerOpening,
      scheduleAutoMove,
      updateCheckSquare,
    ]
  )

  const onSquareClick = useCallback(
    (square: string) => {
      if (isCompleted || isThinking) return
      const eng = engineRef.current
      if (!eng) return

      if (selectedSquare) {
        if (selectedSquare === square) {
          setSelectedSquare(null)
          setLegalMoves([])
          return
        }
        if (legalMoves.includes(square)) {
          handlePlayerMove(selectedSquare, square)
          return
        }
      }

      const piece = eng.get(square as never)
      if (piece && piece.color === trainerOpening.color) {
        setSelectedSquare(square)
        const moves = eng.moves({ square: square as never, verbose: true })
        setLegalMoves(moves.map((m) => m.to))
      } else {
        setSelectedSquare(null)
        setLegalMoves([])
      }
    },
    [
      isCompleted,
      isThinking,
      selectedSquare,
      legalMoves,
      handlePlayerMove,
      trainerOpening.color,
    ]
  )

  const handleHint = useCallback(() => {
    if (isCompleted || isThinking) return
    const step = trainerSteps[stepIndex]
    if (!step) return
    const from = step.uci.slice(0, 2)
    const to = step.uci.slice(2, 4)

    if (hintLevel === 0) {
      setHintLevel(1)
      setHintSquare(from)
      setFeedback({ type: 'hint', title: 'Подсказка', message: step.comment })
    } else {
      setHintLevel(2)
      setHintSquare(from)
      setHintTargetSquare(to)
      setFeedback({
        type: 'hint',
        title: 'Подсказка',
        message: `Ход по теории: ${step.san} (${from.toUpperCase()} → ${to.toUpperCase()}). ${step.comment}`,
      })
    }
  }, [hintLevel, isCompleted, isThinking, stepIndex, trainerSteps])

  const handleNextOpening = useCallback(() => {
    if (filteredOpenings.length === 0) return
    const idx = filteredOpenings.findIndex((o) => o.id === trainerOpeningId)
    const next = filteredOpenings[(idx + 1) % filteredOpenings.length]
    loadOpening(next)
  }, [filteredOpenings, trainerOpeningId, loadOpening])

  const handleTrainOpening = useCallback(
    (opening: Opening) => {
      setTab('trainer')
      setIsCatalogOpen(false)
      loadOpening(opening)
    },
    [loadOpening]
  )

  const handleStudyOpening = useCallback((opening: Opening) => {
    setReferenceOpeningId(opening.id)
    setStudyStep(0)
  }, [])

  // ---------------- Производные значения ----------------
  const trainerTotalMoves = Math.ceil(trainerSteps.length / 2)
  const trainerMoveNumber = Math.min(Math.floor(stepIndex / 2) + 1, trainerTotalMoves)
  const isPlayerTurn =
    !isCompleted && stepIndex < trainerSteps.length && stepColor(stepIndex) === trainerOpening.color

  const trainerCustomSquareStyles = useMemo<Record<string, React.CSSProperties>>(() => {
    const styles: Record<string, React.CSSProperties> = {}
    if (hintSquare) {
      styles[hintSquare] = {
        boxShadow: 'inset 0 0 0 3px var(--accent-brand), 0 0 12px rgba(163, 193, 143, 0.7)',
        backgroundColor: 'color-mix(in srgb, var(--accent-brand) 30%, transparent)',
      }
    }
    if (hintTargetSquare) {
      styles[hintTargetSquare] = {
        boxShadow: 'inset 0 0 0 3px var(--success), 0 0 12px rgba(126, 184, 126, 0.8)',
        backgroundColor: 'color-mix(in srgb, var(--success) 35%, transparent)',
      }
    }
    return styles
  }, [hintSquare, hintTargetSquare])

  const isTrainerStudied = studiedOpeningIds.includes(trainerOpening.id)
  const isReferenceFavorite = favoriteOpeningIds.includes(referenceOpening.id)

  return (
    <GameLayout user={user}>
      {/* Вкладки */}
      <div className="flex items-center gap-1.5 mb-[var(--space-16)] justify-center">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-[var(--radius-4)] transition-all ${
              tab === t.id
                ? 'bg-[var(--accent-brand)] text-bg'
                : 'bg-transparent text-text-secondary border border-[var(--border)] hover:text-text hover:border-[color-mix(in_srgb,var(--accent-brand)_50%,transparent)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="game-layout-container">
        <div className="game-main-column">
          {/* Фильтр по семейству */}
          <div className="mx-auto mb-[var(--space-12)] flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar px-[var(--space-8)]"
            style={{ width: currentBoardWidth || '100%', maxWidth: '100%' }}
          >
            {OPENING_FAMILIES.map((family) => {
              const isSelected = selectedFamily === family.id
              const total =
                family.id === 'all'
                  ? OPENINGS.length
                  : OPENINGS.filter((o) => o.family === family.id).length
              const done =
                family.id === 'all'
                  ? studiedOpeningIds.length
                  : OPENINGS.filter(
                      (o) => o.family === family.id && studiedOpeningIds.includes(o.id)
                    ).length
              return (
                <button
                  key={family.id}
                  onClick={() => setFamily(family.id)}
                  className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1.5 rounded-[var(--radius-4)] transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[var(--accent-brand)] text-bg'
                      : 'bg-transparent text-text-secondary border border-[var(--border)] hover:border-[color-mix(in_srgb,var(--accent-brand)_50%,transparent)] hover:text-text'
                  }`}
                >
                  <span>{family.label}</span>
                  <span
                    className={`text-[9px] opacity-75 ${
                      isSelected ? 'text-bg font-extrabold' : 'text-text-secondary'
                    }`}
                  >
                    ({done}/{total})
                  </span>
                </button>
              )
            })}
          </div>

          {/* Статусная строка */}
          <div
            className="mx-auto mb-[var(--space-12)] flex flex-col gap-[var(--space-8)] px-[var(--space-8)]"
            style={{ width: currentBoardWidth || '100%', maxWidth: '100%' }}
          >
            <div className="flex items-center gap-[var(--space-8)] flex-wrap min-w-0">
              <span className="text-[var(--accent-brand)] font-bold text-sm leading-tight">
                {tab === 'trainer'
                  ? `${trainerOpening.eco} · ${trainerOpening.name}`
                  : `${referenceOpening.eco} · ${referenceOpening.name}`}
              </span>
              {tab === 'trainer' && isTrainerStudied && (
                <span className="text-[10px] font-bold text-[var(--accent-brand)] bg-[color-mix(in_srgb,var(--accent-brand)_15%,transparent)] border border-[color-mix(in_srgb,var(--accent-brand)_40%,transparent)] px-1.5 py-0.5 rounded shrink-0">
                  ✓ ОТРАБОТАН
                </span>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              {tab === 'trainer' ? (
                <>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[color-mix(in_srgb,var(--accent-brand)_10%,transparent)] border border-[color-mix(in_srgb,var(--accent-brand)_30%,transparent)] text-[10px] font-bold text-[var(--accent-brand)]">
                    <span className="text-[9px] uppercase tracking-wider text-text-secondary">
                      ХОД:
                    </span>
                    <span>
                      {trainerMoveNumber}/{trainerTotalMoves}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      isCompleted
                        ? 'text-[var(--accent-brand)]'
                        : isPlayerTurn
                          ? 'text-[var(--accent-brand)]'
                          : 'text-text-secondary'
                    }`}
                  >
                    {isCompleted
                      ? 'Линия разобрана'
                      : isPlayerTurn
                        ? 'Ваш ход'
                        : 'Ход соперника'}
                  </span>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[color-mix(in_srgb,var(--accent-brand)_10%,transparent)] border border-[color-mix(in_srgb,var(--accent-brand)_30%,transparent)] text-[10px] font-bold text-[var(--accent-brand)]">
                    <span className="text-[9px] uppercase tracking-wider text-text-secondary">
                      ХОД:
                    </span>
                    <span>
                      {studyStep}/{referenceSteps.length}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                    {studyStep === 0
                      ? 'Стартовая позиция'
                      : `${referenceSteps[studyStep - 1].engineSan} — ${
                          stepColor(studyStep - 1) === 'w' ? 'белые' : 'чёрные'
                        }`}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Доска */}
          <div ref={boardContainerRef} className="board-container relative">
            {tab === 'trainer' && showConfetti && currentBoardWidth > 0 && (
              <PixelConfetti
                boardMode
                lightSquareColor={getTheme().whiteSquare}
                darkSquareColor={getTheme().blackSquare}
              />
            )}

            {currentBoardWidth > 0 ? (
              tab === 'trainer' ? (
                <ChessBoard
                  game={engineRef.current}
                  position={fen}
                  positionKey={boardVersion}
                  lastMove={lastMove}
                  checkSquare={checkSquare}
                  selectedSquare={selectedSquare}
                  legalMoves={legalMoves}
                  onDrop={(src, tgt) => handlePlayerMove(src, tgt)}
                  onSquareClick={onSquareClick}
                  boardWidth={currentBoardWidth}
                  boardOrientation={trainerOpening.color === 'w' ? 'white' : 'black'}
                  customSquareStyles={trainerCustomSquareStyles}
                />
              ) : (
                <ChessBoard
                  game={studyEngine}
                  position={studyFen}
                  positionKey={`${referenceOpening.id}:${studyStep}`}
                  lastMove={studyLastMove}
                  checkSquare={null}
                  selectedSquare={null}
                  legalMoves={[]}
                  onDrop={() => false}
                  onSquareClick={() => {}}
                  boardWidth={currentBoardWidth}
                  boardOrientation="white"
                  arePiecesDraggable={false}
                />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[var(--surface-elevated)] rounded-xl animate-pulse">
                <div className="text-xs text-text-secondary opacity-50 text-center p-4">
                  Загрузка шахматной доски...
                </div>
              </div>
            )}
          </div>

          {/* Шаг по линии (справочник) */}
          {tab === 'reference' && (
            <div
              className="mx-auto mt-[var(--space-12)] flex items-center justify-center gap-2"
              style={{ width: currentBoardWidth || '100%', maxWidth: '100%' }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStudyStep((s) => Math.max(0, s - 1))}
                disabled={studyStep === 0}
              >
                ← Назад
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStudyStep((s) => Math.min(referenceSteps.length, s + 1))}
                disabled={studyStep >= referenceSteps.length}
              >
                Вперёд →
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStudyStep(0)}
                disabled={studyStep === 0}
              >
                В начало
              </Button>
            </div>
          )}

          {/* Обратная связь (тренажёр) */}
          {tab === 'trainer' && feedback && (
            <div
              className={`mx-auto mt-[var(--space-12)] p-[var(--space-12)] rounded-[var(--radius-8)] border text-center animate-fade-in ${
                feedback.type === 'success'
                  ? 'border-[var(--accent-brand)] bg-[color-mix(in_srgb,var(--accent-brand)_15%,transparent)] text-[var(--accent-brand)]'
                  : feedback.type === 'error'
                    ? 'border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] text-[var(--danger)]'
                    : 'border-[color-mix(in_srgb,var(--accent-brand)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent-brand)_10%,transparent)] text-[var(--accent-brand)]'
              }`}
              style={{ width: currentBoardWidth || '100%', maxWidth: '100%' }}
            >
              <p className="text-[11px] font-bold tracking-wider">{feedback.title}</p>
              <p className="mt-1 text-[11px] font-normal normal-case leading-relaxed text-text opacity-90">
                {feedback.message}
              </p>
            </div>
          )}

          {/* Каталог дебютов (справочник) */}
          {tab === 'reference' && (
            <div className="mt-[var(--space-24)]">
              <h3 className="text-center text-[var(--font-size-sm)] font-bold text-text mb-[var(--space-16)] uppercase tracking-widest">
                Каталог дебютов
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-16)]">
                {filteredOpenings.map((opening) => {
                  const isCurrent = opening.id === referenceOpening.id
                  const isStudied = studiedOpeningIds.includes(opening.id)
                  const isFavorite = favoriteOpeningIds.includes(opening.id)
                  return (
                    <Card
                      key={opening.id}
                      padding="sm"
                      className={`transition-colors ${
                        isCurrent
                          ? 'border-[var(--accent-brand)]'
                          : 'hover:border-[color-mix(in_srgb,var(--accent-brand)_40%,transparent)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-[var(--space-8)]">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--accent-brand)_15%,transparent)] text-[var(--accent-brand)]">
                              {opening.eco}
                            </span>
                            <span className="text-[13px] font-bold text-text">{opening.name}</span>
                            {isStudied && (
                              <span className="text-[10px] font-bold text-[var(--accent-brand)]">
                                ✓
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] uppercase tracking-wider text-text-secondary opacity-70">
                            {FAMILY_LABELS[opening.family]} ·{' '}
                            {opening.color === 'w' ? 'белые' : 'чёрные'} ·{' '}
                            {DIFFICULTY_LABELS[opening.difficulty]}
                          </span>
                        </div>
                        <button
                          onClick={() => toggleFavorite(opening.id)}
                          title="В избранное"
                          className={`text-[14px] leading-none shrink-0 transition-colors ${
                            isFavorite
                              ? 'text-[var(--accent-brand)]'
                              : 'text-text-secondary opacity-40 hover:opacity-90'
                          }`}
                        >
                          ★
                        </button>
                      </div>

                      <p className="text-[11px] text-text-secondary leading-relaxed mb-[var(--space-8)]">
                        {opening.summary}
                      </p>
                      <p className="text-[11px] text-[var(--accent-brand)] leading-relaxed mb-[var(--space-12)]">
                        Идея: {opening.idea}
                      </p>

                      <div className="text-[11px] font-mono text-text-secondary bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-4)] px-2 py-1.5 mb-[var(--space-12)] break-words">
                        {formatOpeningLine(opening.steps.map((s) => s.san))}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleStudyOpening(opening)}
                          className="flex-1"
                        >
                          На доску
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTrainOpening(opening)}
                          className="flex-1"
                        >
                          Тренировать
                        </Button>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Боковая колонка */}
        <div className="game-side-column">
          {tab === 'trainer' ? (
            <Card padding="sm">
              <div className="flex items-center justify-between mb-[var(--space-12)] gap-2">
                <h3 className="font-semibold text-text uppercase tracking-widest text-[11px]">
                  {trainerOpening.eco} · {trainerOpening.name}
                </h3>
                <span
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded shrink-0 ${
                    trainerOpening.difficulty === 'easy'
                      ? 'bg-[color-mix(in_srgb,var(--accent-brand)_20%,transparent)] text-[var(--accent-brand)]'
                      : trainerOpening.difficulty === 'medium'
                        ? 'bg-[color-mix(in_srgb,var(--accent-brand)_12%,transparent)] text-[var(--text-secondary)]'
                        : 'bg-[color-mix(in_srgb,var(--danger)_20%,transparent)] text-[var(--danger)]'
                  }`}
                >
                  {DIFFICULTY_LABELS[trainerOpening.difficulty]}
                </span>
              </div>

              <p className="text-text-secondary text-[12px] leading-relaxed mb-[var(--space-8)]">
                {trainerOpening.summary}
              </p>
              <p className="text-[12px] leading-relaxed text-[var(--accent-brand)] mb-[var(--space-16)]">
                Идея: {trainerOpening.idea}
              </p>

              <div className="mb-[var(--space-16)] p-2.5 rounded-[var(--radius-8)] border border-[var(--border)] bg-bg/40 flex items-center justify-between text-[11px]">
                <span className="text-text-secondary">Ошибок в этот раз:</span>
                <span className="font-bold text-[var(--accent-brand)]">{mistakes}</span>
              </div>

              <div className="space-y-2 mb-[var(--space-16)]">
                {isCompleted ? (
                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    onClick={handleNextOpening}
                    className="border border-[color-mix(in_srgb,var(--accent-brand)_50%,transparent)] hover:border-[var(--accent-brand)]"
                  >
                    Следующий дебют →
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    onClick={handleHint}
                    className="border border-[color-mix(in_srgb,var(--accent-brand)_50%,transparent)] hover:border-[var(--accent-brand)]"
                  >
                    {hintLevel === 0
                      ? 'Подсказка'
                      : hintLevel === 1
                        ? 'Показать клетку'
                        : 'Подсказка показана'}
                  </Button>
                )}

                <Button variant="outline" size="sm" fullWidth onClick={() => loadOpening(trainerOpening)}>
                  Начать заново
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  onClick={() => setIsCatalogOpen(true)}
                >
                  Выбрать дебют ({filteredOpenings.length})
                </Button>

                <Button variant="outline" size="sm" fullWidth onClick={handleNextOpening}>
                  Следующий дебют →
                </Button>
              </div>

              {/* Пройденная часть линии */}
              <div className="mb-[var(--space-16)]">
                <h4 className="text-[10px] uppercase tracking-widest text-text-secondary mb-[var(--space-8)]">
                  Линия дебюта
                </h4>
                <div className="text-[11px] font-mono text-text-secondary leading-relaxed break-words">
                  {trainerSteps.slice(0, stepIndex).length > 0
                    ? formatOpeningLine(
                        trainerSteps.slice(0, stepIndex).map((s) => s.engineSan)
                      )
                    : '—'}
                </div>
              </div>

              {/* Типичные ошибки */}
              {trainerOpening.deviations.length > 0 && (
                <div className="pt-[var(--space-8)] border-t border-[var(--border)]">
                  <button
                    onClick={() => setShowDeviations((v) => !v)}
                    className="text-[10px] uppercase tracking-widest text-text-secondary hover:text-[var(--accent-brand)] transition-colors"
                  >
                    {showDeviations ? '▾' : '▸'} Типичные ошибки (
                    {trainerOpening.deviations.length})
                  </button>
                  {showDeviations && (
                    <ul className="mt-[var(--space-8)] space-y-2">
                      {trainerOpening.deviations.map((d) => (
                        <li
                          key={`${d.at}-${d.san}`}
                          className="text-[11px] leading-relaxed text-text-secondary border-l-2 border-[var(--danger)] pl-2"
                        >
                          <span className="font-bold text-[var(--danger)]">{d.san}</span> —{' '}
                          {d.comment}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="mt-[var(--space-16)] pt-[var(--space-8)] border-t border-[var(--border)]">
                <Button variant="outline" size="sm" fullWidth onClick={() => navigate('/ichi')}>
                  Назад к Ичи
                </Button>
              </div>
            </Card>
          ) : (
            <Card padding="sm">
              <div className="flex items-center justify-between mb-[var(--space-12)] gap-2">
                <h3 className="font-semibold text-text uppercase tracking-widest text-[11px]">
                  {referenceOpening.eco} · {referenceOpening.name}
                </h3>
                <button
                  onClick={() => toggleFavorite(referenceOpening.id)}
                  title="В избранное"
                  className={`text-[14px] leading-none shrink-0 transition-colors ${
                    isReferenceFavorite
                      ? 'text-[var(--accent-brand)]'
                      : 'text-text-secondary opacity-40 hover:opacity-90'
                  }`}
                >
                  ★
                </button>
              </div>

              <p className="text-text-secondary text-[12px] leading-relaxed mb-[var(--space-8)]">
                {referenceOpening.summary}
              </p>
              <p className="text-[12px] leading-relaxed text-[var(--accent-brand)] mb-[var(--space-16)]">
                Идея: {referenceOpening.idea}
              </p>

              <div className="mb-[var(--space-16)]">
                <h4 className="text-[10px] uppercase tracking-widest text-text-secondary mb-[var(--space-8)]">
                  Линия с комментариями
                </h4>
                <ol className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                  {referenceSteps.map((s) => {
                    const isCurrent = s.index === studyStep - 1
                    return (
                      <li
                        key={s.index}
                        className={`text-[11px] leading-relaxed rounded-[var(--radius-4)] px-1.5 py-1 ${
                          isCurrent ? 'bg-[color-mix(in_srgb,var(--accent-brand)_12%,transparent)]' : ''
                        }`}
                      >
                        <span className="text-text-secondary opacity-60">
                          {s.index % 2 === 0 ? `${s.index / 2 + 1}.` : ''}
                        </span>{' '}
                        <span className="font-bold text-text">{s.engineSan}</span>{' '}
                        <span className="text-text-secondary">{s.comment}</span>
                      </li>
                    )
                  })}
                </ol>
              </div>

              <div className="space-y-2">
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  onClick={() => handleTrainOpening(referenceOpening)}
                >
                  Тренировать этот дебют
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  onClick={() => setStudyStep(0)}
                  disabled={studyStep === 0}
                >
                  В начало линии
                </Button>
              </div>

              <div className="mt-[var(--space-16)] pt-[var(--space-8)] border-t border-[var(--border)]">
                <Button variant="outline" size="sm" fullWidth onClick={() => navigate('/ichi')}>
                  Назад к Ичи
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Каталог выбора дебюта */}
      <Modal isOpen={isCatalogOpen} onClose={() => setIsCatalogOpen(false)} title="Дебюты">
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-[11px] text-text-secondary uppercase tracking-wider">
            Выберите дебют для тренировки:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredOpenings.map((opening) => {
              const isCurrent = opening.id === trainerOpening.id
              const isStudied = studiedOpeningIds.includes(opening.id)
              return (
                <button
                  key={opening.id}
                  onClick={() => handleTrainOpening(opening)}
                  className={`p-2.5 rounded-[var(--radius-8)] border text-left flex items-center justify-between gap-2 transition-all ${
                    isCurrent
                      ? 'border-[var(--accent-brand)] bg-[color-mix(in_srgb,var(--accent-brand)_15%,transparent)] text-[var(--accent-brand)]'
                      : isStudied
                        ? 'border-[color-mix(in_srgb,var(--accent-brand)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent-brand)_5%,transparent)] hover:border-[var(--accent-brand)]'
                        : 'border-[var(--border)] bg-bg/50 hover:border-white/40'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-text-secondary opacity-70">
                        {opening.eco}
                      </span>
                      <span className="text-[11px] font-bold truncate">{opening.name}</span>
                    </div>
                    <span className="text-[9px] uppercase tracking-wider text-text-secondary opacity-60">
                      {opening.color === 'w' ? 'белые' : 'чёрные'} ·{' '}
                      {DIFFICULTY_LABELS[opening.difficulty]}
                    </span>
                  </div>
                  {isStudied && (
                    <span className="text-[12px] font-bold text-[var(--accent-brand)] shrink-0">
                      ✓
                    </span>
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
