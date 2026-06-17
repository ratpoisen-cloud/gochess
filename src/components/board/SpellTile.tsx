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
    divineGrace: 'shield.png',
    shadowGrave: 'sleep.png',
    mirage: 'portal.png',
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
        relative flex flex-col items-center justify-center rounded-[var(--radius-8)] transition-all border flex-1
        ${isSm ? 'h-10' : 'h-16 sm:h-20'}
        ${unlocked 
          ? (isActive 
              ? 'border-[var(--accent-brand)] bg-[var(--accent-soft)] ring-2 ring-[var(--accent-brand)] shadow-[0_0_15px_rgba(126,184,126,0.2)]' 
              : 'border-[var(--border)] bg-white/5 hover:bg-white/10 hover:border-[var(--accent-brand)]'
            )
          : 'border-white/5 bg-white/[0.02] grayscale opacity-40 cursor-not-allowed'
        }
        ${!unlocked ? 'cursor-not-allowed' : 'cursor-pointer'}
        ${isTerminal && unlocked ? 'hover:shadow-[0_0_10px_rgba(255,68,68,0.2)]' : ''}
      `}
    >
      {/* Icon */}
      <img
        src={spellIconFile(spell)}
        alt={spell}
        className={`${isSm ? 'w-5 h-5' : 'w-7 h-7 sm:w-9 sm:h-9'} object-contain ${isSm ? 'mb-0' : 'mb-2'}`}
        style={{ imageRendering: 'pixelated' }}
      />

      {/* Charges Indicator - Below icon */}
      {unlocked && !isSm && (
        <div className="flex gap-1 mt-auto pb-1.5">
          {Array.from({ length: maxCharges }).map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${
                i < charges ? (isTerminal ? 'bg-[var(--danger)]' : 'bg-[var(--accent-brand)] shadow-[0_0_4px_rgba(126,184,126,0.6)]') : 'bg-white/10'
              }`}
            />
          ))}
        </div>
      )}

      {/* Sm Charges - Top Right */}
      {unlocked && isSm && (
        <div className="absolute top-0.5 right-0.5 flex flex-col gap-0.5">
           <span className="text-[8px] font-bold text-[var(--accent-brand)]">{charges}</span>
        </div>
      )}

      {/* Lock Overlay */}
      {!unlocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[var(--radius-8)]">
          <span className="text-[10px] font-bold text-white/80">{unlockTurn}</span>
        </div>
      )}

      {/* Terminal Indicator */}
      {unlocked && isTerminal && !isSm && (
        <div className="absolute top-1 right-1 w-2 h-2 bg-[var(--danger)] rounded-full animate-pulse" />
      )}
    </button>
  );
};
