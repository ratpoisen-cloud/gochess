import Modal from '@/components/Modal'
import Button from '@/components/Button'
import { PUZZLES, PUZZLE_THEMES, type PuzzleTheme } from '@/lib/puzzlesData'
import { usePuzzleStore } from '@/stores/puzzleStore'

interface PuzzleBlocksModalProps {
  isOpen: boolean
  onClose: () => void
  /** Блок задач, с которого начинается разбор. */
  onSelect: (category: PuzzleTheme | 'all') => void
}

/**
 * Блоки тактических задач: темы пазлов с прогрессом.
 *
 * Открывается из хаба Ичи, дальше страница пазлов работает с выбранным блоком.
 */
export default function PuzzleBlocksModal({ isOpen, onClose, onSelect }: PuzzleBlocksModalProps) {
  const isSolved = usePuzzleStore((state) => state.isSolved)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Пазлы" description="Выберите блок задач">
      <div className="space-y-6 pt-4 text-left">
        <div className="space-y-2">
          {PUZZLE_THEMES.map((theme) => {
            const puzzles =
              theme.id === 'all'
                ? PUZZLES
                : PUZZLES.filter((puzzle) => puzzle.theme === theme.id)
            const solved = puzzles.filter((puzzle) => isSolved(puzzle.id)).length

            return (
              <Button
                key={theme.id}
                variant="primary"
                size="sm"
                fullWidth
                onClick={() => onSelect(theme.id)}
                className="border-2 border-transparent opacity-90 justify-start text-left"
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="text-[11px] font-bold">{theme.label}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider opacity-70 shrink-0">
                    {solved}/{puzzles.length}
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
