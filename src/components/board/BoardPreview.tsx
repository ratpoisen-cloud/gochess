import { useMemo } from 'react'
import { Chessboard } from 'react-chessboard'
import { useBoardStore } from '@/stores/boardStore'

interface BoardPreviewProps {
  fen: string
  size?: number
  orientation?: 'white' | 'black'
}

export default function BoardPreview({ fen, size = 100, orientation = 'white' }: BoardPreviewProps) {
  const { getTheme, getPieceUrl, selectedPieceSet } = useBoardStore()
  const theme = getTheme()

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
      />
    </div>
  )
}
