import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const mockRunTransaction = vi.fn()
const mockUpdateDoc = vi.fn()
const mockGetDoc = vi.fn()

vi.mock('@/lib/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ id: 'mock-doc' })),
  runTransaction: vi.fn((_db, cb) => mockRunTransaction(_db, cb)),
  updateDoc: vi.fn((...args) => mockUpdateDoc(...args)),
  getDoc: vi.fn((...args) => mockGetDoc(...args)),
  collection: vi.fn(() => ({ id: 'mock-col' })),
  addDoc: vi.fn(() => ({ id: 'mock-doc' })),
  serverTimestamp: vi.fn(() => Date.now()),
}))

vi.mock('@/lib/engine', () => ({
  createEngine: vi.fn(() => {
    const engine = {
      loadPgn: vi.fn(),
      turn: vi.fn(() => 'w'),
      undo: vi.fn(),
      pgn: vi.fn(() => '1. e4'),
      fen: vi.fn(() => 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'),
    }
    return engine
  }),
}))

vi.mock('@/components/Toast', () => ({
  useToast: vi.fn(() => ({ addToast: vi.fn() })),
}))

import { useGameRequest } from '../useGameRequest'
import type { GameData } from '@/types'

describe('useGameRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('setRequestsFromSnapshot', () => {
    it('updates undo and draw request from snapshot', () => {
      const { result } = renderHook(() => useGameRequest('game-1'))
      const data = {
        undo_request: { from_id: 'user-1', created_at: Date.now() },
        draw_request: { from_id: 'user-2', created_at: Date.now() },
      } as unknown as GameData
      act(() => { result.current.setRequestsFromSnapshot(data) })
      expect(result.current.undoRequest).toEqual({ from_id: 'user-1', created_at: expect.any(Number) })
      expect(result.current.drawRequest).toEqual({ from_id: 'user-2', created_at: expect.any(Number) })
    })
  })

  describe('handleRejectUndo', () => {
    it('calls updateDoc with undo_request null', async () => {
      const { result } = renderHook(() => useGameRequest('game-1'))
      await act(async () => { await result.current.handleRejectUndo() })
      expect(mockUpdateDoc).toHaveBeenCalled()
    })

    it('does nothing when gameDocId is null', async () => {
      const { result } = renderHook(() => useGameRequest(null))
      await act(async () => { await result.current.handleRejectUndo() })
      expect(mockUpdateDoc).not.toHaveBeenCalled()
    })
  })

  describe('handleAcceptUndo', () => {
    it('does nothing when gameDocId is null', async () => {
      const { result } = renderHook(() => useGameRequest(null))
      act(() => { result.current.setUndoRequest({ from_id: 'user-1', created_at: Date.now() }) })
      await act(async () => { await result.current.handleAcceptUndo('1. e4 e5') })
      expect(mockGetDoc).not.toHaveBeenCalled()
    })

    it('does nothing when undoRequest is null', async () => {
      const { result } = renderHook(() => useGameRequest('game-1'))
      await act(async () => { await result.current.handleAcceptUndo('1. e4 e5') })
      expect(mockRunTransaction).not.toHaveBeenCalled()
    })
  })

  describe('handleAcceptDraw', () => {
    it('does nothing when gameDocId is null', async () => {
      const { result } = renderHook(() => useGameRequest(null))
      act(() => { result.current.setDrawRequest({ from_id: 'user-1', created_at: Date.now() }) })
      await act(async () => { await result.current.handleAcceptDraw() })
      expect(mockRunTransaction).not.toHaveBeenCalled()
    })

    it('does nothing when drawRequest is null', async () => {
      const { result } = renderHook(() => useGameRequest('game-1'))
      await act(async () => { await result.current.handleAcceptDraw() })
      expect(mockRunTransaction).not.toHaveBeenCalled()
    })

    it('calls runTransaction when drawRequest exists', async () => {
      mockRunTransaction.mockImplementation(async (_db: any, cb: any) => {
        const fakeTransaction = {
          get: vi.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({}),
          }),
          update: vi.fn(),
        }
        await cb(fakeTransaction)
      })
      const { result } = renderHook(() => useGameRequest('game-1'))
      act(() => { result.current.setDrawRequest({ from_id: 'user-1', created_at: Date.now() }) })
      await act(async () => { await result.current.handleAcceptDraw() })
      expect(mockRunTransaction).toHaveBeenCalled()
    })
  })
})
