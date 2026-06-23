import { useMemo, useState, useRef, useCallback } from 'react'
import { Chessboard } from 'react-chessboard'
import { useBoardStore } from '@/stores/boardStore'
import { useReactionStore } from '@/stores/reactionStore'
import type { EngineAPI } from '@/lib/engine'

interface ChessBoardProps {
  game?: EngineAPI | any
  position?: string
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
  gameOverGray?: boolean
  arePiecesDraggable?: boolean
  customSquareStyles?: Record<string, React.CSSProperties>
  customCursor?: string
  onSquareMouseEnter?: (square: string) => void
  onSquareMouseLeave?: () => void
  bombs?: string[]
}

const BASE = import.meta.env.BASE_URL || '/'

export default function ChessBoard({
  game,
  position,
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
  gameOverGray,
  arePiecesDraggable = true,
  customSquareStyles = {},
  customCursor,
  onSquareMouseEnter,
  onSquareMouseLeave,
  bombs = [],
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

  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const handleTouchStart = useCallback((square: string, e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    longPressTimer.current = setTimeout(() => {
      e.preventDefault()
      if (onReactionSquare) {
        onReactionSquare(square, touch.clientX, touch.clientY)
      }
      touchStartRef.current = null
    }, 500)
  }, [onReactionSquare])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    touchStartRef.current = null
  }, [])

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    touchStartRef.current = null
  }, [])

  // Moves for SELECTED piece (click-to-move)
  const selectedMoveDetails = useMemo(() => {
    if (!selectedSquare || !game?.moves) return []
    try {
      return game.moves({ square: selectedSquare as any, verbose: true })
    } catch {
      return []
    }
  }, [game, selectedSquare])

  // Moves for HOVERED piece (preview) — disabled when a piece is selected
  const hoveredMoveDetails = useMemo(() => {
    if (!hoveredSquare || selectedSquare || !game?.moves) return []
    try {
      return game.moves({ square: hoveredSquare as any, verbose: true })
    } catch {
      return []
    }
  }, [game, hoveredSquare, selectedSquare])

  // Active moves: priority = selected > hover
  const activeMoveDetails = selectedSquare ? selectedMoveDetails : hoveredMoveDetails
  const isCheckmate = game?.isCheckmate ? game.isCheckmate() : false
  const isGameOver = game?.isGameOver ? game.isGameOver() : false

  // Pre-compute sets/maps for fast lookup in customSquare
  const moveSet = useMemo(() => new Set(activeMoveDetails.map((m: any) => m.to)), [activeMoveDetails])
  const captureSet = useMemo(() => new Set(
    activeMoveDetails.filter((m: any) => m.flags.includes('c') || m.flags.includes('e')).map((m: any) => m.to)
  ), [activeMoveDetails])
  const endGameEmojiMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of endGameEmojis) map.set(e.square, e.url)
    return map
  }, [endGameEmojis])
  const reactionEmojiMap = useMemo(() => {
    const map = new Map<string, { emojiUrl: string; id: string }>()
    for (const r of reactionEmojis) map.set(r.square, { emojiUrl: r.emojiUrl, id: r.id })
    return map
  }, [reactionEmojis])

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

  const customSquare = useCallback(({ square, children, style }: { square: string; children: React.ReactNode; style: Record<string, string | number> }) => {
    const isSquareVisible = !visibleSquares || visibleSquares.includes(square)

    const fileIdx = square.charCodeAt(0) - 97
    const rankIdx = 8 - parseInt(square[1], 10)
    const x = boardOrientation === 'black' ? 7 - fileIdx : fileIdx
    const y = boardOrientation === 'black' ? 7 - rankIdx : rankIdx
    const bgX = (x / 11) * 100
    const bgY = (y / 11) * 100

    const isActiveMove = moveSet.has(square) && isSquareVisible
    const isActiveCapture = captureSet.has(square) && isSquareVisible
    const isSelected = selectedSquare === square && isSquareVisible
    const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square) && isSquareVisible
    const isCheck = checkSquare === square && isSquareVisible

    const endGameUrl = endGameEmojiMap.get(square)
    const reactionEmoji = reactionEmojiMap.get(square)

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
          if (isGameOver) return
          const piece = game?.get ? game.get(square as any) : null
          if (piece) setHoveredSquare(square)
          onSquareMouseEnter?.(square)
        }}
        onMouseLeave={() => {
          setHoveredSquare(null)
          onSquareMouseLeave?.()
        }}
        onContextMenu={(e) => handleContextMenu(square, e)}
        onTouchStart={(e) => handleTouchStart(square, e)}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            transform: (defeatedKingSquare === square || (isCheckmate && isCheck)) ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.8s ease-in-out',
            transformOrigin: 'center center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
            opacity: isSquareVisible ? 1 : 0
          }}
        >
          {children}
        </div>

        <div
          className="absolute inset-0 z-10 pointer-events-none transition-opacity duration-700 ease-in-out"
          style={{
            backgroundColor: '#1a1c2c',
            backgroundImage: `url(${BASE}engine/fog.svg)`,
            backgroundSize: '1200%',
            backgroundRepeat: 'repeat',
            backgroundPosition: `${bgX}% ${bgY}%`,
            backgroundBlendMode: 'overlay',
            filter: 'grayscale(1) contrast(1.1) brightness(0.9)',
            imageRendering: 'pixelated',
            opacity: isSquareVisible ? 0 : 1,
            display: visibleSquares ? 'block' : 'none'
          }}
        />

        {isActiveMove && !isActiveCapture && <div className="highlight-possible" />}
        {isActiveCapture && <div className="highlight-capture" />}

        {bombs.includes(square) && isSquareVisible && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="animate-pulse flex items-center justify-center" style={{ width: '45%', height: '45%', filter: 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.75))' }}>
              <img src={`${BASE}emojis/spells/bomb.png`} alt="bomb" className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
            </div>
          </div>
        )}

        {endGameUrl && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[60]">
            <div className="animate-bounce-subtle flex items-center justify-center" style={{ width: '60%', height: '60%', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}>
              <img src={endGameUrl} alt="endgame-status" className="w-full h-full object-contain" />
            </div>
          </div>
        )}

        {reactionEmoji && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="animate-bounce flex items-center justify-center" style={{ width: '45%', height: '45%' }}>
              <img src={reactionEmoji.emojiUrl} alt="reaction" className="w-full h-full object-contain" />
            </div>
          </div>
        )}
      </div>
    )
  }, [moveSet, captureSet, endGameEmojiMap, reactionEmojiMap, visibleSquares, boardOrientation, selectedSquare, lastMove, checkSquare, isGameOver, game, onSquareMouseEnter, onSquareMouseLeave, handleContextMenu, handleTouchStart, handleTouchEnd, handleTouchMove, defeatedKingSquare, isCheckmate, bombs])

  return (
    <div
      className="relative w-full h-full"
      style={{
        ...(gameOverGray ? { filter: 'grayscale(1) contrast(0.85) brightness(0.9)' } : {}),
        cursor: customCursor || 'inherit',
        '--board-highlight-possible': theme.highlightPossible,
        '--board-highlight-possible-shadow': theme.highlightPossibleShadow,
        '--board-highlight-capture': theme.highlightCapture,
        '--board-highlight-capture-shadow': theme.highlightCaptureShadow,
        '--board-highlight-selected': theme.highlightSelected,
      } as React.CSSProperties}
    >
      {customCursor && (
        <style>
          {`
            [id="GoChessBoardMain"] *, [id="GoChessBoardMain"] {
              cursor: ${customCursor} !important;
            }
          `}
        </style>
      )}
      <Chessboard
        id="GoChessBoardMain"
        position={position || game?.fen()}
        arePiecesDraggable={arePiecesDraggable}
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
        customSquareStyles={customSquareStyles}
        customSquare={customSquare}
      />
    </div>
  )
}
