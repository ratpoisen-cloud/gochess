import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import AuthModal from '@/components/AuthModal'
import UserMenu from '@/components/UserMenu'
import LoadingScreen from '@/components/LoadingScreen'
import ColorPickerModal from '@/components/ColorPickerModal'
import BoardPreview from '@/components/board/BoardPreview'
import Footer from '@/components/Footer'

const BASE = import.meta.env.BASE_URL || '/'

interface HubTileProps {
  to: string
  icon: string
  title: string
  description: string
  variant?: 'primary' | 'secondary' | 'muted'
}
function HubTile({ to, icon, title, description, variant = 'secondary' }: HubTileProps) {
  const isPrimary = variant === 'primary'

  return (
    <Link
      to={to}
      className={`group flex flex-col items-center justify-center min-h-[230px] p-[28px_20px] rounded-[var(--radius-8)] pixel-tile ${isPrimary ? 'pixel-tile-primary' : ''}`}
    >
      <div className="mb-[var(--space-20)] flex items-center justify-center transform transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1">
        <img 
          src={`${BASE}emojis/${icon}.png`} 
          alt={title}
          className="w-[96px] h-[96px] object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.4)]"
          style={{ 
            imageRendering: 'pixelated',
          }}
        />
      </div>
      <h3 className="text-[var(--font-size-sm)] font-bold mb-[var(--space-10)] text-center transition-colors duration-200 group-hover:text-white">
        {title}
      </h3>
      <p className="text-text-secondary text-[11px] text-center leading-[1.6] max-w-[170px] opacity-60 group-hover:opacity-100 transition-opacity">
        {description}
      </p>
    </Link>
  )
}

