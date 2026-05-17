import { useMemo } from 'react'
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

  const customPieces = useMemo(() => {
    const pieces: Record<string, (args: { isDragging: boolean; squareWidth: number }) => React.ReactElement> = {}
    const codes = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP']
    codes.forEach((code) => {
      pieces[code] = () => (
        <img
          src={getPieceUrl(code)}
          alt={code}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          draggable={false}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )
    })
    return pieces
  }, [getPieceUrl, selectedPieceSet])

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {}

    // Last move highlight (Blue-ish from old project)
    if (lastMove) {
      const lastMoveStyle: React.CSSProperties = {
        boxShadow: 'inset 0 0 0 4px var(--board-last-move-outline)',
        borderRadius: '4px',
      }
      styles[lastMove.from] = lastMoveStyle
      styles[lastMove.to] = lastMoveStyle
    }

    // Check highlight (Red-ish from old project)
    if (checkSquare) {
      styles[checkSquare] = {
        boxShadow: 'inset 0 0 0 4px var(--board-check-outline), 0 0 16px var(--board-check-glow)',
        borderRadius: '4px',
      }
    }

    // Selected square
    if (selectedSquare) {
      styles[selectedSquare] = {
        boxShadow: `inset 0 0 0 4px ${theme.highlightSelected}`,
      }

      // Possible moves
      legalMoves.forEach((sq) => {
        const isCapture = game.get(sq as any) !== null
        if (isCapture) {
          styles[sq] = {
            boxShadow: `inset 0 0 0 4px ${theme.highlightCapture}`,
            background: `linear-gradient(transparent, transparent), radial-gradient(circle, transparent 42.5%, ${theme.highlightCapture} 42.5%, ${theme.highlightCapture} 50%, transparent 50%)`,
            backgroundSize: '100% 100%, 85% 85%',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }
        } else {
          styles[sq] = {
            background: `radial-gradient(circle, ${theme.highlightPossible} 28%, transparent 28%)`,
            boxShadow: `0 0 8px ${theme.highlightPossibleShadow}`,
          }
        }
      })
    }

    return styles
  }, [lastMove, checkSquare, selectedSquare, legalMoves, game, theme])

  return (
    <Chessboard
      position={game.fen()}
      onPieceDrop={onDrop}
      onSquareClick={onSquareClick}
      boardOrientation={boardOrientation}
      boardWidth={boardWidth}
      customDarkSquareStyle={{ backgroundColor: theme.blackSquare }}
      customLightSquareStyle={{ backgroundColor: theme.whiteSquare }}
      customSquareStyles={customSquareStyles}
      customPieces={customPieces}
      animationDuration={animationDuration}
    />
  )
}
