import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot, orderBy, limit, doc, setDoc, serverTimestamp, addDoc, getDocs, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import { usePresence } from '@/hooks/usePresence'
import { useChallenges } from '@/hooks/useChallenges'
import { useToast } from '@/components/Toast'
import type { GameMode, User as AppUser, Challenge } from '@/types'
import Card from '@/components/Card'
import Button from '@/components/Button'
import UserMenu from '@/components/UserMenu'
import SettingsDropdown from '@/components/SettingsDropdown'
import Footer from '@/components/Footer'
import Modal from '@/components/Modal'
import ColorPickerModal from '@/components/ColorPickerModal'

const BASE = import.meta.env.BASE_URL || '/'

export default function OnlineHubPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { addToast } = useToast()
  usePresence()
  const { incomingChallenges, sendChallenge, declineChallenge } = useChallenges()

  const [gameMode, setGameMode] = useState<GameMode>('classic')
  const [activeTab, setActiveTab] = useState<'recent' | 'online'>('recent')
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<AppUser[]>([])
  const [recentPlayers, setRecentPlayers] = useState<AppUser[]>([])

  // Outgoing challenge state
  const [pendingOutgoing, setPendingOutgoing] = useState<string | null>(null)

  // Listen for online users
  useEffect(() => {
    if (!user) return

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const q = query(
      collection(db, 'users'),
      where('lastSeen', '>', Timestamp.fromDate(fiveMinutesAgo)),
      limit(20)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs
        .map(doc => doc.data() as AppUser)
        .filter(u => u.uid !== user.uid)
      setOnlineUsers(users)
    })

    return () => unsubscribe()
  }, [user])

  // Fetch recent players from games
  useEffect(() => {
    if (!user) return

    const fetchRecent = async () => {
      const q = query(
        collection(db, 'games'),
        where('game_type', '==', 'online'),
        where('white_player_id', '==', user.uid),
        orderBy('created_at', 'desc'),
        limit(20)
      )
      const q2 = query(
        collection(db, 'games'),
        where('game_type', '==', 'online'),
        where('black_player_id', '==', user.uid),
        orderBy('created_at', 'desc'),
        limit(20)
      )

      const [snap1, snap2] = await Promise.all([getDocs(q), getDocs(q2)])
      const playerIds = new Set<string>()
      
      snap1.docs.forEach(d => {
        const data = d.data()
        if (data.black_player_id) playerIds.add(data.black_player_id)
      })
      snap2.docs.forEach(d => {
        const data = d.data()
        if (data.white_player_id) playerIds.add(data.white_player_id)
      })

      if (playerIds.size === 0) {
        setRecentPlayers([])
        return
      }

      // Fetch user details for these IDs
      const usersQ = query(collection(db, 'users'), where('uid', 'in', Array.from(playerIds).slice(0, 10)))
      const usersSnap = await getDocs(usersQ)
      setRecentPlayers(usersSnap.docs.map(d => d.data() as AppUser))
    }

    fetchRecent()
  }, [user])

  // Listen for accepted outgoing challenge
  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'challenges'),
      where('fromId', '==', user.uid),
      where('status', '==', 'accepted'),
      limit(1)
    )

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!snapshot.empty) {
        const challenge = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Challenge
        if (challenge.gameId) {
          navigate(`/game/${challenge.gameId}`)
        } else {
          // If receiver accepted but hasn't created gameId yet, wait or handle
          console.log('[Hub] Challenge accepted, waiting for gameId...')
        }
      }
    })

    return () => unsubscribe()
  }, [user, navigate])

  const handleSendChallenge = async (toUser: AppUser) => {
    try {
      setPendingOutgoing(toUser.uid)
      await sendChallenge(toUser.uid, gameMode)
      addToast(`Вызов отправлен ${toUser.displayName}`, 'success')
      // Auto-cancel after 60s
      setTimeout(() => setPendingOutgoing(null), 60000)
    } catch (err) {
      addToast('Ошибка при отправке вызова', 'error')
      setPendingOutgoing(null)
    }
  }

  const handleAccept = async (challenge: Challenge) => {
    try {
      // 1. Create a new game document
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
      const gameRef = await addDoc(collection(db, 'games'), {
        room_code: roomCode,
        white_player_id: challenge.fromId, // Challenger is white by default
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

      // 2. Update challenge status and link gameId
      await setDoc(doc(db, 'challenges', challenge.id), {
        status: 'accepted',
        gameId: gameRef.id
      }, { merge: true })

      // 3. Navigate to game
      navigate(`/game/${gameRef.id}`)
    } catch (err) {
      addToast('Ошибка при принятии вызова', 'error')
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-bg">
      <header className="px-[var(--space-24)] py-[var(--space-32)] bg-bg">
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

      <main className="max-w-[1200px] mx-auto px-[var(--space-24)] py-[var(--space-48)] flex-1 w-full text-center">
        <div className="max-w-[800px] mx-auto">
          <h1 className="text-[var(--font-size-xl)] font-bold mb-[var(--space-12)] uppercase tracking-[0.2em] animate-text-focus-in">
            Онлайн Лобби
          </h1>
          <p className="text-text-secondary text-[12px] mb-[var(--space-48)] opacity-60 uppercase tracking-widest">
            Выбери режим и найди соперника
          </p>

          {/* Mode Selector */}
          <div className="grid grid-cols-2 gap-4 mb-[var(--space-48)]">
            <button
              onClick={() => setGameMode('classic')}
              className={`p-6 rounded-[var(--radius-12)] border-2 transition-all ${
                gameMode === 'classic' 
                  ? 'bg-[rgba(126,184,126,0.1)] border-[var(--accent-brand)] shadow-[0_0_20px_rgba(126,184,126,0.1)]' 
                  : 'bg-surface border-transparent grayscale opacity-50 hover:grayscale-0 hover:opacity-100'
              }`}
            >
              <div className="text-[24px] mb-2">♔</div>
              <div className="text-[10px] font-bold uppercase tracking-widest">Классика</div>
            </button>
            <button
              onClick={() => setGameMode('fog_of_war')}
              className={`p-6 rounded-[var(--radius-12)] border-2 transition-all ${
                gameMode === 'fog_of_war' 
                  ? 'bg-[rgba(126,184,126,0.1)] border-[var(--accent-brand)] shadow-[0_0_20px_rgba(126,184,126,0.1)]' 
                  : 'bg-surface border-transparent grayscale opacity-50 hover:grayscale-0 hover:opacity-100'
              }`}
            >
              <div className="text-[24px] mb-2">☁</div>
              <div className="text-[10px] font-bold uppercase tracking-widest">Туман войны</div>
            </button>
          </div>

          <div className="mb-[var(--space-48)]">
            <Button 
              size="lg" 
              fullWidth 
              onClick={() => setIsColorPickerOpen(true)}
              className="py-6 shadow-[0_0_20px_rgba(126,184,126,0.1)] hover:shadow-[0_0_30px_rgba(126,184,126,0.2)]"
            >
              Создать закрытую комнату
            </Button>
            <p className="mt-4 text-[9px] text-text-secondary uppercase tracking-[0.2em] opacity-40">
              Создай комнату и отправь ссылку другу напрямую
            </p>
          </div>

          {/* Player Tabs */}
          <div className="flex gap-8 mb-[var(--space-24)] border-b border-[var(--border)] px-4">
            <button
              onClick={() => setActiveTab('recent')}
              className={`pb-3 text-[10px] font-bold uppercase tracking-widest transition-all relative ${
                activeTab === 'recent' ? 'text-text' : 'text-text-secondary opacity-50'
              }`}
            >
              Последние игроки
              {activeTab === 'recent' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-brand)]" />}
            </button>
            <button
              onClick={() => setActiveTab('online')}
              className={`pb-3 text-[10px] font-bold uppercase tracking-widest transition-all relative ${
                activeTab === 'online' ? 'text-text' : 'text-text-secondary opacity-50'
              }`}
            >
              Сейчас онлайн
              {activeTab === 'online' && onlineUsers.length > 0 && (
                 <span className="ml-2 w-1.5 h-1.5 rounded-full bg-[var(--success)] inline-block animate-pulse" />
              )}
              {activeTab === 'online' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-brand)]" />}
            </button>
          </div>

          {/* Player List */}
          <div className="space-y-4">
            {activeTab === 'recent' ? (
              recentPlayers.length === 0 ? (
                <p className="py-12 text-text-secondary text-[10px] uppercase opacity-40">Нет недавних игроков</p>
              ) : (
                recentPlayers.map(p => (
                  <PlayerRow 
                    key={p.uid} 
                    player={p} 
                    onChallenge={() => handleSendChallenge(p)} 
                    isPending={pendingOutgoing === p.uid}
                  />
                ))
              )
            ) : (
              onlineUsers.length === 0 ? (
                <p className="py-12 text-text-secondary text-[10px] uppercase opacity-40">Никого нет онлайн</p>
              ) : (
                onlineUsers.map(u => (
                  <PlayerRow 
                    key={u.uid} 
                    player={u} 
                    onChallenge={() => handleSendChallenge(u)}
                    isPending={pendingOutgoing === u.uid}
                  />
                ))
              )
            )}
          </div>
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
               Приглашает вас в {incomingChallenges[0].mode === 'classic' ? 'Классику' : 'Туман войны'}
             </div>
             <div className="grid grid-cols-2 gap-4">
                <Button variant="primary" onClick={() => handleAccept(incomingChallenges[0])}>Принять</Button>
                <Button variant="outline" onClick={() => declineChallenge(incomingChallenges[0].id)} className="bg-transparent opacity-60">Отклонить</Button>
             </div>
          </div>
        </Modal>
      )}

      <ColorPickerModal 
        isOpen={isColorPickerOpen} 
        onClose={() => setIsColorPickerOpen(false)} 
        gameMode={gameMode}
      />
      <Footer />
    </div>
  )
}

