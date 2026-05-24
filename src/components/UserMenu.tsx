import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from './Toast'

export default function UserMenu() {
  const { user, signOut, uploadAvatar } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addToast } = useToast()

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      addToast('Можно загружать только изображения', 'error')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      addToast('Файл слишком большой. Максимум 5 MB', 'error')
      return
    }

    setIsUploading(true)
    try {
      await uploadAvatar(file)
      addToast('Аватар успешно обновлён', 'success')
      setIsOpen(false)
    } catch (err: any) {
      addToast('Ошибка загрузки: ' + (err.message || err), 'error')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const initials = user.displayName ? user.displayName.charAt(0).toUpperCase() : '?'

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-[var(--space-8)] p-[4px] rounded-[var(--radius-8)] hover:bg-[color-mix(in_srgb,var(--accent-brand)_15%,transparent)] transition-colors focus:outline-none"
      >
        <div className="relative w-[32px] h-[32px]">
          <div className="w-full h-full rounded-full overflow-hidden bg-[var(--bg)] flex items-center justify-center text-[var(--accent-brand)] font-bold text-[0.8rem] border border-[var(--border)]">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
            ) : (
              <span>{initials}</span>
            )}
          </div>
        </div>
        <span className="hidden sm:block text-[var(--font-size-sm)] font-medium text-text-secondary">
          {user.displayName}
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-[var(--space-8)] w-[260px] rounded-[var(--radius-8)] border border-[var(--border)] z-[100] animate-modal-pixel-in overflow-hidden"
          style={{ background: 'var(--bg)' }}
        >
          <div className="p-[var(--space-16)] border-b border-[var(--border)]">
            <div className="flex flex-col items-center gap-[var(--space-12)] mb-[var(--space-12)]">
              <div 
                className="group relative w-[64px] h-[64px] rounded-full overflow-hidden bg-[var(--bg)] flex items-center justify-center text-[var(--accent-brand)] font-bold text-[1.5rem] border-2 border-[var(--border)] cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover transition-opacity group-hover:opacity-40" />
                ) : (
                  <span>{initials}</span>
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <span className="text-[1.2rem]">📷</span>
                </div>
                {isUploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
            </div>
            <p className="text-[var(--font-size-sm)] font-bold text-text truncate text-center">
              {user.displayName}
            </p>
          </div>

          <div className="p-[var(--space-8)]">
            <Link
              to="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-[var(--space-12)] w-full p-[10px_12px] text-[var(--font-size-sm)] text-text-secondary hover:text-[var(--accent-brand)] hover:bg-[color-mix(in_srgb,var(--accent-brand)_15%,transparent)] rounded-[var(--radius-8)] transition-all"
            >
              Настройки
            </Link>
            <button
              onClick={() => {
                setIsOpen(false)
                signOut()
              }}
              className="flex items-center gap-[var(--space-12)] w-full p-[10px_12px] text-[var(--font-size-sm)] text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] rounded-[var(--radius-8)] transition-all mt-[4px]"
            >
              Выйти
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
