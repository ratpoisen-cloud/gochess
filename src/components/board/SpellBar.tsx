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
  isOpponent?: boolean;
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
  isOpponent = false,
}) => {
  const maxChargesMap = defaultCharges(playerColor);
  const spells = Object.keys(maxChargesMap) as SpellName[];

  // Filter spells that have 0 max charges for this color (like divineGrace for black)
  const visibleSpells = spells.filter(s => maxChargesMap[s] > 0);

  return (
    <div className={`flex items-center gap-2 p-2 rounded-[var(--radius-12)] bg-black/20 border border-[var(--border)] ${isOpponent ? 'opacity-80 scale-90 origin-center' : ''}`}>
      {visibleSpells.map((spell) => {
        const charges = currentCharges[spell] || 0;
        const maxCharges = maxChargesMap[spell];
        const unlockTurn = SPELL_UNLOCK[spell];
        const unlocked = turnNumber >= unlockTurn;
        const isTerminal = TERMINAL_ACTIONS.includes(spell);
        const canCast = !gameOver && isMyTurn && !hasCastSpellThisTurn && charges > 0 && unlocked && !isOpponent;

        return (
          <SpellTile
            key={spell}
            spell={spell}
            charges={charges}
            maxCharges={maxCharges}
            unlocked={unlocked}
            unlockTurn={unlockTurn}
            isActive={activeSpell === spell}
            canCast={canCast}
            isTerminal={isTerminal}
            size={isOpponent ? 'sm' : 'md'}
            onClick={() => !isOpponent && onSpellClick(spell)}
            onMouseEnter={() => onSpellHover(spell)}
            onMouseLeave={() => onSpellHover(null)}
          />
        );
      })}
    </div>
  );
};
