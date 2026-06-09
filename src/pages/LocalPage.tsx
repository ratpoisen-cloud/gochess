import { Link, useNavigate } from 'react-router-dom'
import ChessBoard from '@/components/board/ChessBoard'
import { useGameStore, getKingSquare } from '@/stores/gameStore'
import { useState, useEffect, useRef } from 'react'
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

import { useBoardStore } from '@/stores/boardStore'

const BASE = import.meta.env.BASE_URL || '/'

type BoardView = 'standard' | 'autoflip' | 'face-to-face'

export default function LocalPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { getPieceUrl, getTheme } = useBoardStore()
  const { 
    game, status, currentTurn, selectedSquare, legalMoves, lastMove, 
    checkSquare, moveHistory, isGameOver, makeMove, selectSquare, 
    resetGame, saveGame, undoMove 
  } = useGameStore()
  
  const [initialized, setInitialized] = useState(false)
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(true)
  const [manualGameOver, setManualGameOver] = useState(false)
  const [resultText, setResultText] = useState('')
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null)
  const [endGameState, setEndGameState] = useState<{ defeated: string | null; emojis: { square: string; url: string }[] } | null>(null)
  const [winnerKingPos, setWinnerKingPos] = useState<{ x: number; y: number } | null>(null)

  // Setup States
  const [whiteName, setWhiteName] = useState(user?.displayName || 'Игрок 1')
  const [blackName, setBlackName] = useState('Гость')
  const [boardView, setBoardView] = useState<BoardView>('standard')
  
  const savedRef = useRef(false)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [reactionSquare, setReactionSquare] = useState<string | null>(null)
  const [reactionPos, setReactionPos] = useState<{ x: number; y: number } | null>(null)

  const boardContainerRef = useRef<HTMLDivElement>(null)
  const { stableWidth } = useBoardWidth(boardContainerRef, true)

  useEffect(() => {
    if (!initialized) {
      resetGame()
      setInitialized(true)
    }
  }, [])

  const isActuallyGameOver = isGameOver || manualGameOver
  const isVictory = isActuallyGameOver && !resultText.includes('Ничья') && !resultText.includes('договоренности')

  const checkPromotion = (from: string, to: string): boolean => {
    const piece = game.get(from as any)
    if (piece?.type !== 'p') return false
    if (piece.color === 'w' && to[1] === '8') return true
    if (piece.color === 'b' && to[1] === '1') return true
    return false
  }

  useEffect(() => {
    if (isActuallyGameOver && !savedRef.current) {
      savedRef.current = true
      saveGame('local')
      
      // If it was an automatic game over, set the result text and end game state
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

          // Always explode from center in local mode
          if (stableWidth > 0) {
            setWinnerKingPos({
              x: stableWidth / 2,
              y: stableWidth / 2
            })
          }

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
  }, [isActuallyGameOver, isGameOver, manualGameOver, status, currentTurn, whiteName, blackName, saveGame, game, stableWidth])

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
    const winnerColor = currentTurn === 'w' ? 'b' : 'w'
    const kingSq = getKingSquare(game, loserColor as any)
    const winnerKingSq = getKingSquare(game, winnerColor as any)
    
    setEndGameState({
      defeated: kingSq,
      emojis: [
        ...(kingSq ? [{ square: kingSq, url: `${BASE}emojis/end game/surrender.png` }] : []),
        ...(winnerKingSq ? [{ square: winnerKingSq, url: `${BASE}emojis/end game/win.png` }] : [])
      ]
    })

    // Always explode from center in local mode
    if (stableWidth > 0) {
      setWinnerKingPos({
        x: stableWidth / 2,
        y: stableWidth / 2
      })
    }
    
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
    setManualGameOver(false)
    setResultText('')
    setEndGameState(null)
    setWinnerKingPos(null)
    savedRef.current = false
  }

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
    const result = useReactionStore.getState().addReaction(reaction, currentTurn as Color)
    if (result === 'limit_reached') {
      addToast('Не более 5 реакций за ход', 'warning')
      return
    }
    if (result !== 'ok') return
    setShowReactionPicker(false)
    setReactionSquare(null)
  }

  const handleStartGame = () => {
    resetGame()
    setManualGameOver(false)
    setResultText('')
    setIsSetupModalOpen(false)
  }

  const statusClasses = {
    checkmate: 'text-[var(--danger)]',
    stalemate: 'text-text-secondary',
    draw: 'text-text-secondary',
    check: 'text-[var(--danger)]',
    playing: currentTurn === 'w' ? 'text-[var(--accent-brand)]' : 'text-text opacity-60',
  }

  // Orientation logic for autoflip
  const boardOrientation = boardView === 'autoflip' 
    ? (currentTurn === 'w' ? 'white' : 'black')
    : 'white'

  return (
    <div className="min-h-[100dvh] flex flex-col bg-bg">
      {/* Inject face-to-face rotation styles if needed */}
      {boardView === 'face-to-face' && (
        <style>
          {`
            /* Only rotate actual black pieces on the board */
            [data-square] img[alt^="b"] {
              rotate: 180deg;
            }
          `}
        </style>
      )}

      <header className="px-[var(--space-24)] max-sm:px-[var(--space-8)] py-[var(--space-32)] max-sm:py-[var(--space-16)] bg-bg">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-[var(--space-12)]">
          <Link to="/">
            <img
              src={`${import.meta.env.BASE_URL || '/'}logo/gochess_wordmark_dark.svg`}
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
              {/* Left: Matchup Info */}
              <div className="flex items-center gap-[var(--space-8)] text-[var(--font-size-sm)] font-bold">
                <img 
                  src={`${import.meta.env.BASE_URL || '/'}emojis/local_new.png`} 
                  alt="local" 
                  className="w-5 h-5 object-contain opacity-90"
                />
                <span className="text-[var(--accent-brand)] truncate">
                  {whiteName} vs {blackName}
                </span>
              </div>

              {/* Center: Notifications */}
              <div className="text-center flex justify-center">
                {(status === 'check' || status === 'checkmate' || status === 'stalemate' || status === 'draw') && (
                  <h2 className={`text-[10px] font-bold ${statusClasses[status]} uppercase tracking-[0.2em] animate-pulse`}>
                    {status === 'check' ? 'Шах!' : status === 'checkmate' ? 'Мат!' : 'Ничья'}
                  </h2>
                )}
              </div>

              {/* Right: Turn Status */}
              <div className="text-right">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${
                  currentTurn === 'w' ? 'text-[var(--accent-brand)] animate-pulse' : 'text-text opacity-60'
                }`}>
                  Ход: {currentTurn === 'w' ? whiteName : blackName}
                </span>
              </div>
            </div>

            <div
              ref={boardContainerRef}
              className="board-container relative overflow-hidden"
            >
              {isVictory && <PixelConfetti origin={winnerKingPos} lightSquareColor={getTheme().whiteSquare} darkSquareColor={getTheme().blackSquare} />}
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
                    boardOrientation={boardOrientation}
                    defeatedKingSquare={endGameState?.defeated}
                    endGameEmojis={endGameState?.emojis}
                  />
                  
                  {/* Promotion Overlay */}
                  {pendingPromotion && (() => {
                    const square = pendingPromotion.to
                    const col = square[0].charCodeAt(0) - 97
                    const rank = parseInt(square[1])
                    
                    let leftIdx = col
                    let isAtTop = rank === 8
                    
                    if (boardOrientation === 'black') {
                      leftIdx = 7 - col
                      isAtTop = rank === 1
                    }

                    return (
                      <div
                        className="absolute inset-0 z-[100] cursor-default bg-black/10"
                        onClick={() => setPendingPromotion(null)}
                      >
                        <div 
                          className="absolute flex flex-col shadow-2xl shadow-black/80 overflow-hidden animate-modal-pixel-in"
                          style={{
                            left: `${leftIdx * 12.5}%`,
                            top: isAtTop ? 0 : 'auto',
                            bottom: isAtTop ? 'auto' : 0,
                            width: '12.5%',
                            height: '50%',
                            backgroundColor: 'rgba(18, 20, 18, 0.96)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: 'var(--radius-14)',
                            /* Rotate entire picker for black player in face-to-face mode */
                            rotate: (boardView === 'face-to-face' && currentTurn === 'b') ? '180deg' : '0deg'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {(['q', 'r', 'b', 'n'] as const).map((piece) => {
                            const code = `${currentTurn}${piece.toUpperCase()}` as const
                            return (
                              <button
                                key={piece}
                                onClick={() => {
                                  makeMove(pendingPromotion.from, pendingPromotion.to, piece)
                                  setPendingPromotion(null)
                                  selectSquare(pendingPromotion.to)
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
                                  alt={`promo-${piece}`}
                                  className="w-[85%] h-[85%] object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] group-hover:scale-110 transition-transform"
                                  draggable={false}
                                />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[var(--surface-elevated)] rounded-xl animate-pulse">
                  <div className="text-[var(--font-size-xs)] text-text-secondary opacity-50 text-center p-4">
                    Загрузка шахматной доски...
                  </div>
                </div>
              )}
            </div>

            {isActuallyGameOver ? (
              <div className="mt-[var(--space-16)] text-center space-y-[var(--space-12)]">
                <p className={`text-[var(--font-size-lg)] font-bold ${
                  resultText.includes('Ничья')
                    ? 'text-text-secondary'
                    : 'text-[var(--accent-brand)]'
                }`}>
                  {resultText}
                </p>
                <div className="flex justify-center gap-[var(--space-12)]">
                  <Button variant="primary" onClick={handleRematch}>
                    Новая игра
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/')}>
                    В лобби
                  </Button>
                </div>
              </div>
            ) : (
              <div 
                className="mx-auto mt-[var(--space-12)] flex justify-between gap-[var(--space-12)]"
                style={{ width: stableWidth || '100%', maxWidth: '100%' }}
              >
                <Button variant="outline" size="sm" onClick={undoMove} className="flex-1 max-w-[160px]">
                  Отмена хода
                </Button>
                <div className="flex gap-[var(--space-12)] flex-1 justify-end">
                  <Button variant="outline" size="sm" onClick={handleDraw} className="flex-1 max-w-[120px]">
                    Ничья
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleResign} className="flex-1 max-w-[120px]">
                    Сдаться
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="game-side-column">
            <Card padding="sm">
              <h3 className="text-[var(--font-size-sm)] font-semibold mb-[var(--space-12)] text-text">
                История ходов
              </h3>
              <div
                className="max-h-[350px] max-sm:max-h-[30dvh] overflow-y-auto space-y-1 text-[var(--font-size-xs)]"
                style={{ background: 'var(--bg)', borderRadius: 'var(--radius-8)', padding: 'var(--space-12)' }}
              >
                {moveHistory.length === 0 ? (
                  <p className="text-text-secondary text-center py-[var(--space-16)]">Нет ходов</p>
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
            </Card>
          </div>
        </div>
      </main>

      {/* Setup Modal */}
      <Modal
        isOpen={isSetupModalOpen}
        onClose={() => {}}
        description="Настройка локальной партии"
      >
        <div className="space-y-[var(--space-24)] pt-[var(--space-8)]">
          {/* Player Names */}
          <div className="space-y-[var(--space-16)]">
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest px-1">
                Игрок за белых
              </label>
              <input 
                type="text"
                value={whiteName}
                onChange={(e) => setWhiteName(e.target.value)}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-8)] p-3 text-text text-[var(--font-size-sm)] focus:outline-none focus:border-[var(--accent-brand)]"
              />
            </div>
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest px-1">
                Игрок за черных
              </label>
              <input 
                type="text"
                value={blackName}
                onChange={(e) => setBlackName(e.target.value)}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-8)] p-3 text-text text-[var(--font-size-sm)] focus:outline-none focus:border-[var(--accent-brand)]"
              />
            </div>
          </div>

          {/* Board View */}
          <div className="space-y-[var(--space-12)]">
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block text-left px-1">
              Режим доски
            </label>
            <div className="space-y-2">
              <Button 
                fullWidth 
                variant="primary" 
                onClick={() => setBoardView('standard')}
                className={`border-2 ${boardView === 'standard' ? '!border-[var(--accent)]' : 'border-transparent opacity-60'}`}
              >
                Стандарт
              </Button>
              <Button 
                fullWidth 
                variant="primary" 
                onClick={() => setBoardView('autoflip')}
                className={`border-2 ${boardView === 'autoflip' ? '!border-[var(--accent)]' : 'border-transparent opacity-60'}`}
              >
                Авто-разворот
              </Button>
              <Button 
                fullWidth 
                variant="primary" 
                onClick={() => setBoardView('face-to-face')}
                className={`border-2 ${boardView === 'face-to-face' ? '!border-[var(--accent)]' : 'border-transparent opacity-60'}`}
              >
                Лицом к лицу
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-[var(--space-12)] pt-2 border-t border-[color-mix(in_srgb,var(--border)_40%,transparent)]">
            <Button 
              fullWidth 
              onClick={handleStartGame}
              variant="primary"
            >
              Начать игру
            </Button>
            <Button 
              fullWidth 
              onClick={() => navigate('/')}
              variant="primary"
              className="hover:!bg-[var(--danger-soft)] hover:!border-[var(--danger-border)]"
            >
              Отмена
            </Button>
          </div>
        </div>
      </Modal>

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

      <Footer />
    </div>
  )
}
