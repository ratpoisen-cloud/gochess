import { useEffect, useState } from 'react'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import { BOT_LEVELS } from '@/lib/botLevels'
import { OPENINGS } from '@/lib/openingsData'
import type { BotLevel } from '@/types'

interface TrainingSetupModalProps {
  isOpen: boolean
  onClose: () => void
  /** Старт тренировки: дебют (null — свободная позиция) и сложность Ичи. */
  onStart: (openingId: string | null, level: BotLevel) => void
  initialOpeningId?: string | null
  initialLevel?: BotLevel
}

/**
 * Настройка тренировки с Ичи: дебют и сложность.
 *
 * Выбор дебюта задаёт стартовую позицию (конец главной линии), сложность —
 * силу Ичи: подсказки и ход «за Ичи».
 */
export default function TrainingSetupModal({
  isOpen,
  onClose,
  onStart,
  initialOpeningId = null,
  initialLevel = 'medium',
}: TrainingSetupModalProps) {
  const [openingId, setOpeningId] = useState<string | null>(initialOpeningId)
  const [level, setLevel] = useState<BotLevel>(initialLevel)

  useEffect(() => {
    if (!isOpen) return
    setOpeningId(initialOpeningId)
    setLevel(initialLevel)
  }, [isOpen, initialOpeningId, initialLevel])

  const handleStart = (selectedLevel: BotLevel) => {
    setLevel(selectedLevel)
    onStart(openingId, selectedLevel)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Тренировка с Ичи" description="Выберите дебют и сложность соперника">
      <div className="space-y-6 pt-4 text-left">
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block px-1">
            Дебют
          </label>

          <div className="max-h-[240px] space-y-1 overflow-y-auto pr-1 custom-scrollbar">
            <Button
              variant="primary"
              size="sm"
              fullWidth
              onClick={() => setOpeningId(null)}
              className={`border-2 text-left justify-start ${
                openingId === null
                  ? '!border-[var(--accent-brand)]'
                  : 'border-transparent opacity-60'
              }`}
            >
              Свободная позиция
            </Button>

            {OPENINGS.map((opening) => (
              <Button
                key={opening.id}
                variant="primary"
                size="sm"
                fullWidth
                onClick={() => setOpeningId(opening.id)}
                className={`border-2 text-left justify-start ${
                  openingId === opening.id
                    ? '!border-[var(--accent-brand)]'
                    : 'border-transparent opacity-60'
                }`}
              >
                {opening.name}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block px-1">
            Сложность
          </label>
          <div className="grid grid-cols-2 gap-2">
            {BOT_LEVELS.map((item) => (
              <Button
                key={item.id}
                variant="primary"
                size="sm"
                onClick={() => handleStart(item.id)}
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
            Выбор уровня сразу начинает тренировку
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <Button fullWidth variant="outline" onClick={onClose} className="hover:!bg-[var(--danger-soft)] transition-colors">
            Отмена
          </Button>
        </div>
      </div>
    </Modal>
  )
}
