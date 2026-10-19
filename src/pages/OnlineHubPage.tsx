import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, query, where, limit, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import { usePresence } from '@/hooks/usePresence'
import { useChallenges } from '@/hooks/useChallenges'
import { useToast } from '@/components/Toast'
import type { Challenge, GameMode, User as AppUser } from '@/types'
import Button from '@/components/Button'
import UserMenu from '@/components/UserMenu'
import SettingsDropdown from '@/components/SettingsDropdown'
import Footer from '@/components/Footer'
import Modal from '@/components/Modal'
import ColorPickerModal from '@/components/ColorPickerModal'
import GameCard from '@/components/board/GameCard'
import { gameRoute } from '@/lib/gameRoutes'
import { isRematchChallenge } from '@/lib/challenges'
import { formatTimeControl } from '@/lib/gameDoc'

const BASE = import.meta.env.BASE_URL || '/'

const modeNames: Record<string, string> = {
  classic: 'Классику',
  fog_of_war: 'Туман войны',
  rapid: 'Рапид',
  spell_chess: 'Магию',
  atomic_chess: 'Атомные шахматы'
}

export default function OnlineHubPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { addToast } = useToast()
  usePresence()
  const { incomingChallenges, acceptChallenge, declineChallenge, now } = useChallenges()

  const [gameMode, setGameMode] = useState<GameMode>('classic')
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false)
  const [recentGames, setRecentGames] = useState<any[]>([])
  const [recentPlayers, setRecentPlayers] = useState<AppUser[]>([])

  // Typing animation state
  const [displayedChars, setDisplayedChars] = useState(0)
  const fullText = "ИГРАЙ ОНЛАЙН!"

  useEffect(() => {
    let timer: any
    if (displayedChars < fullText.length) {
      timer = setTimeout(() => {
        setDisplayedChars(prev => prev + 1)
      }, 60)
    }
    return () => clearTimeout(timer)
  }, [displayedChars])

  // Fetch recent online games AND players
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

        // Filter for ONLINE CLASSIC & RAPID games ONLY on client side
        const isClassicOrRapid = (g: any) => 
          g.game_type === 'online' && (g.game_mode === 'classic' || g.game_mode === 'rapid' || !g.game_mode)

        const classicOnlineGames = sorted.filter(isClassicOrRapid)
        setRecentGames(classicOnlineGames)

        // Extract unique recent players from classic/rapid games
        const playerIds = new Set<string>()
        classicOnlineGames.forEach((g: any) => {
          if (g.white_player_id && g.white_player_id !== user.uid) playerIds.add(g.white_player_id)
          if (g.black_player_id && g.black_player_id !== user.uid) playerIds.add(g.black_player_id)
        })

        if (playerIds.size > 0) {
          const usersQ = query(collection(db, 'users'), where('uid', 'in', Array.from(playerIds).slice(0, 10)))
          const usersSnap = await getDocs(usersQ)
          setRecentPlayers(usersSnap.docs.map(d => d.data() as AppUser))
        }

      } catch (err) {
        console.error('[Hub] Error fetching data:', err)
      }
    }

    fetchData()
  }, [user])

  const [acceptBusy, setAcceptBusy] = useState(false)

  const handleAcceptChallenge = async (challenge: Challenge) => {
    if (!db || !user || acceptBusy) return
    setAcceptBusy(true)
    try {
      const result = await acceptChallenge(challenge)
      if (!result.gameId) {
        addToast('Вызов уже обработан', 'error')
        return
      }
      navigate(`/game/${result.gameId}`)
    } catch (err) {
      addToast('Ошибка при принятии вызова', 'error')
    } finally {
      setAcceptBusy(false)
    }
  }

  const handleModeSelect = (mode: GameMode) => {
    setGameMode(mode)
    setIsColorPickerOpen(true)
  }

