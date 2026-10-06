import { describe, it, expect } from 'vitest'
import { SpellChessEngine } from '@/lib/spellChessEngine'

// Spell Chess is giveaway chess, not standard chess:
//
//   Взятие короля = победа (нет шаха/мата/пата)   — README.md
//
// These tests exist to pin that down. They failed once already: check and mate
// detection was implemented "because it was missing", which made the board
// highlight a king and printed "Шах!"/"Мат!" over a variant that has neither,
// and filtering moves so a king cannot be left attacked made every king capture
// trivially safe. If you are here to add check back, do not — that is a rules
// change and it belongs in README first.

const CHECK_FEN = '4r2k/8/8/8/8/8/8/4K3 w - - 0 1'
const TEXTBOOK_MATE_FEN = 'R5k1/5p1p/8/8/8/8/8/K5R1 b - - 0 1'
const STALEMATE_FEN = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function engineAt(fen: string) {
  const engine = new SpellChessEngine()
  engine.load(fen)
  return engine
}

describe('giveaway rules: there is no check to speak of', () => {
  it('never reports check, even with a rook on the open e-file', () => {
    expect(engineAt(CHECK_FEN).inCheck()).toBe(false)
  })

  it('never reports mate in a textbook mate position', () => {
    const engine = engineAt(TEXTBOOK_MATE_FEN)
    expect(engine.isCheckmate()).toBe(false)
    expect(engine.isStalemate()).toBe(false)
    expect(engine.isDraw()).toBe(false)
  })

  it('never reports a draw in a stalemate position', () => {
    const engine = engineAt(STALEMATE_FEN)
    expect(engine.isStalemate()).toBe(false)
    expect(engine.isDraw()).toBe(false)
  })

  it('reports no insufficient material for bare kings', () => {
    expect(engineAt('4k3/8/8/8/8/8/8/4K3 w - - 0 1').isInsufficientMaterial()).toBe(false)
  })
})

describe('giveaway rules: leaving the king attacked is legal', () => {
  it('still offers king steps that stay in the rook line', () => {
    // The enemy rook on e8 bears down the e-file; e2 and e3 are on that file and
    // are perfectly legal targets in this variant.
    const escapes = engineAt(CHECK_FEN).moves({ square: 'e1' })
    expect(escapes).toContain('e2')
  })

  it('still offers a king step onto an attacked square', () => {
    const engine = engineAt('4r3/8/8/8/8/8/8/4K1k1 w - - 0 1')
    // e1 king, g1 king, rook on e8: stepping onto d2 or e2 walks into the file.
    expect(engine.moves({ square: 'e1' }).length).toBeGreaterThan(0)
  })

  it('still offers pawn pushes that abandon a king', () => {
    expect(engineAt(TEXTBOOK_MATE_FEN).moves({ square: 'f7' }).length).toBeGreaterThan(0)
  })

  it('leaves the board untouched while listing them', () => {
    const engine = engineAt(CHECK_FEN)
    const before = engine.fen()
    engine.moves()
    engine.moves({ square: 'e1' })
    expect(engine.fen()).toBe(before)
  })
})

describe('giveaway rules: capturing the king is the only win', () => {
  it('reports white as the winner after it takes the black king', () => {
    const engine = engineAt('k7/8/8/8/8/8/8/R3K3 w - - 0 1')
    expect(engine.move({ from: 'a1', to: 'a8' })).not.toBeNull()
    expect(engine.isGameOver()).toBe('white')
    expect(engine.isGameOverBool()).toBe(true)
  })

  it('reports black as the winner symmetrically', () => {
    const engine = engineAt('r3k3/8/8/8/8/8/8/K7 b - - 0 1')
    expect(engine.move({ from: 'a8', to: 'a1' })).not.toBeNull()
    expect(engine.isGameOver()).toBe('black')
  })

  it('keeps the game alive while both kings stand', () => {
    expect(engineAt(TEXTBOOK_MATE_FEN).isGameOver()).toBeNull()
    expect(engineAt(START_FEN).isGameOver()).toBeNull()
  })

  it('treats the enemy king as an ordinary capture target', () => {
    // No check to give, so nothing protects the king except real defenders:
    // the rook simply takes it.
    const engine = engineAt('k7/8/8/8/8/8/8/R3K3 w - - 0 1')
    expect(engine.moves({ square: 'a1' })).toContain('a8')
  })
})

