import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import ChessBoard from '@/components/board/ChessBoard'
import { useGameStore, getKingSquare } from '@/stores/gameStore'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useBoardWidth } from '@/hooks/useBoardWidth'
import Card from '@/components/Card'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import SettingsDropdown from '@/components/SettingsDropdown'
import UserMenu from '@/components/UserMenu'
import Footer from '@/components/Footer'
import PixelConfetti from '@/components/PixelConfetti'
import { createBotEngine } from '@/lib/botEngine'
import type { BotLevel } from '@/types'

import { useBoardStore } from '@/stores/boardStore'

const BASE = import.meta.env.BASE_URL || '/'

export default function BotPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { getPieceUrl, getTheme } = useBoardStore()
  const { 
    game, status, currentTurn, selectedSquare, legalMoves, lastMove, 
    checkSquare, moveHistory, isGameOver, makeMove, selectSquare, 
    resetGame, saveGame, playerColor, setPlayerColor,
    createBotGameDoc, updateBotGameDoc, botGameDocId, loadBotGameFromFirestore 
  } = useGameStore()
  
  const [isLevelModalOpen, setIsLevelModalOpen] = useState(true)
  const [tempColor, setTempColor] = useState<'w' | 'b' | 'random'>('w')
  const [level, setLevel] = useState<BotLevel>('medium')
  const [isBotThinking, setIsBotThinking] = useState(false)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null)
  const [winnerColor, setWinnerColor] = useState<'w' | 'b' | null>(null)
  const [isGameLoading, setIsGameLoading] = useState(true)
  const [endGameState, setEndGameState] = useState<{ defeated: string | null; emojis: { square: string; url: string }[] } | null>(null)
  
  const [searchParams] = useSearchParams()
  
  const gameRef = useRef(game)
  const savedRef = useRef(false)
  const botEngineRef = useRef<ReturnType<typeof createBotEngine> | null>(null)
  
  const boardContainerRef = useRef<HTMLDivElement>(null)
  const { stableWidth } = useBoardWidth(boardContainerRef, true)

  useEffect(() => {
    gameRef.current = game
  }, [game])

  useEffect(() => {
    if (isGameOver && !savedRef.current) {
      savedRef.current = true
      saveGame('bot', level)

      // Calculate End Game King Effects
      const whiteKingSquare = getKingSquare(game, 'w')
      const blackKingSquare = getKingSquare(game, 'b')

      if (status === 'checkmate') {
        const loserColor = currentTurn
        const wc = currentTurn === 'w' ? 'b' : 'w'
        setWinnerColor(wc)
        const kingSq = getKingSquare(game, loserColor as any)
        const winnerKingSq = getKingSquare(game, wc)
        setEndGameState({
          defeated: kingSq,
          emojis: [
            ...(kingSq ? [{ square: kingSq, url: `${BASE}emojis/end game/chekmate.png` }] : []),
            ...(winnerKingSq ? [{ square: winnerKingSq, url: `${BASE}emojis/end game/win.png` }] : [])
          ]
        })
      } else if (status === 'stalemate' || status === 'draw') {
        setWinnerColor(null)
        setEndGameState({
          defeated: null,
          emojis: [
            ...(whiteKingSquare ? [{ square: whiteKingSquare, url: `${BASE}emojis/end game/draw.png` }] : []),
            ...(blackKingSquare ? [{ square: blackKingSquare, url: `${BASE}emojis/end game/draw.png` }] : [])
          ]
        })
      }
    }
    if (!isGameOver) {
      savedRef.current = false
      setEndGameState(null)
      setWinnerColor(null)
    }
  }, [isGameOver, saveGame, level, game, status, currentTurn])

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
    <div className="min-h-[100dvh] flex flex-col bg-bg">
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
                    gameOverGray={isGameOver && status !== 'draw' && status !== 'stalemate' && playerColor !== winnerColor}
                  />

                  {/* Promotion Overlay */}
                  {pendingPromotion && (() => {
                    const square = pendingPromotion.to
                    const col = square[0].charCodeAt(0) - 97
                    const rank = parseInt(square[1])
                    
                    let leftIdx = col
                    let isAtTop = rank === 8
                    
                    if (playerColor === 'b') {
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
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {(['q', 'r', 'b', 'n'] as const).map((piece) => {
                            const code = `${playerColor}${piece.toUpperCase()}` as const
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
                                  alt={piece}
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

      <Modal
        isOpen={isLevelModalOpen}
        onClose={() => {}}
        description="Настройка партии с Ичи"
      >
        <div className="space-y-[var(--space-24)] pt-[var(--space-8)]">
          <div className="space-y-[var(--space-12)]">
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block text-left px-1">
              Ваш цвет
            </label>
            <div className="space-y-2">
              <Button 
                fullWidth 
                variant="primary" 
                onClick={() => setTempColor('w')}
                className={`border-2 ${tempColor === 'w' ? '!border-[var(--accent)]' : 'border-transparent opacity-60'}`}
              >
                Белые
              </Button>
              <Button 
                fullWidth 
                variant="primary" 
                onClick={() => setTempColor('b')}
                className={`border-2 ${tempColor === 'b' ? '!border-[var(--accent)]' : 'border-transparent opacity-60'}`}
              >
                Черные
              </Button>
              <Button 
                fullWidth 
                variant="primary" 
                onClick={() => setTempColor('random')}
                className={`border-2 ${tempColor === 'random' ? '!border-[var(--accent)]' : 'border-transparent opacity-60'}`}
              >
                Случайно 🎲
              </Button>
            </div>
          </div>

          <div className="space-y-[var(--space-12)]">
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block text-left px-1">
              Сложность
            </label>
            <div className="space-y-2">
              <Button 
                fullWidth 
                onClick={() => handleStartGame('very-easy')}
                variant="primary"
              >
                Очень лёгкий
              </Button>
              <Button 
                fullWidth 
                onClick={() => handleStartGame('easy')}
                variant="primary"
              >
                Лёгкий
              </Button>
              <Button 
                fullWidth 
                onClick={() => handleStartGame('medium')}
                variant="primary"
              >
                Средний
              </Button>
              <Button 
                fullWidth 
                onClick={() => handleStartGame('hard')}
                variant="primary"
              >
                Сильный
              </Button>
            </div>
          </div>

          <div className="pt-2 border-t border-[color-mix(in_srgb,var(--border)_40%,transparent)]">
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

      <Footer />
    </div>
  )
}

