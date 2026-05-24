import { BOARD_EMOJI_FILES, getEmojiUrl } from '@/lib/emojis'

interface ReactionPickerProps {
  onSelect: (emojiUrl: string) => void
  onClose: () => void
}

export default function ReactionPicker({ onSelect, onClose }: ReactionPickerProps) {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 z-[240] animate-dropdown-in">
      <div 
        className="grid grid-cols-8 gap-1 p-1.5 shadow-[0_12px_24px_rgba(0,0,0,0.45)] backdrop-blur-md"
        style={{
          width: 'min(296px, calc(100vw - 32px))',
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
  )
}
