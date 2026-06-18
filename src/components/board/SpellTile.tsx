import React, { useRef, useCallback } from 'react';
import { type SpellName } from '@/lib/spellChessEngine';

const BASE = (import.meta as any).env?.BASE_URL || '/'

interface SpellTileProps {
  spell: SpellName;
  unlocked: boolean;
  unlockTurn: number;
  isActive: boolean;
  noCharges: boolean;
  chargeDots: number;
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
  chargeDots,
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
        cursor-pointer
      `}
    >
      {unlocked && chargeDots > 0 && (
        <div className="absolute top-0.5 flex items-center justify-center gap-[2px]">
          {Array.from({ length: chargeDots }).map((_, i) => (
            <span key={i} className="w-[4px] h-[4px] rounded-full bg-[var(--accent-brand)]" />
          ))}
        </div>
      )}

      <img
        src={spellIconFile(spell)}
        alt={spell}
        className={`object-contain w-[65%] h-[65%] ${dimmed ? 'opacity-30 grayscale' : ''}`}
        style={{ imageRendering: 'pixelated' }}
      />

      {!unlocked && (
        <span className="absolute inset-0 flex items-center justify-center text-[14px] font-bold text-white">
          {unlockTurn}
        </span>
      )}
    </button>
  );
};
