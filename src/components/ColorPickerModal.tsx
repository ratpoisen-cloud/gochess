import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from './Modal'
import { useToast } from './Toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

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
  const [creating, setCreating] = useState(false)

  const handleChoose = async (choice: ColorChoice) => {
    if (!user || !supabase) {
      addToast('Необходимо авторизоваться', 'warning')
      return
    }

    setCreating(true)

    const assignedColor = choice === 'random'
      ? (Math.random() < 0.5 ? 'w' : 'b')
      : choice

    const code = generateRoomCode()
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
    }

    console.log('[Room] Creating room with code:', code, 'color:', assignedColor)
    console.log('[Room] user:', user.uid, user.displayName)

    try {
      const { error } = await supabase.from('games').insert(roomData)

      if (error) {
        console.error('[Room] INSERT error:', error)
        addToast(`Ошибка создания комнаты`, 'error')
        setCreating(false)
        return
      }

      console.log('[Room] INSERT OK for code:', code)

      setCreating(false)
      onClose()
      navigate(`/game/${code}`)
    } catch (err) {
      console.error('[Room] Exception:', err)
      addToast('Ошибка создания комнаты', 'error')
      setCreating(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Игра по сети" description="Выбери цвет, которым будешь играть">
      <button
        onClick={onClose}
        className="text-[10px] font-bold text-text-secondary hover:text-text transition-colors px-0 uppercase tracking-widest block mb-[var(--space-16)]"
        style={{ fontFamily: 'var(--font-family-ui)' }}
      >
        Назад
      </button>
      <div className="space-y-[var(--space-12)]">
        <button
          onClick={() => handleChoose('w')}
          disabled={creating}
          className="w-full inline-flex items-center justify-center min-h-[var(--btn-height)] px-[var(--btn-padding-x)] text-[var(--btn-font-size)] border rounded-[var(--btn-radius)] font-semibold cursor-pointer leading-[1.3] text-center tracking-[0.012em] shadow-none transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'var(--text)',
            color: 'var(--bg)',
            borderColor: 'var(--accent-brand)',
          }}
        >
          Белые
        </button>

        <button
          onClick={() => handleChoose('b')}
          disabled={creating}
          className="w-full inline-flex items-center justify-center min-h-[var(--btn-height)] px-[var(--btn-padding-x)] text-[var(--btn-font-size)] border rounded-[var(--btn-radius)] font-semibold cursor-pointer leading-[1.3] text-center tracking-[0.012em] shadow-none transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
          }}
        >
          Чёрные
        </button>

        <div className="relative py-[var(--space-4)]">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[color-mix(in_srgb,var(--border)_40%,transparent)]" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-[var(--bg)] px-[var(--space-12)] text-[var(--font-size-xs)] text-text-secondary uppercase tracking-widest">
              Или
            </span>
          </div>
        </div>

        <button
          onClick={() => handleChoose('random')}
          disabled={creating}
          className="w-full inline-flex items-center justify-center min-h-[var(--btn-height)] px-[var(--btn-padding-x)] text-[var(--btn-font-size)] border rounded-[var(--btn-radius)] font-semibold cursor-pointer leading-[1.3] text-center tracking-[0.012em] shadow-none transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'var(--accent-brand)',
            border: '1px solid color-mix(in srgb, var(--accent-brand) 60%, var(--border))',
            color: 'var(--bg)',
          }}
        >
          Случайно
        </button>

        {creating && (
          <div className="text-center">
            <span className="text-text-secondary text-[var(--font-size-xs)] animate-pulse">Создание комнаты...</span>
          </div>
        )}
      </div>
    </Modal>
  )
}
