import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, query, where, orderBy, limit, doc, updateDoc, serverTimestamp, addDoc, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import { usePresence } from '@/hooks/usePresence'
import { useChallenges } from '@/hooks/useChallenges'
import { useToast } from '@/components/Toast'
import type { GameMode, User as AppUser } from '@/types'
import Button from '@/components/Button'
import UserMenu from '@/components/UserMenu'
import SettingsDropdown from '@/components/SettingsDropdown'
import Footer from '@/components/Footer'
import Modal from '@/components/Modal'
import ColorPickerModal from '@/components/ColorPickerModal'
import BoardPreview from '@/components/board/BoardPreview'

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
  const { incomingChallenges, declineChallenge } = useChallenges()

  const [gameMode, setGameMode] = useState<GameMode>('classic')
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false)
  const [recentGames, setRecentGames] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all')
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
        // Fetch all games for user (matching LobbyPage logic to use existing indexes)
        const q1 = query(
          collection(db, 'games'),
          where('white_player_id', '==', user.uid),
          orderBy('created_at', 'desc'),
          limit(20)
        )
        const q2 = query(
          collection(db, 'games'),
          where('black_player_id', '==', user.uid),
          orderBy('created_at', 'desc'),
          limit(20)
        )

        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)])
        const combined = [...snap1.docs, ...snap2.docs].map(d => ({ id: d.id, ...d.data() }))
        
        // Sort by last_move_time or created_at
        const sorted = combined.sort((a: any, b: any) => {
          const timeA = (a.last_move_time?.seconds || a.last_move_time) || (a.created_at?.seconds || a.created_at) || 0
          const timeB = (b.last_move_time?.seconds || b.last_move_time) || (b.created_at?.seconds || b.created_at) || 0
          return (timeB as number) - (timeA as number)
        })

        // Filter for ONLINE games ONLY on client side
        const onlineGames = sorted.filter((g: any) => g.game_type === 'online')
        setRecentGames(onlineGames.slice(0, 10))

        // Extract unique recent players from ALL games (classic or fow)
        const playerIds = new Set<string>()
        onlineGames.forEach((g: any) => {
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

  const handleAcceptChallenge = async (challenge: any) => {
    if (!db) return
    try {
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
      const gameRef = await addDoc(collection(db, 'games'), {
        room_code: roomCode,
        white_player_id: challenge.fromId,
        black_player_id: user?.uid,
        white_name: challenge.fromName,
        black_name: user?.displayName || 'Игрок',
        pgn: '',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        game_state: 'playing',
        game_type: 'online',
        game_mode: challenge.mode,
        turn: 'w',
        winner: null,
        message: null,
        last_move_time: Date.now(),
        created_at: serverTimestamp(),
        reactions: []
      })

      await updateDoc(doc(db, 'challenges', challenge.id), {
        status: 'accepted',
        gameId: gameRef.id
      })

      navigate(`/game/${gameRef.id}`)
    } catch (err) {
      addToast('Ошибка при принятии вызова', 'error')
    }
  }

  const handleGameClick = (g: any) => {
    navigate(`/game/${g.id}`)
  }

  const ModeTile = ({ mode, title, icon, description }: { mode: GameMode, title: string, icon: string, description: string }) => (
    <button
      onClick={() => {
        setGameMode(mode)
        setIsColorPickerOpen(true)
      }}
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
                  {fullText.slice(0, Math.min(displayedChars, 6))}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-[var(--space-20)] mb-[var(--space-48)]">
            <ModeTile 
              mode="classic" 
              title="Классика" 
              icon="classic.png" 
              description="Стандартные правила без ограничений" 
            />
            <ModeTile 
              mode="rapid" 
              title="Рапид" 
              icon="rapid.png" 
              description="Быстрая игра с контролем времени" 
            />
            <ModeTile 
              mode="spell_chess" 
              title="Магия" 
              icon="magic.png" 
              description="Заклинания и физическое взятие короля" 
            />
            <ModeTile 
              mode="atomic_chess" 
              title="Атомные" 
              icon="bomb.png" 
              description="Взятие вызывает взрыв 3x3 вокруг" 
            />
            <ModeTile 
              mode="fog_of_war" 
              title="Туман войны" 
              icon="fog of war.png" 
              description="Видны только свои фигуры и их удары" 
            />
          </div>

          {/* Recent Games List */}
          {user && recentGames.length > 0 && (
            <section className="mt-[var(--space-48)]">
              <h3 className="text-[var(--font-size-sm)] font-bold text-text mb-[var(--space-12)] uppercase tracking-widest text-center">
                Последние партии онлайн
              </h3>

              <div className="flex justify-center items-center gap-[var(--space-20)] mb-[var(--space-24)]">
                {(['all', 'active', 'completed'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`text-[10px] font-bold uppercase tracking-widest transition-all duration-200 ${
                      statusFilter === f 
                        ? 'text-[var(--accent-brand)] scale-110' 
                        : 'text-text-secondary opacity-60 hover:opacity-100'
                    }`}
                  >
                    {f === 'all' ? 'Все' : f === 'active' ? 'Активные' : 'Завершенные'}
                  </button>
                ))}
                <div className="w-[1px] h-3 bg-[var(--border)] opacity-30" />
                <Link 
                  to="/completed" 
                  className="text-[10px] font-bold uppercase tracking-widest text-text-secondary opacity-60 hover:opacity-100 hover:text-[var(--accent-brand)] transition-all duration-200"
                >
                  Архив
                </Link>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-16)] max-w-[900px] mx-auto">
                {recentGames
                  .filter(g => {
                    if (statusFilter === 'all') return true
                    const isActive = g.game_state !== 'game_over'
                    return statusFilter === 'active' ? isActive : !isActive
                  })
                  .map((g) => {
                  const isActive = g.game_state !== 'game_over'
                  const isUserWhite = g.white_player_id === user.uid
                  const isUserBlack = g.black_player_id === user.uid
                  const isMyTurn = isActive && (
                    (g.turn === 'w' && isUserWhite) || 
                    (g.turn === 'b' && isUserBlack)
                  )

                  return (
                    <div 
                      key={g.id} 
                      onClick={() => handleGameClick(g)}
                      className="p-[var(--space-12)] rounded-[var(--radius-8)] pixel-tile transition-all duration-200 flex gap-[var(--space-16)] items-center cursor-pointer active:scale-[0.98]"
                    >
                      <div className="shrink-0">
                        <BoardPreview 
                          fen={g.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'} 
                          size={100} 
                          orientation={g.black_player_id === user.uid ? 'black' : 'white'}
                          gameMode={g.game_mode}
                          playerColor={g.white_player_id === user.uid ? 'w' : 'b'}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-[var(--space-4)]">
                          <span className="text-[var(--font-size-xs)] text-text flex items-center gap-2 truncate font-bold">
                            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-brand)] animate-pulse" />}
                            {g.white_name || '...'} vs {g.black_name || '...'}
                            {g.game_mode === 'fog_of_war' && (
                              <span className="text-[8px] bg-[rgba(126,184,126,0.1)] text-[var(--accent-brand)] px-1.5 py-0.5 rounded border border-[var(--accent-brand)] border-opacity-30 uppercase tracking-tighter">FoW</span>
                            )}
                          </span>
                          {!isActive && (
                            <span className="text-[10px] font-bold uppercase tracking-wider shrink-0 opacity-60">
                              {g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : '½-½'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? (isMyTurn ? 'text-[var(--accent-brand)]' : 'text-text-secondary opacity-60') : 'text-text-secondary opacity-40'}`}>
                            {isActive 
                              ? (isMyTurn ? 'Ваш ход' : 'Ход соперника')
                              : 'Завершена'}
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
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Incoming Challenges Modal */}
      {incomingChallenges.length > 0 && (
        <Modal
          isOpen={true}
          onClose={() => {}}
          title="Новый вызов!"
        >
          <div className="space-y-6 pt-4 text-center">
             <div className="text-[var(--font-size-md)] font-bold text-text mb-2">
               {incomingChallenges[0].fromName}
             </div>
             <div className="text-[10px] text-text-secondary uppercase tracking-widest mb-6">
                Приглашает вас в {modeNames[incomingChallenges[0].mode] || 'игру'}
             </div>
             <div className="grid grid-cols-2 gap-4">
                <Button variant="primary" onClick={() => handleAcceptChallenge(incomingChallenges[0])}>Принять</Button>
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