// Hoisted to module scope: declaring this inside the component gives React a new
// function identity on every render, which remounts all tiles and kills the
// CSS transitions and hover state.
const ModeTile = ({ mode, title, icon, description, onSelect }: {
  mode: GameMode
  title: string
  icon: string
  description: string
  onSelect: (mode: GameMode) => void
}) => (
  <button
    onClick={() => onSelect(mode)}
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
  </button>
)

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

      <main className="max-w-[1200px] mx-auto px-[var(--space-24)] py-[var(--space-48)] flex-1 w-full">
        <div className="max-w-[1000px] mx-auto">
          {/* Typing Title */}
          <div className="text-center mb-[var(--space-64)] h-[80px] flex items-center justify-center relative">
            <h2 className="text-[clamp(1.4rem,4vw,1.8rem)] font-bold text-text tracking-tight leading-[1.2] uppercase w-full">
              {displayedChars > 0 && (
                <>
                  <span className="text-white">
                    {fullText.slice(0, Math.min(displayedChars, 6))}
                  </span>
                  <span className="text-[var(--accent-brand)]">
                    {displayedChars > 6 && fullText.slice(6, displayedChars)}
                  </span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-20)] max-w-[640px] mx-auto mb-[var(--space-48)]">
            <ModeTile 
              mode="classic" 
              title="Классика" 
              icon="classic.png" 
              description="Стандартные правила без ограничений" 
              onSelect={handleModeSelect}
            />
            <ModeTile 
              mode="rapid" 
              title="Рапид" 
              icon="rapid.png" 
              description="Быстрая игра с контролем времени" 
              onSelect={handleModeSelect}
            />
          </div>

          {/* Recent Games List */}
          {user && recentGames.length > 0 && (
            <section className="mt-[var(--space-48)]">
              <h3 className="text-[var(--font-size-sm)] font-bold text-text mb-[var(--space-12)] uppercase tracking-widest text-center">
                Последние партии онлайн
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

          <div className="flex justify-center mt-[var(--space-32)]">
            <Button variant="outline" onClick={() => navigate('/')}>
              Вернуться в лобби
            </Button>
          </div>
        </div>
      </main>

      {/* Incoming Challenges Modal */}
      {incomingChallenges.length > 0 && (
        <Modal
          isOpen={true}
          onClose={() => {}}
          title={isRematchChallenge(incomingChallenges[0]) ? 'Приглашение на реванш' : 'Новый вызов!'}
        >
          <div className="space-y-6 pt-4 text-center">
             <div className="text-[var(--font-size-md)] font-bold text-text mb-2">
               {incomingChallenges[0].fromName}
             </div>
             <div className="text-[10px] text-text-secondary uppercase tracking-widest mb-6">
                {isRematchChallenge(incomingChallenges[0])
                  ? `Предлагает реванш в режиме «${modeNames[incomingChallenges[0].mode] || 'игра'}»`
                  : `Приглашает вас в ${modeNames[incomingChallenges[0].mode] || 'игру'}`}
             </div>
             {incomingChallenges[0].timeControl && (
                <div className="text-[9px] text-text-secondary opacity-70 mb-4">
                  {formatTimeControl(incomingChallenges[0].timeControl)} мин
                </div>
             )}
             <div className="text-[9px] text-text-secondary opacity-70 mb-4">
               Истекает через {Math.max(0, Math.ceil((incomingChallenges[0].expiresAt - now) / 1000))} с
             </div>
             <div className="grid grid-cols-2 gap-4">
                <Button variant="primary" disabled={acceptBusy} onClick={() => handleAcceptChallenge(incomingChallenges[0])}>Принять</Button>
                <Button variant="outline" onClick={() => declineChallenge(incomingChallenges[0].id)} className="bg-transparent opacity-60">Отклонить</Button>
             </div>
          </div>
        </Modal>
      )}

      <ColorPickerModal 
        isOpen={isColorPickerOpen} 
        onClose={() => setIsColorPickerOpen(false)} 
        gameMode={gameMode}
        recentPlayers={recentPlayers}
      />
      <Footer />
    </div>
  )
}
