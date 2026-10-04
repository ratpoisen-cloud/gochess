import { describe, it, expect } from 'vitest'
import { AtomicChessEngine } from '@/lib/engine/AtomicChessEngine'
import type { Move } from '@/lib/engine/types'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

// White Kf6 is adjacent to e7 → Rxe7 would explode own king (suicide).
const SUICIDE_FEN = '4k3/4r3/5K2/8/8/8/4R3/8 w - - 0 1'

// White Ke1 adjacent to the checking Re2 → Kxe2 would explode own king.
const KING_CAPTURE_FEN = '4k3/8/8/8/8/8/4r3/4K3 w - - 0 1'

// Safe capture: white Ke1 is far from the epicenter, black Ke8 + Nf7 are in
// the blast radius, g6 pawn is outside it (chebyshev distance 2).
const WIN_FEN = '4k3/4rn2/6p1/8/8/8/4R3/4K3 w - - 0 1'

// Same capture, but white king sits at chebyshev distance 2 from e7 — legal.
const DISTANCE_2_FEN = '4k3/4r3/6K1/8/8/8/8/4R3 w - - 0 1'

// Black is stalemated as soon as white plays Qc4-f7.
const STALEMATE_SETUP_FEN = '7k/8/6K1/8/2Q5/8/8/8 w - - 0 1'

// White plays Qg3-g7: black's only replies (Kxg7, Nxg7) explode black's own king.
const MATE_SETUP_FEN = '7k/8/8/7n/8/6Q1/8/K7 w - - 0 1'

describe('AtomicChessEngine suicide move filtering (moves vs move)', () => {
  it('start position: 20 moves, verbose entries are well-formed', () => {
    const e = new AtomicChessEngine(START_FEN)
    expect(e.moves()).toHaveLength(20)
    const verbose = e.moves({ verbose: true })
    expect(verbose).toHaveLength(20)
    for (const m of verbose) {
      expect(m).toMatchObject({ from: expect.any(String), to: expect.any(String), san: expect.any(String), piece: expect.any(String), color: 'w' })
    }
  })

  it('filters out a capture that would explode own king (suicide rook)', () => {
    const e = new AtomicChessEngine(SUICIDE_FEN)
    const fromE2 = e.moves({ square: 'e2', verbose: true })
    expect(fromE2.find((m: Move) => m.to === 'e7')).toBeUndefined()
    expect(fromE2.find((m: Move) => m.to !== 'e7')).toBeDefined()
    expect(e.moves().some((san) => san === 'Rxe7')).toBe(false)
    expect(e.move({ from: 'e2', to: 'e7' })).toBeNull()
    expect(e.history()).toHaveLength(0)
  })

  it('filters out a king capture (king on the epicenter always dies)', () => {
    const e = new AtomicChessEngine(KING_CAPTURE_FEN)
    const fromE1 = e.moves({ square: 'e1', verbose: true })
    expect(fromE1.find((m: Move) => m.to === 'e2')).toBeUndefined()
    expect(fromE1.find((m: Move) => m.to === 'd1')).toBeDefined()
    expect(fromE1.find((m: Move) => m.to === 'f1')).toBeDefined()
    expect(e.move({ from: 'e1', to: 'e2' })).toBeNull()
    expect(e.history()).toHaveLength(0)
  })

  it('keeps a safe capture and applies the blast correctly', () => {
    const e = new AtomicChessEngine(WIN_FEN)
    const fromE2 = e.moves({ square: 'e2', verbose: true })
    expect(fromE2.find((m: Move) => m.to === 'e7')).toBeDefined()

    const moved = e.move({ from: 'e2', to: 'e7' })
    expect(moved).not.toBeNull()
    expect(moved?.san).toBe('Rxe7')
    expect(e.get('e7')).toBeNull()
    expect(e.get('e8')).toBeNull()
    expect(e.get('f7')).toBeNull()
    expect(e.get('g6')).toEqual({ type: 'p', color: 'b' })
    expect(e.get('e2')).toBeNull()
    expect(e.get('e1')).toEqual({ type: 'k', color: 'w' })
    expect(e.gameResult()).toBe('1-0')
  })

  it('keeps a capture when own king is exactly 2 squares from the epicenter', () => {
    const e = new AtomicChessEngine(DISTANCE_2_FEN)
    const fromE1 = e.moves({ square: 'e1', verbose: true })
    expect(fromE1.find((m: Move) => m.to === 'e7')).toBeDefined()
    expect(e.move({ from: 'e1', to: 'e7' })).not.toBeNull()
  })

  it('string and verbose modes stay in sync', () => {
    const e = new AtomicChessEngine(SUICIDE_FEN)
    expect(e.moves()).toHaveLength(e.moves({ verbose: true }).length)
    expect(e.moves({ square: 'e2' })).toHaveLength(e.moves({ square: 'e2', verbose: true }).length)
  })
})

