import { useEffect, useState } from 'react'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import { BOT_LEVELS } from '@/lib/botLevels'
import type { BotLevel } from '@/types'

/** Цвет, который игрок отдаёт на выбор. 'random' — жребий. */
export type SetupColor = 'w' | 'b' | 'random'

interface GameSetupModalProps {
  isOpen: boolean
  onClose: () => void
  /** Старт партии: уровень Ичи и итоговый цвет игрока. */
  onStart: (level: BotLevel, color: 'w' | 'b') => void
  initialColor?: SetupColor
  initialLevel?: BotLevel
}

const COLORS: { id: SetupColor; label: string }[] = [
  { id: 'w', label: 'Белые' },
  { id: 'b', label: 'Чёрные' },
  { id: 'random', label: 'Случайно' },
]

/**
 * Настройка партии с Ичи: цвет и сложность.
 *
 * Модалка общая для хаба Ичи (/ichi) и страницы партии (/bot): хаб выбирает
 * параметры и уходит на /bot?color=&level=, а прямая ссылка на /bot
 * показывает ту же модалку.
 */
export default function GameSetupModal({
  isOpen,
  onClose,
  onStart,
  initialColor = 'w',
  initialLevel = 'medium',
}: GameSetupModalProps) {
  const [color, setColor] = useState<SetupColor>(initialColor)
  const [level, setLevel] = useState<BotLevel>(initialLevel)

  // Каждое открытие модалки начинается с исходных значений.
  useEffect(() => {
    if (!isOpen) return
    setColor(initialColor)
    setLevel(initialLevel)
  }, [isOpen, initialColor, initialLevel])

  const handleStart = (selectedLevel: BotLevel) => {
    const finalColor: 'w' | 'b' =
      color === 'random' ? (Math.random() > 0.5 ? 'w' : 'b') : color
    onStart(selectedLevel, finalColor)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Партия с Ичи"
      description="Выберите цвет и сложность соперника"
    >
      <div className="space-y-[var(--space-20)] pt-[var(--space-4)] text-left">
        <div className="space-y-[var(--space-8)]">
          <label className="block px-1 text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            Ваш цвет
          </label>
          <div className="grid grid-cols-3 gap-2">
            {COLORS.map((item) => (
              <Button
                key={item.id}
                size="sm"
                onClick={() => setColor(item.id)}
                className={`border-2 ${
                  color === item.id
                    ? '!border-[var(--accent-brand)]'
                    : 'border-transparent opacity-60'
                }`}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-[var(--space-8)]">
          <label className="block px-1 text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            Сложность
          </label>
          <div className="grid grid-cols-2 gap-2">
            {BOT_LEVELS.map((item) => (
              <Button
                key={item.id}
                size="sm"
                onClick={() => {
                  setLevel(item.id)
                  handleStart(item.id)
                }}
                className={`border-2 ${
                  level === item.id
                    ? '!border-[var(--accent-brand)]'
                    : 'border-transparent opacity-60'
                }`}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <p className="px-1 text-[9px] uppercase tracking-wider text-text-secondary opacity-60">
            Выбор уровня сразу начинает партию
          </p>
        </div>

        <div className="border-t border-[color-mix(in_srgb,var(--border)_40%,transparent)] pt-2">
          <Button
            fullWidth
            onClick={onClose}
            variant="outline"
            className="hover:!bg-[var(--danger-soft)] hover:!border-[var(--danger-border)]"
          >
            Отмена
          </Button>
        </div>
      </div>
    </Modal>
  )
}
