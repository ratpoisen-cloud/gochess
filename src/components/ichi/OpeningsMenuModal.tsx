import Modal from '@/components/Modal'
import Button from '@/components/Button'
import { OPENINGS, OPENING_FAMILIES, type OpeningFamily } from '@/lib/openingsData'
import { useOpeningStore } from '@/stores/openingStore'

export type OpeningsMode = 'trainer' | 'reference'

interface OpeningsMenuModalProps {
  isOpen: boolean
  onClose: () => void
  /** Режим книги дебютов и фильтры. */
  onSelect: (mode: OpeningsMode, family: OpeningFamily | 'all', color?: 'w' | 'b') => void
}

/**
 * Книга дебютов: тренажёр или справочник по цвету/семейству.
 */
export default function OpeningsMenuModal({ isOpen, onClose, onSelect }: OpeningsMenuModalProps) {
  const studiedOpeningIds = useOpeningStore((state) => state.studiedOpeningIds)

  const whiteOpenings = OPENINGS.filter((opening) => opening.color === 'w')
  const blackOpenings = OPENINGS.filter((opening) => opening.color === 'b')

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Дебюты" description="Тренажёр или справочник по дебютам">
      <div className="space-y-6 pt-4 text-left">
        <div className="space-y-2">
          <Button
            variant="primary"
            size="sm"
            fullWidth
            onClick={() => onSelect('trainer', 'all')}
            className="border-2 border-transparent opacity-90 justify-start text-left"
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-[11px] font-bold">Тренажёр</span>
              <span className="text-[9px] font-bold uppercase tracking-wider opacity-70 shrink-0">
                {OPENINGS.length}
              </span>
            </div>
          </Button>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block px-1">
            Цвет
          </label>
          <Button
            variant="primary"
            size="sm"
            fullWidth
            onClick={() => onSelect('reference', 'all', 'w')}
            className="border-2 border-transparent opacity-90 justify-start text-left"
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-[11px] font-bold">Дебюты за белых</span>
              <span className="text-[9px] font-bold uppercase tracking-wider opacity-70 shrink-0">
                {whiteOpenings.length}
              </span>
            </div>
          </Button>
          <Button
            variant="primary"
            size="sm"
            fullWidth
            onClick={() => onSelect('reference', 'all', 'b')}
            className="border-2 border-transparent opacity-90 justify-start text-left"
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-[11px] font-bold">Дебюты за чёрных</span>
              <span className="text-[9px] font-bold uppercase tracking-wider opacity-70 shrink-0">
                {blackOpenings.length}
              </span>
            </div>
          </Button>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block px-1">
            Стратегия
          </label>
          {OPENING_FAMILIES.filter((family) => family.id !== 'all').map((family) => {
            const familyOpenings = OPENINGS.filter((opening) => opening.family === family.id)
            const studied = familyOpenings.filter((opening) =>
              studiedOpeningIds.includes(opening.id)
            ).length

            return (
              <Button
                key={family.id}
                variant="primary"
                size="sm"
                fullWidth
                onClick={() => onSelect('reference', family.id)}
                className="border-2 border-transparent opacity-90 justify-start text-left"
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="text-[11px] font-bold">{family.label}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider opacity-70 shrink-0">
                    {studied}/{familyOpenings.length}
                  </span>
                </div>
              </Button>
            )
          })}
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
