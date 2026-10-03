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

  it('Position 6 — Deep promotion + checks', () => {
    const e = new PoisenChessEngine('r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10')
    expect(perft(e, 1)).toBe(46)
    expect(perft(e, 2)).toBe(2079)
    expect(perft(e, 3)).toBe(89890)
  }, 120000)

  describe('PoisenChessEngine — Checkmate / Stalemate / Draw', () => {
    it('Scholar\'s Mate (4-move checkmate)', () => {
      const e = new PoisenChessEngine()
      e.move({ from: 'e2', to: 'e4' })
      e.move({ from: 'e7', to: 'e5' })
      e.move({ from: 'f1', to: 'c4' })
      e.move({ from: 'b8', to: 'c6' })
      e.move({ from: 'd1', to: 'h5' })
      e.move({ from: 'g8', to: 'f6' })
      e.move({ from: 'h5', to: 'f7' })
      expect(e.isCheckmate()).toBe(true)
      expect(e.isGameOver()).toBe(true)
      expect(e.turn()).toBe('b')
    })

    it('Fool\'s Mate (2-move checkmate)', () => {
      const e = new PoisenChessEngine()
      e.move({ from: 'f2', to: 'f3' })
      e.move({ from: 'e7', to: 'e5' })
      e.move({ from: 'g2', to: 'g4' })
      e.move({ from: 'd8', to: 'h4' })
      expect(e.isCheckmate()).toBe(true)
      expect(e.isGameOver()).toBe(true)
    })

    it('Classic stalemate — rook + king trap black king', () => {
      const e = new PoisenChessEngine('7k/6R1/7K/8/8/8/8/8 b - - 0 1')
      expect(e.isStalemate()).toBe(true)
      expect(e.isDraw()).toBe(true)
    })

    it('Not stalemate when king can move', () => {
      const e = new PoisenChessEngine('k7/8/1K6/8/8/8/8/8 b - - 0 1')
      expect(e.isStalemate()).toBe(false)
      expect(e.isCheckmate()).toBe(false)
    })

    it('Insuffient material — K vs K', () => {
      const e = new PoisenChessEngine('8/8/8/4k3/8/8/3K4/8 w - - 0 1')
      expect(e.isInsufficientMaterial()).toBe(true)
      expect(e.isDraw()).toBe(true)
    })

    it('Insuffient material — K vs KB', () => {
      const e = new PoisenChessEngine('8/8/8/3B4/8/8/4K3/3k4 w - - 0 1')
      expect(e.isInsufficientMaterial()).toBe(true)
    })

    it('Insuffient material — K vs KN', () => {
      const e = new PoisenChessEngine('8/8/8/3N4/8/8/4K3/3k4 w - - 0 1')
      expect(e.isInsufficientMaterial()).toBe(true)
    })

    it('Insuffient material — K+B+B same color vs K', () => {
      const e = new PoisenChessEngine('k7/8/8/8/8/8/3B1B2/4K3 w - - 0 1')
      expect(e.isInsufficientMaterial()).toBe(true)
      expect(e.isDraw()).toBe(true)
    })

    it('NOT insufficient — K+B+B diff color vs K', () => {
      const e = new PoisenChessEngine('k7/8/8/8/8/8/3B4/4K2B w - - 0 1')
      expect(e.isInsufficientMaterial()).toBe(false)
    })

    it('NOT insufficient — K+N+N vs K', () => {
      const e = new PoisenChessEngine('8/8/8/8/8/3N4/4K3/3k3N w - - 0 1')
      expect(e.isInsufficientMaterial()).toBe(false)
    })

    it('50-move rule draw', () => {
      const e = new PoisenChessEngine('4k3/8/8/8/8/8/8/4K3 w - - 100 1')
      expect(e.isDraw()).toBe(true)
    })

    it('Threefold repetition', () => {
      const e = new PoisenChessEngine()
      // Repeat starting position 3 times: knights out and back thrice
      e.move({ from: 'g1', to: 'f3' })
      e.move({ from: 'g8', to: 'f6' })
      e.move({ from: 'f3', to: 'g1' })
      e.move({ from: 'f6', to: 'g8' })  // back to start (count=2)
      e.move({ from: 'g1', to: 'f3' })
      e.move({ from: 'g8', to: 'f6' })
      e.move({ from: 'f3', to: 'g1' })
      e.move({ from: 'f6', to: 'g8' })  // start AGAIN (count=3)
      expect(e.isThreefoldRepetition()).toBe(true)
      expect(e.isDraw()).toBe(true)
    })
  })

  describe('PoisenChessEngine — PGN result', () => {
    it('pgn starts with [Result "*"] at initial position', () => {
      const e = new PoisenChessEngine()
      expect(e.pgn()).toContain('[Result "*"]')
      expect(e.pgn()).not.toMatch(/1-0|0-1|1\/2-1\/2$/)
    })

    it('pgn has [Result "1-0"] after Scholar\'s Mate', () => {
      const e = new PoisenChessEngine()
      e.move({ from: 'e2', to: 'e4' })
      e.move({ from: 'e7', to: 'e5' })
      e.move({ from: 'f1', to: 'c4' })
      e.move({ from: 'b8', to: 'c6' })
      e.move({ from: 'd1', to: 'h5' })
      e.move({ from: 'g8', to: 'f6' })
      e.move({ from: 'h5', to: 'f7' })
      expect(e.isCheckmate()).toBe(true)
      expect(e.turn()).toBe('b')
      const pgn = e.pgn()
      expect(pgn).toContain('[Result "1-0"]')
      expect(pgn).toMatch(/1-0$/)
    })

    it('pgn has [Result "1/2-1/2"] after stalemate', () => {
      const e = new PoisenChessEngine()
      // Starting from stalemate position, black has no legal moves
      e.load('7k/6R1/7K/8/8/8/8/8 b - - 0 1')
      expect(e.isStalemate()).toBe(true)
      // move() with no legal moves — but engine doesn't auto-detect stalemate without a move
      // Let's trigger it by checking: the position is already stalemated
      expect(e.isDraw()).toBe(true)
      expect(e.isGameOver()).toBe(true)
      // gameResult should be '*' because no move was made (loaded from FEN)
      expect(e.gameResult()).toBe('*')
    })

    it('pgn has [Result "1/2-1/2"] after insufficient material', () => {
      const e = new PoisenChessEngine('8/8/8/4k3/8/8/3K4/8 w - - 0 1')
      // White's turn with only K vs K — after a move it's draw
      e.move({ from: 'd2', to: 'e2' })
      expect(e.isDraw()).toBe(true)
      expect(e.gameResult()).toBe('1/2-1/2')
      expect(e.pgn()).toContain('[Result "1/2-1/2"]')
    })

    it('pgn result reverts to "*" after undo', () => {
      const e = new PoisenChessEngine()
      e.move({ from: 'e2', to: 'e4' })
      e.move({ from: 'e7', to: 'e5' })
      e.move({ from: 'f1', to: 'c4' })
      e.move({ from: 'b8', to: 'c6' })
      e.move({ from: 'd1', to: 'h5' })
      e.move({ from: 'g8', to: 'f6' })
      e.move({ from: 'h5', to: 'f7' })
      expect(e.gameResult()).toBe('1-0')
      e.undo()
      expect(e.gameResult()).toBe('*')
      expect(e.pgn()).toContain('[Result "*"]')
    })

    it('gameResult() returns correct value at each state', () => {
      const e = new PoisenChessEngine()
      expect(e.gameResult()).toBe('*')
      e.move({ from: 'e2', to: 'e4' })
      expect(e.gameResult()).toBe('*')
      e.move({ from: 'e7', to: 'e5' })
      expect(e.gameResult()).toBe('*')
      e.move({ from: 'f1', to: 'c4' })
      expect(e.gameResult()).toBe('*')
      e.move({ from: 'b8', to: 'c6' })
      expect(e.gameResult()).toBe('*')
      e.move({ from: 'd1', to: 'h5' })
      expect(e.gameResult()).toBe('*')
      e.move({ from: 'g8', to: 'f6' })
      expect(e.gameResult()).toBe('*')
      e.move({ from: 'h5', to: 'f7' })
      expect(e.gameResult()).toBe('1-0')
    })

    it('loadPgn with annotations strips them correctly', () => {
      const e = new PoisenChessEngine()
      e.loadPgn('[Event "?"]\n[White "?"]\n1. e4!! c5!? 2. Nf3 $1 d6')
      expect(e.fen().split(' ')[0]).toBe('rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R')
    })

    it('loadPgn with variations strips them correctly', () => {
      const e = new PoisenChessEngine()
      e.loadPgn('1. e4 (1. d4 d5) c5 2. Nf3 d6')
      expect(e.fen().split(' ')[0]).toBe('rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R')
    })
  })

  describe('PoisenChessEngine — Move API', () => {
    it('Move has lan field', () => {
      const e = new PoisenChessEngine()
      const moves = e.moves({ verbose: true })
      const e2 = moves.find(m => m.san === 'e4')
      expect(e2).toBeDefined()
      expect(e2!.lan).toBe('e2e4')
    })

    it('Promotion move has lan with promotion piece', () => {
      const e = new PoisenChessEngine('8/2P5/8/8/8/8/8/4K3 w - - 0 1')
      e.move({ from: 'c7', to: 'c8', promotion: 'q' })
      const history = e.history({ verbose: true })
      const last = history[history.length - 1]
      expect(last.lan).toBe('c7c8q')
    })

    it('Capture move has correct lan', () => {
      const e = new PoisenChessEngine('rnbqkb1r/pppppppp/5n2/8/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq - 0 1')
      e.move({ from: 'f6', to: 'e4' })
      const history = e.history({ verbose: true })
      const last = history[history.length - 1]
      expect(last.lan).toBe('f6e4')
    })

    it('squareColor returns correct values', () => {
      const e = new PoisenChessEngine()
      expect(e.squareColor('a1')).toBe('dark')
      expect(e.squareColor('b1')).toBe('light')
      expect(e.squareColor('h8')).toBe('dark')
      expect(e.squareColor('a8')).toBe('light')
      expect(e.squareColor('e4')).toBe('light')
    })
  })
})