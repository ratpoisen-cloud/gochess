import { describe, it, expect, beforeEach, vi } from 'vitest'

const { addDocMock } = vi.hoisted(() => ({ addDocMock: vi.fn(() => ({ id: 'mock-doc' })) }))

vi.mock('@/lib/firebase', () => ({ db: {} }))
vi.mock('@/lib/soundManager', () => ({ soundManager: { play: vi.fn() } }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ id: 'mock-col' })),
  addDoc: addDocMock,
  updateDoc: vi.fn(),
  getDoc: vi.fn(),
  doc: vi.fn(() => ({ id: 'mock-doc' })),
  serverTimestamp: vi.fn(() => Date.now()),
}))

import { useGameStore } from '../gameStore'
import { useAuthStore } from '../authStore'

const STORAGE_KEY = 'gochess-game-store'
const TESTER = { uid: 'u1', displayName: 'Tester', photoURL: null } as never

function playMoves() {
  useGameStore.getState().initGame()
  for (const [from, to] of [['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3']] as const) {
    if (!useGameStore.getState().makeMove(from, to)) throw new Error(`move ${from}-${to} failed`)
  }
}

async function reloadStore() {
  vi.resetModules()
  const { useGameStore: reloaded } = await import('../gameStore')
  const { useAuthStore } = await import('../authStore')
  useAuthStore.setState({ user: TESTER })
  return reloaded
}

describe('gameStore persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    addDocMock.mockClear()
  })

  it('writes the move history as PGN into localStorage', () => {
    playMoves()
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    expect(raw).not.toBeNull()
    expect(raw.state.pgn).toContain('e4')
    expect(raw.state.pgn).toContain('Nf3')
    expect(raw.state.fen).toBe(useGameStore.getState().fen)
  })

  it('rebuilds the engine WITH history after a reload', async () => {
    playMoves()
    const fenBefore = useGameStore.getState().fen

    const reloaded = await reloadStore()
    const s = reloaded.getState()

    expect(s.fen).toBe(fenBefore)
    expect(s.moveHistory).toEqual(['e4', 'e5', 'Nf3'])
    expect(s.game.history()).toEqual(['e4', 'e5', 'Nf3'])
    expect(s.game.fen()).toBe(fenBefore)
    expect(s.game.pgn()).toContain('Nf3')
  })

  it('falls back to the FEN when there is no history source', async () => {
    playMoves()
    const fenBefore = useGameStore.getState().fen
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    delete raw.state.pgn
    raw.state.moveHistory = []
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw))

    const reloaded = await reloadStore()
    const s = reloaded.getState()

    expect(s.fen).toBe(fenBefore)
    expect(s.game.fen()).toBe(fenBefore)
    expect(s.game.history()).toEqual([])
  })

  it('rejects a corrupted PGN and falls back to the SAN list', async () => {
    playMoves()
    const fenBefore = useGameStore.getState().fen
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    raw.state.pgn = '1. d4 d5' // does not reproduce the stored FEN
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw))

    const reloaded = await reloadStore()
    const s = reloaded.getState()

    // first source rejected → second source (moveHistory) gives the real game
    expect(s.game.fen()).toBe(fenBefore)
    expect(s.game.history()).toEqual(['e4', 'e5', 'Nf3'])
  })

  it('legacy data without pgn restores history from moveHistory', async () => {
    playMoves()
    const fenBefore = useGameStore.getState().fen
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    delete raw.state.pgn // pre-fix payload only had the SAN list
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw))

    const reloaded = await reloadStore()
    const s = reloaded.getState()

    expect(s.game.fen()).toBe(fenBefore)
    expect(s.game.history()).toEqual(['e4', 'e5', 'Nf3'])
  })

  it('does not re-create the finished game document after a reload', async () => {
    playMoves()
    useGameStore.getState().setStatus('checkmate')
    useAuthStore.setState({ user: TESTER })

    await useGameStore.getState().saveGame('local')
    expect(addDocMock).toHaveBeenCalledTimes(1)

    const reloaded = await reloadStore()
    await reloaded.getState().saveGame('local')
    expect(addDocMock).toHaveBeenCalledTimes(1)
  })
})
