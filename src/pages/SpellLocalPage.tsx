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
import { SPELL_CONFIGS } from '@/lib/spellChessEngine'
import { useBoardStore } from '@/stores/boardStore'

const BASE = import.meta.env.BASE_URL || '/'

export default function SpellLocalPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { 
    fen, turn, spellState, selectedSquare, legalMoves, lastMove, 
    isGameOver, winner, activeSpell, portalStart, halfMoveCount,
    makeMove, selectSquare, castSpell, resetGame, hasCastSpellThisTurn,
    berserkTarget, confirmBerserk
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
  const { getPieceUrl } = useBoardStore()

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

  const activeBombs = useMemo(() => {
    return spellState.bombs ? Object.keys(spellState.bombs) : []
  }, [spellState.bombs])

  const prevBombsRef = useRef<Record<string, string>>({})
  useEffect(() => {
    const currentBombs = spellState.bombs || {}
    if (halfMoveCount > 0) {
      Object.keys(prevBombsRef.current).forEach(square => {
        if (!currentBombs[square]) {
          const center = getSquareCenter(square)
          vfxRef.current?.trigger({ ...center, type: 'blast' })
        }
      })
    }
    prevBombsRef.current = { ...currentBombs }
  }, [spellState.bombs, halfMoveCount])

  const handleCastSpell = (spell: any, square?: string) => {
    if (square) {
      const center = getSquareCenter(square)
      if (spell === 'freeze') vfxRef.current?.trigger({ ...center, type: 'ice-shatter' })
      if (spell === 'jump') vfxRef.current?.trigger({ ...center, type: 'jump' })
      if (spell === 'shield') vfxRef.current?.trigger({ ...center, type: 'shield' })
      if (spell === 'berserk') vfxRef.current?.trigger({ ...center, type: 'sparkle' })
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
      
      if (activeSpell === 'berserk') {
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

  const currentMana = turn === 'w' ? spellState.whiteMana : spellState.blackMana
  const currentCooldowns = turn === 'w' ? spellState.whiteCooldowns : spellState.blackCooldowns
  const turnNumber = Math.floor(halfMoveCount / 2) + 1
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
    portal: 'portal.png',
    berserk: 'berserk.png'
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
                       activeSpell === 'blast' ? 'Выберите место для установки бомбы' :
                       activeSpell === 'berserk' ? 'Выберите фигуру для превращения' :
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
                  bombs={activeBombs}
                />
              )}

              {berserkTarget && stableWidth && (() => {
                const col = berserkTarget.charCodeAt(0) - 97
                const rank = parseInt(berserkTarget[1])
                const leftPct = col * 12.5
                const isAtTop = rank === 8
                const piece = engine.getPiece(berserkTarget)
                const currentType = piece?.type
                const types = (['q', 'r', 'b', 'n', 'p'] as const).filter(t => t !== currentType)
                return (
                  <div
                    className="absolute inset-0 z-[10001] cursor-default bg-black/10"
                    onClick={() => useSpellGameStore.setState({ berserkTarget: null })}
                  >
                    <div 
                      className="absolute flex flex-col shadow-2xl shadow-black/80 overflow-hidden animate-modal-pixel-in"
                      style={{
                        left: `${leftPct}%`,
                        top: isAtTop ? 0 : 'auto',
                        bottom: isAtTop ? 'auto' : 0,
                        width: '12.5%',
                        height: `${types.length * 12.5}%`,
                        backgroundColor: 'rgba(18, 20, 18, 0.96)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: 'var(--radius-14)',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {types.map((t) => {
                        const code = `${turn}${t.toUpperCase()}`
                        return (
                          <button
                            key={t}
                            onClick={() => {
                              const center = getSquareCenter(berserkTarget)
                              vfxRef.current?.trigger({ ...center, type: 'sparkle' })
                              confirmBerserk(berserkTarget, t)
                            }}
                            className="flex-1 flex items-center justify-center transition-colors group"
                            style={{
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(232, 232, 216, 0.08)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
                            }}
                          >
                            <img
                              src={getPieceUrl(code)}
                              alt={t}
                              className="w-[85%] h-[85%] object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
                              draggable={false}
                            />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
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

              {/* Mana Pool */}
              <div className="mb-4 px-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[8px] font-bold text-text-secondary uppercase tracking-wider">Мана</span>
                  <span className="text-[8px] font-bold text-[var(--accent-brand)]">{currentMana} / 5</span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={`flex-1 h-2 rounded-[2px] transition-all duration-300 ${
                      i < currentMana
                        ? 'bg-[var(--accent-brand)] shadow-[0_0_6px_rgba(126,184,126,0.4)]'
                        : 'bg-[rgba(255,255,255,0.06)]'
                    }`} />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(spellIcons) as Array<keyof typeof spellIcons>).map(spell => {
                  const config = SPELL_CONFIGS[spell]
                  const cooldown = currentCooldowns[spell]
                  const isLocked = turnNumber < config.unlock
                  const noMana = currentMana < config.cost
                  const isActive = activeSpell === spell
                  const isDisabled = isGameOver || hasCastSpellThisTurn || noMana || cooldown > 0 || isLocked
                  return (
                    <button
                      key={spell}
                      onClick={() => castSpell(spell)}
                      disabled={isDisabled}
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
                      {isLocked ? (
                        <span className="text-[7px] font-bold tracking-wider">🔒</span>
                      ) : (
                        <span className="text-[7px] font-bold drop-shadow-[0_0_3px_rgba(126,184,126,0.5)]">
                          {config.cost}💧
                        </span>
                      )}
                      {cooldown > 0 && (
                        <div className="absolute inset-0 bg-bg/85 flex items-center justify-center rounded-[var(--radius-4)]">
                          <span className="text-[10px] font-bold text-[var(--accent-brand)]">{cooldown}</span>
                        </div>
                      )}
                      {isLocked && cooldown <= 0 && (
                        <div className="absolute inset-0 bg-bg/70 flex items-center justify-center rounded-[var(--radius-4)]">
                          <span className="text-[6px] font-bold text-text-secondary text-center leading-tight px-1">
                            Ход {config.unlock}+
                          </span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </Card>

            <Card padding="sm">
              <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em] mb-4 text-center">Прогресс</h3>

              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="text-[11px] font-bold text-[var(--accent-brand)]">Ход</span>
                <span className="text-[20px] font-bold text-text tracking-wider">{turnNumber}</span>
              </div>

              <div className="relative h-1.5 bg-[rgba(255,255,255,0.06)] rounded-[2px] mb-4 mx-1">
                <div
                  className="absolute h-full bg-[var(--accent-brand)] rounded-[2px] transition-all duration-300"
                  style={{ width: `${Math.min(100, (turnNumber / 10) * 100)}%` }}
                />
                {[1, 5, 8, 10].map(t => (
                  <div
                    key={t}
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2"
                    style={{
                      left: `${(t / 10) * 100}%`,
                      borderColor: 'var(--accent-brand)',
                      backgroundColor: turnNumber >= t ? 'var(--accent-brand)' : 'var(--bg)',
                      zIndex: 2
                    }}
                  />
                ))}
              </div>

              <div className="space-y-2">
                {(Object.keys(spellIcons) as Array<keyof typeof spellIcons>).map(spell => {
                  const config = SPELL_CONFIGS[spell]
                  const isUnlocked = turnNumber >= config.unlock
                  return (
                    <div key={spell} className="flex items-center gap-2 px-1">
                      <img
                        src={`${BASE}emojis/${spellIcons[spell]}`}
                        alt={spell}
                        className="w-4 h-4 object-contain"
                        style={{ imageRendering: 'pixelated', opacity: isUnlocked ? 1 : 0.35 }}
                      />
                      <span className={`text-[8px] font-bold uppercase tracking-wider flex-1 ${isUnlocked ? 'text-text' : 'text-text-secondary'}`}>
                        {spell === 'freeze' ? 'Заморозка' :
                         spell === 'jump' ? 'Прыжок' :
                         spell === 'blast' ? 'Взрыв' :
                         spell === 'shield' ? 'Щит' :
                         spell === 'portal' ? 'Портал' :
                         spell === 'berserk' ? 'Берсерк' : spell}
                      </span>
                      <span className={`text-[8px] font-bold ${isUnlocked ? 'text-[var(--accent-brand)]' : 'text-[var(--danger)]'}`}>
                        {isUnlocked ? '✓' : `ход ${config.unlock}+`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

