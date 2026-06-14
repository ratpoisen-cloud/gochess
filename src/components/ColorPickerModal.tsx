import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from './Modal'
import Button from './Button'
import { useToast } from './Toast'
import { db } from '@/lib/firebase'
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'

import type { GameMode, User as AppUser } from '@/types'
import { useChallenges } from '@/hooks/useChallenges'

const BASE = import.meta.env.BASE_URL || '/'

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

interface ColorPickerModalProps {
  isOpen: boolean
  onClose: () => void
  gameMode?: GameMode
  recentPlayers?: AppUser[]
}

type ColorChoice = 'w' | 'b' | 'random'

interface TimeControl {
  base: number    // seconds
  increment: number // seconds
  label: string
}

const TIME_CONTROLS: TimeControl[] = [
  { base: 600, increment: 0, label: '10 + 0' },
  { base: 900, increment: 0, label: '15 + 0' },
  { base: 1800, increment: 0, label: '30 + 0' },
  { base: 600, increment: 5, label: '10 + 5' },
  { base: 900, increment: 5, label: '15 + 5' },
  { base: 1800, increment: 5, label: '30 + 5' },
]

export default function ColorPickerModal({ 
  isOpen, 
  onClose, 
  gameMode = 'classic',
  recentPlayers = [] 
}: ColorPickerModalProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToast } = useToast()
  const { sendChallenge } = useChallenges()
  
  const [step, setStep] = useState<'picker' | 'link'>('picker')
  const [creating, setCreating] = useState(false)
  const [tempColor, setTempColor] = useState<ColorChoice>('w')
  const [selectedTime, setSelectedTime] = useState<TimeControl>(TIME_CONTROLS[0])
  const [pendingChallenge, setPendingChallenge] = useState<string | null>(null)
  const [showTimeHelp, setShowTimeHelp] = useState(false)
  
  const [roomUrl, setRoomUrl] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setStep('picker')
      setCreating(false)
      setCopied(false)
      setPendingChallenge(null)
      setShowTimeHelp(false)
    }
  }, [isOpen])

  const handleChallenge = async (toUser: AppUser) => {
    try {
      setPendingChallenge(toUser.uid)
      await sendChallenge(toUser.uid, gameMode)
      addToast(`Вызов отправлен ${toUser.displayName}`, 'success')
      setTimeout(() => setPendingChallenge(null), 5000)
    } catch (err) {
      addToast('Ошибка при отправке вызова', 'error')
      setPendingChallenge(null)
    }
  }

  const handleStartGame = async () => {
    if (!user) {
      addToast('Необходимо авторизоваться', 'warning')
      return
    }
    if (!db) return

    setCreating(true)

    const assignedColor = tempColor === 'random'
      ? (Math.random() < 0.5 ? 'w' : 'b')
      : tempColor

    try {
      let code = ''
      let isUnique = false
      let attempts = 0

      while (!isUnique && attempts < 5) {
        code = generateRoomCode()
        const q = query(collection(db, 'games'), where('room_code', '==', code), limit(1))
        const snapshot = await getDocs(q)
        if (snapshot.empty) {
          isUnique = true
        }
        attempts++
      }

      if (!isUnique) throw new Error('Не удалось сгенерировать уникальный код')

      const roomData = {
        room_code: code,
        white_player_id: assignedColor === 'w' ? user.uid : null,
        white_name: assignedColor === 'w' ? (user.displayName || 'Игрок') : '',
        black_player_id: assignedColor === 'b' ? user.uid : null,
        black_name: assignedColor === 'b' ? (user.displayName || 'Игрок') : '',
        game_type: 'online',
        game_mode: gameMode,
        pgn: '',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        game_state: 'active',
        turn: 'w',
        created_at: serverTimestamp(),
        last_move_time: serverTimestamp(),
        reactions: [],
        undo_request: null,
        draw_request: null,
        rematch_request: null,
        // Rapid Fields
        time_control: gameMode === 'rapid' ? { base: selectedTime.base, increment: selectedTime.increment } : null,
        white_time_left: gameMode === 'rapid' ? selectedTime.base * 1000 : null,
        black_time_left: gameMode === 'rapid' ? selectedTime.base * 1000 : null,
        last_timer_update: null,
        timer_status: 'paused'
      }

      await addDoc(collection(db, 'games'), roomData)

      const baseUrl = window.location.origin + BASE
      setRoomCode(code)
      setRoomUrl(`${baseUrl}game/${code}`)
      setStep('link')
      setCreating(false)
      addToast('Комната создана!', 'success')
    } catch (err: any) {
      console.error('[Room] Error creating game:', err)
      addToast('Ошибка создания комнаты: ' + (err.message || ''), 'error')
      setCreating(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl)
      setCopied(true)
      addToast('Ссылка скопирована!', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      addToast('Не удалось скопировать', 'error')
    }
  }

  const handleJoin = () => {
    onClose()
    navigate(`/game/${roomCode}`)
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={step === 'picker' ? 'Игра по сети' : 'Пригласить друга'}
      description={step === 'picker' ? 'Выбери цвет и создай комнату' : 'Отправь ссылку сопернику'}
    >
      <div className="space-y-[var(--space-24)] pt-[var(--space-8)]">
        {step === 'picker' && (
          <>
            <div className="space-y-[var(--space-12)]">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block text-left px-1">
                Ваш цвет
              </label>
              <div className="space-y-2">
                <Button 
                  fullWidth
                  variant="primary" 
                  onClick={() => setTempColor('w')}
                  className={`border-2 ${tempColor === 'w' ? '!border-[var(--accent)]' : 'border-transparent opacity-60'}`}
                  disabled={creating}
                >
                  Белые
                </Button>
                <Button 
                  fullWidth
                  variant="primary" 
                  onClick={() => setTempColor('b')}
                  className={`border-2 ${tempColor === 'b' ? '!border-[var(--accent)]' : 'border-transparent opacity-60'}`}
                  disabled={creating}
                >
                  Чёрные
                </Button>
                <Button 
                  fullWidth
                  variant="primary" 
                  onClick={() => setTempColor('random')}
                  className={`border-2 ${tempColor === 'random' ? '!border-[var(--accent)]' : 'border-transparent opacity-60'}`}
                  disabled={creating}
                >
                  Случайно 🎲
                </Button>
              </div>
            </div>

            {gameMode === 'rapid' && (
              <div className="space-y-[var(--space-12)]">
                <div className="flex items-center gap-2 px-1">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block text-left">
                    Контроль времени
                  </label>
                  <button 
                    type="button"
                    onClick={() => setShowTimeHelp(!showTimeHelp)}
                    className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] transition-all ${
                      showTimeHelp 
                        ? 'bg-[var(--accent-brand)] border-[var(--accent-brand)] text-bg' 
                        : 'border-[var(--border)] text-text-secondary hover:text-[var(--accent-brand)] hover:border-[var(--accent-brand)]'
                    }`}
                  >
                    ?
                  </button>
                </div>

                {showTimeHelp && (
                  <div className="p-3 rounded-[var(--radius-8)] bg-[rgba(255,255,255,0.02)] border border-[var(--border)] animate-modal-pixel-in">
                    <p className="text-[9px] text-text-secondary leading-relaxed text-left">
                      <span className="text-text font-bold">Как работает время:</span>
                      <br /><br />
                      Первое число — это основной запас минут на всю партию для каждого игрока.
                      <br /><br />
                      Второе число — <span className="text-[var(--accent-brand)] font-bold">инкремент</span> (добавление):
                      <br />
                      • <span className="text-[var(--accent-brand)] font-bold">+0</span> — время только убавляется. Если оно закончится, вы проиграли.
                      <br />
                      • <span className="text-[var(--accent-brand)] font-bold">+5</span> — после каждого сделанного хода вам возвращается 5 секунд. Это помогает не проиграть по времени в самом конце игры.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {TIME_CONTROLS.map((tc) => (
                    <Button 
                      key={tc.label}
                      variant="primary" 
                      onClick={() => setSelectedTime(tc)}
                      className={`text-[9px] h-10 border-2 ${selectedTime.label === tc.label ? '!border-[var(--accent)]' : 'border-transparent opacity-60'}`}
                      disabled={creating}
                    >
                      {tc.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-[var(--space-12)]">
              <Button 
                fullWidth 
                onClick={handleStartGame}
                variant="primary"
                disabled={creating}
                className="shadow-[0_0_15px_rgba(126,184,126,0.1)]"
              >
                {creating ? 'Создание...' : 'Создать комнату по ссылке'}
              </Button>

              {recentPlayers.length > 0 && (
                <div className="pt-6 mt-6 border-t border-[color-mix(in_srgb,var(--border)_40%,transparent)]">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em] block text-center mb-4">
                    Пригласить друга
                  </label>
                  <div className="max-h-[220px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    {recentPlayers.map(p => (
                      <div 
                        key={p.uid}
                        className="flex items-center justify-between p-3 rounded-[var(--radius-8)] bg-[rgba(255,255,255,0.02)] border border-[var(--border)] hover:border-[var(--accent-brand)] transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-[var(--radius-4)] bg-surface border border-[var(--border)] flex items-center justify-center font-bold text-[10px] text-[var(--accent-brand)] overflow-hidden">
                            {p.photoURL ? (
                              <img src={p.photoURL} alt={p.displayName} className="w-full h-full object-cover" />
                            ) : p.displayName[0].toUpperCase()}
                          </div>
                          <span className="text-[11px] font-bold text-text-secondary group-hover:text-text transition-colors">
                            {p.displayName}
                          </span>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleChallenge(p)}
                          disabled={pendingChallenge === p.uid}
                          className="h-8 px-4 text-[9px]"
                        >
                          {pendingChallenge === p.uid ? '...' : 'Вызвать'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 mt-2 border-t border-[color-mix(in_srgb,var(--border)_40%,transparent)]">
                <Button 
                  fullWidth 
                  onClick={onClose}
                  variant="primary"
                  className="bg-transparent border-transparent text-text-secondary hover:text-text opacity-60"
                  disabled={creating}
                >
                  Отмена
                </Button>
              </div>
            </div>
          </>
        )}

        {step === 'link' && (
          <div className="text-center space-y-[var(--space-20)]">
            <div className="flex items-center gap-[var(--space-8)] p-[var(--space-12)] rounded-[var(--radius-8)]"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
            >
              <input
                type="text"
                readOnly
                value={roomUrl}
                className="flex-1 min-w-0 bg-transparent text-text text-[var(--font-size-xs)] outline-none truncate select-all"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={handleCopy}
                className="shrink-0 px-[var(--space-12)] py-[var(--space-6)] rounded-[var(--radius-4)] text-[10px] font-bold uppercase tracking-wider transition-colors"
                style={{
                  background: copied
                    ? 'color-mix(in srgb, var(--success) 20%, var(--bg))'
                    : 'color-mix(in srgb, var(--accent-brand) 20%, var(--bg))',
                  color: copied ? 'var(--success)' : 'var(--accent-brand)',
                }}
              >
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(roomUrl)}&text=${encodeURIComponent('Сыграем в шахматы?')}`, '_blank')}
                className="flex-1 p-[var(--space-8)] rounded-[var(--radius-8)] bg-[rgba(255,255,255,0.03)] border border-[var(--border)] text-[9px] font-bold uppercase tracking-widest text-text-secondary hover:text-[var(--accent-brand)] hover:border-[var(--accent-brand)] transition-all"
              >
                Telegram
              </button>
              <button 
                onClick={() => window.open(`https://vk.com/share.php?url=${encodeURIComponent(roomUrl)}`, '_blank')}
                className="flex-1 p-[var(--space-8)] rounded-[var(--radius-8)] bg-[rgba(255,255,255,0.03)] border border-[var(--border)] text-[9px] font-bold uppercase tracking-widest text-text-secondary hover:text-[var(--accent-brand)] hover:border-[var(--accent-brand)] transition-all"
              >
                ВКонтакте
              </button>
            </div>
            
            <div className="flex flex-col gap-2">
              <Button onClick={handleJoin} fullWidth>
                Перейти к игре
              </Button>
              <Button variant="primary" onClick={onClose} fullWidth className="opacity-60">
                Закрыть
              </Button>
            </div>

            <p className="text-text-secondary text-[10px] uppercase tracking-widest">
              Код комнаты: <span className="text-[var(--accent-brand)] font-bold">{roomCode}</span>
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
