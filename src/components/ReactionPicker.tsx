const EMOJIS = ['😄', '😎', '🔥', '💀', '😱', '🥶', '💪', '😅', '😢', '👀', '🎉', '😤', '🤝', '♟️', '⭐', '❤️']

interface ReactionPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
}

export default function ReactionPicker({ onSelect, onClose }: ReactionPickerProps) {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[100]">
      <div className="bg-[var(--bg)] border border-[color-mix(in_srgb,var(--accent-brand)_30%,var(--border))] rounded-[var(--radius-8)] p-2">
        <div className="grid grid-cols-6 gap-1">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => { onSelect(emoji); onClose() }}
              className="w-7 h-7 flex items-center justify-center text-sm hover:bg-[color-mix(in_srgb,var(--accent-brand)_20%,transparent)] rounded-[var(--radius-4)] transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
