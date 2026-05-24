import { useState, useRef, useEffect } from 'react'
import { useBoardStore, BOARD_THEMES, PIECE_SETS } from '@/stores/boardStore'

const BASE = import.meta.env.BASE_URL || '/'

export default function SettingsDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { selectedTheme, selectedPieceSet, setSelectedTheme, setSelectedPieceSet } = useBoardStore()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 text-text-secondary hover:text-text transition-all duration-200 active:scale-95 flex items-center"
        title="Настройки"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84a.483.483 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.488.488 0 0 0-.59.22L3.05 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[320px] bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-8)] z-50 animate-dropdown-in">
          <div className="p-[var(--space-16)]">
            <h3 className="text-[var(--font-size-sm)] font-semibold mb-[var(--space-12)] text-[var(--accent-brand)]">Тема доски</h3>
            <div className="grid grid-cols-3 gap-[var(--space-8)] mb-[var(--space-16)]">
              {Object.values(BOARD_THEMES).map((theme) => {
                const isActive = selectedTheme === theme.id
                return (
                  <button
                    key={theme.id}
                    onClick={() => setSelectedTheme(theme.id)}
                    className={`flex flex-col items-center gap-[var(--space-8)] p-[var(--space-8)] rounded-[var(--radius-4)] border transition-colors ${
                      isActive
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                        : 'border-[var(--border)] hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--border))]'
                    }`}
                  >
                    <div className="grid grid-cols-2 w-[48px] h-[48px] rounded-[var(--radius-4)] overflow-hidden">
                      <div style={{ backgroundColor: theme.whiteSquare }} />
                      <div style={{ backgroundColor: theme.blackSquare }} />
                      <div style={{ backgroundColor: theme.blackSquare }} />
                      <div style={{ backgroundColor: theme.whiteSquare }} />
                    </div>
                    <span className="text-[9px] text-text-secondary">{theme.label}</span>
                  </button>
                )
              })}
            </div>

            <h3 className="text-[var(--font-size-sm)] font-semibold mb-[var(--space-12)] text-[var(--accent-brand)]">Набор фигур</h3>
            <div className="grid grid-cols-2 gap-[var(--space-8)]">
              {Object.values(PIECE_SETS).map((pieceSet) => {
                const isActive = selectedPieceSet === pieceSet.id
                return (
                  <button
                    key={pieceSet.id}
                    onClick={() => setSelectedPieceSet(pieceSet.id)}
                    className={`flex flex-col items-center gap-[var(--space-8)] p-[var(--space-8)] rounded-[var(--radius-4)] border transition-colors ${
                      isActive
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                        : 'border-[var(--border)] hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--border))]'
                    }`}
                  >
                    <div className="grid grid-cols-2 gap-[2px] w-[48px] h-[48px]">
                      {['wK', 'bK', 'wQ', 'bQ'].map((code) => (
                        <div
                          key={code}
                          className="flex items-center justify-center rounded-[2px]"
                          style={{ backgroundColor: code[0] === 'w' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.2)' }}
                        >
                          <img
                            src={`${BASE}pieces/${pieceSet.id}/${code}.svg`}
                            alt={code}
                            className="w-[20px] h-[20px]"
                            draggable={false}
                          />
                        </div>
                      ))}
                    </div>
                    <span className="text-[9px] text-text-secondary">{pieceSet.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
