import { useState, useEffect, useRef } from 'react'
import { BOARD_REACTIONS } from '@/stores/reactionStore'

interface ReactionPickerProps {
  square: string
  onSelect: (square: string, emoji: string) => void
  onClose: () => void
  boardRect: DOMRect | null
}

export default function ReactionPicker({ square, onSelect, onClose, boardRect }: ReactionPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  useEffect(() => {
    if (!boardRect) return

    const files = 'abcdefgh'
    const fileIndex = files.indexOf(square[0])
    const rank = parseInt(square[1], 10)

    const squareSize = boardRect.width / 8
    const squareLeft = boardRect.left + fileIndex * squareSize
    const squareTop = boardRect.top + (8 - rank) * squareSize

    const pickerWidth = 280
    const pickerHeight = 80

    let left = squareLeft + squareSize / 2 - pickerWidth / 2
    let top = squareTop - pickerHeight - 8

    if (top < boardRect.top) {
      top = squareTop + squareSize + 8
    }

    left = Math.max(boardRect.left + 8, Math.min(left, boardRect.right - pickerWidth - 8))

    setPosition({ top, left })
  }, [square, boardRect])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  return (
    <div
      ref={pickerRef}
      className="fixed z-[1100] rounded-[var(--radius-12)] p-[6px] border border-[color-mix(in_srgb,var(--border)_60%,transparent)] shadow-[0_10px_24px_rgba(0,0,0,0.4)]"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        background: 'var(--board-reaction-picker-bg, rgba(18, 20, 18, 0.96))',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="grid grid-cols-8 gap-[4px]">
        {BOARD_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(square, emoji)}
            className="w-[28px] h-[28px] flex items-center justify-center rounded-[6px] text-[16px] hover:bg-[var(--accent-soft)] transition-colors duration-[0.1s] ease-[steps(2,end)]"
            style={{
              background: 'var(--board-reaction-option-bg, rgba(255, 255, 255, 0.05))',
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
