import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '@/components/Button'
import UserMenu from '@/components/UserMenu'
import SettingsDropdown from '@/components/SettingsDropdown'
import Footer from '@/components/Footer'
import { useAuth } from '@/hooks/useAuth'
import { collection, query, where, limit, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import GameCard from '@/components/board/GameCard'
import { gameRoute } from '@/lib/gameRoutes'

const BASE = import.meta.env.BASE_URL || '/'

interface HubTileProps {
  to: string
  title: string
  icon: string
  description: string
}

const HubTile = ({ to, title, icon, description }: HubTileProps) => (
  <Link
    to={to}
    className="group relative flex flex-col items-center justify-center min-h-[230px] p-[28px_20px] rounded-[var(--radius-8)] pixel-tile cursor-pointer text-left w-full transition-all duration-300"
  >
    <div className="mb-[var(--space-20)] flex items-center justify-center transform transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1">
      <img
        src={`${BASE}${icon}`}
        alt={title}
        className="w-[96px] h-[96px] object-contain"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
    <h3 className="text-[var(--font-size-sm)] font-bold mb-[var(--space-10)] text-center transition-colors duration-200 group-hover:text-white uppercase tracking-widest">
      {title}
    </h3>
    <p className="text-text-secondary text-[11px] text-center leading-[1.6] max-w-[200px] opacity-60 group-hover:opacity-100 transition-opacity">
      {description}
    </p>
  </Link>
)

export default function IchiHubPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [displayedChars, setDisplayedChars] = useState(0)
  const fullText = "ИЧИ — ОБУЧЕНИЕ И ИГРА"
  const [recentGames, setRecentGames] = useState<any[]>([])

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (displayedChars < fullText.length) {
      timer = setTimeout(() => {
        setDisplayedChars(prev => prev + 1)
      }, 50)
    }
    return () => clearTimeout(timer)
  }, [displayedChars])

  useEffect(() => {
    if (!user || !db) return

    const fetchData = async () => {
      try {
        const q1 = query(
          collection(db, 'games'),
          where('white_player_id', '==', user.uid),
          limit(30)
        )
        const q2 = query(
          collection(db, 'games'),
          where('black_player_id', '==', user.uid),
          limit(30)
        )

        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)])
        const mapById = new Map<string, any>()
        snap1.docs.forEach(d => mapById.set(d.id, { id: d.id, ...d.data() }))
        snap2.docs.forEach(d => mapById.set(d.id, { id: d.id, ...d.data() }))

        const getMs = (doc: any): number => {
          const val = doc.last_move_time ?? doc.created_at
          if (!val) return 0
          if (typeof val === 'number') return val
          return val.seconds * 1000
        }

        const sorted = Array.from(mapById.values()).sort((a, b) => getMs(b) - getMs(a))
        const botGames = sorted.filter((g: any) => g.game_type === 'bot')
        setRecentGames(botGames)
      } catch (err) {
        console.error('[IchiHub] Error fetching games:', err)
      }
    }

    fetchData()
  }, [user])

  const handleGameClick = (game: any) => {
    const route = gameRoute(game)
    if (route) navigate(route)
  }

  const activeGames = recentGames.filter((g: any) => g.game_state !== 'game_over')
  const displayedActiveGames = activeGames.slice(0, 6)

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
                    {fullText.slice(0, Math.min(displayedChars, 3))}
                  </span>
                  {displayedChars > 3 && fullText.slice(3, displayedChars)}
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--space-24)] mb-[var(--space-48)]">
            <HubTile 
              to="/bot" 
              title="Игра" 
              icon="emojis/bot_new.png" 
              description="Партия с Ичи на 4 уровнях сложности с записью ходов" 
            />
            <HubTile 
              to="/bot/training" 
              title="Обучение" 
              icon="emojis/board/Emojis_48x48_130.png" 
              description="Интерактивная доска, подсказки от Ичи и разбор вариантов" 
            />
            <HubTile 
              to="/bot/puzzles" 
              title="Пазлы" 
              icon="emojis/board/Emojis_48x48_281.png" 
              description="Тактические шахматные задачи: маты, связки и вилки" 
            />
          </div>
          
          {/* Recent Ichi Games */}
          {user && recentGames.length > 0 && (
            <section className="mb-[var(--space-48)]">
              <h3 className="text-[var(--font-size-sm)] font-bold text-text mb-[var(--space-12)] uppercase tracking-widest text-center">
                Последние партии с Ичи
              </h3>

              <div className="flex justify-center items-center gap-[var(--space-20)] mb-[var(--space-24)]">
                <Link 
                  to="/active"
                  className="text-[10px] font-bold uppercase tracking-widest text-text-secondary opacity-80 hover:opacity-100 hover:text-[var(--accent-brand)] transition-all duration-200"
                >
                  Активные {activeGames.length > 0 && `(${activeGames.length})`}
                </Link>
                <div className="w-[1px] h-3 bg-[var(--border)] opacity-30" />
                <Link 
                  to="/completed" 
                  className="text-[10px] font-bold uppercase tracking-widest text-text-secondary opacity-80 hover:opacity-100 hover:text-[var(--accent-brand)] transition-all duration-200"
                >
                  Архив
                </Link>
              </div>

              {displayedActiveGames.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-16)] max-w-[900px] mx-auto">
                  {displayedActiveGames.map((g) => (
                    <GameCard
                      key={g.id}
                      game={g}
                      currentUserId={user?.uid}
                      onClick={() => handleGameClick(g)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 border border-dashed border-[var(--border)] rounded-xl opacity-50 uppercase tracking-widest text-[10px] max-w-[500px] mx-auto">
                  Активных партий пока нет
                </div>
              )}
            </section>
          )}

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
