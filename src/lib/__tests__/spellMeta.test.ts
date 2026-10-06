import { describe, it, expect } from 'vitest'
import {
  SPELL_ORDER,
  spellIconFile,
  spellCharges,
  isFreeSpell,
  isSpellAvailableTo,
} from '@/lib/spellMeta'
import { SPELL_UNLOCK, FREE_ACTIONS, TERMINAL_ACTIONS, type SpellName } from '@/lib/spellChessEngine'

const ALL: SpellName[] = [
  'jump', 'shield', 'freeze', 'portal', 'blast',
  'berserk', 'divineGrace', 'shadowGrave', 'mirage',
]

describe('SPELL_ORDER', () => {
  it('lists every spell exactly once', () => {
    expect(SPELL_ORDER).toHaveLength(9)
    expect(new Set(SPELL_ORDER).size).toBe(9)
    expect([...SPELL_ORDER].sort()).toEqual([...ALL].sort())
  })

  it('is sorted by unlock, so blast comes last rather than fifth', () => {
    // The offline page used to hardcode its own order and showed blast as the
    // fifth tile even though it unlocks last.
    const unlocks = SPELL_ORDER.map(s => SPELL_UNLOCK[s])
    expect(unlocks).toEqual([...unlocks].sort((a, b) => a - b))
    expect(SPELL_ORDER[SPELL_ORDER.length - 1]).toBe('blast')
  })

  it('agrees with the code on every unlock step', () => {
    expect(SPELL_UNLOCK).toEqual({
      jump: 1,
      shield: 7,
      berserk: 13,
      freeze: 19,
      portal: 19,
      divineGrace: 25,
      shadowGrave: 25,
      mirage: 25,
      blast: 31,
    })
  })
})

describe('spellCharges', () => {
  it('matches the engine tables for both colours', () => {
    expect(spellCharges('jump', 'w')).toBe(3)
    expect(spellCharges('jump', 'b')).toBe(3)
    expect(spellCharges('shield', 'w')).toBe(2)
    expect(spellCharges('freeze', 'w')).toBe(2)
    expect(spellCharges('portal', 'w')).toBe(1)
    expect(spellCharges('blast', 'w')).toBe(1)
  })

  it('keeps colour-exclusive spells at zero for the other side', () => {
    expect(spellCharges('berserk', 'w')).toBe(1)
    expect(spellCharges('berserk', 'b')).toBe(0)
    expect(spellCharges('divineGrace', 'b')).toBe(0)
    expect(spellCharges('shadowGrave', 'b')).toBe(1)
    expect(spellCharges('shadowGrave', 'w')).toBe(0)
    expect(spellCharges('mirage', 'w')).toBe(0)
  })
})

describe('isFreeSpell', () => {
  it('treats jump, shield and portal as free actions', () => {
    for (const spell of ['jump', 'shield', 'portal'] as SpellName[]) {
      expect(isFreeSpell(spell)).toBe(true)
    }
  })

  it('treats the rest as terminal', () => {
    for (const spell of ['freeze', 'blast', 'berserk', 'divineGrace', 'shadowGrave', 'mirage'] as SpellName[]) {
      expect(isFreeSpell(spell)).toBe(false)
    }
  })

  it('never puts a spell in both buckets', () => {
    const overlap = FREE_ACTIONS.filter(s => TERMINAL_ACTIONS.includes(s))
    expect(overlap).toEqual([])
  })
})

describe('isSpellAvailableTo', () => {
  it('denies the opposite colour its exclusive spells', () => {
    expect(isSpellAvailableTo('berserk', 'w')).toBe(true)
    expect(isSpellAvailableTo('berserk', 'b')).toBe(false)
    expect(isSpellAvailableTo('shadowGrave', 'b')).toBe(true)
    expect(isSpellAvailableTo('shadowGrave', 'w')).toBe(false)
  })

  it('allows shared spells to both', () => {
    for (const spell of ['jump', 'shield', 'freeze', 'portal', 'blast'] as SpellName[]) {
      expect(isSpellAvailableTo(spell, 'w')).toBe(true)
      expect(isSpellAvailableTo(spell, 'b')).toBe(true)
    }
  })
})

describe('spellIconFile', () => {
  it('points at the folder the files actually live in', () => {
    expect(spellIconFile('jump')).toContain('emojis/spells/jump.png')
    expect(spellIconFile('freeze')).toContain('emojis/spells/freezing.png')
    expect(spellIconFile('blast')).toContain('emojis/spells/bomb.png')
  })

  it('never collapses the double slash the way a bare template would', () => {
    for (const spell of ALL) {
      expect(spellIconFile(spell)).not.toContain('//')
    }
  })

  it('covers every spell with a real file name', () => {
    for (const spell of ALL) {
      expect(spellIconFile(spell)).toMatch(/emojis\/spells\/[a-zA-Z]+\.png$/)
    }
  })
})