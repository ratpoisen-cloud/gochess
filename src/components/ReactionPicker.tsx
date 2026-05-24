import { BOARD_EMOJI_FILES, getEmojiUrl } from '@/lib/emojis'

interface ReactionPickerProps {
  onSelect: (emojiUrl: string) => void
  onClose: () => void
}

export default function ReactionPicker({ onSelect, onClose }: ReactionPickerProps) {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[100] animate-dropdown-in">
      <div className="bg-[var(--bg)] border border-[color-mix(in_srgb,var(--accent-brand)_30%,var(--border))] rounded-[var(--radius-8)] p-2 shadow-2xl backdrop-blur-md">
        <div className="grid grid-cols-4 gap-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
          {BOARD_EMOJI_FILES.map((file) => {
            const url = getEmojiUrl(file)
            return (
              <button
                key={file}
                onClick={() => { onSelect(url); onClose() }}
                className="w-9 h-9 flex items-center justify-center hover:bg-[color-mix(in_srgb,var(--accent-brand)_20%,transparent)] rounded-[var(--radius-4)] transition-all hover:scale-110 active:scale-90"
              >
                <img 
                  src={url} 
                  alt="emoji" 
                  className="w-6 h-6 object-contain"
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
