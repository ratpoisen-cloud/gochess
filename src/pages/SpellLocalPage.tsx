import { Link, useNavigate } from 'react-router-dom'
import ChessBoard from '@/components/board/ChessBoard'
import { useSpellGameStore } from '@/stores/spellGameStore'
import { useState, useEffect, useRef } from 'react'
import { useBoardWidth } from '@/hooks/useBoardWidth'
import Card from '@/components/Card'
import Button from '@/components/Button'
import SettingsDropdown from '@/components/SettingsDropdown'
import UserMenu from '@/components/UserMenu'
import Footer from '@/components/Footer'
import { useAuth } from '@/hooks/useAuth'

const BASE = import.meta.env.BASE_URL || '/'

export default function SpellLocalPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { 
    fen, turn, spellState, selectedSquare, legalMoves, lastMove, 
    isGameOver, winner, activeSpell, portalStart,
    makeMove, selectSquare, castSpell, resetGame 
  } = useSpellGameStore()
  
  const [initialized, setInitialized] = useState(false)
  const boardContainerRef = useRef<HTMLDivElement>(null)
  const { stableWidth } = useBoardWidth(boardContainerRef, true)

  useEffect(() => {
    if (!initialized) {
      resetGame()
      setInitialized(true)
    }
  }, [])

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (isGameOver) return false
    return makeMove(sourceSquare, targetSquare)
  }

  const onSquareClick = (square: string) => {
    if (isGameOver) return
    selectSquare(square)
  }

  const currentSpells = turn === 'w' ? spellState.whiteSpells : spellState.blackSpells

  // Custom square styles for visual effects
  const customSquareStyles: Record<string, React.CSSProperties> = {}
  const engine = useSpellGameStore.getState().engine
  
  // Highlight frozen squares
  Object.keys(spellState.frozenSquares).forEach(sq => {
    if (spellState.frozenSquares[sq] > engine.halfMoveCount) {
      customSquareStyles[sq] = {
        background: 'rgba(100, 200, 255, 0.35)',
        boxShadow: 'inset 0 0 15px rgba(255, 255, 255, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }
    }
  })

  // Highlight shielded squares
  Object.keys(spellState.shieldedSquares).forEach(sq => {
    if (spellState.shieldedSquares[sq] > engine.halfMoveCount) {
      customSquareStyles[sq] = {
        ...customSquareStyles[sq],
        boxShadow: '0 0 20px rgba(255, 255, 100, 0.4), inset 0 0 10px rgba(255, 255, 100, 0.6)'
      }
    }
  })

  // Highlight portals
  if (spellState.portals) {
    customSquareStyles[spellState.portals.from] = {
      ...customSquareStyles[spellState.portals.from],
      background: 'radial-gradient(circle, rgba(160, 32, 240, 0.6) 0%, transparent 70%)',
      boxShadow: '0 0 15px rgba(160, 32, 240, 0.8)'
    }
    customSquareStyles[spellState.portals.to] = {
      ...customSquareStyles[spellState.portals.to],
      background: 'radial-gradient(circle, rgba(160, 32, 240, 0.6) 0%, transparent 70%)',
      boxShadow: '0 0 15px rgba(160, 32, 240, 0.8)'
    }
  }

  // Highlight portal selection
  if (portalStart) {
    customSquareStyles[portalStart] = {
      background: 'rgba(160, 32, 240, 0.4)',
      boxShadow: '0 0 10px purple'
    }
  }

  // Highlight jump square
  if (spellState.jumpSquare) {
    customSquareStyles[spellState.jumpSquare] = {
      ...customSquareStyles[spellState.jumpSquare],
      boxShadow: '0 0 15px var(--accent-brand), inset 0 0 10px var(--accent-brand)'
    }
  }

  const spellIcons = {
    freeze: '🧊',
    jump: '🦘',
    blast: '💣',
    shield: '🛡️',
    portal: '🕳️'
  }

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
            <div 
              className="mx-auto mb-[var(--space-12)] grid grid-cols-3 items-center px-[var(--space-8)]"
              style={{ width: stableWidth || '100%', maxWidth: '100%' }}
            >
              <div className="flex items-center gap-[var(--space-8)] text-[var(--font-size-sm)] font-bold">
                <img 
                  src={`${BASE}emojis/online/magic.png`} 
                  alt="magic" 
                  className="w-5 h-5 object-contain opacity-90"
                  style={{ imageRendering: 'pixelated' }}
                />
                <span className="text-[var(--accent-brand)] uppercase tracking-widest">Spell Chess</span>
              </div>

              <div className="text-center flex justify-center">
                {isGameOver ? (
                  <h2 className="text-[10px] font-bold text-[var(--accent-brand)] uppercase tracking-[0.2em] animate-pulse">
                    Победа {winner === 'w' ? 'белых' : 'черных'}!
                  </h2>
                ) : (
                  activeSpell && (
                    <h2 className="text-[10px] font-bold text-[var(--accent-brand)] uppercase tracking-[0.2em] animate-pulse">
                      {activeSpell === 'portal' && !portalStart ? 'Выберите вход портала' : 
                       activeSpell === 'portal' ? 'Выберите выход портала' :
                       activeSpell === 'freeze' ? 'Выберите область 3x3' : 
                       activeSpell === 'blast' ? 'Выберите центр взрыва (+)' :
                       'Выберите фигуру'}
                    </h2>
                  )
                )}
              </div>

              <div className="text-right">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${
                  turn === 'w' ? 'text-[var(--accent-brand)] animate-pulse' : 'text-text opacity-60'
                }`}>
                  {turn === 'w' ? 'Белые' : 'Черные'}
                </span>
              </div>
            </div>

            <div
              ref={boardContainerRef}
              className="board-container relative overflow-hidden"
            >
              {stableWidth > 0 && (
                <ChessBoard
                  position={fen}
                  lastMove={lastMove}
                  checkSquare={null}
                  selectedSquare={selectedSquare}
                  legalMoves={legalMoves}
                  onDrop={onDrop}
                  onSquareClick={onSquareClick}
                  boardWidth={stableWidth}
                  boardOrientation="white"
                  customSquareStyles={customSquareStyles}
                  arePiecesDraggable={!isGameOver && !activeSpell}
                  customCursor={activeSpell ? 'crosshair' : undefined}
                />
              )}
            </div>

            <div className="mt-[var(--space-16)] flex justify-center gap-[var(--space-12)]">
              {isGameOver && (
                <Button variant="primary" onClick={resetGame}>Новая игра</Button>
              )}
              <Button variant="outline" onClick={() => navigate('/')}>В лобби</Button>
            </div>
          </div>

          <div className="game-side-column space-y-[var(--space-16)]">
            <Card padding="sm">
              <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em] mb-4 text-center">Инвентарь</h3>
              <div className="grid grid-cols-5 gap-1.5">
                {(Object.keys(spellIcons) as Array<keyof typeof spellIcons>).map(spell => {
                  const s = currentSpells[spell]
                  const isActive = activeSpell === spell
                  return (
                    <button
                      key={spell}
                      onClick={() => castSpell(spell)}
                      disabled={isGameOver || s.charges <= 0 || s.cooldown > 0}
                      className={`relative p-2 rounded-[var(--radius-4)] border transition-all flex flex-col items-center justify-center gap-1 group ${
                        isActive 
                          ? 'bg-[var(--accent-brand)] border-[var(--accent-brand)] text-bg shadow-[0_0_10px_rgba(126,184,126,0.3)]' 
                          : 'bg-[rgba(255,255,255,0.02)] border-[var(--border)] text-text-secondary hover:border-[var(--accent-brand)] disabled:opacity-20'
                      }`}
                      title={spell.toUpperCase()}
                    >
                      <span className="text-base" style={{ imageRendering: 'pixelated' }}>{spellIcons[spell]}</span>
                      <span className="text-[7px] font-bold">{s.charges}</span>
                      {s.cooldown > 0 && (
                        <div className="absolute inset-0 bg-bg/85 flex items-center justify-center rounded-[var(--radius-4)]">
                          <span className="text-[10px] font-bold text-[var(--accent-brand)]">{s.cooldown}</span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </Card>

            <Card padding="sm" className="overflow-hidden">
              <h3 className="text-[9px] font-bold text-text-secondary uppercase tracking-[0.2em] mb-3 border-b border-white/5 pb-2">Магия пикселей</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                <RuleItem icon="🧊" title="Заморозка" text="Область 3x3 на 1 ход. Фигуры не ходят и не бьют." />
                <RuleItem icon="🦘" title="Прыжок" text="Позволяет перепрыгнуть через одну фигуру." />
                <RuleItem icon="💣" title="Взрыв" text="Уничтожает фигуры крестом (+). Не трогает королей." />
                <RuleItem icon="🛡️" title="Щит" text="Фигуру нельзя съесть в течение 1 хода." />
                <RuleItem icon="🕳️" title="Портал" text="Вход и выход. Любая фигура мгновенно перемещается." />
              </div>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function RuleItem({ icon, title, text }: { icon: string, title: string, text: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-sm mt-0.5">{icon}</span>
      <div>
        <p className="text-[8px] text-text font-bold uppercase tracking-wider">{title}</p>
        <p className="text-[8px] text-text-secondary leading-normal">{text}</p>
      </div>
    </div>
  )
}
