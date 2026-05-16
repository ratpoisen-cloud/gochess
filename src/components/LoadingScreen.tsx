import { useEffect, useState } from 'react'

interface LoadingScreenProps {
  isLoading: boolean
  minimumDisplayTime?: number
}

export default function LoadingScreen({ isLoading, minimumDisplayTime = 1800 }: LoadingScreenProps) {
  const [isVisible, setIsVisible] = useState(isLoading)
  const [canHide, setCanHide] = useState(false)

  useEffect(() => {
    if (isLoading) {
      setIsVisible(true)
      setCanHide(false)

      const timer = setTimeout(() => {
        setCanHide(true)
      }, minimumDisplayTime)

      return () => clearTimeout(timer)
    } else {
      if (canHide) {
        setIsVisible(false)
      }
    }
  }, [isLoading, minimumDisplayTime, canHide])

  if (!isVisible) return null

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      style={{
        background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.035) 0%, transparent 46%), radial-gradient(circle at 50% 100%, rgba(163,193,143,0.04) 0%, transparent 42%), linear-gradient(180deg, color-mix(in srgb, var(--bg) 88%, #0a0d0b), var(--bg) 72%), var(--bg)',
      }}
    >
      <div
        className="text-center rounded-[var(--radius-24)] p-[var(--space-32)] border border-[color-mix(in_srgb,var(--accent)_34%,var(--border))]"
        style={{
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--modal-bg) 96%, #1f241f), var(--modal-bg))',
          boxShadow: '0 20px 48px rgba(0,0,0,0.52), inset 0 1px 0 rgba(232,232,216,0.04)',
          maxWidth: 'min(92vw, 380px)',
          width: '90%',
        }}
      >
        <h1 className="text-[var(--font-size-xl)] font-semibold mb-[var(--space-8)] text-text tracking-[0.03em]">
          GoChess
        </h1>
        <p className="text-text-secondary text-[var(--font-size-xs)] mb-[var(--space-24)]">
          Go shakhmaty
        </p>

        <div className="flex justify-center gap-[var(--space-8)] mb-[var(--space-20)]">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-[10px] h-[10px] rounded-sm bg-accent"
              style={{
                animation: `loadingDotPulse 0.9s steps(3, end) ${i * 0.15}s infinite`,
              }}
            />
          ))}
        </div>

        <p
          className="text-text-secondary text-[var(--font-size-sm)] animate-loading-text-blink"
          style={{
            animation: 'loadingTextBlink 1.4s steps(2, end) infinite',
          }}
        >
          Загрузка...
        </p>
      </div>
    </div>
  )
}
