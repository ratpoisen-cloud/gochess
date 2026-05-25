import { useRef, useLayoutEffect, useState } from 'react'
import { BOARD_EMOJI_FILES, getEmojiUrl } from '@/lib/emojis'

interface ReactionPickerProps {
  onSelect: (emojiUrl: string) => void
  onClose: () => void
  boardWidth?: number
  anchorX: number
  anchorY: number
}

export default function ReactionPicker({ onSelect, onClose, boardWidth, anchorX, anchorY }: ReactionPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  const pickerWidth = boardWidth ? Math.round(Math.min(boardWidth * 0.85, 400)) : 296

  useLayoutEffect(() => {
    const el = pickerRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const w = rect.width || pickerWidth
    const h = rect.height || 160
    const margin = 8
    const vw = window.innerWidth
    const vh = window.innerHeight

    const centerX = vw / 2
    const centerY = vh / 2

    // Horizontal: extend toward center
    const left = anchorX < centerX
      ? Math.max(margin, Math.min(anchorX, vw - w - margin))
      : Math.max(margin, Math.min(anchorX - w, vw - w - margin))

    // Vertical: extend toward center
    const top = anchorY < centerY
      ? Math.max(margin, Math.min(anchorY + margin, vh - h - margin))
      : Math.max(margin, Math.min(anchorY - h - margin, vh - h - margin))

    setPos({ left: Math.round(left), top: Math.round(top) })
  }, [anchorX, anchorY, pickerWidth])

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />
      <div
        ref={pickerRef}
        className="fixed z-[9999] animate-dropdown-in"
        style={{
          left: pos?.left ?? anchorX - pickerWidth / 2,
          top: pos?.top ?? anchorY,
          visibility: pos ? 'visible' : 'hidden',
        }}
      >
        <div
          className="grid grid-cols-8 gap-1 p-1.5"
          style={{
            width: pickerWidth,
            backgroundColor: 'rgba(18, 20, 18, 0.96)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 'var(--radius-14)',
          }}
        >
          {BOARD_EMOJI_FILES.map((file) => {
            const url = getEmojiUrl(file)
            return (
              <button
                key={file}
                onClick={() => { onSelect(url); onClose() }}
                className="aspect-square flex items-center justify-center transition-all hover:scale-110 active:scale-90"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '10px',
                  border: '1px solid transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(232, 232, 216, 0.55)'
                  e.currentTarget.style.backgroundColor = 'rgba(232, 232, 216, 0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'transparent'
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
                }}
              >
                <img
                  src={url}
                  alt="emoji"
                  className="w-[70%] h-[70%] object-contain"
                  loading="lazy"
                />
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
