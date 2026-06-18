import { useNavigate } from 'react-router-dom'
import ChessBoard from '@/components/board/ChessBoard'
import { createEngine } from '@/lib/engine'
import { type AtomicChessEngine } from '@/lib/engine/AtomicChessEngine'
import { useState, useRef, useCallback } from 'react'
import { useBoardWidth } from '@/hooks/useBoardWidth'
import Card from '@/components/Card'
import Button from '@/components/Button'
import { useAuth } from '@/hooks/useAuth'
import PixelConfetti from '@/components/PixelConfetti'
import GameLayout from '@/components/GameLayout'
import { usePgnCopy } from '@/hooks/usePgnCopy'
import { MagicVFX, type MagicVFXHandle } from '@/components/MagicVFX'
import { useBoardStore } from '@/stores/boardStore'
import { getKingSquare } from '@/stores/gameStore'
import PromotionPicker from '@/components/PromotionPicker'

const BASE = import.meta.env.BASE_URL || '/'

export default function AtomicLocalPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { getTheme } = useBoardStore()

  const [engine] = useState(() => createEngine('atomic') as AtomicChessEngine)
  const [fen, setFen] = useState(engine.fen())
  const [turn, setTurn] = useState(engine.turn())
  const [lastMove, setLastMove] = useState<any>(null)
  const [isGameOver, setIsGameOver] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const [moveHistory, setMoveHistory] = useState<string[]>([])

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoves, setLegalMoves] = useState<string[]>([])
  const [checkSquare, setCheckSquare] = useState<string | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null)

  const { pgnCopied, copyPgn } = usePgnCopy(() => engine.pgn())

  const boardContainerRef = useRef<HTMLDivElement>(null)
  const vfxRef = useRef<MagicVFXHandle>(null)
  const { stableWidth } = useBoardWidth(boardContainerRef, true)

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

  const handleMove = useCallback((from: string, to: string, promotion?: string) => {
    const move = engine.move({ from, to, promotion })
    if (!move) return false

    const state = engine.getAtomicState()
    if (state.lastBlastSquare) {
      const center = getSquareCenter(state.lastBlastSquare)
      vfxRef.current?.trigger({ ...center, type: 'blast' })
    }

    setFen(engine.fen())
    setTurn(engine.turn())
    setLastMove(move)
    setMoveHistory(engine.history())
    setSelectedSquare(null)
    setLegalMoves([])

    const kingSq = getKingSquare(engine, engine.turn())
    setCheckSquare(engine.inCheck(engine.turn()) ? kingSq : null)

    const board = engine.board()
    let wKing = false, bKing = false
    board.flat().forEach(p => {
      if (p?.type === 'k') {
        if (p.color === 'w') wKing = true
        if (p.color === 'b') bKing = true
      }
    })

    if (!wKing || !bKing || engine.isGameOver()) {
      setIsGameOver(true)
      setWinner(!bKing ? 'w' : 'b')
    }

    return true
  }, [engine])

  const checkPromotion = (from: string, to: string): boolean => {
    const piece = engine.get(from)
    if (piece?.type !== 'p') return false
    if (piece.color === 'w' && to[1] === '8') return true
    if (piece.color === 'b' && to[1] === '1') return true
    return false
  }

  const selectSquare = useCallback((square: string) => {
    const piece = engine.get(square)

    if (selectedSquare === square) {
      setSelectedSquare(null)
      setLegalMoves([])
      return
    }

    if (selectedSquare) {
      const isLegal = legalMoves.includes(square)
      if (isLegal) {
        if (checkPromotion(selectedSquare, square)) {
          setPendingPromotion({ from: selectedSquare, to: square })
          return
        }
        handleMove(selectedSquare, square)
        return
      }

      if (piece && piece.color === engine.turn()) {
        const moves = engine.moves({ verbose: true }) as any[]
        const filtered = moves.filter(m => m.from === square)
        setSelectedSquare(square)
        setLegalMoves(filtered.map(m => m.to))
        return
      }

      setSelectedSquare(null)
      setLegalMoves([])
      return
    }

    if (piece && piece.color === engine.turn()) {
      const moves = engine.moves({ verbose: true }) as any[]
      const filtered = moves.filter(m => m.from === square)
      setSelectedSquare(square)
      setLegalMoves(filtered.map(m => m.to))
    }
  }, [engine, selectedSquare, legalMoves, handleMove])

  const onSquareClick = (square: string) => {
    if (isGameOver) return
    selectSquare(square)
  }

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (isGameOver) return false
    if (checkPromotion(sourceSquare, targetSquare)) {
      if (legalMoves.includes(targetSquare)) {
        setPendingPromotion({ from: sourceSquare, to: targetSquare })
        return true
      }
    }
    return handleMove(sourceSquare, targetSquare)
  }

  const resetGame = () => {
    engine.reset()
    setFen(engine.fen())
    setTurn(engine.turn())
    setLastMove(null)
    setIsGameOver(false)
    setWinner(null)
    setMoveHistory([])
    setSelectedSquare(null)
    setLegalMoves([])
    setCheckSquare(null)
    setPendingPromotion(null)
  }

  return (
    <GameLayout user={user}>
      <div className="game-layout-container">
        <div className="game-main-column">
          <div className="mx-auto mb-[var(--space-12)] grid grid-cols-3 items-center px-[var(--space-8)]" style={{ width: stableWidth || '100%' }}>
            <div className="flex items-center gap-[var(--space-8)] text-[var(--font-size-sm)] font-bold">
              <img src={`${BASE}emojis/online/bomb.png`} alt="mode" className="w-5 h-5 object-contain" style={{ imageRendering: 'pixelated' }} />
              <span className="text-[var(--accent-brand)] uppercase tracking-widest">Атомные</span>
            </div>
            <div className="text-center flex justify-center">
              {isGameOver && (
                <h2 className="text-[10px] font-bold text-[var(--accent-brand)] uppercase tracking-[0.2em] animate-pulse">
                   Победа {winner === 'w' ? 'белых' : 'чёрных'}!
                </h2>
              )}
            </div>
            <div className="text-right">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${turn === 'w' ? 'text-[var(--accent-brand)] animate-pulse' : 'text-text opacity-60'}`}>
                {turn === 'w' ? 'Ход белых' : 'Ход чёрных'}
              </span>
            </div>
          </div>

          <div ref={boardContainerRef} className="board-container relative overflow-hidden">
            {isGameOver && winner && <PixelConfetti boardMode lightSquareColor={getTheme().whiteSquare} darkSquareColor={getTheme().blackSquare} />}
            <MagicVFX ref={vfxRef} boardWidth={stableWidth} />
            {stableWidth > 0 && (
              <>
                <ChessBoard
                  game={engine}
                  position={fen}
                  lastMove={lastMove}
                  checkSquare={checkSquare}
                  selectedSquare={selectedSquare}
                  legalMoves={legalMoves}
                  onDrop={onDrop}
                  onSquareClick={onSquareClick}
                  boardWidth={stableWidth}
                  boardOrientation="white"
                  arePiecesDraggable={!isGameOver}
                />
                {pendingPromotion && (
                  <PromotionPicker
                    to={pendingPromotion.to}
                    color={turn}
                    onSelect={(piece) => {
                      handleMove(pendingPromotion.from, pendingPromotion.to, piece)
                      setPendingPromotion(null)
                      setSelectedSquare(pendingPromotion.to)
                    }}
                    onCancel={() => setPendingPromotion(null)}
                  />
                )}
              </>
            )}
          </div>

          <div className="mt-8 flex justify-center gap-4">
             {isGameOver ? (
               <Button variant="primary" onClick={resetGame}>Новая игра</Button>
             ) : (
               <Button variant="outline" onClick={() => navigate('/offline')}>Сдаться</Button>
             )}
             <Button variant="outline" onClick={() => navigate('/offline')}>В лобби</Button>
          </div>
        </div>

        <div className="game-side-column">
          <Card padding="sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">История</h3>
              <button onClick={copyPgn} className={`text-[9px] font-bold uppercase tracking-tighter ${pgnCopied ? 'text-[var(--accent-brand)]' : 'opacity-40 hover:opacity-100'}`}>
                {pgnCopied ? 'Готово' : 'PGN'}
              </button>
            </div>
            <div className="max-h-[300px] overflow-y-auto text-[10px] font-mono leading-relaxed opacity-60 custom-scrollbar pr-2">
              {moveHistory.length > 0 ? moveHistory.join(', ') : 'Ожидание хода...'}
            </div>
          </Card>

          <Card padding="sm" className="mt-4">
            <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">Правила</h3>
            <p className="text-[10px] leading-relaxed opacity-70">
              Любое взятие вызывает взрыв 3x3. Все фигуры в радиусе (кроме пешек) и сам захватчик уничтожаются. Нельзя взрывать своего короля.
            </p>
          </Card>
        </div>
      </div>
    </GameLayout>
  )
}
