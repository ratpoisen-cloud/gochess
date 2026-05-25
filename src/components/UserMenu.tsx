import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function UserMenu() {
  const { user, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!user) return null

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-[var(--space-8)] p-[6px_12px] rounded-[var(--radius-8)] border border-[var(--border)] hover:border-[var(--accent-brand)] transition-colors focus:outline-none bg-[rgba(255,255,255,0.02)]"
      >
        <span className="text-[var(--font-size-sm)] font-bold text-text uppercase tracking-widest">
          {user.displayName}
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-[var(--space-8)] w-[200px] rounded-[var(--radius-8)] border border-[var(--border)] z-[100] animate-modal-pixel-in overflow-hidden shadow-2xl"
          style={{ background: 'var(--bg)' }}
        >
          <div className="p-[var(--space-12)] border-b border-[var(--border)] bg-[rgba(255,255,255,0.02)]">
            <p className="text-[var(--font-size-xs)] font-bold text-[var(--accent-brand)] uppercase tracking-widest text-center">
              Аккаунт
            </p>
          </div>

          <div className="p-[var(--space-8)]">
            <Link
              to="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-[var(--space-12)] w-full p-[10px_12px] text-[var(--font-size-sm)] text-text-secondary hover:text-[var(--accent-brand)] hover:bg-[color-mix(in_srgb,var(--accent-brand)_15%,transparent)] rounded-[var(--radius-8)] transition-all uppercase tracking-wider font-bold"
            >
              Настройки
            </Link>
            <button
              onClick={() => {
                setIsOpen(false)
                signOut()
              }}
              className="flex items-center gap-[var(--space-12)] w-full p-[10px_12px] text-[var(--font-size-sm)] text-[var(--danger)] hover:bg-[var(--danger-soft)] rounded-[var(--radius-8)] transition-all mt-[4px] uppercase tracking-wider font-bold"
            >
              Выйти
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
