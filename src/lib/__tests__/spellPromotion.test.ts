import { describe, it, expect } from 'vitest'
import { SpellChessEngine } from '@/lib/spellChessEngine'

// White pawn on a7 (about to promote), both kings present.
const PROMOTION_FEN = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1'

describe('SpellChessEngine promotion', () => {
  it('promotes to a queen by default', () => {
    const e = new SpellChessEngine(PROMOTION_FEN)
    const move = e.move({ from: 'a7', to: 'a8' })
    expect(move).not.toBeNull()
    expect(e.get('a8')).toEqual({ type: 'q', color: 'w' })
    expect(move?.promotion).toBe('q')
  })

  it('honors an explicit promotion piece', () => {
    const e = new SpellChessEngine(PROMOTION_FEN)
    const move = e.move({ from: 'a7', to: 'a8', promotion: 'n' })
    expect(e.get('a8')).toEqual({ type: 'n', color: 'w' })
    expect(move?.promotion).toBe('n')
  })

  it('treats an unknown promotion piece as queen', () => {
    const e = new SpellChessEngine(PROMOTION_FEN)
    e.move({ from: 'a7', to: 'a8', promotion: 'x' as never })
    expect(e.get('a8')).toEqual({ type: 'q', color: 'w' })
  })

  it('returns null for an illegal move (EngineAPI contract)', () => {
    const e = new SpellChessEngine(PROMOTION_FEN)
    expect(e.move({ from: 'a7', to: 'a6' })).toBeNull()
    expect(e.move({ from: 'e1', to: 'e4' })).toBeNull()
  })

  it('the promoted piece is playable afterwards instead of being stuck', () => {
    const e = new SpellChessEngine(PROMOTION_FEN)
    e.move({ from: 'a7', to: 'a8' })
    e.move({ from: 'e8', to: 'e7' }) // black replies
    // a pawn left on the 8th rank would have zero moves forever
    expect(e.getLegalMoves('a8').length).toBeGreaterThan(0)
  })

  it('the move can be undone back into a pawn', () => {
    const e = new SpellChessEngine(PROMOTION_FEN)
    e.move({ from: 'a7', to: 'a8' })
    e.undo()
    expect(e.get('a7')).toEqual({ type: 'p', color: 'w' })
    expect(e.get('a8')).toBeNull()
    expect(e.turn()).toBe('w')
  })
})
