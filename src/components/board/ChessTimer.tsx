import { useState, useEffect, useRef } from 'react'

interface ChessTimerProps {
  timeLeft: number         // in ms
  isActive: boolean        // is it this player's turn
  label: string            // player name or "You"
  increment?: number       // in seconds
  onTimeout?: () => void   // callback when timer hits zero
  /**
   * Controlled mode: no internal ticker — the parent owns the clock
   * (local rapid: increments, resets and undo all live there). The
   * default (false) keeps the online model: value from a Firestore
   * snapshot, smoothed locally between updates.
   */
  controlled?: boolean
}

export default function ChessTimer({ 
  timeLeft, 
  isActive, 
  label, 
  increment = 0,
  onTimeout,
  controlled = false,
}: ChessTimerProps) {
  const [localTime, setLocalTime] = useState(timeLeft)
  const lastTickRef = useRef(Date.now())
  const hasTimedOut = useRef(false)
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout

  // Sync with prop when it changes
  useEffect(() => {
    if (controlled) return
    setLocalTime(timeLeft)
    lastTickRef.current = Date.now()
    if (timeLeft > 0) hasTimedOut.current = false
  }, [timeLeft, controlled])

  // Controlled: parent decrements the prop; just watch it for zero.
  useEffect(() => {
    if (!controlled) return
    if (timeLeft <= 0 && isActive && !hasTimedOut.current) {
      hasTimedOut.current = true
      onTimeoutRef.current?.()
    }
    if (timeLeft > 0) hasTimedOut.current = false
  }, [controlled, timeLeft, isActive])

  // Tick local time if active
  useEffect(() => {
    if (controlled || !isActive) return

    // Re-base the ticker when the clock starts running. The effect above only
    // fires when `timeLeft` changes, and the opponent's move writes only their
    // own key (useGameTimer.buildTimerUpdate), so our `timeLeft` prop stays the
    // same while the opponent thinks. Without this reset the first tick would
    // subtract the opponent's whole thinking time from our clock, compounding
    // on every move and losing the game on time long before the real one.
    lastTickRef.current = Date.now()

    const interval = setInterval(() => {
      const now = Date.now()
      const delta = now - lastTickRef.current
      lastTickRef.current = now
      setLocalTime(prev => {
        const next = Math.max(0, prev - delta)
        if (next === 0 && !hasTimedOut.current) {
          hasTimedOut.current = true
          onTimeoutRef.current?.()
        }
        return next
      })
    }, 100)

    return () => clearInterval(interval)
  }, [isActive, controlled])

  const formatTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const displayTime = controlled ? timeLeft : localTime
  const isWarning = displayTime < 60000
  const isCritical = displayTime < 10000

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
        {formatTime(displayTime)}
      </div>
    </div>
  )
}
