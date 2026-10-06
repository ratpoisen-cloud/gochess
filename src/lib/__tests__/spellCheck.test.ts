import { describe, it, expect } from 'vitest'
import { SpellChessEngine } from '@/lib/spellChessEngine'

// Black king on g8 boxed by its own pawns, with white rooks on a8 (8th rank)
// and g1 (g-file). Black to move: in check, and every escape is covered.
const CHECKMATE_FEN = 'R5k1/5p1p/8/8/8/8/8/K5R1 b - - 0 1'

// Black Kh8 is shut in by Qf7 and Kg6 but not attacked — classic stalemate.
const STALEMATE_FEN = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'

// Black Re8 eyes the white king on e1 down the open e-file.
const CHECK_FEN = '4r2k/8/8/8/8/8/8/4K3 w - - 0 1'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function engineAt(fen: string) {
  const engine = new SpellChessEngine()
  engine.load(fen)
  return engine
}

describe('inCheck', () => {
  it('sees a rook checking down the e-file', () => {
    expect(engineAt(CHECK_FEN).inCheck()).toBe(true)
  })

  it('does not see a check when there is none', () => {
    expect(engineAt(START_FEN).inCheck()).toBe(false)
  })

  it('reports no check when the side to move has no king', () => {
    // White rook took the black king: Spell Chess ends on king capture, so the
    // remaining side must not suddenly be "in check".
    const engine = engineAt('4R2k/8/8/8/8/8/8/4K3 w - - 0 1')
    engine.move({ from: 'e8', to: 'e1' })
    expect(engine.inCheck()).toBe(false)
    expect(engine.isCheckmate()).toBe(false)
    expect(engine.isStalemate()).toBe(false)
  })
})

describe('isCheckmate', () => {
  it('recognises a boxed king', () => {
    const engine = engineAt(CHECKMATE_FEN)
    expect(engine.inCheck()).toBe(true)
    expect(engine.isCheckmate()).toBe(true)
  })

  it('is false when the checked king can simply step aside', () => {
    expect(engineAt(CHECK_FEN).isCheckmate()).toBe(false)
  })

  it('is false when nothing is going on', () => {
    expect(engineAt(START_FEN).isCheckmate()).toBe(false)
  })
})

describe('isStalemate', () => {
  it('recognises a shut-in but unattacked king', () => {
    const engine = engineAt(STALEMATE_FEN)
    expect(engine.inCheck()).toBe(false)
    expect(engine.isStalemate()).toBe(true)
  })

  it('is false when the king is mated rather than idle', () => {
    expect(engineAt(CHECKMATE_FEN).isStalemate()).toBe(false)
  })

  it('is false in a normal position', () => {
    expect(engineAt(START_FEN).isStalemate()).toBe(false)
  })
})

describe('isDraw', () => {
  it('follows stalemate', () => {
    expect(engineAt(STALEMATE_FEN).isDraw()).toBe(true)
  })

  it('is false while the game is still being played', () => {
    expect(engineAt(START_FEN).isDraw()).toBe(false)
    expect(engineAt(CHECK_FEN).isDraw()).toBe(false)
  })
})

describe('isInsufficientMaterial', () => {
  it('calls bare kings insufficient', () => {
    expect(engineAt('4k3/8/8/8/8/8/8/4K3 w - - 0 1').isInsufficientMaterial()).toBe(true)
  })

  it('calls king and single minor insufficient', () => {
    expect(engineAt('4k3/8/8/8/8/8/8/3BK3 w - - 0 1').isInsufficientMaterial()).toBe(true)
  })

  it('is not insufficient once a pawn is on the board', () => {
    expect(engineAt('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1').isInsufficientMaterial()).toBe(false)
  })

  it('is not insufficient with a rook', () => {
    expect(engineAt('k7/8/8/8/8/8/8/R3K3 w - - 0 1').isInsufficientMaterial()).toBe(false)
  })

  it('needs both kings present', () => {
    expect(engineAt('8/8/8/8/8/8/8/4K3 w - - 0 1').isInsufficientMaterial()).toBe(false)
  })

  it('stays out of isDraw, because this game only ends on king capture', () => {
    // Reporting a draw here would print "Ничья" on a live game.
    const bare = engineAt('4k3/8/8/8/8/8/8/4K3 w - - 0 1')
    expect(bare.isInsufficientMaterial()).toBe(true)
    expect(bare.isDraw()).toBe(false)
  })
})

describe('moves no longer include squares that leave your own king attacked', () => {
  // Before this, getLegalMoves returned pseudo-legal moves: the board highlighted
  // them and move() accepted them, so a player could walk their king into check.
  it('drops king steps that stay in the attacked file', () => {
    const engine = engineAt(CHECK_FEN)
    expect(engine.getKingSquare('w')).toBe('e1')
    // Only the squares that genuinely escape the rook on e8 survive.
    const escapes = engine.moves({ square: 'e1' }).sort()
    expect(escapes).toEqual(['d1', 'd2', 'f1', 'f2'])
    expect(escapes).not.toContain('e2')
  })

  it('drops pawn pushes that abandon a king left in check', () => {
    // Black is in check from Ra8; pushing the f-pawn does not answer it.
    const engine = engineAt(CHECKMATE_FEN)
    expect(engine.moves({ square: 'f7' })).toEqual([])
  })

  it('still offers a pin-free move when one exists', () => {
    const engine = engineAt(CHECK_FEN)
    expect(engine.moves().length).toBeGreaterThan(0)
  })

  it('does not mutate the board while filtering', () => {
    const engine = engineAt(CHECK_FEN)
    const before = engine.fen()
    engine.moves()
    engine.moves({ square: 'e1' })
    expect(engine.fen()).toBe(before)
    expect(engine.get('e1')).toEqual({ type: 'k', color: 'w' })
    expect(engine.get('e8')).toEqual({ type: 'r', color: 'b' })
  })
})

describe('gameResult stays driven by king capture', () => {
  it('does not report a result for a checkmated but surviving king', () => {
    const engine = engineAt(CHECKMATE_FEN)
    expect(engine.isCheckmate()).toBe(true)
    expect(engine.isGameOver()).toBeNull()
  })

  it('reports white as the winner once it takes the black king', () => {
    const engine = engineAt('k7/8/8/8/8/8/8/R3K3 w - - 0 1')
    expect(engine.move({ from: 'a1', to: 'a8' })).not.toBeNull()
    expect(engine.isGameOver()).toBe('white')
  })
})