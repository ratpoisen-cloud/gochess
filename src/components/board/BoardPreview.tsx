import { useMemo } from 'react'
import { Chessboard } from 'react-chessboard'
import { useBoardStore } from '@/stores/boardStore'
import { createEngine } from '@/lib/engine'
import { getVisibleSquares } from '@/lib/chessFog'

const BASE = import.meta.env.BASE_URL || '/'

interface BoardPreviewProps {
  fen: string
  size?: number
  orientation?: 'white' | 'black'
  gameMode?: 'classic' | 'fog_of_war'
  playerColor?: 'w' | 'b'
}

export default function BoardPreview({ 
  fen, 
  size = 100, 
  orientation = 'white',
  gameMode = 'classic',
  playerColor
}: BoardPreviewProps) {
  const { getTheme, getPieceUrl, selectedPieceSet } = useBoardStore()
  const theme = getTheme()

  // Calculate visible squares for Fog of War
  const visibleSquares = useMemo(() => {
    if (gameMode !== 'fog_of_war' || !playerColor) return null
    try {
      const game = createEngine('standard', fen)
      return getVisibleSquares(game, playerColor)
    } catch {
      return null
    }
  }, [fen, gameMode, playerColor])

  const customPieces = useMemo(() => {
    const pieces: Record<string, () => React.ReactElement> = {}
    const codes = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP']
    codes.forEach((code) => {
      pieces[code] = () => (
        <div style={{ width: '100%', height: '100%' }}>
          <img
            src={getPieceUrl(code)}
            alt={code}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
            draggable={false}
          />
        </div>
      )
    })
    return pieces
  }, [getPieceUrl, selectedPieceSet])

  return (
    <div 
      style={{ 
        width: size, 
        height: size, 
        borderRadius: '4px', 
        overflow: 'hidden',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        pointerEvents: 'none'
      }}
    >
      <Chessboard
        id={`preview-${fen.slice(0, 10)}`}
        position={fen}
        boardWidth={size}
        boardOrientation={orientation}
        arePiecesDraggable={false}
        areArrowsAllowed={false}
        showBoardNotation={false}
        customDarkSquareStyle={{ backgroundColor: theme.blackSquare }}
        customLightSquareStyle={{ backgroundColor: theme.whiteSquare }}
        customPieces={customPieces}
        customSquare={({ square, children, style }) => {
          const isSquareVisible = !visibleSquares || visibleSquares.includes(square)
          
          return (
            <div style={{ ...style, position: 'relative' }}>
              {/* Piece container - hidden in fog */}
              <div style={{ 
                width: '100%', 
                height: '100%', 
                opacity: isSquareVisible ? 1 : 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {children}
              </div>

              {/* Simplified Fog Overlay for Preview */}
              {!isSquareVisible && (
                <div 
                  className="absolute inset-0 z-10"
                  style={{ 
                    backgroundColor: '#1a1c2c', // Deep Ocean-style base
                    backgroundImage: `url(${BASE}engine/fog.svg)`,
                    backgroundSize: '300%', // Smaller zoom for small preview
                    backgroundBlendMode: 'overlay',
                    filter: 'grayscale(1) contrast(1.1) brightness(0.9)',
                    imageRendering: 'pixelated'
                  }}
                />
              )}
            </div>
          )
        }}
      />
    </div>
  )
}

