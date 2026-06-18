import React, { useState, useEffect, useRef } from 'react';
import { type SpellName, SPELL_UNLOCK, TERMINAL_ACTIONS, defaultCharges } from '@/lib/spellChessEngine';
import { SpellTile } from './SpellTile';
import { SPELL_DETAILS } from './SpellInfoPanel';
import type { Color } from '@/types';

interface SpellBarProps {
  playerColor: Color;
  currentCharges: Record<SpellName, number>;
  turnNumber: number;
  isMyTurn: boolean;
  hasCastSpellThisTurn: boolean;
  activeSpell: SpellName | null;
  gameOver: boolean;
  isOpponent?: boolean;
  onSpellClick: (spell: SpellName) => void;
  onSpellHover?: (spell: SpellName | null) => void;
}

export const SpellBar: React.FC<SpellBarProps> = ({
  playerColor,
  currentCharges,
  turnNumber,
  isMyTurn: _isMyTurn,
  hasCastSpellThisTurn: _hasCast,
  activeSpell,
  gameOver: _gameOver,
  isOpponent: _isOpponent,
  onSpellClick,
  onSpellHover,
}) => {
  void _isOpponent
  const maxChargesMap = defaultCharges(playerColor);
  const spells = Object.keys(maxChargesMap) as SpellName[];

  const visibleSpells = spells
    .filter(s => maxChargesMap[s] > 0)
    .sort((a, b) => SPELL_UNLOCK[a] - SPELL_UNLOCK[b]);

  const [tooltip, setTooltip] = useState<{ spell: SpellName; x: number; y: number } | null>(null)
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!tooltip) return
    const handler = () => setTooltip(null)
    window.addEventListener('scroll', handler, { once: true })
    window.addEventListener('touchstart', handler, { once: true })
    return () => window.removeEventListener('scroll', handler)
  }, [tooltip])

  const handleLongPress = (spell: SpellName, x: number, y: number) => {
    setTooltip({ spell, x, y })
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
    tooltipTimer.current = setTimeout(() => setTooltip(null), 4000)
  }

  const handleClickOutside = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <>
      <div
        className="w-full flex items-stretch gap-1"
        onClick={handleClickOutside}
      >
        {visibleSpells.map((spell) => {
          const charges = currentCharges[spell] || 0;
          const unlockTurn = SPELL_UNLOCK[spell];
          const unlocked = turnNumber >= unlockTurn;

          return (
            <SpellTile
              key={spell}
              spell={spell}
              unlocked={unlocked}
              unlockTurn={unlockTurn}
              isActive={activeSpell === spell}
              noCharges={charges <= 0}
              chargeDots={charges}
              onClick={() => onSpellClick(spell)}
              onLongPress={handleLongPress}
              onMouseEnter={() => onSpellHover?.(spell)}
              onMouseLeave={() => onSpellHover?.(null)}
            />
          );
        })}
      </div>

      {tooltip && (() => {
        const details = SPELL_DETAILS[tooltip.spell]
        const unlockTurn = SPELL_UNLOCK[tooltip.spell]
        const isLocked = turnNumber < unlockTurn
        const isTerminal = TERMINAL_ACTIONS.includes(tooltip.spell)
        const popupWidth = 220
        const margin = 12
        const left = Math.min(tooltip.x, window.innerWidth - popupWidth - margin)
        const top = tooltip.y > window.innerHeight / 2
          ? tooltip.y - 120
          : tooltip.y + margin

        return (
          <div
            ref={tooltipRef}
            className="fixed z-[9999] animate-dropdown-in"
            style={{ left: Math.max(margin, left), top: Math.max(margin, top) }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="p-3 w-[220px]"
              style={{
                backgroundColor: 'rgba(18, 20, 18, 0.96)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 'var(--radius-8)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-[var(--accent-brand)] uppercase tracking-wider">
                  {details.name}
                </span>
                <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded uppercase ${isTerminal ? 'text-[var(--danger)]' : 'text-[var(--accent-brand)]'}`}
                  style={{ backgroundColor: isTerminal ? 'rgba(193,90,90,0.15)' : 'rgba(163,193,143,0.15)' }}>
                  {details.type}
                </span>
              </div>
              {isLocked && (
                <p className="text-[8px] text-[var(--danger)] font-bold mb-1">
                  Блокировка до {unlockTurn} хода
                </p>
              )}
              <p className="text-[9px] leading-relaxed text-text-secondary">
                {details.desc}
              </p>
            </div>
          </div>
        )
      })()}
    </>
  );
};
