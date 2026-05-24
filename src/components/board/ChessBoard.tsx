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
  onDrop,
  onSquareClick,
  boardWidth,
  boardOrientation = 'white',
  animationDuration = 200,
}: ChessBoardProps) {
  const { getTheme, getPieceUrl, selectedPieceSet } = useBoardStore()
  const theme = getTheme()
  const [hoveredSquare, setHoveredSquare] = useState<string | null>(null)

  // Moves for SELECTED piece (click-to-move)
  const selectedMoveDetails = useMemo(() => {
    if (!selectedSquare) return []
    try {
      return game.moves({ square: selectedSquare as any, verbose: true })
    } catch {
      return []
    }
  }, [game, selectedSquare])

  // Moves for HOVERED piece (preview) — disabled when a piece is selected
  const hoveredMoveDetails = useMemo(() => {
    if (!hoveredSquare || selectedSquare) return []
    try {
      return game.moves({ square: hoveredSquare as any, verbose: true })
    } catch {
      return []
    }
  }, [game, hoveredSquare, selectedSquare])

  // Active moves: priority = selected > hover
  const activeMoveDetails = selectedSquare ? selectedMoveDetails : hoveredMoveDetails

  const customPieces = useMemo(() => {
    const pieces: Record<string, (args: { isDragging: boolean }) => React.ReactElement> = {}
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
              filter: isDragging
                ? 'drop-shadow(0 8px 16px rgba(0,0,0,0.5))'
                : 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
              transform: isDragging ? 'scale(1.05)' : 'none',
            }}
            draggable={false}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )
    })
    return pieces
  }, [getPieceUrl, selectedPieceSet])

  return (
    <div
      className="relative w-full h-full"
      style={{
        '--board-highlight-possible': theme.highlightPossible,
        '--board-highlight-possible-shadow': theme.highlightPossibleShadow,
        '--board-highlight-capture': theme.highlightCapture,
        '--board-highlight-capture-shadow': theme.highlightCaptureShadow,
        '--board-highlight-selected': theme.highlightSelected,
      } as React.CSSProperties}
    >
      <Chessboard
        id="GoChessBoardMain"
        position={game.fen()}
        onPieceDrop={(source, target) => {
          setHoveredSquare(null)
          return onDrop(source, target)
        }}
        onSquareClick={onSquareClick}
        boardOrientation={boardOrientation}
        boardWidth={boardWidth}
        customDarkSquareStyle={{ backgroundColor: theme.blackSquare }}
        customLightSquareStyle={{ backgroundColor: theme.whiteSquare }}
        customPieces={customPieces}
        animationDuration={animationDuration}
        customNotationStyle={{ fontSize: boardWidth ? Math.round(boardWidth / 64) : 12 }}
        customSquare={({ square, children, style }: any) => {
          const activeMove = activeMoveDetails.find(m => m.to === square)
          const isActiveMove = !!activeMove
          const isActiveCapture = activeMove && (activeMove.flags.includes('c') || activeMove.flags.includes('e'))
          const isSelected = selectedSquare === square
          const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square)
          const isCheck = checkSquare === square

          return (
            <div
              style={{ ...style, position: 'relative' }}
              data-square={square}
              className={`
                ${isSelected ? 'highlight-selected' : ''}
                ${isLastMove ? 'highlight-last-move' : ''}
                ${isCheck ? 'highlight-check' : ''}
              `}
              onMouseEnter={() => {
                const piece = game.get(square)
                if (piece) setHoveredSquare(square)
              }}
              onMouseLeave={() => setHoveredSquare(null)}
            >
              {children}
              {isActiveMove && !isActiveCapture && <div className="highlight-possible" />}
              {isActiveCapture && <div className="highlight-capture" />}
            </div>
          )
        }}
      />
    </div>
  )
}
