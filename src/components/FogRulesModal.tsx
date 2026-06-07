import Modal from './Modal'
import Button from './Button'

interface FogRulesModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function FogRulesModal({ isOpen, onClose }: FogRulesModalProps) {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Туман войны: Правила"
    >
      <div className="space-y-6 pt-4">
        <div className="space-y-4">
          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-[rgba(126,184,126,0.1)] flex items-center justify-center text-[var(--accent-brand)] font-bold">1</div>
            <div>
              <h4 className="text-[var(--font-size-sm)] font-bold uppercase tracking-widest mb-1">Ограниченная видимость</h4>
              <p className="text-[11px] text-text-secondary leading-[1.6]">
                Вы видите только те клетки, на которые могут пойти ваши фигуры, а также клетки, на которых они стоят. Остальная часть доски скрыта туманом.
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-[rgba(126,184,126,0.1)] flex items-center justify-center text-[var(--accent-brand)] font-bold">2</div>
            <div>
              <h4 className="text-[var(--font-size-sm)] font-bold uppercase tracking-widest mb-1">Зрение пешек</h4>
              <p className="text-[11px] text-text-secondary leading-[1.6]">
                Пешки видят клетки, которые они атакуют (по диагонали перед собой), даже если на этих клетках нет фигур соперника.
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-[rgba(126,184,126,0.1)] flex items-center justify-center text-[var(--accent-brand)] font-bold">3</div>
            <div>
              <h4 className="text-[var(--font-size-sm)] font-bold uppercase tracking-widest mb-1">Никаких уведомлений</h4>
              <p className="text-[11px] text-text-secondary leading-[1.6]">
                В этом режиме игра не сообщает о Шахе или Мате. Вы должны сами следить за безопасностью короля и обнаруживать ловушки соперника.
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-[rgba(126,184,126,0.1)] flex items-center justify-center text-[var(--accent-brand)] font-bold">4</div>
            <div>
              <h4 className="text-[var(--font-size-sm)] font-bold uppercase tracking-widest mb-1">Цель игры</h4>
              <p className="text-[11px] text-text-secondary leading-[1.6]">
                Побеждает тот, кто первым поставит мат королю соперника. Но помните: в тумане даже мат может произойти неожиданно!
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <Button fullWidth onClick={onClose}>Понятно</Button>
        </div>
      </div>
    </Modal>
  )
}
