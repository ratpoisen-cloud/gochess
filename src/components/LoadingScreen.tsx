import { useEffect, useState } from 'react'

interface LoadingScreenProps {
  isLoading: boolean
}

export default function LoadingScreen({ isLoading }: LoadingScreenProps) {
  const [shouldRender, setShouldRender] = useState(isLoading)
  const [isFading, setIsFading] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setIsFading(true)
      const timer = setTimeout(() => {
        setShouldRender(false)
        setIsFading(false)
      }, 500) // Match transition duration
      return () => clearTimeout(timer)
    } else {
      setShouldRender(true)
      setIsFading(false)
    }
  }, [isLoading])

  if (!shouldRender) return null

  return (
    <div
      className={`fixed inset-0 z-[2000] flex items-center justify-center p-6 transition-opacity duration-500 ease-in-out bg-[#050607] ${isFading ? 'opacity-0' : 'opacity-100'}`}
    >
      <div
        className="w-[min(92vw,420px)] p-[32px_24px] rounded-[var(--radius-8)] text-center"
        style={{
          background: 'var(--bg)',
        }}
      >
        <h1 className="text-[1.2rem] font-bold m-0 leading-none text-[var(--accent-brand)] tracking-[0.2em] uppercase">
          Go Chess
        </h1>
        <p 
          className="mt-3 text-[0.65rem] text-text-secondary leading-tight uppercase tracking-widest opacity-60 animate-[loadingSubtitlePulse_1.1s_steps(2,end)_infinite]"
        >
          Premium Pixel Edition
        </p>

        <p 
          className="mt-6 text-[0.72rem] text-text animate-[loadingTextBlink_1.4s_steps(2,end)_infinite]"
        >
          Загрузка…
        </p>

        <div className="mt-5 inline-grid grid-flow-col gap-2.5 justify-center">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="w-2.5 h-2.5 bg-[var(--accent-brand)] shadow-[0_0_10px_color-mix(in_srgb,var(--accent-brand)_30%,transparent)] animate-[app-loading-pixel-steps_1s_steps(4,end)_infinite]"
              style={{
                animationDelay: `${i * 0.12}s`,
              }}
            />
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes app-loading-pixel-steps {
          0%, 100% {
            transform: translateY(0);
            opacity: 0.2;
          }
          50% {
            transform: translateY(-4px);
            opacity: 1;
            background: var(--accent-brand);
            box-shadow: 0 0 15px color-mix(in_srgb,var(--accent-brand)_40%,transparent);
          }
        }
        @keyframes loadingTextBlink {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes loadingSubtitlePulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}} />
    </div>
  )
}
