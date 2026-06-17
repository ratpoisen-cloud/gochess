import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { type Move } from '@/lib/engine'
import { type SpellName, type SpellState, defaultCharges } from '@/lib/spellChessEngine'
import { db } from '@/lib/firebase'
import { doc, updateDoc, runTransaction } from 'firebase/firestore'
import LoadingScreen from '@/components/LoadingScreen'
import { useAuth } from '@/hooks/useAuth'
import { useBoardWidth } from '@/hooks/useBoardWidth'
import { useGameSync } from '@/hooks/useGameSync'
import { useReactionStore, type Reaction } from '@/stores/reactionStore'
import { useBoardStore } from '@/stores/boardStore'
import ChessBoard from '@/components/board/ChessBoard'
import ChessTimer from '@/components/board/ChessTimer'
import Button from '@/components/Button'
import ReactionPicker from '@/components/ReactionPicker'
import RequestModal from '@/components/RequestModal'
import Card from '@/components/Card'
import AuthModal from '@/components/AuthModal'
import PixelConfetti from '@/components/PixelConfetti'
import FogRulesModal from '@/components/FogRulesModal'
import { useToast } from '@/components/Toast'
import GameLayout from '@/components/GameLayout'
import { usePgnCopy } from '@/hooks/usePgnCopy'
import { MagicVFX, type MagicVFXHandle } from '@/components/MagicVFX'
import { SpellBar } from '@/components/board/SpellBar'
import { SpellInfoPanel } from '@/components/board/SpellInfoPanel'

