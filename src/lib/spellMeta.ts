import { type SpellName, SPELL_UNLOCK, FREE_ACTIONS, WHITE_CHARGES, BLACK_CHARGES } from '@/lib/spellChessEngine'

const BASE = (import.meta as any).env?.BASE_URL || '/'

const SPELL_ICONS: Record<SpellName, string> = {
  jump: 'jump.png',
  shield: 'shield.png',
  freeze: 'freezing.png',
  portal: 'portal.png',
  blast: 'bomb.png',
  berserk: 'berserk.png',
  divineGrace: 'divineGrace.png',
  shadowGrave: 'shadowGrave.png',
  mirage: 'mirage.png',
}

export function spellIconFile(spell: SpellName): string {
  return `${BASE}emojis/spells/${SPELL_ICONS[spell] || 'shield.png'}`.replace(/\/+/g, '/')
}

/**
 * Unlock order, so the bar, the rules sheet and any future list agree on when a
 * spell appears instead of each picking its own arrangement.
 */
export const SPELL_ORDER: SpellName[] = (
  Object.keys(SPELL_UNLOCK) as SpellName[]
).sort((a, b) => SPELL_UNLOCK[a] - SPELL_UNLOCK[b])

export function spellCharges(spell: SpellName, color: 'w' | 'b'): number {
  return (color === 'w' ? WHITE_CHARGES : BLACK_CHARGES)[spell]
}

export function isFreeSpell(spell: SpellName): boolean {
  return FREE_ACTIONS.includes(spell)
}

/** Colours are exclusive: divineGrace is white-only, shadowGrave and mirage black-only. */
export function isSpellAvailableTo(spell: SpellName, color: 'w' | 'b'): boolean {
  return spellCharges(spell, color) > 0
}