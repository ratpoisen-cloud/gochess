import { describe, it, expect } from 'vitest'
import { PoisenChessEngine, type Move } from '../PoisenChess'

function perft(engine: PoisenChessEngine, depth: number): number {
  if (depth === 0) return 1
  const moves = engine.moves({ verbose: true }) as Move[]
  let nodes = 0
  for (const m of moves) {
    engine.move({ from: m.from, to: m.to, promotion: m.promotion })
    nodes += perft(engine, depth - 1)
    engine.undo()
  }
  return nodes
}

describe('PoisenChessEngine Perft', () => {
  it('Position 1 — Start position', () => {
    const e = new PoisenChessEngine()
    expect(perft(e, 1)).toBe(20)
    expect(perft(e, 2)).toBe(400)
    expect(perft(e, 3)).toBe(8902)
    expect(perft(e, 4)).toBe(197281)
  }, 60000)

  it('Position 2 — Kiwipete', () => {
    const e = new PoisenChessEngine('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1')
    expect(perft(e, 1)).toBe(48)
    expect(perft(e, 2)).toBe(2039)
    expect(perft(e, 3)).toBe(97862)
  }, 120000)

  it('Position 3 — Promotion + en-passant', () => {
    const e = new PoisenChessEngine('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1')
    expect(perft(e, 1)).toBe(14)
    expect(perft(e, 2)).toBe(191)
    expect(perft(e, 3)).toBe(2812)
    expect(perft(e, 4)).toBe(43238)
  }, 120000)

  it('Position 4 — Castling + en-passant complex', () => {
    const e = new PoisenChessEngine('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1')
    expect(perft(e, 1)).toBe(6)
    expect(perft(e, 2)).toBe(264)
    expect(perft(e, 3)).toBe(9467)
  }, 120000)

  it('Position 5 — Many promotions', () => {
    const e = new PoisenChessEngine('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8')
    expect(perft(e, 1)).toBe(44)
    expect(perft(e, 2)).toBe(1486)
    expect(perft(e, 3)).toBe(62379)
  }, 120000)
})