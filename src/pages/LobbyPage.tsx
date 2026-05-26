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
  const [displayedChars, setDisplayedChars] = useState(0)
  const [animationPhase, setAnimationPhase] = useState<'typing' | 'logo'>('typing')
  
  const fullTextLine1 = "Играй в шахматы"
  const fullTextLine2 = "с друзьями"

  useEffect(() => {
    if (initialLoading) return
    const totalLen = fullTextLine1.length + fullTextLine2.length
    if (displayedChars < totalLen) {
      const timer = setTimeout(() => {
        setDisplayedChars(prev => prev + 1)
      }, 60)
      return () => clearTimeout(timer)
    } else if (animationPhase === 'typing') {
      const timer = setTimeout(() => {
        setAnimationPhase('logo')
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [displayedChars, initialLoading, animationPhase])

  useEffect(() => {
    if (!user || !supabase) {
      setRecentGames([])
      return
    }
    ;(async () => {
      try {
        const { data } = await supabase!
          .from('games')
          .select('*')
          .or(`white_player_id.eq.${user.uid},black_player_id.eq.${user.uid}`)
          .order('created_at', { ascending: false })
          .limit(10)
        if (data) setRecentGames(data)
      } catch {
        console.error('Failed to load recent games')
      }
    })()
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
        <div className="max-w-[1200px] mx-auto flex items-center justify-center relative min-h-[32px]">
          <div className="absolute right-0 flex items-center gap-[var(--space-12)] md:gap-[var(--space-20)]">
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
      </header>

      <main className="max-w-[1200px] mx-auto px-[var(--space-24)] pb-[var(--space-64)] flex-1 w-full flex flex-col justify-center gap-[10vh] md:gap-[12vh]">
        <section className="text-center relative min-h-[80px] flex items-center justify-center">
          <h2 className={`absolute text-[clamp(1.4rem,4vw,1.8rem)] font-bold text-text tracking-tight leading-[1.2] uppercase w-full transition-all duration-700 ${animationPhase === 'logo' ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
            {displayedChars > 0 ? (
              <>
                <span className="text-[var(--accent-brand)]">
                  {fullTextLine1.slice(0, Math.min(displayedChars, 5))}
                </span>
                {displayedChars > 5 && fullTextLine1.slice(5, Math.min(displayedChars, fullTextLine1.length))}
                {displayedChars > fullTextLine1.length && (
                  <>
                    <br />
                    {fullTextLine2.slice(0, displayedChars - fullTextLine1.length)}
                  </>
                )}
                {displayedChars < (fullTextLine1.length + fullTextLine2.length) ? (
                  <span className="animate-pulse ml-1 inline-block w-2 h-[1em] bg-[var(--accent-brand)] align-middle" />
                ) : (
                  <span className="ml-1 inline-block w-2 h-[1em] bg-transparent align-middle" />
                )}
              </>
            ) : (
              <span className="opacity-0">.</span>
            )}
          </h2>
          
          <img
            src={`${BASE}logo/gochess_wordmark_dark.svg`}
            alt="GoChess"
            className={`absolute h-[56px] md:h-[72px] w-auto ${animationPhase === 'logo' ? 'opacity-100 animate-image-typing' : 'opacity-0'}`}
          />
        </section>

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
            title="Игра с Ичи"
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
                          {g.game_type === 'bot' ? '🤖 Ичи' : g.game_type === 'local' ? '🎮 Локальная' : ''}
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
