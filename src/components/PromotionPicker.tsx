import { useBoardStore } from '@/stores/boardStore'
import type { Color } from '@/types'

interface PromotionPickerProps {
  to: string
  color: Color
  onSelect: (piece: 'q' | 'r' | 'b' | 'n') => void
  onCancel: () => void
}

export default function PromotionPicker({ to, color, onSelect, onCancel }: PromotionPickerProps) {
  const { getPieceUrl } = useBoardStore()
  const col = to[0].charCodeAt(0) - 97
  const rank = parseInt(to[1])
  let leftIdx = col
  let isAtTop = rank === 8
  if (color === 'b') {
    leftIdx = 7 - col
    isAtTop = rank === 1
  }

  return (
    <div className="absolute inset-0 z-[100] cursor-default bg-black/10" onClick={onCancel}>
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
          const code = `${color}${piece.toUpperCase()}` as const
          return (
            <button
              key={piece}
              onClick={() => onSelect(piece)}
              className="flex-1 flex items-center justify-center transition-colors group"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(232, 232, 216, 0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)' }}
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
}
