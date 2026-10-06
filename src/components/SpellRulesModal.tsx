import Modal from './Modal'
import Button from './Button'
import { SPELL_DETAILS } from './board/SpellInfoPanel'
import { SPELL_UNLOCK, type SpellName } from '@/lib/spellChessEngine'
import { SPELL_ORDER, spellIconFile, spellCharges, isFreeSpell, isSpellAvailableTo } from '@/lib/spellMeta'

interface SpellRulesModalProps {
  isOpen: boolean
  onClose: () => void
  playerColor?: 'w' | 'b' | null
}

const RULES: Array<{ title: string; body: string }> = [
  {
    title: 'Победа — только взятие короля',
    body: 'Взять короля соперника. Это единственный способ закончить партию. Партия не заканчивается ни матом, ни патом, ни ничьей.',
  },
  {
    title: 'Шаха не существует',
    body: 'У короля нет режима «в шахе». Ходы, которые оставляют вашего короля под ударом, разрешены — и соперник не получит за это ни шаха, ни мата. Король защищается только реальными фигурами.',
  },
  {
    title: 'Свободные и завершающие',
    body: 'Свободное заклинание не заканчивает ход — таких можно применить несколько за ход. Завершающее заканчивает ход, поэтому за ход выбирается только одно.',
  },
  {
    title: 'Заряды не восстанавливаются',
    body: 'Вместо маны и кулдаунов у каждого заклинания есть конечное число зарядов на всю партию. Потратив заряд, вы больше не сможете применить это заклинание.',
  },
  {
    title: 'Открытие по ходу',
    body: 'Заклинания становятся доступны по ходу партии, поэтому счётчик «Ход N» над доской — не украшение. Заклинание открывается на указанном в таблице полуходе.',
  },
  {
    title: 'Короли неуязвимы к магии',
    body: 'Заморозка и взрыв не действуют на королей. Короля можно только взять обычным ходом.',
  },
  {
    title: 'Взрыв срабатывает не под тем, кто наступил',
    body: 'Поставленная мина взрывается в начале следующего хода того, кто её поставил, а не под фигурой, которая на неё наступила. Обозначение на клетке относится к вашей зоне, а не к сопернику.',
  },
]

export default function SpellRulesModal({ isOpen, onClose, playerColor = null }: SpellRulesModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Магия: Правила" maxWidth="max-w-2xl">
      <div className="space-y-6 pt-2 text-left">
        <div className="space-y-3">
          {RULES.map((rule, index) => (
            <div key={rule.title} className="flex gap-3 items-start">
              <div className="w-6 h-6 shrink-0 rounded-[var(--radius-4)] bg-[rgba(126,184,126,0.1)] flex items-center justify-center text-[var(--accent-brand)] font-bold text-[11px]">
                {index + 1}
              </div>
              <div>
                <h4 className="text-[var(--font-size-sm)] font-bold tracking-wide mb-1">{rule.title}</h4>
                <p className="text-[11px] text-text-secondary leading-[1.6]">{rule.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div>
          <h4 className="text-[var(--font-size-sm)] font-bold uppercase tracking-widest mb-1">Заклинания</h4>
          <p className="text-[11px] text-text-secondary leading-[1.6] mb-3">
            Порядок — по открытию в игре. Заряды указаны для белых и чёрных отдельно: часть заклинаний доступна только одной стороне.
          </p>

          <div className="space-y-2">
            {SPELL_ORDER.map((spell: SpellName) => {
              const details = SPELL_DETAILS[spell]
              const whiteCharges = spellCharges(spell, 'w')
              const blackCharges = spellCharges(spell, 'b')
              const mine = playerColor ? isSpellAvailableTo(spell, playerColor) : null

              return (
                <div
                  key={spell}
                  className={`flex gap-3 p-[var(--space-12)] rounded-[var(--radius-8)] border ${
                    mine === false
                      ? 'border-[rgba(255,255,255,0.05)] opacity-45'
                      : 'border-[rgba(255,255,255,0.08)]'
                  }`}
                >
                  <img src={spellIconFile(spell)} alt="" className="w-8 h-8 shrink-0 pixelated" />

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 mb-1">
                      <span className="font-bold text-[var(--font-size-sm)]">{details.name}</span>
                      <span className="text-[10px] uppercase tracking-widest text-[var(--accent-brand)]">
                        {isFreeSpell(spell) ? 'свободное' : 'завершает ход'}
                      </span>
                      <span className="text-[10px] text-text-secondary">с полухода {SPELL_UNLOCK[spell]}</span>
                      <span className="text-[10px] text-text-secondary">
                        заряды: {whiteCharges > 0 ? `белые ${whiteCharges}` : '— белым нет'}
                        {blackCharges > 0 ? `, чёрные ${blackCharges}` : ', чёрным нет'}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-secondary leading-[1.6]">{details.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="pt-2">
          <Button fullWidth onClick={onClose}>Понятно</Button>
        </div>
      </div>
    </Modal>
  )
}