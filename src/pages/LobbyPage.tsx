import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { usePresence } from '@/hooks/usePresence'
import { useChallenges } from '@/hooks/useChallenges'
import { useToast } from '@/components/Toast'
import { db } from '@/lib/firebase'
import { collection, query, where, limit, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import AuthModal from '@/components/AuthModal'
import UserMenu from '@/components/UserMenu'
import LoadingScreen from '@/components/LoadingScreen'
import ColorPickerModal from '@/components/ColorPickerModal'
import BoardPreview from '@/components/board/BoardPreview'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
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
  usePresence()
  const { incomingChallenges, declineChallenge } = useChallenges()
  const { addToast } = useToast()
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

  const handleAcceptChallenge = async (challenge: any) => {
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
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [recentGames, setRecentGames] = useState<any[]>([])
  const [gameFilter, setGameFilter] = useState<'all' | 'online' | 'bot' | 'local'>('all')
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
    if (!user) {
      setRecentGames([])
      return
    }
    
    const loadRecentGames = async () => {
      try {
        const gamesRef = collection(db, 'games')
        const qWhite = query(
          gamesRef, 
          where('white_player_id', '==', user.uid),
          limit(20)
        )
        const qBlack = query(
          gamesRef, 
          where('black_player_id', '==', user.uid),
          limit(20)
        )

        const [whiteSnap, blackSnap] = await Promise.all([
          getDocs(qWhite),
          getDocs(qBlack)
        ])

        const combined = [
          ...whiteSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
          ...blackSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        ]
        
        // Sort by last_move_time client-side, fallback to created_at for old games
        const getMs = (doc: any): number => {
          const val = doc.last_move_time ?? doc.created_at
          if (!val) return 0
          if (typeof val === 'number') return val
          return val.seconds * 1000
        }
        const sorted = combined
          .sort((a: any, b: any) => getMs(b) - getMs(a))
          .slice(0, 10)

        setRecentGames(sorted)
      } catch (err) {
        console.error('[Lobby] Failed to load recent games:', err)
      }
    }

    loadRecentGames()
  }, [user])

  const handleGameClick = (game: any) => {
    if (game.game_type === 'online' && game.room_code) {
      navigate(`/game/${game.room_code}`)
    } else if (game.game_type === 'bot' && game.game_state === 'active' && game.id) {
      navigate(`/bot?game=${game.id}`)
    }
  }

  useEffect(() => {
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
                navigate('/online')
              } else {
                setIsAuthModalOpen(true)
              }
            }}
            className="group relative flex flex-col items-center justify-center min-h-[230px] p-[28px_20px] rounded-[var(--radius-8)] pixel-tile cursor-pointer text-left w-full"
          >
            {incomingChallenges.length > 0 && (
              <div className="absolute top-4 right-4 flex items-center justify-center w-6 h-6 bg-[var(--danger)] text-white text-[10px] font-bold rounded-full animate-bounce z-10 shadow-lg">
                {incomingChallenges.length}
              </div>
            )}
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
              Пригласи друга или брось вызов игрокам онлайн
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
            <h3 className="text-[var(--font-size-sm)] font-bold text-text mb-[var(--space-12)] uppercase tracking-widest text-center">
              Последние партии
            </h3>
            
            <div className="flex justify-center gap-[var(--space-20)] mb-[var(--space-24)]">
              {(['all', 'online', 'bot', 'local'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setGameFilter(f)}
                  className={`text-[10px] font-bold uppercase tracking-widest transition-all duration-200 ${
                    gameFilter === f 
                      ? 'text-[var(--accent-brand)] scale-110' 
                      : 'text-text-secondary opacity-60 hover:opacity-100'
                  }`}
                >
                  {f === 'all' ? 'Все' : f === 'online' ? 'Онлайн' : f === 'bot' ? 'С ботом' : 'Локально'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-16)] max-w-[900px] mx-auto">
              {recentGames
                .filter(g => gameFilter === 'all' || g.game_type === gameFilter)
                .map((g) => {
                const isOnline = g.game_type === 'online'
                const isActive = g.game_state !== 'game_over'
                
                // Determine turn status
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
                    className={`p-[var(--space-12)] rounded-[var(--radius-8)] pixel-tile transition-all duration-200 flex gap-[var(--space-16)] items-center ${
                      (isOnline && isActive) || (g.game_type === 'bot' && isActive)
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
                          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-brand)] animate-pulse" />}
                          {g.white_name || '...'} vs {g.black_name || '...'}
                        </span>
                        {!isActive && (
                          <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                            g.winner === 'white' ? 'text-text' : g.winner === 'black' ? 'text-text-secondary' : 'text-[var(--text-secondary)]'
                          }`}>
                            {g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : '½-½'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? (isMyTurn ? 'text-[var(--accent-brand)]' : 'text-text-secondary opacity-60') : 'text-text-secondary opacity-40'}`}>
                          {isActive 
                            ? (isMyTurn ? 'Ваш ход' : 'Ход соперника')
                            : isOnline 
                              ? 'Онлайн' 
                              : g.game_type === 'bot' 
                                ? 'Против Ичи' 
                                : 'Локально'}
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
      </main>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <ColorPickerModal isOpen={isColorPickerOpen} onClose={() => setIsColorPickerOpen(false)} />
      
      {/* Incoming Challenge Notification Modal */}
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
               Приглашает вас в {incomingChallenges[0].mode === 'classic' ? 'Классику' : 'Туман войны'}
             </div>
             <div className="grid grid-cols-2 gap-4">
                <Button variant="primary" onClick={() => handleAcceptChallenge(incomingChallenges[0])}>Принять</Button>
                <Button variant="outline" onClick={() => declineChallenge(incomingChallenges[0].id)} className="bg-transparent opacity-60">Отклонить</Button>
             </div>
          </div>
        </Modal>
      )}

      <Footer />
    </div>
  )
}
