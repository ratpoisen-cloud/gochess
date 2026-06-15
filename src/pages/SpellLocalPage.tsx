import { Link, useNavigate } from 'react-router-dom'
import ChessBoard from '@/components/board/ChessBoard'
import { useSpellGameStore } from '@/stores/spellGameStore'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useBoardWidth } from '@/hooks/useBoardWidth'
import Card from '@/components/Card'
import Button from '@/components/Button'
import SettingsDropdown from '@/components/SettingsDropdown'
import UserMenu from '@/components/UserMenu'
import Footer from '@/components/Footer'
import { useAuth } from '@/hooks/useAuth'
import { MagicVFX, type MagicVFXHandle } from '@/components/MagicVFX'

const BASE = import.meta.env.BASE_URL || '/'

export default function SpellLocalPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { 
    fen, turn, spellState, selectedSquare, legalMoves, lastMove, 
    isGameOver, winner, activeSpell, portalStart, halfMoveCount,
    makeMove, selectSquare, castSpell, resetGame, hasCastSpellThisTurn
  } = useSpellGameStore()
  
  const engine = useSpellGameStore.getState().engine
  const kingSquare = turn ? engine.getKingSquare(turn) : null
  const checkSquare = useMemo(() => {
    if (!kingSquare) return null
    const opponentColor = turn === 'w' ? 'b' : 'w'
    return engine.isSquareAttacked(kingSquare, opponentColor) ? kingSquare : null
  }, [fen, turn])
  
  const [initialized, setInitialized] = useState(false)
  const [hoveredSquare, setHoveredSquare] = useState<string | null>(null)
  const [pendingTarget, setPendingTarget] = useState<string | null>(null)
  const boardContainerRef = useRef<HTMLDivElement>(null)
  const vfxRef = useRef<MagicVFXHandle>(null)
  const { stableWidth } = useBoardWidth(boardContainerRef, true)

  useEffect(() => {
    if (!initialized) {
      resetGame()
      setInitialized(true)
    }
  }, [])

  useEffect(() => {
    setPendingTarget(null)
  }, [activeSpell])

  const getSquareCenter = (square: string) => {
    if (!stableWidth) return { x: 0, y: 0 }
    const squareSize = stableWidth / 8
    const col = square.charCodeAt(0) - 97
    const row = 8 - parseInt(square[1])
    return {
      x: col * squareSize + squareSize / 2,
      y: row * squareSize + squareSize / 2
    }
  }

  const handleCastSpell = (spell: any, square?: string) => {
    if (square) {
      const center = getSquareCenter(square)
      if (spell === 'freeze') vfxRef.current?.trigger({ ...center, type: 'ice-shatter' })
      if (spell === 'blast') vfxRef.current?.trigger({ ...center, type: 'blast' })
      if (spell === 'jump') vfxRef.current?.trigger({ ...center, type: 'jump' })
      if (spell === 'shield') vfxRef.current?.trigger({ ...center, type: 'jump' }) 
      if (spell === 'portal' && portalStart) {
        const start = getSquareCenter(portalStart)
        vfxRef.current?.trigger({ ...start, type: 'portal' })
        vfxRef.current?.trigger({ ...center, type: 'portal' })
      }
    }
    castSpell(spell, square)
    setPendingTarget(null)
  }

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (isGameOver) return false
    
    const engine = useSpellGameStore.getState().engine
    const targetPiece = engine.getPiece(targetSquare)
    if (targetPiece && engine.isFrozen(targetSquare)) {
      const center = getSquareCenter(targetSquare)
      vfxRef.current?.trigger({ ...center, type: 'ice-shatter' })
    }

    if (engine.spellState.jumpSquare === sourceSquare) {
      const center = getSquareCenter(targetSquare)
      vfxRef.current?.trigger({ ...center, type: 'jump' })
    }

    return makeMove(sourceSquare, targetSquare)
  }

  const onSquareClick = (square: string) => {
    if (isGameOver) return
    
    if (activeSpell) {
      if (activeSpell === 'portal' && !portalStart) {
        selectSquare(square)
        return
      }
      
      if (pendingTarget === square) {
        handleCastSpell(activeSpell, square)
      } else {
        setPendingTarget(square)
      }
      return
    }
    
    selectSquare(square)
  }

  const currentSpells = turn === 'w' ? spellState.whiteSpells : spellState.blackSpells
  const previewTarget = pendingTarget || hoveredSquare

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {}
    
    if (activeSpell === 'blast' && previewTarget) {
      const col = previewTarget.charCodeAt(0) - 97
      const row = parseInt(previewTarget[1])
      for (const [dc, dr] of [[0, 0], [-1, 0], [1, 0], [0, 1], [0, -1]]) {
        const tCol = col + dc
        const tRow = row + dr
        if (tCol >= 0 && tCol < 8 && tRow >= 1 && tRow <= 8) {
          styles[`${String.fromCharCode(tCol + 97)}${tRow}`] = {
            background: 'rgba(255, 0, 0, 0.4)',
            boxShadow: 'inset 0 0 10px rgba(255, 0, 0, 0.5)',
            borderRadius: '2px'
          }
        }
      }
    }

    if (activeSpell === 'freeze' && previewTarget) {
      const col = previewTarget.charCodeAt(0) - 97
      const row = parseInt(previewTarget[1])
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          const tCol = col + dc
          const tRow = row + dr
          if (tCol >= 0 && tCol < 8 && tRow >= 1 && tRow <= 8) {
            styles[`${String.fromCharCode(tCol + 97)}${tRow}`] = {
              background: 'rgba(100, 200, 255, 0.4)',
              boxShadow: 'inset 0 0 10px rgba(255, 255, 255, 0.5)',
              borderRadius: '2px'
            }
          }
        }
      }
    }

    Object.keys(spellState.frozenSquares).forEach(sq => {
      if (spellState.frozenSquares[sq] > halfMoveCount) {
        styles[sq] = {
          background: 'rgba(100, 200, 255, 0.35)',
          boxShadow: 'inset 0 0 15px rgba(255, 255, 255, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }
      }
    })

    Object.keys(spellState.shieldedSquares).forEach(sq => {
      if (spellState.shieldedSquares[sq] > halfMoveCount) {
        styles[sq] = {
          ...styles[sq],
          boxShadow: '0 0 20px rgba(255, 255, 100, 0.4), inset 0 0 10px rgba(255, 255, 100, 0.6)'
        }
      }
    })

    if (spellState.portals) {
      styles[spellState.portals.from] = {
        ...styles[spellState.portals.from],
        background: 'radial-gradient(circle, rgba(160, 32, 240, 0.6) 0%, transparent 70%)',
        boxShadow: '0 0 15px rgba(160, 32, 240, 0.8)'
      }
      styles[spellState.portals.to] = {
        ...styles[spellState.portals.to],
        background: 'radial-gradient(circle, rgba(160, 32, 240, 0.6) 0%, transparent 70%)',
        boxShadow: '0 0 15px rgba(160, 32, 240, 0.8)'
      }
    }

    if (portalStart) {
      styles[portalStart] = {
        ...styles[portalStart],
        background: 'rgba(160, 32, 240, 0.4)',
        boxShadow: '0 0 10px purple'
      }
    }

    if (spellState.jumpSquare) {
      styles[spellState.jumpSquare] = {
        ...styles[spellState.jumpSquare],
        boxShadow: '0 0 15px var(--accent-brand), inset 0 0 10px var(--accent-brand)'
      }
    }

    return styles
  }, [activeSpell, previewTarget, spellState, halfMoveCount, portalStart])

  const spellIcons = {
    freeze: 'freezing.png',
    jump: 'jump.png',
    blast: 'bomb.png',
    shield: 'shield.png',
    portal: 'portal.png'
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
                    Победа {winner === 'w' ? 'белых' : 'чёрных'}!
                  </h2>
                ) : (
                  activeSpell ? (
                    <h2 className="text-[10px] font-bold text-[var(--accent-brand)] uppercase tracking-[0.2em] animate-pulse text-center leading-tight">
                      {pendingTarget ? 'Нажмите ещё раз для подтверждения' : 
                       activeSpell === 'portal' && !portalStart ? 'Выберите вход портала' : 
                       activeSpell === 'portal' ? 'Выберите выход портала' :
                       activeSpell === 'freeze' ? 'Выберите область 3x3' : 
                       activeSpell === 'blast' ? 'Выберите центр взрыва (+)' :
                       'Выберите фигуру'}
                    </h2>
                  ) : hasCastSpellThisTurn ? (
                    <h2 className="text-[10px] font-bold text-[var(--danger)] uppercase tracking-[0.2em] text-center leading-tight">
                      Магия уже использована в этот ход
                    </h2>
                  ) : null
                )}
              </div>

              <div className="text-right">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${
                  turn === 'w' ? 'text-[var(--accent-brand)] animate-pulse' : 'text-text opacity-60'
                }`}>
                  {turn === 'w' ? 'Белые' : 'Чёрные'}
                </span>
              </div>
            </div>

            <div
              ref={boardContainerRef}
              className="board-container relative overflow-hidden"
            >
              <MagicVFX ref={vfxRef} boardWidth={stableWidth} />
              {stableWidth > 0 && (
                <ChessBoard
                  position={fen}
                  lastMove={lastMove}
                  checkSquare={checkSquare}
                  selectedSquare={selectedSquare}
                  legalMoves={legalMoves}
                  onDrop={onDrop}
                  onSquareClick={onSquareClick}
                  onSquareMouseEnter={(square) => setHoveredSquare(square)}
                  onSquareMouseLeave={() => setHoveredSquare(null)}
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
              <Button variant="outline" onClick={() => navigate('/offline')}>В лобби</Button>
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
                      disabled={isGameOver || hasCastSpellThisTurn || s.charges <= 0 || s.cooldown > 0}
                      className={`relative p-2 rounded-[var(--radius-4)] border transition-all flex flex-col items-center justify-center gap-1 group ${
                        isActive 
                          ? 'bg-[var(--accent-brand)] border-[var(--accent-brand)] text-bg shadow-[0_0_10px_rgba(126,184,126,0.3)]' 
                          : 'bg-[rgba(255,255,255,0.02)] border-[var(--border)] text-text-secondary hover:border-[var(--accent-brand)] disabled:opacity-20'
                      }`}
                      title={spell.toUpperCase()}
                    >
                      <img 
                        src={`${BASE}emojis/${spellIcons[spell]}`} 
                        alt={spell}
                        className="w-6 h-6 object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
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
                <RuleItem icon="freezing.png" title="Заморозка" text="Область 3x3 на 1 ход. Фигуры не ходят и не бьют." />
                <RuleItem icon="jump.png" title="Прыжок" text="Позволяет перепрыгнуть через одну фигуру." />
                <RuleItem icon="bomb.png" title="Взрыв" text="Уничтожает фигуры крестом (+). Не трогает королей." />
                <RuleItem icon="shield.png" title="Щит" text="Фигуру нельзя съесть в течение 1 хода." />
                <RuleItem icon="portal.png" title="Портал" text="Вход и выход. Любая фигура мгновенно перемещается." />
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
      <img 
        src={`${BASE}emojis/${icon}`} 
        alt={title}
        className="w-5 h-5 object-contain mt-0.5"
        style={{ imageRendering: 'pixelated' }}
      />
      <div>
        <p className="text-[8px] text-text font-bold uppercase tracking-wider">{title}</p>
        <p className="text-[8px] text-text-secondary leading-normal">{text}</p>
      </div>
    </div>
  )
}
