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
import { SPELL_UNLOCK, WHITE_CHARGES, BLACK_CHARGES, type SpellName } from '@/lib/spellChessEngine'
import { useBoardStore } from '@/stores/boardStore'

const BASE = import.meta.env.BASE_URL || '/'

const SPELL_META: Record<SpellName, { label: string; icon: string; desc: string; type: 'free' | 'terminal'; target: 'square' | 'piece' | 'pair' }> = {
  jump:  { label: 'Прыжок',  icon: 'jump.png',    desc: 'Перепрыгнуть фигуру', type: 'free', target: 'piece' },
  shield:{ label: 'Щит',     icon: 'shield.png',  desc: 'Защитить фигуру',    type: 'free', target: 'piece' },
  portal:{ label: 'Портал',  icon: 'portal.png',  desc: 'Телепорт между двумя клетками', type: 'free', target: 'pair' },
  freeze:{ label: 'Заморозка',icon: 'freezing.png',desc: 'Заморозить 3x3 область', type: 'terminal', target: 'square' },
  blast: { label: 'Взрыв',   icon: 'bomb.png',    desc: 'Установить мину',   type: 'terminal', target: 'square' },
  berserk:{ label: 'Берсерк',icon: 'berserk.png', desc: 'Превратить фигуру', type: 'terminal', target: 'piece' },
  divineGrace:{ label: 'Благодать',icon: 'divineGrace.png', desc: 'Снять заморозку в радиусе 1', type: 'terminal', target: 'square' },
  shadowGrave:{ label: 'Тень',icon: 'shadowGrave.png',   desc: 'Пожертвовать свою + убить врага', type: 'terminal', target: 'piece' },
  mirage:{ label: 'Мираж',   icon: 'mirage.png',  desc: 'Поменять местами две фигуры', type: 'terminal', target: 'pair' },
}

const ALL_SPELLS: SpellName[] = ['jump', 'shield', 'portal', 'freeze', 'blast', 'berserk', 'divineGrace', 'shadowGrave', 'mirage']
const NO_CONFIRM_SPELLS: SpellName[] = ['portal', 'berserk', 'divineGrace', 'shadowGrave', 'mirage']
const WHITE_ONLY: SpellName[] = ['berserk', 'divineGrace']
const BLACK_ONLY: SpellName[] = ['shadowGrave', 'mirage']

