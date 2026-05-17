import { useMemo, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { useBoardStore } from '@/stores/boardStore'
import type { Chess } from 'chess.js'

interface ChessBoardProps {
  game: Chess
  lastMove: { from: string; to: string } | null
  checkSquare: string | null
  selectedSquare: string | null
  legalMoves: string[]
  onDrop: (source: string, target: string) => boolean
  onSquareClick: (square: string) => void
  boardWidth?: number
  boardOrientation?: 'white' | 'black'
  animationDuration?: number
}

export default function ChessBoard({
  game,
  lastMove,
  checkSquare,
  selectedSquare,
  legalMoves,
  onDrop,
  onSquareClick,
  boardWidth = 760,
  boardOrientation = 'white',
  animationDuration = 300,
}: ChessBoardProps) {
  const { getTheme, getPieceUrl, selectedPieceSet } = useBoardStore()
  const theme = getTheme()
  const [dragSquare, setDragSquare] = useState<string | null>(null)

  const customPieces = useMemo(() => {
    const pieces: Record<string, (args: { isDragging: boolean; squareWidth: number }) => React.ReactElement> = {}
    const codes = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP']
    codes.forEach((code) => {
      pieces[code] = ({ isDragging }) => (
        <div style={{ width: '100%', height: '100%' }}>
          <img
            src={getPieceUrl(code)}
            alt={code}
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain',
              filter: isDragging ? 'drop-shadow(0 14px 28px rgba(0,0,0,0.6))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
              transform: isDragging ? 'scale(1.15) translateY(-10px)' : 'none',
              transition: 'transform 0.12s cubic-bezier(0.18, 0.89, 0.32, 1.28), filter 0.12s ease',
              zIndex: isDragging ? 1000 : 'auto',
            }}
            draggable={false}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )
    })
    return pieces
  }, [getPieceUrl, selectedPieceSet])

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {}

    // Last move highlight
    if (lastMove) {
      const lastMoveStyle: React.CSSProperties = {
        boxShadow: 'inset 0 0 0 4px var(--board-last-move-outline)',
        borderRadius: '4px',
      }
      styles[lastMove.from] = lastMoveStyle
      styles[lastMove.to] = lastMoveStyle
    }

    // Check highlight
    if (checkSquare) {
      styles[checkSquare] = {
        boxShadow: 'inset 0 0 0 4px var(--board-check-outline), 0 0 16px var(--board-check-glow)',
        borderRadius: '4px',
      }
    }

    // Determine active square for selection/drag
    const activeSquare = selectedSquare || dragSquare
    
    // Highlight active square
    if (activeSquare) {
      styles[activeSquare] = {
        boxShadow: `inset 0 0 0 4px ${theme.highlightSelected}`,
        backgroundColor: dragSquare ? 'var(--board-highlight-drag-bg)' : undefined,
      }
    }

    // Highlight legal moves
    const movesToShow = activeSquare ? legalMoves : []
    movesToShow.forEach((sq) => {
      const isCapture = game.get(sq as any) !== null
      if (isCapture) {
        // Capture ring
        styles[sq] = {
          boxShadow: `inset 0 0 0 4px ${theme.highlightCapture}`,
          background: `linear-gradient(transparent, transparent), radial-gradient(circle, transparent 42.5%, ${theme.highlightCapture} 42.5%, ${theme.highlightCapture} 50%, transparent 50%)`,
          backgroundSize: '100% 100%, 85% 85%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }
      } else {
        // Possible move dot
        styles[sq] = {
          background: `radial-gradient(circle, ${theme.highlightPossible} 28%, transparent 28%)`,
          boxShadow: `0 0 8px ${theme.highlightPossibleShadow}`,
        }
      }
    })

    return styles
  }, [lastMove, checkSquare, selectedSquare, dragSquare, legalMoves, game, theme])

  const handleDragBegin = (_piece: string, source: string) => {
    setDragSquare(source)
    if (selectedSquare !== source) {
      onSquareClick(source)
    }
  }

  const handleDragEnd = () => {
    setDragSquare(null)
  }

  return (
    <div className="relative" data-board-dragging={!!dragSquare}>
      <Chessboard
        position={game.fen()}
        onPieceDrop={(source, target) => {
          handleDragEnd()
          return onDrop(source, target)
        }}
        onSquareClick={onSquareClick}
        onPieceDragBegin={handleDragBegin}
        onPieceDragEnd={handleDragEnd}
        boardOrientation={boardOrientation}
        boardWidth={boardWidth}
        customDarkSquareStyle={{ backgroundColor: theme.blackSquare }}
        customLightSquareStyle={{ backgroundColor: theme.whiteSquare }}
        customSquareStyles={customSquareStyles}
        customPieces={customPieces}
        animationDuration={animationDuration}
      />
    </div>
  )
}