function PlayerRow({ player, onChallenge, isPending }: { player: AppUser, onChallenge: () => void, isPending: boolean }) {
  return (
    <Card padding="sm" className="flex items-center justify-between hover:border-[var(--accent-brand)] transition-colors group">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-[var(--radius-8)] bg-surface flex items-center justify-center font-bold text-[var(--accent-brand)] border border-[var(--border)] overflow-hidden">
          {player.photoURL || player.customAvatarURL ? (
            <img src={player.photoURL || player.customAvatarURL || ''} alt={player.displayName} className="w-full h-full object-cover" />
          ) : (
            player.displayName[0].toUpperCase()
          )}
        </div>
        <div className="text-left">
          <div className="text-[var(--font-size-sm)] font-bold text-text group-hover:text-[var(--accent-brand)] transition-colors">
            {player.displayName}
          </div>
          <div className="text-[9px] text-text-secondary uppercase tracking-widest opacity-60">
            {player.lastSeen ? 'Был недавно' : 'Активен'}
          </div>
        </div>
      </div>
      <Button 
        size="sm" 
        onClick={onChallenge} 
        disabled={isPending}
        className={isPending ? 'opacity-50' : ''}
      >
        {isPending ? 'Ждем...' : 'Вызвать'}
      </Button>
    </Card>
  )
}
