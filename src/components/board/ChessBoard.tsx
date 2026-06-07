import { useMemo, useState, useRef, useCallback } from 'react'
import { Chessboard } from 'react-chessboard'
import { useBoardStore } from '@/stores/boardStore'
import { useReactionStore } from '@/stores/reactionStore'
import type { Chess } from 'chess.js'

interface ChessBoardProps {
  game: Chess
  lastMove: { from: string; to: string } | null
  checkSquare: string | null
  selectedSquare: string | null
  legalMoves: string[]
  onDrop: (source: string, target: string) => boolean
  onSquareClick: (square: string) => void
  onReactionSquare?: (square: string, clientX: number, clientY: number) => void
  boardWidth?: number
  boardOrientation?: 'white' | 'black'
  animationDuration?: number
  defeatedKingSquare?: string | null
  endGameEmojis?: { square: string; url: string }[]
  visibleSquares?: string[] | null
}

export default function ChessBoard({
  game,
  lastMove,
  checkSquare,
  selectedSquare,
  onDrop,
  onSquareClick,
  onReactionSquare,
  boardWidth,
  boardOrientation = 'white',
  animationDuration = 200,
  defeatedKingSquare,
  endGameEmojis = [],
  visibleSquares = null,
}: ChessBoardProps) {
  const { getTheme, getPieceUrl, selectedPieceSet } = useBoardStore()
  const theme = getTheme()
  const [hoveredSquare, setHoveredSquare] = useState<string | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reactionEmojis = useReactionStore((s) => s.reactions)

  const handleContextMenu = useCallback((square: string, e: React.MouseEvent) => {
    e.preventDefault()
    if (onReactionSquare) {
      onReactionSquare(square, e.clientX, e.clientY)
    }
  }, [onReactionSquare])

  const handleTouchStart = useCallback((square: string, e: React.TouchEvent) => {
    longPressTimer.current = setTimeout(() => {
      if (onReactionSquare) {
        const touch = e.touches[0]
        onReactionSquare(square, touch.clientX, touch.clientY)
      }
    }, 500)
  }, [onReactionSquare])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

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
  const isCheckmate = game.isCheckmate()

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
        onPromotionCheck={() => false}
        boardOrientation={boardOrientation}
        boardWidth={boardWidth}
        customDarkSquareStyle={{ backgroundColor: theme.blackSquare }}
        customLightSquareStyle={{ backgroundColor: theme.whiteSquare }}
        customPieces={customPieces}
        animationDuration={animationDuration}
        customNotationStyle={{ fontSize: boardWidth ? Math.round(boardWidth / 64) : 12 }}
        customSquare={({ square, children, style }: { square: string; children: React.ReactNode; style: Record<string, string | number> }) => {
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
                const piece = game.get(square as any)
                if (piece) setHoveredSquare(square)
              }}
              onMouseLeave={() => setHoveredSquare(null)}
              onContextMenu={(e) => handleContextMenu(square, e)}
              onTouchStart={(e) => handleTouchStart(square, e)}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchEnd}
            >
              <div 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  transform: (defeatedKingSquare === square || (isCheckmate && isCheck)) ? 'rotate(90deg)' : 'none',
                  transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                  transformOrigin: 'center center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1,
                  opacity: (visibleSquares && !visibleSquares.includes(square)) ? 0 : 1
                }}
              >
                {children}
              </div>
              
              {/* Fog of War Overlay */}
              {visibleSquares && !visibleSquares.includes(square) && (
                <div 
                  className="absolute inset-0 z-10 pointer-events-none"
                  style={{ 
                    background: 'rgba(5, 6, 7, 0.85)',
                    backdropFilter: 'blur(2px)',
                    imageRendering: 'pixelated'
                  }}
                />
              )}

              {isActiveMove && !isActiveCapture && <div className="highlight-possible" />}
              {isActiveCapture && <div className="highlight-capture" />}
              
              {/* End Game Emojis */}
              {endGameEmojis.filter(e => e.square === square).map((e, i) => (
                <div
                  key={`endgame-${i}`}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-[60]"
                >
                  <div 
                    className="animate-bounce-subtle flex items-center justify-center"
                    style={{
                      width: '60%',
                      height: '60%',
                      filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))'
                    }}
                  >
                    <img 
                      src={e.url} 
                      alt="endgame-status" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              ))}

              {reactionEmojis.filter((r) => r.square === square).slice(-1).map((r) => (
                <div
                  key={r.id}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
                >
                  <div 
                    className="animate-bounce flex items-center justify-center"
                    style={{
                      width: '45%',
                      height: '45%',
                    }}
                  >
                    <img 
                      src={r.emojiUrl} 
                      alt="reaction" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              ))}
            </div>
          )
        }}
      />
    </div>
  )
}
