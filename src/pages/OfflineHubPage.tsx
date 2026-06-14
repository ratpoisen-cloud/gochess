import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '@/components/Button'
import UserMenu from '@/components/UserMenu'
import SettingsDropdown from '@/components/SettingsDropdown'
import Footer from '@/components/Footer'
import { useAuth } from '@/hooks/useAuth'

const BASE = import.meta.env.BASE_URL || '/'

export default function OfflineHubPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Typing animation state
  const [displayedChars, setDisplayedChars] = useState(0)
  const fullText = "ИГРАЙ ОФФЛАЙН!"

  useEffect(() => {
    let timer: any
    if (displayedChars < fullText.length) {
      timer = setTimeout(() => {
        setDisplayedChars(prev => prev + 1)
      }, 60)
    }
    return () => clearTimeout(timer)
  }, [displayedChars])

  const ModeTile = ({ to, title, icon, description }: { to: string, title: string, icon: string, description: string }) => (
    <Link
      to={to}
      className="group relative flex flex-col items-center justify-center min-h-[230px] p-[28px_20px] rounded-[var(--radius-8)] pixel-tile cursor-pointer text-left w-full transition-all duration-300"
    >
      <div className="mb-[var(--space-20)] flex items-center justify-center transform transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1">
        <img 
          src={`${BASE}emojis/online/${icon}`} 
          alt={title}
          className="w-[96px] h-[96px] object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
      <h3 className="text-[var(--font-size-sm)] font-bold mb-[var(--space-10)] text-center transition-colors duration-200 group-hover:text-white uppercase tracking-widest">
        {title}
      </h3>
      <p className="text-text-secondary text-[11px] text-center leading-[1.6] max-w-[170px] opacity-60 group-hover:opacity-100 transition-opacity">
        {description}
      </p>
    </Link>
  )

  return (
    <div className="min-h-[100dvh] flex flex-col bg-bg">
      <header className="px-[var(--space-24)] max-sm:px-[var(--space-8)] py-[var(--space-32)] max-sm:py-[var(--space-16)] bg-bg">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-[var(--space-12)]">
          <Link to="/">
            <img
              src={`${BASE}logo/gochess_wordmark_dark.svg`}
              alt="GoChess"
              className="h-[28px] w-auto"
            />
          </Link>
          <div className="flex items-center gap-[var(--space-12)]">
            <SettingsDropdown />
            {user && <UserMenu />}
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-[var(--space-24)] max-sm:px-[var(--space-8)] py-[var(--space-48)] max-sm:py-[var(--space-24)] flex-1 w-full">
        <div className="max-w-[1000px] mx-auto">
          {/* Typing Title */}
          <div className="text-center mb-[var(--space-64)] h-[80px] flex items-center justify-center relative">
            <h2 className="text-[clamp(1.4rem,4vw,1.8rem)] font-bold text-text tracking-tight leading-[1.2] uppercase w-full">
              {displayedChars > 0 && (
                <>
                  <span className="text-[var(--accent-brand)]">
                    {fullText.slice(0, Math.min(displayedChars, 5))}
                  </span>
                  {displayedChars > 5 && fullText.slice(5, displayedChars)}
                  {displayedChars < fullText.length ? (
                    <span className="animate-pulse ml-1 inline-block w-2 h-[1em] bg-[var(--accent-brand)] align-middle" />
                  ) : (
                    <span className="ml-1 inline-block w-2 h-[1em] bg-transparent align-middle" />
                  )}
                </>
              )}
            </h2>
          </div>

          {/* Mode Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[var(--space-20)] mb-[var(--space-48)]">
            <ModeTile 
              to="/local/classic" 
              title="Классика" 
              icon="classic.png" 
              description="Стандартные правила без ограничений по времени" 
            />
            <ModeTile 
              to="/local/rapid" 
              title="Рапид" 
              icon="rapid.png" 
              description="Быстрая игра с контролем времени" 
            />
            <ModeTile 
              to="/local/spell" 
              title="Магия" 
              icon="magic.png" 
              description="Битва с заклинаниями и взятием короля" 
            />
          </div>
          
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => navigate('/')}>
              Вернуться в лобби
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
