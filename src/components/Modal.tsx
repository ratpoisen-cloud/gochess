import { ReactNode, useEffect } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children?: ReactNode
  maxWidth?: string
}

export default function Modal({ isOpen, onClose, title, description, children, maxWidth }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center animate-modal-overlay-in bg-black/60 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="animate-modal-pixel-in text-center text-[var(--font-size-sm)] leading-[1.55] rounded-[var(--radius-14)] p-[var(--space-24)] border border-[color-mix(in_srgb,var(--accent-brand)_20%,var(--border))] shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        style={{
          background: 'rgba(13, 13, 13, 0.95)',
          maxWidth: maxWidth || 'min(92vw, 360px)',
          width: '90%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 className="text-[var(--font-size-lg)] font-semibold mb-[var(--space-16)] text-text tracking-[0.008em] leading-[1.2]">
            {title}
          </h2>
        )}
        {description && (
          <p className="text-text-secondary mb-[var(--space-20)] leading-[1.55]">
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  )
}
