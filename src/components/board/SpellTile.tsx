import React from 'react';
import { type SpellName } from '@/lib/spellChessEngine';

const BASE = (import.meta as any).env?.BASE_URL || '/'

interface SpellTileProps {
  spell: SpellName;
  charges: number;
  maxCharges: number;
  unlocked: boolean;
  unlockTurn: number;
  isActive: boolean;
  canCast: boolean;
  isTerminal: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  size?: 'sm' | 'md';
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
  charges,
  maxCharges,
  unlocked,
  unlockTurn,
  isActive,
  canCast,
  isTerminal,
  onClick,
  onMouseEnter,
  onMouseLeave,
  size = 'md',
}) => {
  const isSm = size === 'sm';

  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      disabled={!canCast && unlocked}
      className={`
        relative flex flex-col items-center justify-center rounded-[var(--radius-8)] transition-all border
        ${isSm ? 'w-full' : 'flex-1 aspect-square'}
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
      {/* Icon */}
      <img
        src={spellIconFile(spell)}
        alt={spell}
        className={`object-contain ${isSm ? 'w-[40%] h-[40%]' : 'w-[45%] h-[45%] sm:w-[50%] sm:h-[50%]'}`}
        style={{ imageRendering: 'pixelated' }}
      />

      {/* Charges dots */}
      {unlocked && !isSm && (
        <div className="flex gap-[3px] mt-auto pb-[6px]">
          {Array.from({ length: maxCharges }).map((_, i) => (
            <div
              key={i}
              className={`w-[5px] h-[5px] rounded-full ${
                i < charges ? (isTerminal ? 'bg-[var(--danger)]' : 'bg-[var(--accent-brand)]') : 'bg-white/[0.12]'
              }`}
            />
          ))}
        </div>
      )}

      {/* Sm charges badge */}
      {unlocked && isSm && (
        <span className="absolute top-[2px] right-[2px] text-[7px] font-bold text-[var(--accent-brand)]">
          {charges}
        </span>
      )}

      {/* Lock overlay */}
      {!unlocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[var(--radius-8)]">
          <span className="text-[9px] font-bold text-white/70">{unlockTurn}</span>
        </div>
      )}

      {/* Terminal indicator */}
      {unlocked && isTerminal && !isSm && (
        <div className="absolute top-[3px] left-[3px] w-[6px] h-[6px] bg-[var(--danger)] rounded-full animate-pulse" />
      )}
    </button>
  );
};