describe('the codex is the source of truth: freeze', () => {
  // SPELL_DETAILS says: "Замораживает область 3х3 клетки. Фигуры в этой области
  // не могут двигаться 3 хода. Не действует на королей."
  const FROZEN_READY_FEN = '4k3/8/3r4/2nq4/8/8/8/4K3 w - - 60 40'

  it('leaves kings alone', () => {
    const engine = engineAt(FROZEN_READY_FEN)
    expect(engine.castFreeze('e8')).toBe(true)
    // e8 is the black king and d5 sits inside the same 3x3 as e4 centre.
    expect(engine.spellState.frozenSquares['e8']).toBeUndefined()
    expect(engine.spellState.frozenSquares['d8']).toBeUndefined()
  })

  it('freezes the enemy figures that are standing there', () => {
    const engine = engineAt(FROZEN_READY_FEN)
    expect(engine.castFreeze('d4')).toBe(true)
    expect(engine.spellState.frozenSquares['d5']).toBeDefined()
    expect(engine.spellState.frozenSquares['c5']).toBeDefined()
  })

  it('lasts 3 moves, matching the codex', () => {
    const engine = engineAt(FROZEN_READY_FEN)
    const before = engine.halfMoveCount
    engine.castFreeze('d4')
    // Stored as before + 6 plies = 3 full moves, the same convention the shield
    // (+4 for "2 хода") and portal (+6 for "3 хода") use.
    expect(engine.spellState.frozenSquares['d5']).toBe(before + 6)
  })

  it('does not mark empty squares as frozen', () => {
    // Otherwise the first figure to step into a square the wave passed through
    // would be stuck, which the codex does not say.
    const engine = engineAt(FROZEN_READY_FEN)
    engine.castFreeze('d4')
    expect(engine.spellState.frozenSquares['a1']).toBeUndefined()
    expect(engine.spellState.frozenSquares['e2']).toBeUndefined()
  })

  it('still blocks a frozen figure from moving', () => {
    const engine = engineAt(FROZEN_READY_FEN)
    engine.castFreeze('d4')
    expect(engine.getLegalMoves('d5')).toEqual([])
  })

  it('still lets a king move out of a frozen area', () => {
    const engine = engineAt(FROZEN_READY_FEN)
    engine.castFreeze('d4')
    expect(engine.getLegalMoves('e8').length).toBeGreaterThan(0)
  })
})

describe('load clears the board first', () => {
  // It used to overlay the FEN onto whatever was already standing, so loading a
  // sparse position over a full one left the old pieces in place.
  it('leaves no pieces from the previous position behind', () => {
    const engine = engineAt(START_FEN)
    engine.load('4r2k/8/8/8/8/8/8/4K3 w - - 0 1')
    expect(engine.fen()).toBe('4r2k/8/8/8/8/8/8/4K3 w - - 0 1')
  })

  it('clears pieces that the new FEN leaves empty', () => {
    const engine = engineAt(START_FEN)
    engine.load('4k3/8/8/8/8/8/8/4K3 w - - 0 1')
    expect(engine.get('b1')).toBeNull()
    expect(engine.get('a2')).toBeNull()
    expect(engine.get('e8')).toEqual({ type: 'k', color: 'b' })
  })

  it('drops the move history so pgn cannot replay an earlier game', () => {
    const engine = engineAt(START_FEN)
    engine.move({ from: 'e2', to: 'e4' })
    expect(engine.history().length).toBeGreaterThan(0)
    engine.load(START_FEN)
    expect(engine.history()).toHaveLength(0)
  })
})