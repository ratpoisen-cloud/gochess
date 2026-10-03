import React from 'react';
import { type SpellName, SPELL_UNLOCK, TERMINAL_ACTIONS } from '@/lib/spellChessEngine';

export const SPELL_DETAILS: Record<SpellName, { name: string; type: string; desc: string }> = {
  jump: {
    name: 'Прыжок',
    type: 'Свободное',
    desc: 'Позволяет не-коню перепрыгнуть через одну фигуру (свою или чужую) на пустую клетку или для взятия.',
  },
  shield: {
    name: 'Магический Щит',
    type: 'Свободное',
    desc: 'Защищает выбранную фигуру от взятия или взрыва на 2 хода соперника.',
  },
  portal: {
    name: 'Портал',
    type: 'Свободное',
    desc: 'Создаёт два портала на пустых клетках. Любая фигура, наступившая в один, мгновенно перемещается во второй. Исчезает через 3 хода.',
  },
  freeze: {
    name: 'Заморозка',
    type: 'Завершает ход',
    desc: 'Замораживает область 3х3 клетки. Фигуры в этой области не могут двигаться 3 хода. Не действует на королей.',
  },
  blast: {
    name: 'Взрывной Заряд',
    type: 'Завершает ход',
    desc: 'Устанавливает скрытую мину. Взрывается в начале вашего следующего хода, уничтожая все незащищенные фигуры в области 3х3. Короли неуязвимы.',
  },
  berserk: {
    name: 'Берсерк',
    type: 'Завершает ход',
    desc: 'Временно (на 6 ходов) превращает вашу фигуру в ферзя, ладью, слона или коня. Сила имеет цену.',
  },
  divineGrace: {
    name: 'Божья Благодать',
    type: 'Завершает ход',
    desc: 'Только для Белых. Мгновенно снимает эффект заморозки со всех ваших фигур в области 3х3.',
  },
  shadowGrave: {
    name: 'Теневая Могила',
    type: 'Завершает ход',
    desc: 'Только для Чёрных. Жертвует свою фигуру, превращая клетку в непроходимую на 3 хода. При этом одна случайная соседняя вражеская фигура уничтожается.',
  },
  mirage: {
    name: 'Мираж',
    type: 'Завершает ход',
    desc: 'Только для Чёрных. Позволяет мгновенно поменять местами две любые свои фигуры (кроме короля). Щиты также переносятся.',
  },
};

interface SpellInfoPanelProps {
  spell: SpellName | null;
  turnNumber: number;
}

export const SpellInfoPanel: React.FC<SpellInfoPanelProps> = ({ spell, turnNumber }) => {
  if (!spell) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center border border-[var(--border)] rounded-[var(--radius-14)] bg-white/[0.02]">
        <span className="text-4xl mb-4 opacity-20">🪄</span>
        <p className="text-[var(--font-size-xs)] text-text-secondary opacity-40 uppercase tracking-widest leading-relaxed">
          Наведите на заклинание,<br />чтобы узнать его силу
        </p>
      </div>
    );
  }

  const details = SPELL_DETAILS[spell];
  const unlockTurn = SPELL_UNLOCK[spell];
  const isLocked = turnNumber < unlockTurn;

  return (
    <div className="h-full flex flex-col p-[var(--space-16)] border border-[var(--accent-brand)] rounded-[var(--radius-14)] bg-[var(--surface-elevated)] shadow-xl animate-modal-pixel-in">
      <div className="flex items-center justify-between mb-[var(--space-12)]">
        <h3 className="text-[var(--font-size-md)] font-bold text-[var(--accent-brand)] uppercase tracking-wider">
          {details.name}
        </h3>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-[var(--radius-4)] uppercase ${
          TERMINAL_ACTIONS.includes(spell) ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : 'bg-[var(--accent-soft)] text-[var(--accent-brand)]'
        }`}>
          {details.type}
        </span>
      </div>

      {isLocked && (
        <div className="mb-[var(--space-12)] p-2 bg-[var(--danger-soft)] border border-[var(--danger-border)] rounded-[var(--radius-8)]">
          <p className="text-[9px] text-[var(--danger)] font-bold uppercase tracking-tight">
            Блокировка до {unlockTurn} хода (сейчас {turnNumber})
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        <p className="text-[11px] leading-relaxed text-text-secondary">
          {details.desc}
        </p>
      </div>

      <div className="mt-[var(--space-16)] pt-[var(--space-12)] border-t border-[var(--border)]">
        <div className="flex items-center gap-2 opacity-60">
          <div className={`w-1.5 h-1.5 rounded-full ${TERMINAL_ACTIONS.includes(spell) ? 'bg-[var(--danger)]' : 'bg-[var(--accent-brand)]'}`} />
          <span className="text-[9px] uppercase tracking-widest">
            {TERMINAL_ACTIONS.includes(spell) ? 'Завершает ход' : 'Можно ходить после'}
          </span>
        </div>
      </div>
    </div>
  );
};
