import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from './Modal'
import Button from './Button'
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
  const [tempColor, setTempColor] = useState<ColorChoice>('w')

  const handleStartGame = async () => {
    if (!user || !supabase) {
      addToast('Необходимо авторизоваться', 'warning')
      return
    }

    setCreating(true)

    const assignedColor = tempColor === 'random'
      ? (Math.random() < 0.5 ? 'w' : 'b')
      : tempColor

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

    try {
      // Retry on unique constraint violation (room_code collision)
      for (let attempt = 0; attempt < 3; attempt++) {
        const c = attempt === 0 ? code : generateRoomCode()
        const { error } = await supabase.from('games').insert({ ...roomData, room_code: c })

        if (!error) {
          setCreating(false)
          onClose()
          navigate(`/game/${c}`)
          return
        }

        // Only retry on unique violation (PostgreSQL code 23505)
        if (error && error.code !== '23505') {
          console.error('[Room] INSERT error:', error)
          addToast('Ошибка создания комнаты', 'error')
          setCreating(false)
          return
        }
      }
      addToast('Ошибка создания комнаты. Попробуйте ещё раз.', 'error')
      setCreating(false)
    } catch (err) {
      console.error('[Room] Exception:', err)
      addToast('Ошибка создания комнаты', 'error')
      setCreating(false)
    }
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      description="Го шахматы онлайн"
    >
      <div className="space-y-[var(--space-24)] pt-[var(--space-8)]">
        {/* Color Selection */}
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

        {/* Action Buttons */}
        <div className="space-y-[var(--space-12)]">
          <Button 
            fullWidth 
            onClick={handleStartGame}
            variant="primary"
            disabled={creating}
          >
            {creating ? 'Создание...' : 'Создать игру'}
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
      </div>
    </Modal>
  )
}
