import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import AuthModal from '@/components/AuthModal'
import UserMenu from '@/components/UserMenu'
import Button from '@/components/Button'

const BASE = import.meta.env.BASE_URL || '/'

interface HubTileProps {
  to: string
  icon: string
  title: string
  description: string
  variant?: 'primary' | 'secondary' | 'muted'
}

function HubTile({ to, icon, title, description, variant = 'secondary' }: HubTileProps) {
  const borderClasses = {
    primary: 'hover:border-accent group-hover:border-accent',
    secondary: 'hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--border))]',
    muted: 'opacity-60 hover:opacity-75',
  }

  const bgClasses = {
    primary: 'border-[color-mix(in_srgb,var(--accent)_20%,var(--border))] bg-[color-mix(in_srgb,var(--accent-soft)_50%,var(--card))]',
    secondary: 'border-[color-mix(in_srgb,var(--border)_80%,transparent)]',
    muted: 'border-[color-mix(in_srgb,var(--border)_80%,transparent)]',
  }

  const titleHoverClasses = {
    primary: 'group-hover:text-accent',
    secondary: 'group-hover:text-accent-hover',
    muted: '',
  }

  return (
    <Link
      to={to}
      className={`group block min-h-[142px] p-[18px_16px] rounded-[var(--radius-20)] border transition-[transform,box-shadow,border-color] duration-[0.2s] ease-[steps(3,end)] hover:translate-y-[-3px] hover:shadow-[0_14px_32px_rgba(0,0,0,0.28)] active:scale-[0.985] ${borderClasses[variant]} ${bgClasses[variant]}`}
      style={{
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--surface-elevated) 55%, var(--card)), color-mix(in srgb, var(--card) 94%, #151915))',
      }}
    >
      <div className="text-[2rem] mb-[var(--space-12)] text-center">{icon}</div>
      <h3 className={`text-[0.78rem] font-semibold mb-[var(--space-8)] text-center transition-colors duration-[0.14s] ease-[steps(2,end)] ${titleHoverClasses[variant]}`}>
        {title}
      </h3>
      <p className="text-text-secondary text-[var(--font-size-xs)] text-center leading-[1.5]">
        {description}
      </p>
    </Link>
  )
}

export default function LobbyPage() {
  const { user } = useAuth()
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="border-b border-[color-mix(in_srgb,var(--border)_60%,transparent)] px-[var(--space-20)] py-[var(--space-16)]">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-[var(--space-12)]">
            <img
              src={`${BASE}logo/gochess_wordmark_dark.svg`}
              alt="GoChess"
              className="h-[32px] w-auto"
            />
          </div>
          <div className="flex items-center gap-[var(--space-16)]">
            {user ? (
              <UserMenu />
            ) : (
              <Button variant="outline" size="sm" onClick={() => setIsAuthModalOpen(true)}>
                Войти
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-[var(--space-20)] py-[var(--space-32)] flex-1">
        <div className="text-center mb-[var(--space-32)]">
          <h2 className="text-[clamp(1.32rem,2.1vw,var(--font-size-xl))] font-bold mb-[var(--space-16)] text-text tracking-[0.008em] leading-[1.2]">
            Добро пожаловать в GoChess
          </h2>
          <p className="text-text-secondary text-[var(--font-size-md)]">
            Играй в шахматы с друзьями или против бота
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[var(--game-layout-gap)]">
          <HubTile
            to="/bot"
            icon="🤖"
            title="Играть с ботом"
            description="3 уровня сложности"
            variant="secondary"
          />
          <HubTile
            to="/game/new"
            icon="⚔️"
            title="Создать игру"
            description="Пригласи друга по ссылке"
            variant="primary"
          />
          <div className="group p-[18px_16px] rounded-[var(--radius-20)] border border-[color-mix(in_srgb,var(--border)_80%,transparent)] text-center opacity-60" style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--surface-elevated) 55%, var(--card)), color-mix(in srgb, var(--card) 94%, #151915))' }}>
            <div className="text-[2rem] mb-[var(--space-12)]">🎮</div>
            <h3 className="text-[0.78rem] font-semibold mb-[var(--space-8)]">Партии</h3>
            <p className="text-text-secondary text-[var(--font-size-xs)]">Скоро</p>
          </div>
          <div className="group p-[18px_16px] rounded-[var(--radius-20)] border border-[color-mix(in_srgb,var(--border)_80%,transparent)] text-center opacity-60" style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--surface-elevated) 55%, var(--card)), color-mix(in srgb, var(--card) 94%, #151915))' }}>
            <div className="text-[2rem] mb-[var(--space-12)]">👥</div>
            <h3 className="text-[0.78rem] font-semibold mb-[var(--space-8)]">Игроки</h3>
            <p className="text-text-secondary text-[var(--font-size-xs)]">Скоро</p>
          </div>
        </div>

        <div className="mt-[var(--space-32)] text-center">
          <div className="inline-block p-[var(--space-16)] rounded-[var(--radius-16)] border border-[color-mix(in_srgb,var(--border)_80%,transparent)]" style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--surface-elevated) 55%, var(--card)), color-mix(in srgb, var(--card) 94%, #151915))' }}>
            <p className="text-text-secondary text-[var(--font-size-xs)]">
              Проект инициализирован: React + Vite + Tailwind CSS
            </p>
          </div>
        </div>
      </main>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  )
}
