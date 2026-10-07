import { useNavigate } from 'react-router-dom'
import ChessBoard from '@/components/board/ChessBoard'
import { useSpellGameStore } from '@/stores/spellGameStore'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useBoardWidth } from '@/hooks/useBoardWidth'
import Card from '@/components/Card'
import Button from '@/components/Button'
import { useAuth } from '@/hooks/useAuth'
import { MagicVFX, type MagicVFXHandle } from '@/components/MagicVFX'
import SpellRulesModal from '@/components/SpellRulesModal'
import GameLayout from '@/components/GameLayout'
import { SpellBar } from '@/components/board/SpellBar'
import { SpellInfoPanel } from '@/components/board/SpellInfoPanel'
import PixelConfetti from '@/components/PixelConfetti'
import PromotionPicker from '@/components/PromotionPicker'
import { spellIconFile, SPELL_ORDER } from '@/lib/spellMeta'
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

const NO_CONFIRM_SPELLS: SpellName[] = ['portal', 'berserk', 'divineGrace', 'shadowGrave', 'mirage']

export default function SpellLocalPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const {
    fen, turn, spellState, selectedSquare, legalMoves, lastMove,
    isGameOver, winner, activeSpell, portalStart, mirageStart, halfMoveCount,
    makeMove, selectSquare, castSpell, resetGame, hasCastSpellThisTurn, clearSpellSelection,
    berserkTarget, confirmBerserk
  } = useSpellGameStore()

  const engine = useSpellGameStore.getState().engine

  const [initialized, setInitialized] = useState(false)
  const [hoveredSquare, setHoveredSquare] = useState<string | null>(null)
  const [pendingTarget, setPendingTarget] = useState<string | null>(null)
  const boardContainerRef = useRef<HTMLDivElement>(null)
  const vfxRef = useRef<MagicVFXHandle>(null)
  const [isRulesOpen, setIsRulesOpen] = useState(false)
  const [hoveredSpell, setHoveredSpell] = useState<SpellName | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null)
  const { stableWidth } = useBoardWidth(boardContainerRef, true)
  const { getPieceUrl, getTheme } = useBoardStore()

  useEffect(() => {
    if (!initialized) {
      resetGame()
      setInitialized(true)
    }
  }, [])

  // Sync engine state to store on mount (handles stale singleton after full reload)
  useEffect(() => {
    const engine = useSpellGameStore.getState().engine
    const store = useSpellGameStore.getState()
    if (store.halfMoveCount !== engine.halfMoveCount) {
      useSpellGameStore.setState({ halfMoveCount: engine.halfMoveCount })
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

  const isPromotion = (from: string, to: string) => {
    const currentEngine = useSpellGameStore.getState().engine
    const piece = currentEngine.getPiece(from)
    if (piece?.type !== 'p') return false
    if (piece.color === 'w' && to[1] === '8') return true
    if (piece.color === 'b' && to[1] === '1') return true
    return false
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

    if (isPromotion(sourceSquare, targetSquare)) {
      setPendingPromotion({ from: sourceSquare, to: targetSquare })
      return true
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

    if (selectedSquare && legalMoves.includes(square) && isPromotion(selectedSquare, square)) {
      setPendingPromotion({ from: selectedSquare, to: square })
      return
    }

    selectSquare(square)
  }

  // Mirrors the king_capture branch in useGameSync: a captured king is already
  // off the board, so only the survivor gets marked.
  const { defeatedKingSquare, endGameEmojis } = useMemo(() => {
    if (!isGameOver || !winner) return { defeatedKingSquare: null, endGameEmojis: [] }

    const loser = winner === 'w' ? 'b' : 'w'
    const loserSquare = engine.getKingSquare(loser)
    const winnerSquare = engine.getKingSquare(winner)

    return {
      defeatedKingSquare: loserSquare,
      endGameEmojis: [
        ...(loserSquare ? [{ square: loserSquare, url: `${BASE}emojis/end game/chekmate.png` }] : []),
        ...(winnerSquare ? [{ square: winnerSquare, url: `${BASE}emojis/end game/win.png` }] : []),
      ],
    }
  }, [isGameOver, winner, fen, engine])

  const turnNumber = halfMoveCount + 1
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
    if (isGameOver) return winner ? `Победа ${winner === 'w' ? 'белых' : 'чёрных'}!` : 'Ничья!'
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
    <GameLayout user={user}>
              <div className="game-layout-container">
                <div className="game-main-column" onClick={() => { if (activeSpell) clearSpellSelection() }}>
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
                      <span className="text-[var(--accent-brand)] truncate">Spell Chess</span>
                      <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                        Ход {turnNumber}
                      </span>
                    </div>

                    <div className="flex flex-col items-center gap-1 text-center">
                      {isGameOver ? (
                        <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--accent-brand)] animate-pulse">
                          {getStatusMessage()}
                        </span>
                      ) : activeSpell ? (
                        <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--accent-brand)] animate-pulse">
                          {getStatusMessage()}
                        </span>
                      ) : hasCastSpellThisTurn ? (
                        <span className="text-[9px] text-text-secondary opacity-60 uppercase tracking-widest">
                          Заклинание использовано
                        </span>
                      ) : null}
                    </div>

                    <div className="text-right">
                      {isGameOver ? (
                        <span className="text-[var(--font-size-sm)] font-bold text-text-secondary opacity-60 uppercase tracking-widest">
                          Игра окончена
                        </span>
                      ) : (
                        <span className={`text-[var(--font-size-sm)] font-bold uppercase tracking-widest ${
                          turn === 'w' ? 'text-[var(--accent-brand)] animate-pulse' : 'text-text opacity-60'
                        }`}>
                          Ход {turn === 'w' ? 'белых' : 'чёрных'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    ref={boardContainerRef}
                    className="board-container relative overflow-hidden"
                  >
                    <MagicVFX ref={vfxRef} boardWidth={stableWidth} />
                    {isGameOver && winner && (
                      <PixelConfetti
                        boardMode
                        lightSquareColor={getTheme().whiteSquare}
                        darkSquareColor={getTheme().blackSquare}
                      />
                    )}

            <SpellRulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} playerColor={turn} />

            {pendingPromotion && stableWidth > 0 && (
              <div className="absolute inset-0 z-[10001] flex items-center justify-center pointer-events-none">
                <div className="pointer-events-auto">
                  <PromotionPicker
                    to={pendingPromotion.to}
                    color={turn}
                    onSelect={(piece) => {
                      makeMove(pendingPromotion.from, pendingPromotion.to, piece)
                      setPendingPromotion(null)
                    }}
                    onCancel={() => setPendingPromotion(null)}
                  />
                </div>
              </div>
            )}
                    {stableWidth > 0 && (
                      <ChessBoard
                        position={fen}
                        game={engine}
                        checkSquare={null}
                        lastMove={lastMove}
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
                        defeatedKingSquare={defeatedKingSquare}
                        endGameEmojis={endGameEmojis}
                        gameOverGray={isGameOver && !!winner && winner !== turn}
                      />
                    )}

                    {berserkTarget && stableWidth && (() => {
                      const col = berserkTarget.charCodeAt(0) - 97
                      const rank = parseInt(berserkTarget[1])
                      const leftPct = col * 12.5
                      const isAtTop = rank === 8
                      const piece = engine.getPiece(berserkTarget)
                      const currentType = piece?.type
                      const types = (['q', 'r', 'b', 'n'] as const).filter(t => t !== currentType)
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
                {stableWidth > 0 && (
                  <div
                    className="mx-auto mt-4 flex justify-center"
                    style={{ width: stableWidth || '100%', maxWidth: '100%' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <SpellBar
                      playerColor={turn}
                      currentCharges={spellState.charges[turn] || {}}
                      turnNumber={turnNumber}
                      isMyTurn={true}
                      hasCastSpellThisTurn={hasCastSpellThisTurn}
                      activeSpell={activeSpell}
                      gameOver={isGameOver}
                      onSpellClick={(spell: SpellName) => castSpell(spell)}
                      onSpellHover={setHoveredSpell}
                    />
                  </div>
                )}

                  <div className="mt-[var(--space-16)] flex justify-center gap-[var(--space-12)]">
                    {isGameOver && (
                      <Button variant="primary" onClick={resetGame}>Новая игра</Button>
                    )}
                    <Button variant="outline" onClick={() => navigate('/offline')}>В лобби</Button>
                  </div>
                </div>

                <div className="game-side-column space-y-[var(--space-16)]">
                  <div className="h-[220px]">
                    <SpellInfoPanel spell={hoveredSpell || activeSpell} turnNumber={turnNumber} />
                  </div>


                  <Card padding="sm">
                    <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em] mb-4 text-center">Прогресс</h3>

                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-[11px] font-bold text-[var(--accent-brand)]">Ход</span>
                      <span className="text-[20px] font-bold text-text tracking-wider">{turnNumber}</span>
                    </div>

                    <button
                      onClick={() => setIsRulesOpen(true)}
                      className="text-[9px] font-bold text-text-secondary uppercase tracking-[0.2em] hover:text-[var(--accent-brand)] transition-colors mb-4"
                    >
                      Правила
                    </button>

                    <div className="relative h-1.5 bg-[rgba(255,255,255,0.06)] rounded-[2px] mb-4 mx-1">
                      <div
                        className="absolute h-full bg-[var(--accent-brand)] rounded-[2px] transition-all duration-300"
                        style={{ width: `${Math.min(100, (turnNumber / 40) * 100)}%` }}
                      />
                      {[1, 7, 13, 19, 25, 31].map(t => (
                        <div
                          key={t}
                          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2"
                          style={{
                            left: `${(t / 40) * 100}%`,
                            borderColor: 'var(--accent-brand)',
                            backgroundColor: turnNumber >= t ? 'var(--accent-brand)' : 'var(--bg)',
                            zIndex: 2
                          }}
                        />
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      {SPELL_ORDER.map(spell => {
                        const meta = SPELL_META[spell]
                        const unlockTurn = SPELL_UNLOCK[spell]
                        const isUnlocked = turnNumber >= unlockTurn
                        const charge = spellState.charges[turn][spell] || 0
                        const maxCharge = turn === 'w' ? (WHITE_CHARGES[spell] || 0) : (BLACK_CHARGES[spell] || 0)
                        return (
                          <div key={spell} className="flex items-center gap-2 px-1">
                            <img
                              src={spellIconFile(spell)}
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
    </GameLayout>
  )
}
