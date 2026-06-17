import React from 'react';
import { type SpellName } from '@/lib/spellChessEngine';

const BASE = (import.meta as any).env?.BASE_URL || '/'

interface SpellTileProps {
  spell: SpellName;
  unlocked: boolean;
  unlockTurn: number;
  isActive: boolean;
  canCast: boolean;
  isTerminal: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const spellIconFile = (spell: SpellName): string => {
  const files: Record<SpellName, string> = {
    jump: 'jump.png',
    shield: 'shield.png',
    freeze: 'freezing.png',
    portal: 'portal.png',
    blast: 'bomb.png',
    berserk: 'berserk.png',
    divineGrace: 'divineGrace.png',
    shadowGrave: 'shadowGrave.png',
    mirage: 'mirage.png',
  };
  return `${BASE}emojis/spells/${files[spell] || 'shield.png'}`.replace(/\/+/g, '/')
};

export const SpellTile: React.FC<SpellTileProps> = ({
  spell,
  unlocked,
  unlockTurn,
  isActive,
  canCast,
  isTerminal,
  onClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      disabled={!canCast && unlocked}
      className={`
        relative flex flex-col items-center justify-center rounded-[var(--radius-8)] transition-all border
        flex-1 aspect-square
        ${unlocked 
          ? (isActive 
              ? 'border-[var(--accent-brand)] bg-white/[0.06] ring-1 ring-[var(--accent-brand)]' 
              : 'border-transparent bg-white/[0.03] hover:bg-white/[0.08] hover:border-[var(--accent-brand)]'
            )
          : 'border-transparent bg-white/[0.02] grayscale opacity-30 cursor-not-allowed'
        }
        ${!unlocked ? 'cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <img
        src={spellIconFile(spell)}
        alt={spell}
        className="object-contain w-[50%] h-[50%]"
        style={{ imageRendering: 'pixelated' }}
      />

      {!unlocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[var(--radius-8)]">
          <span className="text-[9px] font-bold text-white/70">{unlockTurn}</span>
        </div>
      )}

      {unlocked && isTerminal && (
        <div className="absolute top-[3px] left-[3px] w-[6px] h-[6px] bg-[var(--danger)] rounded-full animate-pulse" />
      )}
    </button>
  );
};
