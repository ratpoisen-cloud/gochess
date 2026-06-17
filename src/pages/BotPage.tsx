import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import ChessBoard from '@/components/board/ChessBoard'
import { useGameStore } from '@/stores/gameStore'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useBoardWidth } from '@/hooks/useBoardWidth'
import Card from '@/components/Card'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import PixelConfetti from '@/components/PixelConfetti'
import GameLayout from '@/components/GameLayout'
import PromotionPicker from '@/components/PromotionPicker'
import { usePgnCopy } from '@/hooks/usePgnCopy'
import { useEndGameEffects } from '@/hooks/useEndGameEffects'
import { createBotEngine } from '@/lib/botEngine'
import type { BotLevel } from '@/types'

import { useBoardStore } from '@/stores/boardStore'

export default function BotPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { getTheme } = useBoardStore()
  const { 
    game, status, currentTurn, selectedSquare, legalMoves, lastMove, 
    checkSquare, moveHistory, isGameOver, makeMove, selectSquare, 
    undoMove, resetGame, saveGame, playerColor, setPlayerColor,
    createBotGameDoc, updateBotGameDoc, botGameDocId, loadBotGameFromFirestore 
  } = useGameStore()
  
  const [isLevelModalOpen, setIsLevelModalOpen] = useState(true)
  const [tempColor, setTempColor] = useState<'w' | 'b' | 'random'>('w')
  const [level, setLevel] = useState<BotLevel>('medium')
  const [isBotThinking, setIsBotThinking] = useState(false)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null)
  const [isGameLoading, setIsGameLoading] = useState(true)

  const { pgnCopied, copyPgn } = usePgnCopy(() => game.pgn())
  const { winnerColor, endGameState } = useEndGameEffects({
    game,
    isGameOver,
    status,
    currentTurn,
    onSave: () => saveGame('bot', level),
  })
  
  const [searchParams] = useSearchParams()

  const gameRef = useRef(game)
  const botEngineRef = useRef<ReturnType<typeof createBotEngine> | null>(null)
  
  const boardContainerRef = useRef<HTMLDivElement>(null)
  const { stableWidth } = useBoardWidth(boardContainerRef, true)

  useEffect(() => {
    gameRef.current = game
  }, [game])

  useEffect(() => {
    if (botGameDocId && !isGameOver && moveHistory.length > 0) {
      updateBotGameDoc()
    }
  }, [moveHistory.length, botGameDocId, isGameOver, updateBotGameDoc])

  useEffect(() => {
    const gameId = searchParams.get('game')
    if (!gameId) {
      setIsGameLoading(false)
      return
    }

    loadBotGameFromFirestore(gameId).then((result) => {
      if (result) {
        setLevel(result.level as BotLevel)
        setPlayerColor(result.playerColor)
        setIsLevelModalOpen(false)

        if (botEngineRef.current) {
          botEngineRef.current.destroy()
        }
        botEngineRef.current = createBotEngine(result.level as BotLevel)
      } else {
        // If loading failed or it's a new game, modal stays open
        // But if it's a completed game, loadBotGameFromFirestore now returns data,
        // so we check if the game is over to keep the modal closed.
        const currentGameState = useGameStore.getState().isGameOver
        if (currentGameState) {
          setIsLevelModalOpen(false)
        }
      }
      setIsGameLoading(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (botEngineRef.current) {
        botEngineRef.current.destroy()
        botEngineRef.current = null
      }
    }
  }, [])

  const checkPromotion = (from: string, to: string): boolean => {
    const piece = game.get(from as any)
    if (piece?.type !== 'p') return false
    if (piece.color === 'w' && to[1] === '8') return true
    if (piece.color === 'b' && to[1] === '1') return true
    return false
  }

  // Bot Turn Logic
  useEffect(() => {
    if (!isGameOver && currentTurn !== playerColor && !isBotThinking && !isLevelModalOpen && !pendingPromotion) {
      const timer = setTimeout(async () => {
        setIsBotThinking(true)
        const currentGame = gameRef.current
        if (currentGame.isGameOver()) {
          setIsBotThinking(false)
          return
        }

        const engine = botEngineRef.current
        if (engine) {
          try {
            const bestMove = await engine.getBestMove(currentGame.fen())
            if (bestMove && bestMove !== '(none)') {
              const from = bestMove.slice(0, 2)
              const to = bestMove.slice(2, 4)
              const promotion = bestMove.length > 4 ? bestMove.slice(4, 5) : undefined
              makeMove(from, to, promotion)
            } else {
              const moves = currentGame.moves({ verbose: true })
              if (moves.length > 0) {
                const fallback = moves[Math.floor(Math.random() * moves.length)]
                makeMove(fallback.from, fallback.to, fallback.promotion)
              }
            }
          } catch (err) {
            console.error('[Bot] Engine error, using fallback:', err)
            const moves = currentGame.moves({ verbose: true })
            if (moves.length > 0) {
              const fallback = moves[Math.floor(Math.random() * moves.length)]
              makeMove(fallback.from, fallback.to, fallback.promotion)
            }
          }
        } else {
          const moves = currentGame.moves({ verbose: true })
          if (moves.length > 0) {
            const randomMove = moves[Math.floor(Math.random() * moves.length)]
            makeMove(randomMove.from, randomMove.to, randomMove.promotion)
          }
        }

        setIsBotThinking(false)
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [currentTurn, playerColor, isGameOver, isBotThinking, makeMove, isLevelModalOpen, pendingPromotion])

  const onDrop = useCallback((sourceSquare: string, targetSquare: string) => {
    if (currentTurn !== playerColor) return false
    
    if (checkPromotion(sourceSquare, targetSquare)) {
      if (legalMoves.includes(targetSquare)) {
        setPendingPromotion({ from: sourceSquare, to: targetSquare })
        return true
      }
    }
    
    return makeMove(sourceSquare, targetSquare)
  }, [makeMove, currentTurn, playerColor, game, legalMoves])

  const onSquareClick = (square: string) => {
    if (currentTurn !== playerColor) return

    if (selectedSquare && checkPromotion(selectedSquare, square)) {
      if (legalMoves.includes(square)) {
        setPendingPromotion({ from: selectedSquare, to: square })
        return
      }
    }

    selectSquare(square)
  }

  const handleStartGame = async (selectedLevel: BotLevel) => {
    const finalColor = tempColor === 'random' 
      ? (Math.random() > 0.5 ? 'w' : 'b') 
      : tempColor
    
    if (botEngineRef.current) {
      botEngineRef.current.destroy()
    }
    botEngineRef.current = createBotEngine(selectedLevel)
    setPlayerColor(finalColor)
    setLevel(selectedLevel)
    resetGame()
    setIsLevelModalOpen(false)

    await createBotGameDoc(selectedLevel)
  }

  const statusClasses = {
    checkmate: 'text-[var(--danger)]',
    stalemate: 'text-text-secondary',
    draw: 'text-text-secondary',
    check: 'text-[var(--danger)]',
    playing: isBotThinking ? 'text-[var(--accent-brand)] animate-pulse' : currentTurn === playerColor ? 'text-[var(--accent-brand)]' : 'text-text opacity-60',
  }

  return (
    <GameLayout user={user}>
      <div className="game-layout-container">
          <div className="game-main-column">
            <div 
              className="mx-auto mb-[var(--space-12)] grid grid-cols-3 items-center px-[var(--space-8)]"
              style={{ width: stableWidth || '100%', maxWidth: '100%' }}
            >
              {/* Left: Bot Info */}
              <div className="flex items-center gap-[var(--space-8)] text-[var(--font-size-sm)] font-bold">
                <img 
                  src={`${import.meta.env.BASE_URL || '/'}emojis/bot_new.png`} 
                  alt="bot" 
                  className="w-5 h-5 object-contain opacity-90"
                />
                <span className="text-[var(--accent-brand)] truncate">
                  Ичи {level === 'very-easy' ? 'очень легкий' : level === 'easy' ? 'легкий' : level === 'medium' ? 'средний' : 'сложный'}
                </span>
              </div>

              {/* Center: Notifications (Check, Results) */}
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
                  !isBotThinking && currentTurn === playerColor ? 'text-[var(--accent-brand)] animate-pulse' : 'text-text-secondary opacity-60'
                }`}>
                  {isBotThinking ? 'Ход соперника' : currentTurn === playerColor ? 'Ваш ход' : 'Ход соперника'}
                </span>
              </div>
            </div>

            <div
              ref={boardContainerRef}
              className="board-container"
            >
              {isGameOver && status !== 'draw' && status !== 'stalemate' && stableWidth > 0 && playerColor === winnerColor && (
                <PixelConfetti boardMode lightSquareColor={getTheme().whiteSquare} darkSquareColor={getTheme().blackSquare} />
              )}
              {isGameLoading && searchParams.get('game') ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-[var(--accent-brand)] animate-pulse text-sm">Загрузка партии...</div>
                </div>
              ) : stableWidth > 0 ? (
                <>
                  <ChessBoard
                    game={game}
                    lastMove={lastMove}
                    checkSquare={checkSquare}
                    selectedSquare={selectedSquare}
                    legalMoves={legalMoves}
                    onDrop={onDrop}
                    onSquareClick={onSquareClick}
                    boardWidth={stableWidth}
                    boardOrientation={playerColor === 'b' ? 'black' : 'white'}
                    defeatedKingSquare={endGameState?.defeated}
                    endGameEmojis={endGameState?.emojis}
                    gameOverGray={isGameOver && winnerColor !== null && winnerColor !== playerColor}
                    arePiecesDraggable={!isGameOver}
                  />

                  {/* Promotion Overlay */}
                  {pendingPromotion && (
                    <PromotionPicker
                      to={pendingPromotion.to}
                      color={playerColor!}
                      onSelect={(piece) => {
                        makeMove(pendingPromotion.from, pendingPromotion.to, piece)
                        setPendingPromotion(null)
                        selectSquare(pendingPromotion.to)
                      }}
                      onCancel={() => setPendingPromotion(null)}
                    />
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[var(--surface-elevated)] rounded-xl animate-pulse">
                  <div className="text-[var(--font-size-xs)] text-text-secondary opacity-50 text-center p-4">
                    Загрузка шахматной доски...
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="game-side-column">
            <Card padding="sm">
              <div className="flex items-center justify-between mb-[var(--space-12)]">
                <div className="flex items-center gap-2">
                  <h3 className="text-[var(--font-size-sm)] font-semibold text-text">История ходов</h3>
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
              </div>
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
              {moveHistory.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => undoMove(true)} fullWidth className="mt-[var(--space-12)]">
                  Отмена хода
                </Button>
              )}
            </Card>
          </div>
        </div>

        <Modal
          isOpen={isLevelModalOpen}
          onClose={() => {}}
          description="Настройка партии с Ичи"
        >
          <div className="space-y-[var(--space-24)] pt-[var(--space-8)]">
            <div className="space-y-[var(--space-12)]">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block text-left px-1">Ваш цвет</label>
              <div className="space-y-2">
                <Button fullWidth variant="primary" onClick={() => setTempColor('w')} className={`border-2 ${tempColor === 'w' ? '!border-[var(--accent)]' : 'border-transparent opacity-60'}`}>Белые</Button>
                <Button fullWidth variant="primary" onClick={() => setTempColor('b')} className={`border-2 ${tempColor === 'b' ? '!border-[var(--accent)]' : 'border-transparent opacity-60'}`}>Чёрные</Button>
                <Button fullWidth variant="primary" onClick={() => setTempColor('random')} className={`border-2 ${tempColor === 'random' ? '!border-[var(--accent)]' : 'border-transparent opacity-60'}`}>Случайно 🎲</Button>
              </div>
            </div>
            <div className="space-y-[var(--space-12)]">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block text-left px-1">Сложность</label>
              <div className="space-y-2">
                <Button fullWidth onClick={() => handleStartGame('very-easy')} variant="primary">Очень лёгкий</Button>
                <Button fullWidth onClick={() => handleStartGame('easy')} variant="primary">Лёгкий</Button>
                <Button fullWidth onClick={() => handleStartGame('medium')} variant="primary">Средний</Button>
                <Button fullWidth onClick={() => handleStartGame('hard')} variant="primary">Сильный</Button>
              </div>
            </div>
            <div className="pt-2 border-t border-[color-mix(in_srgb,var(--border)_40%,transparent)]">
              <Button fullWidth onClick={() => navigate('/')} variant="primary" className="hover:!bg-[var(--danger-soft)] hover:!border-[var(--danger-border)]">Отмена</Button>
            </div>
          </div>
        </Modal>
      </GameLayout>
    )
  }

