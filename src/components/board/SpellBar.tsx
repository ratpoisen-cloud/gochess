import React from 'react';
import { type SpellName, SPELL_UNLOCK, TERMINAL_ACTIONS, defaultCharges } from '@/lib/spellChessEngine';
import { SpellTile } from './SpellTile';
import type { Color } from '@/types';

interface SpellBarProps {
  playerColor: Color;
  currentCharges: Record<SpellName, number>;
  turnNumber: number;
  isMyTurn: boolean;
  hasCastSpellThisTurn: boolean;
  activeSpell: SpellName | null;
  gameOver: boolean;
  onSpellClick: (spell: SpellName) => void;
  onSpellHover: (spell: SpellName | null) => void;
}

export const SpellBar: React.FC<SpellBarProps> = ({
  playerColor,
  currentCharges,
  turnNumber,
  isMyTurn,
  hasCastSpellThisTurn,
  activeSpell,
  gameOver,
  onSpellClick,
  onSpellHover,
}) => {
  const maxChargesMap = defaultCharges(playerColor);
  const spells = Object.keys(maxChargesMap) as SpellName[];

  const visibleSpells = spells
    .filter(s => maxChargesMap[s] > 0)
    .sort((a, b) => SPELL_UNLOCK[a] - SPELL_UNLOCK[b]);

  return (
    <div
      className="w-full flex items-stretch gap-1.5 p-2 rounded-[var(--radius-14)]"
      style={{ backgroundColor: 'rgba(18, 20, 18, 0.96)', border: '1px solid rgba(255, 255, 255, 0.12)' }}
    >
      {visibleSpells.map((spell) => {
        const charges = currentCharges[spell] || 0;
        const unlockTurn = SPELL_UNLOCK[spell];
        const unlocked = turnNumber >= unlockTurn;
        const isTerminal = TERMINAL_ACTIONS.includes(spell);
        const canCast = !gameOver && isMyTurn && !hasCastSpellThisTurn && charges > 0 && unlocked;

        return (
          <SpellTile
            key={spell}
            spell={spell}
            unlocked={unlocked}
            unlockTurn={unlockTurn}
            isActive={activeSpell === spell}
            canCast={canCast}
            isTerminal={isTerminal}
            onClick={() => onSpellClick(spell)}
            onMouseEnter={() => onSpellHover(spell)}
            onMouseLeave={() => onSpellHover(null)}
          />
        );
      })}
    </div>
  );
};
