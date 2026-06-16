import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/firebase', () => ({ db: undefined }))
vi.mock('@/lib/soundManager', () => ({ soundManager: { play: vi.fn() } }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ id: 'mock-col' })),
  addDoc: vi.fn(() => ({ id: 'mock-doc' })),
  updateDoc: vi.fn(),
  getDoc: vi.fn(),
  doc: vi.fn(() => ({ id: 'mock-doc' })),
  serverTimestamp: vi.fn(() => Date.now()),
}))
vi.mock('zustand/middleware', () => ({
  persist: (config: any) => config,
}))

import { useGameStore } from '../gameStore'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function makeMoves(moves: [string, string, string?][]) {
  for (const [from, to, promotion] of moves) {
    const ok = useGameStore.getState().makeMove(from, to, promotion)
    if (!ok) throw new Error(`Move ${from}-${to} failed`)
  }
}

describe('gameStore', () => {
  beforeEach(() => {
    const s = useGameStore.getState()
    if (s && typeof s.initGame === 'function') s.initGame()
    vi.clearAllMocks()
  })

  it('initGame resets to starting position', () => {
    const s = useGameStore.getState()
    expect(s.fen).toBe(START_FEN)
    expect(s.status).toBe('playing')
    expect(s.currentTurn).toBe('w')
    expect(s.moveHistory).toEqual([])
    expect(s.isGameOver).toBe(false)
    expect(s.selectedSquare).toBeNull()
    expect(s.legalMoves).toEqual([])
  })

  it('makeMove changes state after legal move', () => {
    const result = useGameStore.getState().makeMove('e2', 'e4')
    expect(result).toBe(true)
    const s = useGameStore.getState()
    expect(s.currentTurn).toBe('b')
    expect(s.lastMove).toEqual({ from: 'e2', to: 'e4' })
    expect(s.moveHistory).toContain('e4')
    expect(s.fen).not.toBe(START_FEN)
  })

  it('makeMove returns false for illegal move', () => {
    const fenBefore = useGameStore.getState().fen
    const result = useGameStore.getState().makeMove('e2', 'e5')
    expect(result).toBe(false)
    const s = useGameStore.getState()
    expect(s.fen).toBe(fenBefore)
    expect(s.currentTurn).toBe('w')
  })

  it('makeMove handles promotion', () => {
    const g = useGameStore.getState().game
    g.load('k7/4P3/8/8/8/8/8/K7 w - - 0 1')
    useGameStore.getState().makeMove('e7', 'e8', 'q')
    const s = useGameStore.getState()
    expect(s.fen).toContain('Q')
    expect(s.moveHistory[0]).toMatch(/e8=Q/)
  })

  it('selectSquare finds legal moves for own piece', () => {
    useGameStore.getState().selectSquare('e2')
    const s = useGameStore.getState()
    expect(s.selectedSquare).toBe('e2')
    expect(s.legalMoves.length).toBeGreaterThan(0)
    expect(s.legalMoves).toContain('e4')
    expect(s.legalMoves).toContain('e3')
  })

  it('selectSquare deselects on same square', () => {
    useGameStore.getState().selectSquare('e2')
    useGameStore.getState().selectSquare('e2')
    const s = useGameStore.getState()
    expect(s.selectedSquare).toBeNull()
    expect(s.legalMoves).toEqual([])
  })

  it('two clicks make a move', () => {
    useGameStore.getState().selectSquare('e2')
    useGameStore.getState().selectSquare('e4')
    const s = useGameStore.getState()
    expect(s.currentTurn).toBe('b')
    expect(s.lastMove).toEqual({ from: 'e2', to: 'e4' })
  })

  it('undoMove restores previous state', () => {
    const fenBefore = useGameStore.getState().fen
    useGameStore.getState().makeMove('e2', 'e4')
    useGameStore.getState().undoMove()
    const s = useGameStore.getState()
    expect(s.fen).toBe(fenBefore)
    expect(s.currentTurn).toBe('w')
    expect(s.moveHistory).toEqual([])
  })

  it('undoMove on empty game does not crash', () => {
    expect(() => useGameStore.getState().undoMove()).not.toThrow()
  })

  it('detects checkmate (Scholar\'s Mate)', () => {
    makeMoves([
      ['e2', 'e4'],
      ['e7', 'e5'],
      ['d1', 'h5'],
      ['b8', 'c6'],
      ['f1', 'c4'],
      ['g8', 'f6'],
      ['h5', 'f7'],
    ])
    const s = useGameStore.getState()
    expect(s.status).toBe('checkmate')
    expect(s.isGameOver).toBe(true)
    expect(s.currentTurn).toBe('b')
  })

  it('detects stalemate', () => {
    const store = useGameStore.getState()
    // White Kf6, Qh1, Black Kh8 — pattern: 7k/8/7K/8/8/8/8/7Q
    store.makeMove('7k/8/7K/8/8/8/8/7Q w - - 0 1', '')
    store.makeMove('h1', 'g2')
    const s = useGameStore.getState()
    expect(s.status).toBe('stalemate')
    expect(s.isGameOver).toBe(true)
  })

  it('selectSquare only selects own pieces', () => {
    // Try to select black piece as white
    useGameStore.getState().selectSquare('e7')
    const s = useGameStore.getState()
    expect(s.selectedSquare).toBeNull()
    expect(s.legalMoves).toEqual([])
  })

  it('captures update lastMove and fen', () => {
    // 1. e4 d5 2. exd5
    makeMoves([
      ['e2', 'e4'],
      ['d7', 'd5'],
      ['e4', 'd5'],
    ])
    const s = useGameStore.getState()
    expect(s.lastMove).toEqual({ from: 'e4', to: 'd5' })
    expect(s.moveHistory.length).toBe(3)
  })

  it('setStatus and setPlayerColor work', () => {
    useGameStore.getState().setStatus('check')
    expect(useGameStore.getState().status).toBe('check')

    useGameStore.getState().setPlayerColor('b')
    expect(useGameStore.getState().playerColor).toBe('b')

    useGameStore.getState().setPlayerColor('w')
    expect(useGameStore.getState().playerColor).toBe('w')

    useGameStore.getState().setStatus('playing')
    expect(useGameStore.getState().status).toBe('playing')
  })

  it('resetGame calls initGame', () => {
    useGameStore.getState().makeMove('e2', 'e4')
    useGameStore.getState().resetGame()
    const s = useGameStore.getState()
    expect(s.fen).toBe(START_FEN)
    expect(s.moveHistory).toEqual([])
  })
})