export default function SpellLocalPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const {
    fen, turn, spellState, selectedSquare, legalMoves, lastMove,
    isGameOver, winner, activeSpell, portalStart, mirageStart, halfMoveCount,
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
    const bombs = spellState.bombs ? Object.keys(spellState.bombs) : []
    if (spellState.pendingBlastMine) bombs.push(spellState.pendingBlastMine.square)
    return bombs
  }, [spellState.bombs, spellState.pendingBlastMine])

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

  // Track pending blast mine explosion
  const prevPendingMineRef = useRef<{ square: string; color: string } | null>(null)
  useEffect(() => {
    const currentMine = spellState.pendingBlastMine
    if (prevPendingMineRef.current && !currentMine) {
      const center = getSquareCenter(prevPendingMineRef.current.square)
      vfxRef.current?.trigger({ ...center, type: 'blast' })
    }
    prevPendingMineRef.current = currentMine ? { square: currentMine.square, color: currentMine.color } : null
  }, [spellState.pendingBlastMine])

  const handleCastSpell = (spell: SpellName, square?: string) => {
    if (square) {
      const center = getSquareCenter(square)
      switch (spell) {
        case 'freeze': vfxRef.current?.trigger({ ...center, type: 'ice-shatter' }); break
        case 'jump': vfxRef.current?.trigger({ ...center, type: 'jump' }); break
        case 'shield': vfxRef.current?.trigger({ ...center, type: 'shield' }); break
        case 'berserk': vfxRef.current?.trigger({ ...center, type: 'sparkle' }); break
        case 'divineGrace': vfxRef.current?.trigger({ ...center, type: 'sparkle' }); break
        case 'portal':
          if (portalStart) {
            const start = getSquareCenter(portalStart)
            vfxRef.current?.trigger({ ...start, type: 'portal' })
            vfxRef.current?.trigger({ ...center, type: 'portal' })
          }
          break
        case 'mirage':
          if (mirageStart) {
            const start = getSquareCenter(mirageStart)
            vfxRef.current?.trigger({ ...start, type: 'portal' })
            vfxRef.current?.trigger({ ...center, type: 'portal' })
          }
          break
        case 'shadowGrave': {
          const center = getSquareCenter(square)
          vfxRef.current?.trigger({ ...center, type: 'portal' })
          // blast on random enemy (we don't know which one, so just trigger on center)
          setTimeout(() => vfxRef.current?.trigger({ ...center, type: 'blast' }), 300)
          break
        }
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
      if (NO_CONFIRM_SPELLS.includes(activeSpell)) {
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

  const turnNumber = Math.floor(halfMoveCount / 2) + 1
  const previewTarget = pendingTarget || hoveredSquare

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {}

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

    if (activeSpell === 'blast' && previewTarget) {
      const col = previewTarget.charCodeAt(0) - 97
      const row = parseInt(previewTarget[1])
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          const tCol = col + dc
          const tRow = row + dr
          if (tCol >= 0 && tCol < 8 && tRow >= 1 && tRow <= 8) {
            styles[`${String.fromCharCode(tCol + 97)}${tRow}`] = {
              background: 'rgba(255, 0, 0, 0.3)',
              boxShadow: 'inset 0 0 10px rgba(255, 0, 0, 0.5)',
              borderRadius: '2px'
            }
          }
        }
      }
    }

    if (activeSpell === 'divineGrace' && previewTarget) {
      const col = previewTarget.charCodeAt(0) - 97
      const row = parseInt(previewTarget[1])
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          const tCol = col + dc
          const tRow = row + dr
          if (tCol >= 0 && tCol < 8 && tRow >= 1 && tRow <= 8) {
            styles[`${String.fromCharCode(tCol + 97)}${tRow}`] = {
              background: 'rgba(255, 215, 0, 0.25)',
              boxShadow: 'inset 0 0 10px rgba(255, 215, 0, 0.4)',
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

    if (spellState.portals && spellState.portals.expiry > halfMoveCount) {
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

    if (mirageStart) {
      styles[mirageStart] = {
        ...styles[mirageStart],
        background: 'rgba(255, 215, 0, 0.3)',
        boxShadow: '0 0 10px rgba(255, 215, 0, 0.5)'
      }
    }

    if (spellState.jumpSquare) {
      styles[spellState.jumpSquare] = {
        ...styles[spellState.jumpSquare],
        boxShadow: '0 0 15px var(--accent-brand), inset 0 0 10px var(--accent-brand)'
      }
    }

    Object.keys(spellState.impassableSquares).forEach(sq => {
      if (spellState.impassableSquares[sq] > halfMoveCount) {
        styles[sq] = {
          ...styles[sq],
          background: 'rgba(40, 40, 40, 0.6)',
          boxShadow: 'inset 0 0 15px rgba(0, 0, 0, 0.5)',
        }
      }
    })

    return styles
  }, [activeSpell, previewTarget, spellState, halfMoveCount, portalStart, mirageStart])

  const getStatusMessage = () => {
    if (isGameOver) return `Победа ${winner === 'w' ? 'белых' : 'чёрных'}!`
    if (activeSpell) {
      const meta = SPELL_META[activeSpell]
      if (pendingTarget) return 'Нажмите ещё раз для подтверждения'
      if (activeSpell === 'portal' && !portalStart) return 'Выберите вход портала'
      if (activeSpell === 'portal') return 'Выберите выход портала'
      if (activeSpell === 'mirage' && !mirageStart) return 'Выберите первую фигуру'
      if (activeSpell === 'mirage') return 'Выберите вторую фигуру'
      if (activeSpell === 'freeze') return 'Выберите центр области 3x3'
      if (activeSpell === 'blast') return 'Выберите место для мины'
      if (activeSpell === 'divineGrace') return 'Выберите центр снятия заморозки'
      if (activeSpell === 'shadowGrave') return 'Выберите свою фигуру для жертвы'
      if (activeSpell === 'berserk') return 'Выберите фигуру для превращения'
      if (activeSpell === 'jump') return 'Выберите фигуру для прыжка'
      if (activeSpell === 'shield') return 'Выберите фигуру для щита'
      return meta.desc
    }
    if (hasCastSpellThisTurn) return 'Магия уже использована в этот ход'
    return null
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
                    {getStatusMessage()}
                  </h2>
                ) : getStatusMessage() ? (
                  <h2 className={`text-[10px] font-bold uppercase tracking-[0.2em] text-center leading-tight ${hasCastSpellThisTurn && !activeSpell ? 'text-[var(--danger)]' : 'text-[var(--accent-brand)]'} ${activeSpell ? 'animate-pulse' : ''}`}>
                    {getStatusMessage()}
                  </h2>
                ) : null}
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
                        borderRadius: 'var(--radius-8)',
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

              <div className="grid grid-cols-3 gap-1.5">
                {ALL_SPELLS.map(spell => {
                  const meta = SPELL_META[spell]
                  const charge = spellState.charges[turn][spell] || 0
                  const unlockTurn = SPELL_UNLOCK[spell]
                  const isLocked = turnNumber < unlockTurn
                  const isColorRestricted = (WHITE_ONLY.includes(spell) && turn !== 'w') || (BLACK_ONLY.includes(spell) && turn !== 'b')
                  const noCharges = charge <= 0
                  const isActive = activeSpell === spell
                  const isDisabled = isGameOver || hasCastSpellThisTurn || isLocked || isColorRestricted || noCharges

                  return (
                    <button
                      key={spell}
                      onClick={() => castSpell(spell)}
                      disabled={isDisabled}
                      className={`relative p-1.5 rounded-[var(--radius-4)] border transition-all flex flex-col items-center justify-center gap-0.5 group ${
                        isActive
                          ? 'bg-[var(--accent-brand)] border-[var(--accent-brand)] text-bg shadow-[0_0_10px_rgba(126,184,126,0.3)]'
                          : 'bg-[rgba(255,255,255,0.02)] border-[var(--border)] text-text-secondary hover:border-[var(--accent-brand)] disabled:opacity-20'
                      }`}
                      title={`${meta.label} — ${meta.desc} (${meta.type === 'free' ? 'свободное' : 'завершающее'})`}
                    >
                      <img
                        src={`${BASE}emojis/${meta.icon}`}
                        alt={spell}
                        className="w-5 h-5 object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                      <span className="text-[6px] font-bold drop-shadow-[0_0_3px_rgba(126,184,126,0.5)]">
                        {noCharges ? '0' : charge}
                      </span>
                      {isLocked && (
                        <div className="absolute inset-0 bg-bg/70 flex items-center justify-center rounded-[var(--radius-4)]">
                          <span className="text-[5px] font-bold text-text-secondary text-center leading-tight px-0.5">
                            🔒 ход {unlockTurn}+
                          </span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="mt-3 flex items-center justify-center gap-3 text-[7px] text-text-secondary">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-[var(--accent-brand)]/40 border border-[var(--accent-brand)]" />
                  Свободное
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-[var(--danger)]/40 border border-[var(--danger)]" />
                  Завершающее
                </span>
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
                  style={{ width: `${Math.min(100, (turnNumber / 20) * 100)}%` }}
                />
                {[1, 4, 7, 10, 13, 16].map(t => (
                  <div
                    key={t}
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2"
                    style={{
                      left: `${(t / 20) * 100}%`,
                      borderColor: 'var(--accent-brand)',
                      backgroundColor: turnNumber >= t ? 'var(--accent-brand)' : 'var(--bg)',
                      zIndex: 2
                    }}
                  />
                ))}
              </div>

              <div className="space-y-1.5">
                {ALL_SPELLS.map(spell => {
                  const meta = SPELL_META[spell]
                  const unlockTurn = SPELL_UNLOCK[spell]
                  const isUnlocked = turnNumber >= unlockTurn
                  const charge = spellState.charges[turn][spell] || 0
                  const maxCharge = turn === 'w' ? (WHITE_CHARGES[spell] || 0) : (BLACK_CHARGES[spell] || 0)
                  return (
                    <div key={spell} className="flex items-center gap-2 px-1">
                      <img
                        src={`${BASE}emojis/${meta.icon}`}
                        alt={spell}
                        className="w-3.5 h-3.5 object-contain"
                        style={{ imageRendering: 'pixelated', opacity: isUnlocked ? 1 : 0.35 }}
                      />
                      <span className={`text-[7px] font-bold uppercase tracking-wider flex-1 ${isUnlocked ? 'text-text' : 'text-text-secondary'}`}>
                        {meta.label}
                      </span>
                      <span className={`text-[7px] font-bold ${charge > 0 ? 'text-[var(--accent-brand)]' : 'text-[var(--danger)]'}`}>
                        {charge}/{maxCharge}
                      </span>
                      {!isUnlocked && (
                        <span className="text-[7px] font-bold text-text-secondary">
                          ход {unlockTurn}+
                        </span>
                      )}
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
