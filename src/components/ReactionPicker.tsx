import { useLayoutEffect, useRef, useState } from 'react'
import { BOARD_EMOJI_FILES, getEmojiUrl } from '@/lib/emojis'

interface ReactionPickerProps {
  anchorX: number
  anchorY: number
  boardWidth: number
  onSelect: (emojiUrl: string) => void
  onClose: () => void
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export default function ReactionPicker({ anchorX, anchorY, boardWidth, onSelect, onClose }: ReactionPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  const margin = 8
  const pickerWidth = Math.min(boardWidth * 0.85, 400)

  useLayoutEffect(() => {
    const el = pickerRef.current
    if (!el) return

    el.style.visibility = 'hidden'
    el.style.left = '0'
    el.style.top = '0'

    const rect = el.getBoundingClientRect()
    const height = rect.height

    const left = anchorX < window.innerWidth / 2
      ? clamp(margin, anchorX, window.innerWidth - pickerWidth - margin)
      : clamp(margin, anchorX - pickerWidth, window.innerWidth - pickerWidth - margin)

    const top = anchorY < window.innerHeight / 2
      ? clamp(margin, anchorY + margin, window.innerHeight - height - margin)
      : clamp(margin, anchorY - height - margin, window.innerHeight - height - margin)

    el.style.visibility = 'visible'
    setPos({ left, top })
  }, [anchorX, anchorY, pickerWidth])

  return (
    <>
      <div
        className="fixed inset-0 z-[9998]"
        onClick={onClose}
      />
      <div
        ref={pickerRef}
        className="fixed z-[9999] animate-dropdown-in"
        style={{
          left: pos?.left ?? anchorX,
          top: pos?.top ?? anchorY,
          visibility: pos ? 'visible' : 'hidden',
          width: pickerWidth,
        }}
      >
        <div
          className="bg-[var(--bg)] border border-[color-mix(in_srgb,var(--accent-brand)_30%,var(--border))] rounded-[var(--radius-8)] p-2 shadow-lg"
        >
          <div className="grid grid-cols-8 gap-1 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
            {BOARD_EMOJI_FILES.map((file) => {
              const url = getEmojiUrl(file)
              return (
                <button
                  key={file}
                  onClick={() => { onSelect(url); onClose() }}
                  className="aspect-square flex items-center justify-center hover:bg-[color-mix(in_srgb,var(--accent-brand)_20%,transparent)] rounded-[var(--radius-4)] transition-all hover:scale-110 active:scale-95"
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
      </div>
    </>
  )
}
