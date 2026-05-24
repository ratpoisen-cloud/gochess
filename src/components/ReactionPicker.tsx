import { BOARD_EMOJI_FILES, getEmojiUrl } from '@/lib/emojis'

interface ReactionPickerProps {
  onSelect: (emojiUrl: string) => void
  onClose: () => void
}

export default function ReactionPicker({ onSelect, onClose }: ReactionPickerProps) {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[100] animate-dropdown-in">
      <div className="bg-[var(--bg)] border border-[color-mix(in_srgb,var(--accent-brand)_30%,var(--border))] rounded-[var(--radius-8)] p-2 shadow-2xl">
        <div className="grid grid-cols-6 gap-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
          {BOARD_EMOJI_FILES.map((file) => {
            const url = getEmojiUrl(file)
            return (
              <button
                key={file}
                onClick={() => { onSelect(url); onClose() }}
                className="w-10 h-10 flex items-center justify-center hover:bg-[color-mix(in_srgb,var(--accent-brand)_20%,transparent)] rounded-[var(--radius-4)] transition-all hover:scale-110 active:scale-95"
              >
                <img 
                  src={url} 
                  alt="emoji" 
                  className="w-8 h-8 object-contain"
                  loading="lazy"
                />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