describe('AtomicChessEngine mate/stalemate on the post-blast position', () => {
  it('atomic mate: only suicide replies left, result and SAN recorded', () => {
    const e = new AtomicChessEngine(MATE_SETUP_FEN)
    const m = e.move({ from: 'g3', to: 'g7' })
    expect(m?.san).toBe('Qg7#')
    expect(e.history()).toContain('Qg7#')
    expect(e.isCheckmate()).toBe(true)
    expect(e.isGameOver()).toBe(true)
    expect(e.gameResult()).toBe('1-0')

    const mated = new AtomicChessEngine('7k/6Q1/8/7n/8/8/8/K7 b - - 0 1')
    expect(mated.moves()).toHaveLength(0)
    expect(mated.isCheckmate()).toBe(true)
    expect(mated.isGameOver()).toBe(true)
  })

  it('detects stalemate after a move and records the draw', () => {
    const e = new AtomicChessEngine(STALEMATE_SETUP_FEN)
    const m = e.move({ from: 'c4', to: 'f7' })
    expect(m?.san).toBe('Qf7')
    expect(e.isStalemate()).toBe(true)
    expect(e.isGameOver()).toBe(true)
    expect(e.gameResult()).toBe('1/2-1/2')
  })

  it('stalemate position is detected on load too', () => {
    const e = new AtomicChessEngine('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')
    expect(e.moves()).toHaveLength(0)
    expect(e.isStalemate()).toBe(true)
    expect(e.isGameOver()).toBe(true)
    expect(e.isCheckmate()).toBe(false)
  })
})

describe('AtomicChessEngine PGN replay and undo', () => {
  it('loadPgn replays captures with explosions', () => {
    const e = new AtomicChessEngine()
    e.loadPgn('1. e4 d5 2. exd5')
    expect(e.get('d5')).toBeNull()
    expect(e.get('d7')).toBeNull()
    expect(e.getAtomicState().lastBlastSquare).toBe('d5')
  })

  it('undo restores the pre-move position and clears the blast state', () => {
    const e = new AtomicChessEngine(WIN_FEN)
    e.move({ from: 'e2', to: 'e7' })
    expect(e.getAtomicState().lastBlastSquare).toBe('e7')
    expect(e.undo()).not.toBeNull()
    expect(e.getAtomicState().lastBlastSquare).toBeNull()
    expect(e.fen()).toBe(WIN_FEN)
    expect(e.gameResult()).toBe('*')
  })

  it('undo after a PGN replay pops the capture correctly', () => {
    const e = new AtomicChessEngine()
    e.loadPgn('1. e4 d5 2. exd5')
    expect(e.undo()).not.toBeNull()
    expect(e.get('d5')).toEqual({ type: 'p', color: 'b' })
    expect(e.get('e4')).toEqual({ type: 'p', color: 'w' })
    expect(e.getAtomicState().lastBlastSquare).toBeNull()
  })
})
