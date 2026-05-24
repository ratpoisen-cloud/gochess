import { useState, useRef, useEffect } from 'react'

interface Option {
  value: string
  label: string
}

interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: Option[]
  className?: string
}

export default function CustomSelect({ value, onChange, options, className = "" }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const selectedOption = options.find(opt => opt.value === value) || options[0]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-[10px] font-bold text-text-secondary hover:text-text transition-colors uppercase tracking-widest focus:outline-none"
        style={{ fontFamily: 'var(--font-family-ui)' }}
      >
        <span>{selectedOption.label}</span>
        <svg 
          viewBox="0 0 24 24" 
          className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          strokeWidth="3" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 mt-4 w-48 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-8)] overflow-hidden z-[100] animate-dropdown-in"
        >
          <div className="py-2">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={`
                  w-full text-left px-5 py-3 text-[10px] uppercase tracking-widest transition-colors
                  ${value === option.value 
                    ? 'text-text bg-white/10 font-bold' 
                    : 'text-text-secondary hover:text-text hover:bg-white/10'}
                `}
                style={{ fontFamily: 'var(--font-family-ui)' }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
