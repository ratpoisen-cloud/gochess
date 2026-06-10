import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, query, where, limit, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import UserMenu from '@/components/UserMenu'
import SettingsDropdown from '@/components/SettingsDropdown'
import Footer from '@/components/Footer'
import BoardPreview from '@/components/board/BoardPreview'

const BASE = import.meta.env.BASE_URL || '/'

export default function CompletedGamesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [completedGames, setCompletedGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !db) return

    const fetchCompletedGames = async () => {
      try {
        const gamesRef = collection(db, 'games')
        const q1 = query(
          gamesRef,
          where('white_player_id', '==', user.uid),
          where('game_state', '==', 'game_over'),
          limit(50)
        )
        const q2 = query(
          gamesRef,
          where('black_player_id', '==', user.uid),
          where('game_state', '==', 'game_over'),
          limit(50)
        )

        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)])
        const combined = [...snap1.docs, ...snap2.docs].map(d => ({ id: d.id, ...d.data() }))
        
        const sorted = combined.sort((a: any, b: any) => {
          const timeA = (a.last_move_time?.seconds || a.last_move_time) || (a.created_at?.seconds || a.created_at) || 0
          const timeB = (b.last_move_time?.seconds || b.last_move_time) || (b.created_at?.seconds || b.created_at) || 0
          return (timeB as number) - (timeA as number)
        })

        setCompletedGames(sorted)
      } catch (err) {
        console.error('[CompletedGames] Error fetching data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchCompletedGames()
  }, [user])

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
        <div className="max-w-[800px] mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-[var(--font-size-md)] font-bold text-text uppercase tracking-widest">
              Архив партий
            </h2>
            <Link to="/online" className="text-[10px] text-[var(--accent-brand)] uppercase tracking-widest hover:underline">
              Назад в хаб
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-20 opacity-50 uppercase tracking-widest text-[10px]">Загрузка архива...</div>
          ) : completedGames.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-[var(--border)] rounded-xl opacity-50 uppercase tracking-widest text-[10px]">
              Завершенных партий пока нет
            </div>
          ) : (
            <div className="space-y-4">
              {completedGames.map((g) => (
                <div 
                  key={g.id} 
                  onClick={() => navigate(`/game/${g.id}`)}
                  className="p-[var(--space-12)] rounded-[var(--radius-8)] pixel-tile transition-all duration-200 flex gap-[var(--space-16)] items-center cursor-pointer active:scale-[0.98] hover:border-[var(--accent-brand)]"
                >
                  <div className="shrink-0">
                    <BoardPreview 
                      fen={g.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'} 
                      size={80} 
                      orientation={g.black_player_id === user?.uid ? 'black' : 'white'}
                      gameMode={g.game_mode}
                      playerColor={g.white_player_id === user?.uid ? 'w' : 'b'}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[var(--font-size-xs)] text-text flex items-center gap-2 truncate font-bold">
                        {g.white_name || '...'} vs {g.black_name || '...'}
                        {g.game_mode === 'fog_of_war' && (
                          <span className="text-[8px] bg-[rgba(126,184,126,0.1)] text-[var(--accent-brand)] px-1.5 py-0.5 rounded border border-[var(--accent-brand)] border-opacity-30 uppercase tracking-tighter">FoW</span>
                        )}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider shrink-0 opacity-80">
                        {g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : '½-½'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-text-secondary opacity-60 uppercase tracking-widest">
                        {g.message === 'checkmate' ? 'Мат' : g.message === 'resign' ? 'Сдача' : g.message === 'draw' ? 'Ничья' : 'Окончена'}
                      </span>
                      <span className="text-[10px] text-text-secondary opacity-50">
                        {g.created_at
                          ? new Date(
                              typeof g.created_at === 'string'
                                ? g.created_at
                                : g.created_at.seconds * 1000
                            ).toLocaleDateString()
                          : ''}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