export default function LobbyPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [recentGames, setRecentGames] = useState<any[]>([])

  useEffect(() => {
    if (!user || !supabase) {
      setRecentGames([])
      return
    }
    supabase
      .from('games')
      .select('*')
      .or(`white_player_id.eq.${user.uid},black_player_id.eq.${user.uid}`)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setRecentGames(data)
      })
    }, [user])

    const handleGameClick = (game: any) => {
    if (game.game_type === 'online' && game.room_code) {
      navigate(`/game/${game.room_code}`)
    }
    }

    useEffect(() => {
    // Simulate initial app load for the cool splash screen effect
    const timer = setTimeout(() => {
      setInitialLoading(false)
    }, 1200)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-[100dvh] flex flex-col bg-bg">
      <LoadingScreen isLoading={initialLoading} />
      
      <header className="px-[var(--space-24)] py-[var(--space-32)] bg-bg">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <Link to="/" className="text-[var(--font-size-sm)] font-bold tracking-[0.02em] uppercase no-underline">
            <span className="text-[var(--accent-brand)]">го</span> шахматы
          </Link>
          <div className="flex items-center gap-[var(--space-12)] md:gap-[var(--space-20)]">
            <div className="flex items-center gap-[var(--space-16)]">
              <button 
                onClick={() => navigate('/settings')}
                className="p-1 text-text-secondary hover:text-text transition-all duration-200 active:scale-95 flex items-center"
                title="Настройки"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                  <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84a.483.483 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.488.488 0 0 0-.59.22L3.05 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                </svg>
              </button>
              {user ? (
                <UserMenu />
              ) : (
                <button 
                  onClick={() => setIsAuthModalOpen(true)}
                  className="text-[10px] font-bold text-text-secondary hover:text-text transition-colors px-2 uppercase tracking-widest"
                  style={{ fontFamily: 'var(--font-family-ui)' }}
                >
                  Войти
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-[var(--space-24)] pb-[var(--space-64)] flex-1 w-full flex flex-col justify-center gap-[10vh] md:gap-[12vh]">

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[var(--space-24)] md:gap-[var(--space-32)]">
          <button
            onClick={() => {
              if (user) {
                setIsColorPickerOpen(true)
              } else {
                setIsAuthModalOpen(true)
              }
            }}
            className="group flex flex-col items-center justify-center min-h-[230px] p-[28px_20px] rounded-[var(--radius-8)] pixel-tile cursor-pointer text-left w-full"
          >
            <div className="mb-[var(--space-20)] flex items-center justify-center transform transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1">
              <img 
                src={`${BASE}emojis/multi_new.png`} 
                alt="По сети"
                className="w-[96px] h-[96px] object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            <h3 className="text-[var(--font-size-sm)] font-bold mb-[var(--space-10)] text-center transition-colors duration-200 group-hover:text-white">
              По сети
            </h3>
            <p className="text-text-secondary text-[11px] text-center leading-[1.6] max-w-[170px] opacity-60 group-hover:opacity-100 transition-opacity">
              Пригласи друга по ссылке и играй онлайн
            </p>
          </button>

          <HubTile
            to="/bot"
            icon="bot_new"
            title="Против Бота"
            description="Оттачивай мастерство на 3 уровнях сложности"
            variant="secondary"
          />
          <HubTile
            to="/local"
            icon="local_new"
            title="За одним ПК"
            description="Классическая игра вдвоем на одном устройстве"
            variant="secondary"
          />
        </section>

        {user && recentGames.length > 0 && (
          <section className="mt-[var(--space-48)]">
            <h3 className="text-[var(--font-size-sm)] font-bold text-text mb-[var(--space-20)] uppercase tracking-widest text-center">
              Последние партии
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-16)] max-w-[900px] mx-auto">
              {recentGames.map((g) => {
                const isOnline = g.game_type === 'online'
                const isActive = g.game_state !== 'game_over'
                
                return (
                  <div 
                    key={g.id} 
                    onClick={() => handleGameClick(g)}
                    className={`p-[var(--space-12)] rounded-[var(--radius-8)] pixel-tile transition-all duration-200 flex gap-[var(--space-16)] items-center ${
                      isOnline && isActive 
                        ? 'cursor-pointer active:scale-[0.98]' 
                        : ''
                    }`}
                  >
                    <div className="shrink-0">
                      <BoardPreview 
                        fen={g.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'} 
                        size={100} 
                        orientation={g.black_player_id === user.uid ? 'black' : 'white'}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-[var(--space-4)]">
                        <span className="text-[var(--font-size-xs)] text-text flex items-center gap-2 truncate font-bold">
                          {isOnline && isActive && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-brand)] animate-pulse" title="Активная игра" />}
                          {g.white_name} vs {g.black_name}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                          g.winner === 'white' ? 'text-text' : g.winner === 'black' ? 'text-text-secondary' : 'text-[var(--text-secondary)]'
                        }`}>
                          {g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : '½-½'}
                        </span>
                      </div>
                      
                      <div className="text-[9px] text-text-secondary flex flex-wrap items-center gap-x-[var(--space-12)] gap-y-[var(--space-4)]">
                        <span>
                          {g.game_type === 'bot' ? '🤖 Бот' : g.game_type === 'local' ? '🎮 Локальная' : ''}
                        </span>
                        <span>{new Date(g.created_at).toLocaleDateString()}</span>
                        {g.message && <span className="capitalize text-[var(--accent-brand)]">{g.message}</span>}
                        {isOnline && isActive && (() => {
                          const currentUid = user?.uid
                          const whiteId = g.white_player_id
                          const blackId = g.black_player_id
                          const turn = (g.turn || 'w').toLowerCase()
                          
                          const isMyTurn = (turn === 'w' && currentUid === whiteId) || 
                                           (turn === 'b' && currentUid === blackId)
                          
                          return (
                            <span className={`font-bold ${
                              isMyTurn 
                                ? 'text-[var(--accent-brand)] animate-pulse' 
                                : 'text-[var(--text)] opacity-60'
                            }`}>
                              {isMyTurn ? 'Ваш ход' : 'Ход соперника'}
                            </span>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

      </main>

      <Footer />

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <ColorPickerModal isOpen={isColorPickerOpen} onClose={() => setIsColorPickerOpen(false)} />
    </div>
  )
}
