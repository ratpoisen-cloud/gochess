import { describe, it, expect } from 'vitest'
import { SpellChessEngine, SPELL_UNLOCK, type SpellName } from '../spellChessEngine'

// Cheap, deterministic checks for the online Spell Chess ply-counter bug.
// Unlike perft these run in milliseconds, so they are safe to run anywhere.

function canCastReport(engine: SpellChessEngine, spell: SpellName): string {
  // Reach the same gate the UI uses: SPELL_UNLOCK vs getTurnNumber()
  const t = engine.getTurnNumber()
  if (t < SPELL_UNLOCK[spell]) return 'locked'
  const charge = engine.spellState.charges[engine.turn() as 'w' | 'b']?.[spell] ?? 0
  if (charge <= 0) return 'charges'
  return 'ok'
}

function squares(): string[] {
  const out: string[] = []
  for (const f of 'abcdefgh') for (let r = 1; r <= 8; r++) out.push(f + r)
  return out
}

// Pick any legal move for the side to move, using the engine's own generator so
// the sequence can never become illegal.
function pickLegalMove(e: SpellChessEngine): { from: string; to: string } | null {
  const side = e.turn()
  for (const sq of squares()) {
    const p = e.getPiece(sq)
    if (!p || p.color !== side) continue
    for (const to of e.getLegalMoves(sq)) return { from: sq, to }
  }
  return null
}

describe('SpellChessEngine — ply counter survives FEN round-trip', () => {
  it('advances halfMoveCount and reports a rising turn number', () => {
    const e = new SpellChessEngine()
    expect(e.getTurnNumber()).toBe(1)

    e.move({ from: 'e2', to: 'e4' })
    expect(e.halfMoveCount).toBe(1)
    expect(e.getTurnNumber()).toBe(2)

    e.move({ from: 'e7', to: 'e5' })
    expect(e.halfMoveCount).toBe(2)
    expect(e.getTurnNumber()).toBe(3)
  })

  it('emits a real fullmove number in FEN and derives it back on load', () => {
    const e = new SpellChessEngine()
    e.move({ from: 'e2', to: 'e4' })
    e.move({ from: 'e7', to: 'e5' })
    e.move({ from: 'g1', to: 'f3' })
    // halfMoveCount 3 -> fullmove = floor(3/2)+1 = 2
    expect(e.fen().split(' ')[5]).toBe('2')

    const rehydrated = new SpellChessEngine(e.fen())
    expect(rehydrated.halfMoveCount).toBe(3)
    expect(rehydrated.getTurnNumber()).toBe(4)
  })

  it('keeps the ply counter through spell_state_json (the online path)', () => {
    const e = new SpellChessEngine()
    e.move({ from: 'e2', to: 'e4' })
    e.move({ from: 'e7', to: 'e5' })

    const ssj = e.spellStateToJSON()
    const fen = e.fen()

    // This is exactly what useGameSync does on every ply: rebuild the engine
    // from FEN, then re-apply the persisted spell state.
    const rebuilt = new SpellChessEngine(fen)
    rebuilt.applySpellStateJSON(ssj)

    expect(rebuilt.halfMoveCount).toBe(2)
    expect(rebuilt.getTurnNumber()).toBe(3)
  })

  it('preserves the ply counter for a legacy document with no halfMoveCount', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e 3 2'
    const e = new SpellChessEngine(fen)
    // load() derives halfMoveCount = (2-1)*2 + 1 (black to move) = 3
    expect(e.halfMoveCount).toBe(3)

    const legacy = JSON.stringify({
      frozenSquares: {},
      jumpSquare: null,
      shieldedSquares: {},
      portals: null,
      bombs: {},
      berserkTransforms: {},
      charges: { w: { jump: 3 }, b: { jump: 3 } },
      impassableSquares: {},
      pendingBlastMine: null,
    })
    e.applySpellStateJSON(legacy)

    // Must fall back to the FEN-derived value, not reset to 0
    expect(e.halfMoveCount).toBe(3)
  })

  it('unlocks spells as the turn number crosses their threshold', () => {
    const e = new SpellChessEngine()

    // shield unlocks at turn 7
    expect(canCastReport(e, 'shield')).toBe('locked')

    // Advance the ply counter directly (simulating many moves) and re-check
    e.halfMoveCount = 6
    expect(e.getTurnNumber()).toBe(7)
    expect(canCastReport(e, 'shield')).toBe('ok')

    // blast unlocks at turn 31
    e.halfMoveCount = 30
    expect(e.getTurnNumber()).toBe(31)
    expect(canCastReport(e, 'blast')).toBe('ok')
  })

  it('unlocks spells across 40 online rebuild cycles (the real acceptance case)', () => {
    // useGameSync rebuilds the engine from FEN + spell_state_json on EVERY ply.
    // Before the fix this pinned the turn number to 1-2 forever, so only
    // `jump` was ever castable and 8 of 9 spells stayed locked for the whole
    // online game. Simulate the exact cycle.
    let live = new SpellChessEngine()
    expect(canCastReport(live, 'blast')).toBe('locked')
    expect(canCastReport(live, 'shield')).toBe('locked')

    for (let i = 0; i < 40; i++) {
      const m = pickLegalMove(live)
      expect(m, `no legal move at ply ${i}`).not.toBeNull()
      const ok = live.move({ from: m!.from, to: m!.to })
      expect(ok, `move rejected at ply ${i}: ${m!.from}->${m!.to}`).not.toBeNull()

      // The online path: fresh engine, FEN, then persisted spell state
      const fen = live.fen()
      const ssj = live.spellStateToJSON()
      live = new SpellChessEngine(fen)
      live.applySpellStateJSON(ssj)
    }

    expect(live.halfMoveCount).toBe(40)
    expect(live.getTurnNumber()).toBe(41)

    // Now the thresholds must actually be crossed
    expect(canCastReport(live, 'shield')).toBe('ok')
    expect(canCastReport(live, 'blast')).toBe('ok')
  })

  it('charges survive a partial spell_state_json instead of zeroing out', () => {
    const e = new SpellChessEngine()
    e.applySpellStateJSON(JSON.stringify({ charges: { w: { freeze: 2 } } }))
    // Missing entries must fall back to defaults, not become undefined
    expect(e.spellState.charges.w.freeze).toBe(2)
    expect(typeof e.spellState.charges.w.jump).toBe('number')
    expect(e.spellState.charges.w.jump).toBeGreaterThan(0)
  })

  it('does not emit bogus castling rights in FEN', () => {
    const e = new SpellChessEngine()
    expect(e.fen().split(' ')[2]).toBe('-')
  })

  it('undo restores the previous ply count', () => {
    const e = new SpellChessEngine()
    e.move({ from: 'e2', to: 'e4' })
    e.move({ from: 'e7', to: 'e5' })
    expect(e.halfMoveCount).toBe(2)
    e.undo()
    expect(e.halfMoveCount).toBe(1)
  })
})
