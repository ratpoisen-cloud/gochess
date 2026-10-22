import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import GameLayout from '@/components/GameLayout'
import ChessBoard from '@/components/board/ChessBoard'
import Card from '@/components/Card'
import Button from '@/components/Button'
import PromotionPicker from '@/components/PromotionPicker'
import TrainingSetupModal from '@/components/ichi/TrainingSetupModal'
import { createEngine, type EngineAPI } from '@/lib/engine'
import { createBotEngine } from '@/lib/botEngine'
import { botLevelLabel, parseBotLevel } from '@/lib/botLevels'
import { OPENINGS } from '@/lib/openingsData'
import { openingPositionFen } from '@/lib/openings'
import { useBoardWidth } from '@/hooks/useBoardWidth'
import { usePgnCopy } from '@/hooks/usePgnCopy'
import type { BotLevel } from '@/types'

export default function IchiTrainingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Параметры приходят из хаба Ичи: ?opening=<id>&level=<уровень>.
  const initialOpeningId = searchParams.get('opening')
  const initialLevel = parseBotLevel(searchParams.get('level')) ?? 'medium'

  const [openingId, setOpeningId] = useState<string | null>(initialOpeningId)
  const [level, setLevel] = useState<BotLevel>(initialLevel)
  const [isSetupOpen, setIsSetupOpen] = useState(false)

  const opening = useMemo(
    () => (openingId ? OPENINGS.find((o) => o.id === openingId) ?? null : null),
    [openingId]
  )
  /** Позиция, с которой начинается тренировка: конец линии выбранного дебюта. */
  const trainingFen = useMemo(
    () => (opening ? openingPositionFen(opening) : undefined),
    [opening]
  )

  const [engine, setEngine] = useState<EngineAPI>(() => createEngine('standard', trainingFen))
  const [fen, setFen] = useState(() => createEngine('standard', trainingFen).fen())
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoves, setLegalMoves] = useState<string[]>([])
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [checkSquare, setCheckSquare] = useState<string | null>(null)
  const [moveHistory, setMoveHistory] = useState<string[]>([])

  const [isThinking, setIsThinking] = useState(false)
  const [hint, setHint] = useState<{ from: string; to: string; text: string } | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null)

  const boardContainerRef = useRef<HTMLDivElement>(null)
  const { stableWidth, immediateWidth } = useBoardWidth(boardContainerRef, true)
  const currentBoardWidth = immediateWidth || stableWidth
  const botEngineRef = useRef<ReturnType<typeof createBotEngine> | null>(null)

  const { pgnCopied, copyPgn } = usePgnCopy(() => engine.pgn())

  useEffect(() => {
    botEngineRef.current = createBotEngine(level, openingId)
    return () => {
      if (botEngineRef.current) {
        botEngineRef.current.destroy()
        botEngineRef.current = null
      }
    }
  }, [level, openingId])

  /** Полная перезагрузка позиции тренировки. */
  const loadPosition = useCallback((nextFen?: string) => {
    const newEngine = createEngine('standard', nextFen)
    setEngine(newEngine)
    setFen(newEngine.fen())
    setMoveHistory([])
    setSelectedSquare(null)
    setLegalMoves([])
    setLastMove(null)
    setCheckSquare(null)
    setHint(null)
  }, [])

  /** Смена дебюта или сложности: новая позиция и новый Ичи. */
  const applySetup = useCallback(
    (nextOpeningId: string | null, nextLevel: BotLevel) => {
      const nextOpening = nextOpeningId ? OPENINGS.find((o) => o.id === nextOpeningId) ?? null : null
      const nextFen = nextOpening ? openingPositionFen(nextOpening) : undefined

      loadPosition(nextFen)
      setOpeningId(nextOpeningId)
      setLevel(nextLevel)

      const params = new URLSearchParams({ level: nextLevel })
      if (nextOpeningId) params.set('opening', nextOpeningId)
      setSearchParams(params, { replace: true })
    },
    [loadPosition, setSearchParams]
  )

  const updateCheckSquare = useCallback((eng: EngineAPI) => {
    if (eng.inCheck()) {
      const turn = eng.turn()
      // find king of current turn
      for (const file of ['a','b','c','d','e','f','g','h']) {
        for (const rank of ['1','2','3','4','5','6','7','8']) {
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

  const executeMove = useCallback((from: string, to: string, promotion?: string) => {
    const moveRes = engine.move({ from, to, promotion })
    if (moveRes) {
      setFen(engine.fen())
      setLastMove({ from, to })
      setMoveHistory(engine.history())
      setSelectedSquare(null)
      setLegalMoves([])
      setHint(null)
      updateCheckSquare(engine)
      return true
    }
    return false
  }, [engine, updateCheckSquare])

  const checkPromotion = (from: string, to: string): boolean => {
    const piece = engine.get(from as any)
    if (piece?.type !== 'p') return false
    if (piece.color === 'w' && to[1] === '8') return true
    if (piece.color === 'b' && to[1] === '1') return true
    return false
  }

  const onSquareClick = (square: string) => {
    if (isThinking) return

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
        executeMove(selectedSquare, square)
        return
      }
    }

    const piece = engine.get(square as any)
    if (piece && piece.color === engine.turn()) {
      setSelectedSquare(square)
      const moves = engine.moves({ square: square as any, verbose: true })
      setLegalMoves(moves.map((m: any) => m.to))
    } else {
      setSelectedSquare(null)
      setLegalMoves([])
    }
  }

  const handleAskHint = async () => {
    if (isThinking || engine.isGameOver()) return
    setIsThinking(true)
    setHint(null)

    try {
      const bestMove = await botEngineRef.current?.getBestMove(engine.fen())
      if (bestMove && bestMove !== '(none)' && bestMove.length >= 4) {
        const from = bestMove.slice(0, 2)
        const to = bestMove.slice(2, 4)
        setHint({
          from,
          to,
          text: `Ичи советует: ${from.toUpperCase()} → ${to.toUpperCase()}`
        })
      } else {
        const moves = engine.moves({ verbose: true })
        if (moves.length > 0) {
          const fallback = moves[0]
          setHint({
            from: fallback.from,
            to: fallback.to,
            text: `Ичи советует: ${fallback.from.toUpperCase()} → ${fallback.to.toUpperCase()}`
          })
        }
      }
    } catch (err) {
      console.error('[IchiTraining] Hint error:', err)
    } finally {
      setIsThinking(false)
    }
  }

  const handleBotMove = async () => {
    if (isThinking || engine.isGameOver()) return
    setIsThinking(true)
    setHint(null)

    try {
      const bestMove = await botEngineRef.current?.getBestMove(engine.fen())
      if (bestMove && bestMove !== '(none)' && bestMove.length >= 4) {
        const from = bestMove.slice(0, 2)
        const to = bestMove.slice(2, 4)
        const promotion = bestMove.length > 4 ? bestMove.slice(4, 5) : undefined
        executeMove(from, to, promotion)
      } else {
        const moves = engine.moves({ verbose: true })
        if (moves.length > 0) {
          const fallback = moves[0]
          executeMove(fallback.from, fallback.to, fallback.promotion)
        }
      }
    } catch (err) {
      console.error('[IchiTraining] Bot move error:', err)
    } finally {
      setIsThinking(false)
    }
  }

  const handleUndo = () => {
    engine.undo()
    setFen(engine.fen())
    setMoveHistory(engine.history())
    setSelectedSquare(null)
    setLegalMoves([])
    setLastMove(null)
    setHint(null)
    updateCheckSquare(engine)
  }

  const handleReset = () => {
    loadPosition(trainingFen)
  }

  const customSquareStyles: Record<string, React.CSSProperties> = {}
  if (hint) {
    customSquareStyles[hint.from] = {
      boxShadow: 'inset 0 0 0 3px var(--accent-brand), 0 0 12px rgba(163, 193, 143, 0.6)',
      backgroundColor: 'rgba(163, 193, 143, 0.25)',
    }
    customSquareStyles[hint.to] = {
      boxShadow: 'inset 0 0 0 3px var(--success), 0 0 12px rgba(126, 184, 126, 0.6)',
      backgroundColor: 'rgba(126, 184, 126, 0.35)',
    }
  }

  const currentTurn = engine.turn()

  return (
    <GameLayout user={user}>
      <div className="game-layout-container">
        <div className="game-main-column">
          <div 
            className="mx-auto mb-[var(--space-12)] flex items-center justify-between px-[var(--space-8)]"
            style={{ width: currentBoardWidth || '100%', maxWidth: '100%' }}
          >
            <div className="flex items-center gap-[var(--space-8)] text-sm font-bold min-w-0">
              <img
                src={`${import.meta.env.BASE_URL || '/'}emojis/board/Emojis_48x48_130.png`}
                alt="trainer"
                className="w-5 h-5 object-contain"
              />
              <span className="text-[var(--accent-brand)] truncate">Тренировка с Ичи</span>
              {opening && (
                <span className="text-text-secondary opacity-70 truncate">
                  · {opening.eco} {opening.name}
                </span>
              )}
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent-brand)]">
                {currentTurn === 'w' ? 'Ход белых' : 'Ход чёрных'}
              </span>
            </div>
          </div>

          <div 
            ref={boardContainerRef}
            className="board-container relative"
          >
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
                    if (checkPromotion(src, tgt)) {
                      setPendingPromotion({ from: src, to: tgt })
                      return true
                    }
                    return executeMove(src, tgt)
                  }}
                  onSquareClick={onSquareClick}
                  boardWidth={currentBoardWidth}
                  boardOrientation={orientation}
                  customSquareStyles={customSquareStyles}
                />

                {pendingPromotion && (
                  <PromotionPicker
                    to={pendingPromotion.to}
                    color={currentTurn}
                    onSelect={(piece) => {
                      executeMove(pendingPromotion.from, pendingPromotion.to, piece)
                      setPendingPromotion(null)
                    }}
                    onCancel={() => setPendingPromotion(null)}
                  />
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[var(--surface-elevated)] rounded-xl animate-pulse">
                <div className="text-xs text-text-secondary opacity-50 text-center p-4">
                  Загрузка шахматной доски...
                </div>
              </div>
            )}
          </div>

          {hint && (
            <div 
              className="mx-auto mt-[var(--space-12)] p-[var(--space-12)] rounded-[var(--radius-8)] border border-[color-mix(in_srgb,var(--accent-brand)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent-brand)_10%,transparent)] text-center animate-fade-in"
              style={{ width: currentBoardWidth || '100%', maxWidth: '100%' }}
            >
              <p className="text-[11px] font-bold text-[var(--accent-brand)] uppercase tracking-wider">
                {hint.text}
              </p>
            </div>
          )}
        </div>

        <div className="game-side-column">
          <Card padding="sm">
            <div className="flex items-center justify-between gap-2 mb-[var(--space-12)]">
              <h3 className="text-sm font-semibold text-text">
                Инструменты тренера
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[color-mix(in_srgb,var(--accent-brand)_15%,transparent)] text-[var(--accent-brand)] shrink-0">
                {botLevelLabel(level)}
              </span>
            </div>

            {opening && (
              <p className="mb-[var(--space-12)] text-[11px] text-text-secondary leading-relaxed">
                Позиция после дебюта <span className="text-text font-semibold">{opening.eco} {opening.name}</span>.
                Сброс возвращает доску в эту позицию.
              </p>
            )}

            <div className="space-y-2 mb-[var(--space-16)]">
              <Button 
                variant="primary" 
                size="sm"
                fullWidth 
                onClick={handleAskHint}
                disabled={isThinking || engine.isGameOver()}
                className="border border-[color-mix(in_srgb,var(--accent-brand)_50%,transparent)] hover:border-[var(--accent-brand)]"
              >
                {isThinking ? 'Ичи думает...' : 'Подсказка Ичи'}
              </Button>

              <Button 
                variant="outline" 
                size="sm"
                fullWidth 
                onClick={handleBotMove}
                disabled={isThinking || engine.isGameOver()}
              >
                Ход за Ичи
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleUndo}
                  disabled={moveHistory.length === 0}
                >
                  Отмена хода
                </Button>

                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setOrientation(o => o === 'white' ? 'black' : 'white')}
                >
                  Перевернуть
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                fullWidth
                onClick={handleReset}
              >
                Сброс позиции
              </Button>

              <Button
                variant="outline"
                size="sm"
                fullWidth
                onClick={() => setIsSetupOpen(true)}
              >
                Сменить дебют
              </Button>
            </div>

            <div className="flex items-center justify-between mb-[var(--space-8)] pt-[var(--space-8)] border-t border-[var(--border)]">
              <span className="text-xs font-semibold text-text">История</span>
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

            <div
              className="max-h-[220px] overflow-y-auto space-y-1 text-xs bg-bg p-[var(--space-8)] rounded-[var(--radius-8)]"
            >
              {moveHistory.length === 0 ? (
                <p className="text-text-secondary text-center py-4">Сделайте первый ход</p>
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

            <div className="mt-[var(--space-16)] pt-[var(--space-8)] border-t border-[var(--border)]">
              <Button variant="outline" size="sm" fullWidth onClick={() => navigate('/ichi')}>
                Назад к Ичи
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <TrainingSetupModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        onStart={(nextOpeningId, nextLevel) => {
          setIsSetupOpen(false)
          applySetup(nextOpeningId, nextLevel)
        }}
        initialOpeningId={openingId}
        initialLevel={level}
      />
    </GameLayout>
  )
}
