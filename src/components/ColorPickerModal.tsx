import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from './Modal'
import Button from './Button'
import { useToast } from './Toast'
import { db } from '@/lib/firebase'
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'

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
}

type ColorChoice = 'w' | 'b' | 'random'

export default function ColorPickerModal({ isOpen, onClose }: ColorPickerModalProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToast } = useToast()
  
  const [step, setStep] = useState<'picker' | 'link'>('picker')
  const [creating, setCreating] = useState(false)
  const [tempColor, setTempColor] = useState<ColorChoice>('w')
  
  const [roomUrl, setRoomUrl] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setStep('picker')
      setCreating(false)
      setCopied(false)
    }
  }, [isOpen])

  const handleStartGame = async () => {
    if (!user) {
      addToast('Необходимо авторизоваться', 'warning')
      return
    }

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
        pgn: '',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        game_state: 'active',
        turn: 'w',
        created_at: serverTimestamp(),
        reactions: [],
        undo_request: null,
        draw_request: null,
        rematch_request: null
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
                  Черные
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

            <div className="space-y-[var(--space-12)]">
              <Button 
                fullWidth 
                onClick={handleStartGame}
                variant="primary"
                disabled={creating}
              >
                {creating ? 'Создание...' : 'Создать комнату'}
              </Button>

              <div className="pt-2 border-t border-[color-mix(in_srgb,var(--border)_40%,transparent)]">
                <Button 
                  fullWidth 
                  onClick={onClose}
                  variant="primary"
                  className="hover:!bg-[var(--danger-soft)] hover:!border-[var(--danger-border)]"
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
                className="flex-1 bg-transparent text-text text-[var(--font-size-xs)] outline-none truncate select-all"
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
