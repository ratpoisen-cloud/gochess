import { useState, useEffect, useRef } from 'react'

interface ChessTimerProps {
  timeLeft: number         // in ms
  isActive: boolean        // is it this player's turn
  label: string            // player name or "You"
  increment?: number       // in seconds
  onTimeout?: () => void   // callback when timer hits zero
}

export default function ChessTimer({ 
  timeLeft, 
  isActive, 
  label, 
  increment = 0,
  onTimeout
}: ChessTimerProps) {
  const [localTime, setLocalTime] = useState(timeLeft)
  const lastTickRef = useRef(Date.now())
  const hasTimedOut = useRef(false)

  // Sync with prop when it changes
  useEffect(() => {
    setLocalTime(timeLeft)
    lastTickRef.current = Date.now()
    if (timeLeft > 0) hasTimedOut.current = false
  }, [timeLeft])

  // Tick local time if active
  useEffect(() => {
    if (!isActive || localTime <= 0) return

    const interval = setInterval(() => {
      const now = Date.now()
      const delta = now - lastTickRef.current
      lastTickRef.current = now
      
      setLocalTime(prev => {
        const next = Math.max(0, prev - delta)
        if (next === 0 && !hasTimedOut.current) {
          hasTimedOut.current = true
          onTimeout?.()
        }
        return next
      })
    }, 100)

    return () => clearInterval(interval)
  }, [isActive, localTime, onTimeout])

  const formatTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const isWarning = localTime < 60000
  const isCritical = localTime < 10000

  return (
    <div className={`flex items-center justify-between w-full px-[var(--space-12)] py-[var(--space-8)] rounded-[var(--radius-8)] border transition-all duration-300 ${
      isActive 
        ? 'bg-[rgba(126,184,126,0.1)] border-[var(--accent-brand)] shadow-[0_0_15px_rgba(126,184,126,0.05)]' 
        : 'bg-[rgba(0,0,0,0.2)] border-[var(--border)] opacity-60'
    }`}>
      <div className="flex flex-col">
        <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${
          isActive ? 'text-[var(--accent-brand)]' : 'text-text-secondary'
        }`}>
          {label}
        </span>
        {increment > 0 && (
          <span className="text-[8px] text-text-secondary opacity-50">
            +{increment}s
          </span>
        )}
      </div>

      <div className={`font-mono text-[16px] font-bold tracking-tighter ${
        isCritical ? 'text-[var(--danger)] animate-pulse' : 
        isWarning ? 'text-[var(--warning)]' : 
        isActive ? 'text-[var(--accent-brand)]' : 'text-text'
      }`} style={{ fontFamily: 'var(--font-family-ui)' }}>
        {formatTime(localTime)}
      </div>
    </div>
  )
}
