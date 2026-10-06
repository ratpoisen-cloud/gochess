import { describe, it, expect } from 'vitest'
import { activeMineSquares, detonatedMineSquares } from '@/lib/spellMines'
import { SpellChessEngine } from '@/lib/spellChessEngine'
import type { SpellState } from '@/lib/spellChessEngine'

function stateWith(overrides: Partial<SpellState>): SpellState {
  return {
    charges: { w: {}, b: {} },
    frozen: {},
    shielded: {},
    portals: {},
    jumpSquare: null,
    bombs: {},
    pendingBlastMine: null,
    immobile: {},
    ...overrides,
  } as SpellState
}

describe('activeMineSquares', () => {
  it('reports the pending mine, which is where castBlast actually stores it', () => {
    const state = stateWith({ pendingBlastMine: { square: 'e5', color: 'w' } })
    expect(activeMineSquares(state)).toEqual(['e5'])
  })

  it('reports nothing when there is no mine', () => {
    expect(activeMineSquares(stateWith({}))).toEqual([])
  })

  it('still honours the legacy bombs map if it ever gets populated', () => {
    const state = stateWith({ bombs: { d4: 'w' } })
    expect(activeMineSquares(state)).toEqual(['d4'])
  })

  it('lists both sources without duplicating a shared square', () => {
    const state = stateWith({ bombs: { e5: 'w' }, pendingBlastMine: { square: 'e5', color: 'w' } })
    expect(activeMineSquares(state)).toEqual(['e5'])
  })

  it('survives a missing spell state', () => {
    expect(activeMineSquares(null)).toEqual([])
    expect(activeMineSquares(undefined)).toEqual([])
  })
})

describe('detonatedMineSquares', () => {
  it('reports the mine that just disappeared', () => {
    expect(detonatedMineSquares(['e5'], [])).toEqual(['e5'])
  })

  it('stays silent while a mine is merely being placed', () => {
    expect(detonatedMineSquares([], ['d4'])).toEqual([])
    expect(detonatedMineSquares(['e5'], ['e5'])).toEqual([])
  })

  it('ignores mines that were still there on both reads', () => {
    expect(detonatedMineSquares(['e5', 'd4'], ['d4'])).toEqual(['e5'])
  })

  it('keeps the order in which mines vanished', () => {
    expect(detonatedMineSquares(['e5', 'a1', 'h8'], [])).toEqual(['e5', 'a1', 'h8'])
  })
})

// `blast` unlocks on ply 31 and `getTurnNumber()` is halfMoveCount + 1, so the
// halfmove clock has to be high enough for the cast to be accepted at all.
const MINE_READY_FEN = '4k3/8/8/3Q4/4p3/8/8/4K3 w - - 60 40'

describe('the engine only ever writes pendingBlastMine', () => {
  // This is the trap behind the original bug: `bombs` looks like the mine field
  // but is never populated, so any UI reading it alone shows nothing.
  it('leaves bombs empty after a mine is placed', () => {
    const engine = new SpellChessEngine()
    engine.load(MINE_READY_FEN)

    const placed = engine.castBlast('d5')
    expect(placed).toBe(true)

    const state = engine.spellState
    expect(Object.keys(state.bombs)).toHaveLength(0)
    expect(state.pendingBlastMine?.square).toBe('d5')
  })

  it('surfaces the placed mine through activeMineSquares', () => {
    const engine = new SpellChessEngine()
    engine.load(MINE_READY_FEN)
    engine.castBlast('d5')

    expect(activeMineSquares(engine.spellState)).toEqual(['d5'])
  })

  it('detonates at the start of the caster’s next turn', () => {
    const engine = new SpellChessEngine()
    // White queen sits on d5, black pawn on e4 can shuffle to e3.
    engine.load(MINE_READY_FEN)

    expect(engine.castBlast('d5')).toBe(true)
    expect(activeMineSquares(engine.spellState)).toEqual(['d5'])

    // Black replies — the mine is armed but does not blow on black's turn.
    expect(engine.move({ from: 'e4', to: 'e3' })).not.toBeNull()
    expect(activeMineSquares(engine.spellState)).toEqual([])

    // The 3x3 blast around d5 took the queen with it.
    expect(engine.get('d5')).toBeNull()
  })
})