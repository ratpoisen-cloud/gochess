import { Link, useNavigate, useLocation } from 'react-router-dom'
import ChessBoard from '@/components/board/ChessBoard'
import { useGameStore, getKingSquare } from '@/stores/gameStore'
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useBoardWidth } from '@/hooks/useBoardWidth'
import { useReactionStore, type Reaction } from '@/stores/reactionStore'
import type { Color } from '@/types'
import Card from '@/components/Card'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import SettingsDropdown from '@/components/SettingsDropdown'
import UserMenu from '@/components/UserMenu'
import ReactionPicker from '@/components/ReactionPicker'
import Footer from '@/components/Footer'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/hooks/useAuth'
import PixelConfetti from '@/components/PixelConfetti'
import ChessTimer from '@/components/board/ChessTimer'
import { useBoardStore } from '@/stores/boardStore'

const BASE = import.meta.env.BASE_URL || '/'

type BoardView = 'standard' | 'autoflip' | 'face-to-face'

export default function LocalPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { addToast } = useToast()
  const { getPieceUrl, getTheme } = useBoardStore()
  const { 
    game, status, currentTurn, selectedSquare, legalMoves, lastMove, 
    checkSquare, moveHistory, isGameOver, makeMove, selectSquare, 
    resetGame, saveGame, undoMove 
  } = useGameStore()
  
  const isRapid = location.pathname.includes('/rapid')
  const [initialized, setInitialized] = useState(false)
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(true)
  const [manualGameOver, setManualGameOver] = useState(false)
  const [resultText, setResultText] = useState('')
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null)
  const [endGameState, setEndGameState] = useState<{ defeated: string | null; emojis: { square: string; url: string }[] } | null>(null)
  const [pgnCopied, setPgnCopied] = useState(false)

  // Setup States
  const [whiteName, setWhiteName] = useState(user?.displayName || 'Игрок 1')
  const [blackName, setBlackName] = useState('Гость')
  const [boardView, setBoardView] = useState<BoardView>('standard')
  
  // Rapid States
  const [timeControl, setTimeControl] = useState({ base: 10, increment: 0 })
  const [whiteTime, setWhiteTime] = useState(600000)
  const [blackTime, setBlackTime] = useState(600000)
  const lastTurnRef = useRef(currentTurn)

  const isActuallyGameOver = isGameOver || manualGameOver
  const isVictory = isActuallyGameOver && !resultText.includes('Ничья') && !resultText.includes('договоренности')

  useEffect(() => {
    if (!initialized) {
      resetGame()
      setInitialized(true)
    }
  }, [])

  // Handle Timeout
  const handleTimeout = useCallback((loser: Color) => {
    if (isActuallyGameOver) return
    const winnerName = loser === 'w' ? blackName : whiteName
    setResultText(`Время вышло. Победа ${winnerName === whiteName ? 'белых' : 'чёрных'} (${winnerName})`)
    setManualGameOver(true)
  }, [isActuallyGameOver, blackName, whiteName])

  // Turn Change (Increment Logic)
  useEffect(() => {
    if (isRapid && !isSetupModalOpen && !isActuallyGameOver) {
      if (lastTurnRef.current !== currentTurn) {
        const playerWhoJustMoved = lastTurnRef.current
        if (playerWhoJustMoved === 'w') {
          setWhiteTime(prev => prev + (timeControl.increment * 1000))
        } else {
          setBlackTime(prev => prev + (timeControl.increment * 1000))
        }
        lastTurnRef.current = currentTurn
      }
    }
  }, [currentTurn, isRapid, isSetupModalOpen, isActuallyGameOver, timeControl.increment])

  const copyPgn = () => {
    try {
      navigator.clipboard.writeText(game.pgn())
      setPgnCopied(true)
      addToast('PGN скопирован', 'success')
      setTimeout(() => setPgnCopied(false), 2000)
    } catch {
      addToast('Ошибка копирования', 'error')
    }
  }

  const checkPromotion = (from: string, to: string): boolean => {
    const piece = game.get(from as any)
    if (piece?.type !== 'p') return false
    if (piece.color === 'w' && to[1] === '8') return true
    if (piece.color === 'b' && to[1] === '1') return true
    return false
  }

  const savedRef = useRef(false)
  useEffect(() => {
    if (isActuallyGameOver && !savedRef.current) {
      savedRef.current = true
      saveGame('local')
      
      if (isGameOver && !manualGameOver) {
        const whiteKingSquare = getKingSquare(game, 'w')
        const blackKingSquare = getKingSquare(game, 'b')

        if (status === 'checkmate') {
          const loserColor = currentTurn
          const winnerColor = currentTurn === 'w' ? 'b' : 'w'
          const kingSq = getKingSquare(game, loserColor as any)
          const winnerKingSq = getKingSquare(game, winnerColor as any)
          setEndGameState({
            defeated: kingSq,
            emojis: [
              ...(kingSq ? [{ square: kingSq, url: `${BASE}emojis/end game/chekmate.png` }] : []),
              ...(winnerKingSq ? [{ square: winnerKingSq, url: `${BASE}emojis/end game/win.png` }] : [])
            ]
          })

          setResultText(currentTurn === 'w' ? `Победа чёрных (${blackName})` : `Победа белых (${whiteName})`)
        } else if (status === 'stalemate' || status === 'draw') {
          setEndGameState({
            defeated: null,
            emojis: [
              ...(whiteKingSquare ? [{ square: whiteKingSquare, url: `${BASE}emojis/end game/draw.png` }] : []),
              ...(blackKingSquare ? [{ square: blackKingSquare, url: `${BASE}emojis/end game/draw.png` }] : [])
            ]
          })
          setResultText('Ничья')
        }
      }
    }
    if (!isActuallyGameOver) {
      savedRef.current = false
      setEndGameState(null)
    }
  }, [isActuallyGameOver, isGameOver, manualGameOver, status, currentTurn, whiteName, blackName, saveGame, game])

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (isActuallyGameOver) return false
    if (checkPromotion(sourceSquare, targetSquare)) {
      setPendingPromotion({ from: sourceSquare, to: targetSquare })
      return true
    }
    return makeMove(sourceSquare, targetSquare)
  }

  const onSquareClick = (square: string) => {
    if (isActuallyGameOver) return
    if (selectedSquare && checkPromotion(selectedSquare, square)) {
      if (legalMoves.includes(square)) {
        setPendingPromotion({ from: selectedSquare, to: square })
        return
      }
    }
    selectSquare(square)
  }

  const handleResign = () => {
    const winner = currentTurn === 'w' ? blackName : whiteName
    const loserColor = currentTurn
    const kingSq = getKingSquare(game, loserColor as any)
    const winnerColor = currentTurn === 'w' ? 'b' : 'w'
    const winnerKingSq = getKingSquare(game, winnerColor as any)
    
    setEndGameState({
      defeated: kingSq,
      emojis: [
        ...(kingSq ? [{ square: kingSq, url: `${BASE}emojis/end game/surrender.png` }] : []),
        ...(winnerKingSq ? [{ square: winnerKingSq, url: `${BASE}emojis/end game/win.png` }] : [])
      ]
    })
    setResultText(`Сдача. Победа ${winner}`)
    setManualGameOver(true)
  }

  const handleDraw = () => {
    const whiteKingSquare = getKingSquare(game, 'w')
    const blackKingSquare = getKingSquare(game, 'b')
    setEndGameState({
      defeated: null,
      emojis: [
        ...(whiteKingSquare ? [{ square: whiteKingSquare, url: `${BASE}emojis/end game/draw.png` }] : []),
        ...(blackKingSquare ? [{ square: blackKingSquare, url: `${BASE}emojis/end game/draw.png` }] : [])
      ]
    })
    setResultText('Ничья по соглашению')
    setManualGameOver(true)
  }

  const handleRematch = () => {
    resetGame()
    if (isRapid) {
      setWhiteTime(timeControl.base * 60000)
      setBlackTime(timeControl.base * 60000)
    }
    setManualGameOver(false)
    setResultText('')
    setEndGameState(null)
    savedRef.current = false
  }

  const handleStartGame = () => {
    resetGame()
    if (isRapid) {
      setWhiteTime(timeControl.base * 60000)
      setBlackTime(timeControl.base * 60000)
      lastTurnRef.current = 'w'
    }
    setManualGameOver(false)
    setResultText('')
    setIsSetupModalOpen(false)
  }

  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [reactionSquare, setReactionSquare] = useState<string | null>(null)
  const [reactionPos, setReactionPos] = useState<{ x: number; y: number } | null>(null)

  const boardContainerRef = useRef<HTMLDivElement>(null)
  const { stableWidth } = useBoardWidth(boardContainerRef, true)

  const handleReactionSquare = (square: string, clientX: number, clientY: number) => {
    if (isActuallyGameOver) return
    setReactionSquare(square)
    setReactionPos({ x: clientX, y: clientY })
    setShowReactionPicker(true)
  }

  const handleEmojiSelect = (emojiUrl: string) => {
    if (!reactionSquare) return
    const reaction: Reaction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      square: reactionSquare,
      emojiUrl,
      playerId: currentTurn,
      createdAt: Date.now(),
    }
    useReactionStore.getState().addReaction(reaction, currentTurn as Color)
    setShowReactionPicker(false)
    setReactionSquare(null)
  }

  const boardOrientation = boardView === 'autoflip' 
    ? (currentTurn === 'w' ? 'white' : 'black')
    : 'white'

  const statusClasses = {
    checkmate: 'text-[var(--danger)]',
    stalemate: 'text-text-secondary',
    draw: 'text-text-secondary',
    check: 'text-[var(--danger)]',
    playing: currentTurn === 'w' ? 'text-[var(--accent-brand)]' : 'text-text opacity-60',
  }

  const headerContent = useMemo(() => (
    <header className="px-[var(--space-24)] max-sm:px-[var(--space-8)] py-[var(--space-32)] max-sm:py-[var(--space-16)] bg-bg">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-[var(--space-12)]">
        <Link to="/">
          <img src={`${BASE}logo/gochess_wordmark_dark.svg`} alt="GoChess" className="h-[28px] w-auto" />
        </Link>
        <div className="flex items-center gap-[var(--space-12)]">
          <SettingsDropdown />
          {user && <UserMenu />}
        </div>
      </div>
    </header>
  ), [user])

  // MEMOIZED BOARD to prevent flickering
  const memoizedBoard = useMemo(() => (
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
      boardOrientation={boardOrientation}
      defeatedKingSquare={endGameState?.defeated}
      endGameEmojis={endGameState?.emojis}
      gameOverGray={isActuallyGameOver}
      arePiecesDraggable={!isActuallyGameOver}
    />
  ), [game, lastMove, checkSquare, selectedSquare, legalMoves, stableWidth, boardOrientation, endGameState, isActuallyGameOver])

  return (
    <div className="min-h-[100dvh] flex flex-col bg-bg">
      {boardView === 'face-to-face' && (
        <style>
          {` [data-square] img[alt^="b"] { rotate: 180deg; } `}
        </style>
      )}

      {headerContent}

      <main className="max-w-[1200px] mx-auto px-[var(--space-24)] max-sm:px-[var(--space-8)] py-[var(--space-48)] max-sm:py-[var(--space-24)] flex-1 w-full">
        <div className="game-layout-container">
          <div className="game-main-column">
            <div className="mx-auto mb-[var(--space-12)] grid grid-cols-3 items-center px-[var(--space-8)]" style={{ width: stableWidth || '100%' }}>
              <div className="flex items-center gap-[var(--space-8)] text-[var(--font-size-sm)] font-bold min-w-0">
                <img src={`${BASE}emojis/online/${isRapid ? 'rapid' : 'classic'}.png`} alt="mode" className="w-5 h-5 object-contain shrink-0" />
                <span className="text-[var(--accent-brand)] truncate">{whiteName} vs {blackName}</span>
              </div>
              <div className="text-center flex justify-center">
                {(status !== 'playing' || manualGameOver) && (
                  <h2 className={`text-[10px] font-bold ${statusClasses[status] || 'text-[var(--accent-brand)]'} uppercase tracking-[0.2em] animate-pulse whitespace-nowrap`}>
                    {manualGameOver ? 'Игра окончена' : status === 'check' ? 'Шах!' : status === 'checkmate' ? 'Мат!' : 'Ничья'}
                  </h2>
                )}
              </div>
              <div className="text-right">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${currentTurn === 'w' ? 'text-[var(--accent-brand)] animate-pulse' : 'text-text opacity-60'}`}>
                  {currentTurn === 'w' ? 'Ход белых' : 'Ход чёрных'}
                </span>
              </div>
            </div>

            <div className="mx-auto flex flex-col gap-2" style={{ width: stableWidth || '100%' }}>
              {isRapid && (
                <div className="mb-2">
                  <ChessTimer 
                    timeLeft={blackTime} 
                    isActive={currentTurn === 'b' && !isActuallyGameOver} 
                    label={blackName} 
                    increment={timeControl.increment}
                    onTimeout={() => handleTimeout('b')}
                  />
                </div>
              )}

              <div ref={boardContainerRef} className="board-container relative overflow-hidden">
                {isVictory && <PixelConfetti boardMode lightSquareColor={getTheme().whiteSquare} darkSquareColor={getTheme().blackSquare} />}
                {stableWidth > 0 && (
                  <>
                    {memoizedBoard}
                    {pendingPromotion && (
                      <div className="absolute inset-0 z-[100] bg-black/10" onClick={() => setPendingPromotion(null)}>
                         <div className="absolute flex flex-col bg-modal border border-white/10 rounded-xl overflow-hidden" style={{ left: '40%', top: '25%', width: '20%', height: '50%' }}>
                            {['q','r','b','n'].map(p => (
                              <button key={p} className="flex-1 hover:bg-[var(--accent-soft)] transition-colors" onClick={() => { makeMove(pendingPromotion.from, pendingPromotion.to, p); setPendingPromotion(null); }}>
                                <img src={getPieceUrl(`${currentTurn}${p.toUpperCase()}` as any)} className="w-8 h-8 mx-auto" />
                              </button>
                            ))}
                         </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {isRapid && (
                <div className="mt-2">
                  <ChessTimer 
                    timeLeft={whiteTime} 
                    isActive={currentTurn === 'w' && !isActuallyGameOver} 
                    label={whiteName} 
                    increment={timeControl.increment} 
                    onTimeout={() => handleTimeout('w')}
                  />
                </div>
              )}

              <div className="mt-4 flex justify-between gap-4">
                 {isActuallyGameOver ? (
                   <>
                     <Button fullWidth variant="primary" onClick={handleRematch}>Новая игра</Button>
                     <Button fullWidth variant="outline" onClick={() => navigate('/offline')}>В лобби</Button>
                   </>
                 ) : (
                   <>
                     <Button variant="outline" size="sm" onClick={undoMove}>Отмена</Button>
                     <div className="flex gap-2">
                       <Button variant="outline" size="sm" onClick={handleDraw}>Ничья</Button>
                       <Button variant="danger" size="sm" onClick={handleResign}>Сдаться</Button>
                     </div>
                   </>
                 )}
              </div>
            </div>
          </div>

          <div className="game-side-column">
             <Card padding="sm">
               <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
                 <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">История</h3>
                 <button onClick={copyPgn} className={`text-[9px] font-bold uppercase tracking-tighter ${pgnCopied ? 'text-[var(--accent-brand)]' : 'opacity-40 hover:opacity-100 transition-opacity'}`}>
                   {pgnCopied ? 'Готово' : 'PGN'}
                 </button>
               </div>
               <div className="max-h-[300px] overflow-y-auto text-[10px] font-mono leading-relaxed opacity-60 custom-scrollbar pr-2">
                 {moveHistory.length > 0 ? moveHistory.join(', ') : 'Нет ходов'}
               </div>
             </Card>
          </div>
        </div>
      </main>

      <Modal isOpen={isSetupModalOpen} onClose={() => {}} description={`Настройка (${isRapid ? 'Рапид' : 'Классика'})`}>
        <div className="space-y-6 pt-4 text-left">
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block px-1">Игроки</label>
            <input type="text" value={whiteName} onChange={e => setWhiteName(e.target.value)} className="w-full bg-[rgba(255,255,255,0.03)] border border-[var(--border)] rounded-[var(--radius-8)] p-3 text-[var(--font-size-sm)] focus:border-[var(--accent-brand)] outline-none transition-colors" placeholder="Белые" />
            <input type="text" value={blackName} onChange={e => setBlackName(e.target.value)} className="w-full bg-[rgba(255,255,255,0.03)] border border-[var(--border)] rounded-[var(--radius-8)] p-3 text-[var(--font-size-sm)] focus:border-[var(--accent-brand)] outline-none transition-colors" placeholder="Чёрные" />
          </div>

          {isRapid && (
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block px-1">Контроль времени</label>
              <div className="grid grid-cols-3 gap-2">
                {[{l:'5+0',b:5,i:0},{l:'10+0',b:10,i:0},{l:'10+5',b:10,i:5},{l:'15+10',b:15,i:10},{l:'30+0',b:30,i:0}].map(tc => (
                  <Button key={tc.l} variant="primary" size="sm" onClick={() => setTimeControl({base:tc.b, increment:tc.i})} className={`border-2 ${timeControl.base === tc.b && timeControl.increment === tc.i ? '!border-[var(--accent-brand)]' : 'border-transparent opacity-60'}`}>{tc.l}</Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block px-1">Вид доски</label>
            <div className="grid grid-cols-1 gap-2">
              <Button variant="primary" size="sm" onClick={() => setBoardView('standard')} className={`border-2 ${boardView === 'standard' ? '!border-[var(--accent-brand)]' : 'border-transparent opacity-60'}`}>Стандарт</Button>
              <Button variant="primary" size="sm" onClick={() => setBoardView('autoflip')} className={`border-2 ${boardView === 'autoflip' ? '!border-[var(--accent-brand)]' : 'border-transparent opacity-60'}`}>Авто-разворот</Button>
              <Button variant="primary" size="sm" onClick={() => setBoardView('face-to-face')} className={`border-2 ${boardView === 'face-to-face' ? '!border-[var(--accent-brand)]' : 'border-transparent opacity-60'}`}>Лицом к лицу</Button>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Button fullWidth onClick={handleStartGame}>Начать игру</Button>
            <Button fullWidth variant="outline" onClick={() => navigate('/offline')} className="hover:!bg-[var(--danger-soft)] transition-colors">Отмена</Button>
          </div>
        </div>
      </Modal>

      <Footer />

      {showReactionPicker && reactionPos && (
        <ReactionPicker
          onSelect={handleEmojiSelect}
          onClose={() => {
            setShowReactionPicker(false)
            setReactionSquare(null)
          }}
          boardWidth={stableWidth}
          anchorX={reactionPos.x}
          anchorY={reactionPos.y}
        />
      )}
    </div>
  )
}
