import { useState, useEffect } from 'react'
import Modal from './Modal'
import Button from './Button'
import { useToast } from './Toast'
import { supabase } from '@/lib/supabase'
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

interface CreateRoomModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function CreateRoomModal({ isOpen, onClose }: CreateRoomModalProps) {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [step, setStep] = useState<'create' | 'link' | 'error'>('create')
  const [roomUrl, setRoomUrl] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setStep('create')
      setRoomUrl('')
      setRoomCode('')
      setCopied(false)
    }
  }, [isOpen])

  const handleCreateRoom = async () => {
    if (!user || !supabase) {
      addToast('Необходимо авторизоваться', 'warning')
      return
    }

    const code = generateRoomCode()
    const baseUrl = window.location.origin + BASE
    const url = `${baseUrl}game/${code}`

    try {
      const { error } = await supabase
        .from('games')
        .insert({
          room_code: code,
          white_player_id: user.uid,
          white_name: user.displayName,
          game_type: 'online',
          pgn: '',
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          game_state: 'active',
          turn: 'w',
        })

      if (error) {
        console.error('Create room error:', error)
        setStep('error')
        addToast('Ошибка создания комнаты: ' + error.message, 'error')
        return
      }

      setRoomCode(code)
      setRoomUrl(url)
      setStep('link')
      addToast('Комната создана!', 'success')
    } catch (err: any) {
      console.error('Create room error:', err)
      setStep('error')
      addToast('Ошибка создания комнаты', 'error')
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Игра по сети" description="Создай комнату и пригласи друга">
      <div className="space-y-[var(--space-16)]">
        {step === 'create' && (
          <div className="text-center">
            <p className="text-text-secondary text-[var(--font-size-sm)] mb-[var(--space-20)]">
              Создай комнату — получи ссылку-приглашение и отправь её другу.
            </p>
            <Button onClick={handleCreateRoom} fullWidth>
              Создать комнату
            </Button>
          </div>
        )}

        {step === 'link' && (
          <div className="text-center space-y-[var(--space-16)]">
            <p className="text-text-secondary text-[var(--font-size-sm)]">
              Комната создана! Отправь ссылку другу:
            </p>
            <div className="flex items-center gap-[var(--space-8)] p-[var(--space-12)] rounded-[var(--radius-8)]"
              style={{ background: 'color-mix(in srgb, var(--accent-brand) 10%, var(--bg))', border: '1px solid color-mix(in srgb, var(--accent-brand) 30%, var(--border))' }}
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
            <div className="flex items-center justify-center gap-[var(--space-8)]">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-brand)] animate-pulse" />
              <span className="text-text-secondary text-[var(--font-size-xs)]">
                Ожидаем соперника...
              </span>
            </div>
            <p className="text-text-secondary text-[10px]">
              Код комнаты: <span className="text-[var(--accent-brand)] font-bold tracking-wider">{roomCode}</span>
            </p>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center">
            <p className="text-[var(--danger)] text-[var(--font-size-sm)] mb-[var(--space-20)]">
              Не удалось создать комнату. Попробуй ещё раз.
            </p>
            <Button onClick={() => { setStep('create'); handleCreateRoom() }} fullWidth>
              Повторить
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
