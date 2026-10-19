import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { collection, query, where, limit, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import UserMenu from '@/components/UserMenu'
import SettingsDropdown from '@/components/SettingsDropdown'
import Footer from '@/components/Footer'
import GameCard from '@/components/board/GameCard'
import { gameRoute } from '@/lib/gameRoutes'

const BASE = import.meta.env.BASE_URL || '/'

interface CompletedGamesPageProps {
  defaultTab?: 'active' | 'completed'
}

export default function CompletedGamesPage({ defaultTab }: CompletedGamesPageProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const initialTab = defaultTab || (location.pathname === '/active' ? 'active' : 'completed')
  const [tab, setTab] = useState<'active' | 'completed'>(initialTab)
  const [activeGames, setActiveGames] = useState<any[]>([])
  const [completedGames, setCompletedGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (defaultTab) {
      setTab(defaultTab)
    } else if (location.pathname === '/active') {
      setTab('active')
    } else if (location.pathname === '/completed') {
      setTab('completed')
    }
  }, [defaultTab, location.pathname])

  useEffect(() => {
    if (!user || !db) return

    const fetchGames = async () => {
      try {
        setLoading(true)
        const gamesRef = collection(db, 'games')

        // Fetch recent games (captures active + recent completed)
        const [whiteSnap, blackSnap] = await Promise.all([
          getDocs(query(gamesRef, where('white_player_id', '==', user.uid), limit(50))),
          getDocs(query(gamesRef, where('black_player_id', '==', user.uid), limit(50)))
        ])

        // Also fetch specifically completed games to ensure deep archive
        const [whiteCompSnap, blackCompSnap] = await Promise.all([
          getDocs(query(gamesRef, where('white_player_id', '==', user.uid), where('game_state', '==', 'game_over'), limit(50))),
          getDocs(query(gamesRef, where('black_player_id', '==', user.uid), where('game_state', '==', 'game_over'), limit(50)))
        ])

        const mapById = new Map<string, any>()
        whiteSnap.docs.forEach(d => mapById.set(d.id, { id: d.id, ...d.data() }))
        blackSnap.docs.forEach(d => mapById.set(d.id, { id: d.id, ...d.data() }))
        whiteCompSnap.docs.forEach(d => mapById.set(d.id, { id: d.id, ...d.data() }))
        blackCompSnap.docs.forEach(d => mapById.set(d.id, { id: d.id, ...d.data() }))

        const getMs = (doc: any): number => {
          const val = doc.last_move_time ?? doc.created_at
          if (!val) return 0
          if (typeof val === 'number') return val
          return val.seconds * 1000
        }

        const all = Array.from(mapById.values()).sort((a, b) => getMs(b) - getMs(a))

        setActiveGames(all.filter(g => g.game_state !== 'game_over'))
        setCompletedGames(all.filter(g => g.game_state === 'game_over'))
      } catch (err) {
        console.error('[GamesArchive] Error fetching data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchGames()
  }, [user])

  const displayedGames = tab === 'active' ? activeGames : completedGames

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

      <main className="max-w-[1200px] mx-auto px-[var(--space-24)] py-[var(--space-48)] flex-1 w-full">
        <div className="max-w-[900px] mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-[var(--space-20)]">
              <button
                onClick={() => setTab('active')}
                className={`text-[12px] font-bold uppercase tracking-widest transition-all duration-200 ${
                  tab === 'active'
                    ? 'text-[var(--accent-brand)] scale-110'
                    : 'text-text-secondary opacity-60 hover:opacity-100'
                }`}
              >
                Активные {activeGames.length > 0 && `(${activeGames.length})`}
              </button>
              <div className="w-[1px] h-3 bg-[var(--border)] opacity-30" />
              <button
                onClick={() => setTab('completed')}
                className={`text-[12px] font-bold uppercase tracking-widest transition-all duration-200 ${
                  tab === 'completed'
                    ? 'text-[var(--accent-brand)] scale-110'
                    : 'text-text-secondary opacity-60 hover:opacity-100'
                }`}
              >
                Архив {completedGames.length > 0 && `(${completedGames.length})`}
              </button>
            </div>
            <Link to="/" className="text-[10px] text-[var(--accent-brand)] uppercase tracking-widest hover:underline">
              Назад в лобби
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-20 opacity-50 uppercase tracking-widest text-[10px]">
              Загрузка партий...
            </div>
          ) : displayedGames.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-[var(--border)] rounded-xl opacity-50 uppercase tracking-widest text-[10px]">
              {tab === 'active' ? 'Активных партий пока нет' : 'Завершённых партий пока нет'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-16)]">
              {displayedGames.map((g) => (
                <GameCard
                  key={g.id}
                  game={g}
                  currentUserId={user?.uid}
                  onClick={() => { const route = gameRoute(g); if (route) navigate(route) }}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