export default function GamePage() {
  const { user, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { getTheme, getPieceUrl } = useBoardStore()
  const { roomCode } = useParams<{ roomCode: string }>()

  const sync = useGameSync(roomCode, user, authLoading)

  // UI-only state
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoves, setLegalMoves] = useState<string[]>([])
  const [isRulesOpen, setIsRulesOpen] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [reactionSquare, setReactionSquare] = useState<string | null>(null)
  const [reactionPos, setReactionPos] = useState<{ x: number; y: number } | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [showResignConfirm, setShowResignConfirm] = useState(false)
  const [copied, setCopied] = useState(false)

  // Spell state
  const [activeSpell, setActiveSpell] = useState<SpellName | null>(null)
  const [hoveredSpell, setHoveredSpell] = useState<SpellName | null>(null)
  const [portalStart, setPortalStart] = useState<string | null>(null)
  const [mirageStart, setMirageStart] = useState<string | null>(null)
  const [hoveredSquare, setHoveredSquare] = useState<string | null>(null)
  const [pendingTarget, setPendingTarget] = useState<string | null>(null)
  const [berserkTarget, setBerserkTarget] = useState<string | null>(null)
  const vfxRef = useRef<MagicVFXHandle>(null)
  const prevBombsRef = useRef<string[]>([])

  const { pgnCopied, copyPgn } = usePgnCopy(() => sync.game.pgn())

  const {
    game,
    status,
    moveHistory,
    lastMove,
    checkSquare,
    isMyTurn,
    playerColor,
    opponentName,
    opponentJoined,
    gameMode,
    visibleSquares,
    loading,
    error,
    gameOver,
    resultText,
    winnerColor,
    endGameState,
    gameDocId,
    whiteTimeLeft,
    blackTimeLeft,
    timerStatus,
    timeControl,
    undoRequest,
    drawRequest,
    rematchGameId,
    isRematchProposed,
    makeMove,
    handleResign,
    handleRematch,
    handleAcceptUndo,
    handleRejectUndo,
    handleAcceptDraw,
    castSpell,
    spellStateJson,
    hasCastSpellThisTurn,
  } = sync

  const { addToast } = useToast()
  const boardContainerRef = useRef<HTMLDivElement>(null)
  const { stableWidth } = useBoardWidth(boardContainerRef, !loading)

  const checkPromotion = (from: string, to: string): boolean => {
    const piece = game.get(from as any)
    if (piece?.type !== 'p') return false
    if (piece.color === 'w' && to[1] === '8') return true
    if (piece.color === 'b' && to[1] === '1') return true
    return false
  }

  const onDrop = useCallback((from: string, to: string) => {
    if (!isMyTurn || gameOver) return false
    if (checkPromotion(from, to)) {
      if (legalMoves.includes(to)) {
        setPendingPromotion({ from, to })
        return true
      }
    }
    makeMove(from, to)
    return true
  }, [makeMove, isMyTurn, gameOver, legalMoves])

  const isSpellMode = gameMode === 'spell_chess'

  const getSquareCenter = (square: string) => {
    if (!stableWidth) return { x: 0, y: 0 }
    const squareSize = stableWidth / 8
    const col = square.charCodeAt(0) - 97
    const row = 8 - parseInt(square[1])
    return {
      x: col * squareSize + squareSize / 2,
      y: row * squareSize + squareSize / 2,
    }
  }

  const handleCastSpell = (spell: SpellName, target?: string, target2?: string) => {
    if (target) {
      const center = getSquareCenter(target)
      switch (spell) {
        case 'freeze': vfxRef.current?.trigger({ ...center, type: 'ice-shatter' }); break
        case 'jump': vfxRef.current?.trigger({ ...center, type: 'jump' }); break
        case 'shield': vfxRef.current?.trigger({ ...center, type: 'shield' }); break
        case 'berserk': vfxRef.current?.trigger({ ...center, type: 'sparkle' }); break
        case 'divineGrace': vfxRef.current?.trigger({ ...center, type: 'sparkle' }); break
        case 'blast': vfxRef.current?.trigger({ ...center, type: 'blast' }); break
        case 'portal':
          if (target2) {
            vfxRef.current?.trigger({ ...getSquareCenter(target), type: 'portal' })
            vfxRef.current?.trigger({ ...getSquareCenter(target2), type: 'portal' })
          }
          break
        case 'mirage':
          if (target2) {
            vfxRef.current?.trigger({ ...getSquareCenter(target), type: 'portal' })
            vfxRef.current?.trigger({ ...getSquareCenter(target2), type: 'portal' })
          }
          break
        case 'shadowGrave':
          vfxRef.current?.trigger({ ...center, type: 'portal' })
          setTimeout(() => vfxRef.current?.trigger({ ...center, type: 'blast' }), 300)
          break
      }
    }
    castSpell?.(spell, target, target2)
  }

  const onSquareClick = useCallback((square: string) => {
    if (gameOver || !isMyTurn) return

    if (activeSpell && castSpell) {
      const noConfirmSpells: SpellName[] = ['portal', 'berserk', 'divineGrace', 'shadowGrave', 'mirage']
      if (noConfirmSpells.includes(activeSpell)) {
        if (activeSpell === 'portal') {
          if (!portalStart) { setPortalStart(square); return }
          handleCastSpell('portal', portalStart, square)
          setActiveSpell(null)
          setPortalStart(null)
          return
        }
        if (activeSpell === 'mirage') {
          if (!mirageStart) {
            const piece = game.get(square as any)
            if (piece && piece.color === playerColor && piece.type !== 'k') { setMirageStart(square) }
            return
          }
          handleCastSpell('mirage', mirageStart, square)
          setActiveSpell(null)
          setMirageStart(null)
          return
        }
        if (activeSpell === 'shadowGrave') {
          handleCastSpell('shadowGrave', square)
          setActiveSpell(null)
          return
        }
        if (activeSpell === 'divineGrace') {
          handleCastSpell('divineGrace', square)
          setActiveSpell(null)
          return
        }
        if (activeSpell === 'berserk') {
          const piece = game.get(square as any)
          if (piece && piece.color === playerColor && piece.type !== 'k') {
            setBerserkTarget(square)
            setActiveSpell(null)
          }
          return
        }
        if (activeSpell === 'blast') {
          handleCastSpell('blast', square)
          setActiveSpell(null)
          return
        }
      }
      if (pendingTarget === square) {
        handleCastSpell(activeSpell, square)
        setActiveSpell(null)
        setPendingTarget(null)
      } else {
        setPendingTarget(square)
      }
      return
    }

    const g = game
    const piece = g.get(square as any)

    if (selectedSquare) {
      const isLegal = legalMoves.includes(square)
      if (isLegal) {
        if (checkPromotion(selectedSquare, square)) {
          setPendingPromotion({ from: selectedSquare, to: square })
          return
        }
        makeMove(selectedSquare, square)
        return
      }
      if (piece && piece.color === playerColor) {
        const moves = g.moves({ square: square as any, verbose: true }) as Move[]
        setSelectedSquare(square)
        setLegalMoves(moves.map((m) => m.to))
        return
      }
      setSelectedSquare(null)
      setLegalMoves([])
      return
    }

    if (piece && piece.color === playerColor) {
      const moves = g.moves({ square: square as any, verbose: true }) as Move[]
      setSelectedSquare(square)
      setLegalMoves(moves.map((m) => m.to))
    }
  }, [gameOver, isMyTurn, selectedSquare, legalMoves, playerColor, makeMove, game, activeSpell, castSpell, portalStart, mirageStart, pendingTarget])

  const handleReactionSquare = (square: string, clientX: number, clientY: number) => {
    setReactionSquare(square)
    setReactionPos({ x: clientX, y: clientY })
    setShowReactionPicker(true)
  }

  const handleEmojiSelect = async (emojiUrl: string) => {
    if (!gameDocId || !user || !reactionSquare || !playerColor) return

    const reaction: Reaction = {
      id: Math.random().toString(36).slice(2, 10),
      square: reactionSquare,
      emojiUrl,
      playerId: user.uid,
      createdAt: Date.now(),
    }

    const result = useReactionStore.getState().addReaction(reaction, playerColor)
    if (result === 'limit_reached') {
      addToast('Не более 5 реакций за ход', 'warning')
      return
    }
    if (result !== 'ok') return
    setShowReactionPicker(false)
    setReactionSquare(null)

    try {
      await runTransaction(db, async (transaction) => {
        const gameRef = doc(db, 'games', gameDocId)
        const freshDoc = await transaction.get(gameRef)
        const reactions = freshDoc.data()?.reactions || []
        transaction.update(gameRef, {
          reactions: [...reactions, reaction].slice(-20),
        })
      })
    } catch {
      addToast('Ошибка отправки реакции', 'error')
    }
  }

  useEffect(() => {
    if (rematchGameId) {
      addToast('Реванш создан! Переход...', 'success')
      const timer = setTimeout(() => navigate(`/game/${rematchGameId}`), 1500)
      return () => clearTimeout(timer)
    }
  }, [rematchGameId, navigate, addToast])

  const parsedSpellState = useMemo((): SpellState | null => {
    if (!isSpellMode || !spellStateJson) return null
    try { return JSON.parse(spellStateJson) as SpellState } catch { return null }
  }, [isSpellMode, spellStateJson])

  useEffect(() => {
    if (!isSpellMode || !parsedSpellState || !stableWidth) return
    const bombs: string[] = Object.keys(parsedSpellState.bombs || {})
    const prevArray = prevBombsRef.current
    if (bombs.length < prevArray.length) {
      const lost = prevArray.filter((b) => !bombs.includes(b))
      lost.forEach((sq) => {
        const center = getSquareCenter(sq)
        vfxRef.current?.trigger({ ...center, type: 'blast' })
      })
    }
    prevBombsRef.current = bombs
  }, [parsedSpellState, isSpellMode, stableWidth])

  const activeCharges = useMemo(() => {
    if (!isSpellMode || !parsedSpellState) return null
    return parsedSpellState.charges[playerColor === 'w' ? 'w' : 'b'] || {}
  }, [isSpellMode, parsedSpellState, playerColor])

  const activeBombs = useMemo(() => {
    if (!isSpellMode || !parsedSpellState) return []
    return Object.keys(parsedSpellState.bombs || {})
  }, [isSpellMode, parsedSpellState])

  const turnNumber = Math.floor(moveHistory.length / 2) + 1

  const handleBerserkConfirm = (type: string) => {
    if (!berserkTarget || !castSpell) return
    handleCastSpell('berserk', berserkTarget, type)
    setBerserkTarget(null)
  }

  const spellCustomSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {}

    if (isSpellMode && activeSpell === 'freeze' && hoveredSquare) {
      const col = hoveredSquare.charCodeAt(0) - 97
      const row = parseInt(hoveredSquare[1])
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          const c = col + dc
          const r = row + dr
          if (c >= 0 && c < 8 && r >= 1 && r <= 8) {
            const sq = String.fromCharCode(97 + c) + r
            styles[sq] = { background: 'rgba(100, 200, 255, 0.2)', outline: '1px solid rgba(100, 200, 255, 0.4)' }
          }
        }
      }
    }

    if (isSpellMode && activeSpell === 'blast' && hoveredSquare) {
      const col = hoveredSquare.charCodeAt(0) - 97
      const row = parseInt(hoveredSquare[1])
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          const c = col + dc
          const r = row + dr
          if (c >= 0 && c < 8 && r >= 1 && r <= 8) {
            styles[String.fromCharCode(97 + c) + r] = { background: 'rgba(255, 100, 50, 0.2)', outline: '1px solid rgba(255, 100, 50, 0.4)' }
          }
        }
      }
    }

    if (isSpellMode && activeSpell === 'shield' && hoveredSquare) {
      styles[hoveredSquare] = { background: 'rgba(50, 255, 100, 0.15)', outline: '2px solid rgba(50, 255, 100, 0.5)' }
    }

    if (isSpellMode && activeSpell === 'portal' && portalStart) {
      styles[portalStart] = { background: 'rgba(150, 50, 255, 0.25)', outline: '2px solid rgba(150, 50, 255, 0.5)' }
    }

    if (isSpellMode && activeSpell === 'mirage' && mirageStart) {
      styles[mirageStart] = { background: 'rgba(255, 200, 0, 0.25)', outline: '2px solid rgba(255, 200, 0, 0.5)' }
    }

    if (isSpellMode && berserkTarget) {
      styles[berserkTarget] = { background: 'rgba(255, 0, 0, 0.25)', outline: '2px solid rgba(255, 0, 0, 0.6)' }
    }

    if (parsedSpellState) {
      const halfMoveCount = moveHistory.length
      Object.keys(parsedSpellState.frozenSquares).forEach(sq => {
        if (parsedSpellState.frozenSquares[sq] > halfMoveCount) {
          styles[sq] = {
            background: 'rgba(100, 200, 255, 0.35)',
            boxShadow: 'inset 0 0 15px rgba(255, 255, 255, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }
        }
      })
      Object.keys(parsedSpellState.shieldedSquares).forEach(sq => {
        if (parsedSpellState.shieldedSquares[sq] > halfMoveCount) {
          styles[sq] = {
            ...styles[sq],
            boxShadow: '0 0 20px rgba(255, 255, 100, 0.4), inset 0 0 10px rgba(255, 255, 100, 0.6)'
          }
        }
      })
      if (parsedSpellState.portals && parsedSpellState.portals.expiry > halfMoveCount) {
        styles[parsedSpellState.portals.from] = {
          ...styles[parsedSpellState.portals.from],
          background: 'radial-gradient(circle, rgba(160, 32, 240, 0.6) 0%, transparent 70%)',
          boxShadow: '0 0 15px rgba(160, 32, 240, 0.8)'
        }
        styles[parsedSpellState.portals.to] = {
          ...styles[parsedSpellState.portals.to],
          background: 'radial-gradient(circle, rgba(160, 32, 240, 0.6) 0%, transparent 70%)',
          boxShadow: '0 0 15px rgba(160, 32, 240, 0.8)'
        }
      }
      if (parsedSpellState.jumpSquare) {
        styles[parsedSpellState.jumpSquare] = {
          ...styles[parsedSpellState.jumpSquare],
          boxShadow: '0 0 15px var(--accent-brand), inset 0 0 10px var(--accent-brand)'
        }
      }
      Object.keys(parsedSpellState.impassableSquares).forEach(sq => {
        if (parsedSpellState.impassableSquares[sq] > halfMoveCount) {
          styles[sq] = {
            ...styles[sq],
            background: 'rgba(40, 40, 40, 0.6)',
            boxShadow: 'inset 0 0 15px rgba(0, 0, 0, 0.5)',
          }
        }
      })
    }

    return styles
  }, [isSpellMode, activeSpell, hoveredSquare, portalStart, mirageStart, berserkTarget, parsedSpellState, moveHistory.length])

  if (authLoading && !user) return <LoadingScreen isLoading={true} />
  if (error) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-bg p-6 text-center">
        <h2 className="text-xl font-bold text-text mb-4">{error}</h2>
        <Button onClick={() => navigate("/")}>Вернуться в лобби</Button>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-bg p-6 text-center">
        <h2 className="text-xl font-bold text-text mb-4">Требуется вход</h2>
        <Button onClick={() => setIsAuthModalOpen(true)}>Войти</Button>
        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      </div>
    )
  }

  if (loading) return <LoadingScreen isLoading={true} />

  return (
    <GameLayout user={user}>
      <div className="game-layout-container">
        <div className="game-main-column">
          {timeControl && (
            <div className="mx-auto mb-4" style={{ width: stableWidth || '100%', maxWidth: '100%' }}>
              <ChessTimer
                timeLeft={playerColor === 'w' ? (blackTimeLeft || 0) : (whiteTimeLeft || 0)}
                isActive={!isMyTurn && !gameOver && timerStatus === 'active'}
                label={opponentJoined ? opponentName : 'Соперник'}
                increment={timeControl.increment}
              />
            </div>
          )}

          {isSpellMode && stableWidth > 0 && (
            <div className="mx-auto mb-4 flex justify-center" style={{ width: stableWidth || '100%', maxWidth: '100%' }}>
              <SpellBar
                playerColor={playerColor === 'w' ? 'b' : 'w'}
                currentCharges={parsedSpellState?.charges[playerColor === 'w' ? 'b' : 'w'] ?? defaultCharges(playerColor === 'w' ? 'b' : 'w')}
                turnNumber={turnNumber}
                isMyTurn={false}
                hasCastSpellThisTurn={false}
                activeSpell={null}
                gameOver={gameOver}
                onSpellClick={() => {}}
                onSpellHover={setHoveredSpell}
              />
            </div>
          )}

          <div
            className="mx-auto mb-[var(--space-12)] grid grid-cols-3 items-center px-[var(--space-8)]"
            style={{ width: stableWidth || '100%', maxWidth: '100%' }}
          >
            <div className="flex items-center gap-[var(--space-8)] text-[var(--font-size-sm)] font-bold">
              <span className="text-[var(--accent-brand)] truncate">
                {opponentJoined ? (opponentName || 'Соперник') : 'Ожидание...'}
              </span>
              {opponentJoined && <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />}
              {gameMode === 'fog_of_war' && (
                <span className="text-[12px]">☁️</span>
              )}
            </div>

            <div className="text-center flex flex-col items-center justify-center gap-1">
              {gameMode === 'fog_of_war' && !gameOver && (
                <button
                  onClick={() => setIsRulesOpen(true)}
                  className="text-[9px] font-bold text-text-secondary uppercase tracking-[0.2em] hover:text-[var(--accent-brand)] transition-colors"
                >
                  Правила
                </button>
              )}

              {isSpellMode && !gameOver && (
                <div className="flex flex-col items-center gap-1">
                  {activeSpell && (
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--accent-brand)] animate-pulse">
                      Целься заклинанием...
                    </span>
                  )}
                  {hasCastSpellThisTurn && (
                    <span className="text-[9px] text-text-secondary opacity-60 uppercase tracking-widest">
                      Заклинание использовано
                    </span>
                  )}
                </div>
              )}

              {(status === 'check' || status === 'checkmate' || status === 'stalemate' || status === 'draw') && (
                <h2 className={`text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse ${
                  status === 'check' || status === 'checkmate' ? 'text-[var(--danger)]' : 'text-text-secondary'
                }`}>
                  {gameMode === 'fog_of_war'
                    ? (status === 'draw' || status === 'stalemate' ? 'Ничья' : '')
                    : (status === 'check' ? 'Шах!' : status === 'checkmate' ? 'Мат!' : 'Ничья')
                  }
                </h2>
              )}
            </div>

            <div className="text-right">
              <span className={`text-[var(--font-size-sm)] font-bold uppercase tracking-widest ${
                isMyTurn && !gameOver ? 'text-[var(--accent-brand)] animate-pulse' : 'text-text-secondary opacity-60'
              }`}>
                {gameOver ? 'Игра окончена' : isMyTurn ? 'Ваш ход' : 'Ход соперника'}
              </span>
            </div>
          </div>

          <div ref={boardContainerRef} className="board-container relative">
            {gameOver && !resultText.includes('Ничья') && !resultText.includes('договоренности') && stableWidth > 0 && playerColor === winnerColor && (
              <PixelConfetti boardMode lightSquareColor={getTheme().whiteSquare} darkSquareColor={getTheme().blackSquare} />
            )}
            {isSpellMode && stableWidth > 0 && (
              <MagicVFX ref={vfxRef} boardWidth={stableWidth} />
            )}
            {stableWidth > 0 ? (
              <>
                <ChessBoard
                  game={game}
                  lastMove={lastMove}
                  checkSquare={checkSquare}
                  selectedSquare={selectedSquare}
                  legalMoves={legalMoves}
                  onDrop={onDrop}
                  onSquareClick={onSquareClick}
                  onReactionSquare={handleReactionSquare}
                  boardWidth={stableWidth}
                  boardOrientation={playerColor === 'b' ? 'black' : 'white'}
                  defeatedKingSquare={endGameState?.defeated}
                  endGameEmojis={endGameState?.emojis}
                  visibleSquares={visibleSquares}
                  gameOverGray={gameOver && !resultText.includes('Ничья') && !resultText.includes('договоренности') && playerColor !== winnerColor}
                  arePiecesDraggable={!gameOver}
                  customSquareStyles={spellCustomSquareStyles}
                  bombs={activeBombs}
                  onSquareMouseEnter={isSpellMode && activeSpell ? (sq: string) => setHoveredSquare(sq) : undefined}
                  onSquareMouseLeave={isSpellMode && activeSpell ? () => setHoveredSquare(null) : undefined}
                />

                {pendingPromotion && (
                  <div className="absolute inset-0 z-[100] bg-black/20 flex items-center justify-center">
                    <div className="bg-[var(--surface-elevated)] max-sm:p-2 max-sm:gap-2 sm:p-4 sm:gap-4 rounded-[var(--radius-14)] shadow-2xl flex">
                      {(['q', 'r', 'b', 'n'] as const).map((piece) => (
                        <button
                          key={piece}
                          onClick={() => {
                            makeMove(pendingPromotion.from, pendingPromotion.to, piece)
                            setPendingPromotion(null)
                          }}
                          className="max-sm:w-12 max-sm:h-12 sm:w-16 sm:h-16 hover:bg-white/10 rounded-lg transition-colors p-1"
                        >
                          <img
                            src={getPieceUrl(`${playerColor}${piece.toUpperCase()}`)}
                            alt={piece}
                            className="w-full h-full object-contain"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full aspect-square flex items-center justify-center bg-[var(--surface-elevated)] rounded-xl animate-pulse">
                <div className="text-[var(--font-size-xs)] text-text-secondary opacity-50 text-center p-4">
                  Загрузка шахматной доски...
                </div>
              </div>
            )}

            {isSpellMode && berserkTarget && stableWidth && (() => {
              const col = berserkTarget.charCodeAt(0) - 97
              const rank = parseInt(berserkTarget[1])
              const leftPct = col * 12.5
              const isAtTop = rank === 8
              const piece = game.get(berserkTarget as any)
              const currentType = piece?.type
              const types = (['q', 'r', 'b', 'n'] as const).filter(t => t !== currentType)
              return (
                <div
                  className="absolute inset-0 z-[110] cursor-default bg-black/10"
                  onClick={() => setBerserkTarget(null)}
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
                    {types.map((t) => (
                      <button
                        key={t}
                        onClick={() => handleBerserkConfirm(t)}
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
                          src={getPieceUrl(`${playerColor}${t.toUpperCase()}`)}
                          alt={t}
                          className="w-[85%] h-[85%] object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
                          draggable={false}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>

          {isSpellMode && stableWidth > 0 && (
            <div className="mx-auto mt-4 flex justify-center" style={{ width: stableWidth || '100%', maxWidth: '100%' }}>
              <SpellBar
                playerColor={playerColor || 'w'}
                currentCharges={activeCharges ?? defaultCharges(playerColor === 'w' ? 'w' : 'b')}
                turnNumber={turnNumber}
                isMyTurn={isMyTurn}
                hasCastSpellThisTurn={hasCastSpellThisTurn}
                activeSpell={activeSpell}
                gameOver={gameOver}
                onSpellClick={(spell) => {
                  if (activeSpell === spell) {
                    setActiveSpell(null)
                    return
                  }
                  if (spell === 'berserk') {
                    setActiveSpell('berserk')
                    addToast('Выберите свою фигуру для берсерка', 'info')
                  } else {
                    setActiveSpell(spell)
                    addToast(`Выберите цель для магии`, 'info')
                  }
                }}
                onSpellHover={setHoveredSpell}
              />
            </div>
          )}

          {timeControl && (
            <div className="mx-auto mt-4" style={{ width: stableWidth || '100%', maxWidth: '100%' }}>
              <ChessTimer
                timeLeft={playerColor === 'w' ? (whiteTimeLeft || 0) : (blackTimeLeft || 0)}
                isActive={isMyTurn && !gameOver && timerStatus === 'active'}
                label="Ваше время"
                increment={timeControl.increment}
              />
            </div>
          )}

          {gameOver && resultText && (
            <div
              className="mx-auto mt-4 py-[var(--space-12)] px-[var(--space-16)] bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[var(--radius-14)] text-center animate-modal-pixel-in shadow-xl"
              style={{ width: stableWidth || '100%', maxWidth: '100%' }}
            >
              <p className="text-[var(--font-size-sm)] font-bold text-[var(--accent-brand)] uppercase tracking-[0.2em]">
                {resultText}
              </p>
            </div>
          )}
        </div>

        <div className="game-side-column space-y-[var(--space-20)]">
          {isSpellMode && (
            <div className="h-[220px]">
              <SpellInfoPanel 
                spell={hoveredSpell || activeSpell} 
                turnNumber={turnNumber} 
              />
            </div>
          )}

          {!opponentJoined && (
            <Card padding="sm" className="border-[var(--accent-brand)] shadow-[0_0_20px_rgba(126,184,126,0.1)]">
              <div className="flex items-center justify-between mb-[var(--space-12)]">
                <h3 className="text-[var(--font-size-sm)] font-bold text-[var(--accent-brand)] uppercase tracking-widest">Пригласить друга</h3>
                <span className="w-2 h-2 rounded-full bg-[var(--accent-brand)] animate-pulse" />
              </div>
              <div className="space-y-[var(--space-12)]">
                <div className="flex items-center gap-[var(--space-8)] p-[var(--space-8)] rounded-[var(--radius-8)] bg-[rgba(0,0,0,0.2)] border border-[var(--border)]">
                  <input
                    type="text"
                    readOnly
                    value={window.location.href}
                    className="flex-1 min-w-0 bg-transparent text-[10px] text-text-secondary outline-none truncate select-all font-mono"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href)
                      setCopied(true)
                      addToast('Ссылка скопирована', 'success')
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    className="shrink-0 px-2 py-1 rounded-[var(--radius-4)] text-[9px] font-bold uppercase tracking-wider transition-all"
                    style={{
                      background: copied ? 'var(--success)' : 'var(--accent-brand)',
                      color: 'black',
                    }}
                  >
                    {copied ? 'OK' : 'Копия'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent('Сыграем в шахматы?')}`, '_blank')}
                    className="flex-1 py-2 rounded-[var(--radius-8)] bg-[rgba(255,255,255,0.03)] border border-[var(--border)] text-[9px] font-bold uppercase tracking-widest text-text-secondary hover:text-[var(--accent-brand)] hover:border-[var(--accent-brand)] transition-all"
                  >
                    Telegram
                  </button>
                  <button
                    onClick={() => window.open(`https://vk.com/share.php?url=${encodeURIComponent(window.location.href)}`, '_blank')}
                    className="flex-1 py-2 rounded-[var(--radius-8)] bg-[rgba(255,255,255,0.03)] border border-[var(--border)] text-[9px] font-bold uppercase tracking-widest text-text-secondary hover:text-[var(--accent-brand)] hover:border-[var(--accent-brand)] transition-all"
                  >
                    ВКонтакте
                  </button>
                </div>
              </div>
            </Card>
          )}

          {!isSpellMode && (
            <Card padding="sm">
              <div className="flex items-center justify-between mb-[var(--space-12)]">
                <div className="flex items-center gap-2">
                  <h3 className="text-[var(--font-size-sm)] font-semibold text-text">Ходы</h3>
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
                <span className="text-[10px] text-text-secondary uppercase tracking-widest opacity-60">
                  {moveHistory.length} полуходов
                </span>
              </div>
              <div className="max-h-[200px] max-sm:max-h-[25dvh] overflow-y-auto custom-scrollbar pr-2">
                <div className="flex flex-wrap gap-2">
                  {moveHistory.length === 0 ? (
                    <p className="text-[10px] text-text-secondary opacity-40 italic w-full text-center py-4">
                      Ожидание первого хода...
                    </p>
                  ) : (
                    moveHistory.map((move, i) => (
                      <span key={i} className="text-[11px] font-mono">
                        {i % 2 === 0 && <span className="text-text-secondary mr-1">{Math.floor(i / 2) + 1}.</span>}
                        <span className="text-text font-bold">{move}</span>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-[var(--space-12)]">
            {!gameOver ? (
              <>
                {!isSpellMode && (
                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    onClick={() => {
                      if (!gameDocId || !user || gameOver || moveHistory.length === 0) return
                      updateDoc(doc(db, 'games', gameDocId), {
                        undo_request: { from_id: user.uid, created_at: Date.now() },
                      }).catch(() => addToast('Ошибка при отправке запроса', 'error'))
                    }}
                    disabled={moveHistory.length === 0 || (!!(undoRequest && user && undoRequest.from_id === user.uid))}
                  >
                    Отмена
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    if (!gameDocId || !user || gameOver || !opponentJoined) return
                    updateDoc(doc(db, 'games', gameDocId), {
                      draw_request: { from_id: user.uid, created_at: Date.now() },
                    }).catch(() => addToast('Ошибка при предложении ничьей', 'error'))
                  }}
                  disabled={!opponentJoined}
                >
                  Ничья
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                size="sm"
                fullWidth
                onClick={handleRematch}
                className="col-span-2 border-[var(--accent-brand)] border"
                disabled={rematchGameId !== null}
              >
                {rematchGameId ? 'Переход...' : isRematchProposed ? 'Принять реванш' : 'Реванш'}
              </Button>
            )}
          </div>
          {!gameOver && (
            <Button
              variant="primary"
              size="sm"
              fullWidth
              className="hover:!bg-[var(--danger-soft)]"
              onClick={() => setShowResignConfirm(true)}
            >
              Сдаться
            </Button>
          )}
        </div>
      </div>

      {showReactionPicker && reactionPos && (
        <ReactionPicker
          anchorX={reactionPos.x}
          anchorY={reactionPos.y}
          onSelect={handleEmojiSelect}
          onClose={() => setShowReactionPicker(false)}
        />
      )}

      <RequestModal
        isOpen={!!(undoRequest && user && undoRequest.from_id !== user.uid)}
        title="Запрос отмены"
        description="Соперник просит отменить последний ход"
        onAccept={handleAcceptUndo}
        onReject={handleRejectUndo}
      />

      <RequestModal
        isOpen={!!(drawRequest && user && drawRequest.from_id !== user.uid)}
        title="Предложение ничьей"
        description="Соперник предлагает ничью"
        onAccept={handleAcceptDraw}
        onReject={() => gameDocId && updateDoc(doc(db, 'games', gameDocId), { draw_request: null })}
      />

      <ConfirmDialog
        isOpen={showResignConfirm}
        title="Сдаться?"
        onConfirm={handleResign}
        onCancel={() => setShowResignConfirm(false)}
      />

      <FogRulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />
    </GameLayout>
  )
}

function ConfirmDialog({ isOpen, title, onConfirm, onCancel }: any) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <Card className="max-w-[320px] w-full animate-modal-pixel-in">
        <h3 className="text-center font-bold mb-6">{title}</h3>
        <div className="flex flex-col gap-2">
          <Button variant="primary" fullWidth onClick={() => { onConfirm(); onCancel() }}>Да</Button>
          <Button variant="primary" fullWidth onClick={onCancel} className="bg-transparent opacity-60">Нет</Button>
        </div>
      </Card>
    </div>
  )
}
