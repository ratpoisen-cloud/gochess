import React, { useRef, useCallback } from 'react';
import { type SpellName } from '@/lib/spellChessEngine';

const BASE = (import.meta as any).env?.BASE_URL || '/'

interface SpellTileProps {
  spell: SpellName;
  unlocked: boolean;
  unlockTurn: number;
  isActive: boolean;
  noCharges: boolean;
  charges?: number;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onLongPress?: (spell: SpellName, x: number, y: number) => void;
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
  noCharges,
  charges,
  onClick,
  onLongPress,
  onMouseEnter,
  onMouseLeave,
}) => {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    longPressTimer.current = setTimeout(() => {
      onLongPress?.(spell, touch.clientX, touch.clientY)
    }, 500)
  }, [spell, onLongPress])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const dimmed = !unlocked || noCharges

  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={() => longPressTimer.current && clearTimeout(longPressTimer.current)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      className={`
        relative flex items-center justify-center flex-1 aspect-square
        ${isActive ? 'ring-1 ring-[var(--accent-brand)] rounded' : ''}
        ${dimmed ? 'opacity-30 grayscale' : ''}
        cursor-pointer
      `}
    >
      <img
        src={spellIconFile(spell)}
        alt={spell}
        className="object-contain w-[65%] h-[65%]"
        style={{ imageRendering: 'pixelated' }}
      />

      {unlocked && !noCharges && charges !== undefined && (
        <span className="absolute -top-0.5 -right-0.5 text-[8px] font-bold text-white bg-black/60 px-[3px] rounded-sm leading-tight">
          {charges}
        </span>
      )}

      {!unlocked && (
        <span className="absolute text-[8px] font-bold text-white/70 bottom-[2px]">
          {unlockTurn}
        </span>
      )}
    </button>
  );
};
