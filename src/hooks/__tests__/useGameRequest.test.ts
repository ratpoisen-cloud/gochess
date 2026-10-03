import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const mockRunTransaction = vi.fn()
const mockUpdateDoc = vi.fn()
const mockGetDoc = vi.fn()
const mockLoadPgn = vi.fn()
let mockHistory = ['e4']

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
  createEngine: vi.fn(() => ({
    loadPgn: (...args: unknown[]) => mockLoadPgn(...args),
    turn: vi.fn(() => 'b'),
    undo: vi.fn(),
    pgn: vi.fn(() => '1. e4'),
    fen: vi.fn(() => 'fen-after-undo'),
    history: vi.fn(() => mockHistory),
  })),
}))

vi.mock('@/components/Toast', () => ({
  useToast: vi.fn(() => ({ addToast: vi.fn() })),
}))

import { useGameRequest } from '../useGameRequest'
import type { GameData } from '@/types'

/** Runs the transaction callback against a configurable fresh document. */
function mockTransactionWith(fresh: Record<string, unknown> | null) {
  mockRunTransaction.mockImplementation(async (_db: unknown, cb: (t: unknown) => Promise<string>) => {
    const update = vi.fn()
    const transaction = {
      get: vi.fn().mockResolvedValue({
        exists: () => fresh !== null,
        data: () => fresh,
      }),
      update,
    }
    const result = await cb(transaction)
    return { result, update }
  })
}

describe('useGameRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHistory = ['e4']
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
    const request = { from_id: 'user-1', created_at: 111 }

    it('does nothing when gameDocId is null', async () => {
      const { result } = renderHook(() => useGameRequest(null))
      act(() => { result.current.setUndoRequest(request) })
      await act(async () => { await result.current.handleAcceptUndo() })
      expect(mockGetDoc).not.toHaveBeenCalled()
    })

    it('does nothing when undoRequest is null', async () => {
      const { result } = renderHook(() => useGameRequest('game-1'))
      await act(async () => { await result.current.handleAcceptUndo() })
      expect(mockRunTransaction).not.toHaveBeenCalled()
    })

    it('refuses a finished game', async () => {
      mockTransactionWith({
        game_state: 'game_over',
        undo_request: request,
        white_player_id: 'user-2',
        pgn: '1. e4',
      })
      const { result } = renderHook(() => useGameRequest('game-1'))
      act(() => { result.current.setUndoRequest(request) })
      await act(async () => { await result.current.handleAcceptUndo() })
      const { update } = await mockRunTransaction.mock.results[0].value
      expect(update).not.toHaveBeenCalled()
    })

    it('refuses when the fresh document no longer carries this request', async () => {
      mockTransactionWith({
        game_state: 'active',
        undo_request: { from_id: 'user-9', created_at: 999 },
        white_player_id: 'user-2',
        pgn: '1. e4',
      })
      const { result } = renderHook(() => useGameRequest('game-1'))
      act(() => { result.current.setUndoRequest(request) })
      await act(async () => { await result.current.handleAcceptUndo() })
      const { update } = await mockRunTransaction.mock.results[0].value
      expect(update).not.toHaveBeenCalled()
    })

    it('rebuilds the position from the document PGN, not from the caller argument', async () => {
      mockTransactionWith({
        game_state: 'active',
        undo_request: request,
        white_player_id: 'user-2',
        black_player_id: 'user-1',
        pgn: '1. e4 e5 2. Nf3',
      })
      const { result } = renderHook(() => useGameRequest('game-1'))
      act(() => { result.current.setUndoRequest(request) })
      await act(async () => { await result.current.handleAcceptUndo('1. d4') })
      expect(mockLoadPgn).toHaveBeenCalledWith('1. e4 e5 2. Nf3')
    })

    it('clears the request without touching the position when history is empty', async () => {
      mockHistory = []
      mockTransactionWith({
        game_state: 'active',
        undo_request: request,
        white_player_id: 'user-2',
        pgn: '',
      })
      const { result } = renderHook(() => useGameRequest('game-1'))
      act(() => { result.current.setUndoRequest(request) })
      await act(async () => { await result.current.handleAcceptUndo() })
      const { update } = await mockRunTransaction.mock.results[0].value
      expect(update).toHaveBeenCalledWith({ id: 'mock-doc' }, { undo_request: null })
    })

    it('refuses spell mode (no move list to replay)', async () => {
      mockTransactionWith({
        game_state: 'active',
        undo_request: request,
        white_player_id: 'user-2',
        pgn: '1. e4',
      })
      const { result } = renderHook(() => useGameRequest('game-1'))
      act(() => { result.current.setUndoRequest(request) })
      await act(async () => { await result.current.handleAcceptUndo('spell_chess') })
      const { update } = await mockRunTransaction.mock.results[0].value
      expect(update).not.toHaveBeenCalled()
      expect(mockLoadPgn).not.toHaveBeenCalled()
    })
  })

  describe('handleAcceptDraw', () => {
    const request = { from_id: 'user-1', created_at: 222 }

    it('does nothing when gameDocId is null', async () => {
      const { result } = renderHook(() => useGameRequest(null))
      act(() => { result.current.setDrawRequest(request) })
      await act(async () => { await result.current.handleAcceptDraw() })
      expect(mockRunTransaction).not.toHaveBeenCalled()
    })

    it('does nothing when drawRequest is null', async () => {
      const { result } = renderHook(() => useGameRequest('game-1'))
      await act(async () => { await result.current.handleAcceptDraw() })
      expect(mockRunTransaction).not.toHaveBeenCalled()
    })

    it('accepts a pending draw and clears both requests', async () => {
      mockTransactionWith({
        game_state: 'active',
        draw_request: request,
        undo_request: request,
      })
      const { result } = renderHook(() => useGameRequest('game-1'))
      act(() => { result.current.setDrawRequest(request) })
      await act(async () => { await result.current.handleAcceptDraw() })
      const { update } = await mockRunTransaction.mock.results[0].value
      expect(update).toHaveBeenCalledWith({ id: 'mock-doc' }, {
        game_state: 'game_over',
        winner: null,
        message: 'draw',
        draw_request: null,
        undo_request: null,
      })
    })

    it('refuses to overwrite a decided game', async () => {
      mockTransactionWith({
        game_state: 'game_over',
        winner: 'white',
        message: 'checkmate',
        draw_request: request,
      })
      const { result } = renderHook(() => useGameRequest('game-1'))
      act(() => { result.current.setDrawRequest(request) })
      await act(async () => { await result.current.handleAcceptDraw() })
      const { update } = await mockRunTransaction.mock.results[0].value
      expect(update).not.toHaveBeenCalled()
    })

    it('refuses when the fresh document no longer carries this request', async () => {
      mockTransactionWith({
        game_state: 'active',
        draw_request: { from_id: 'user-9', created_at: 999 },
      })
      const { result } = renderHook(() => useGameRequest('game-1'))
      act(() => { result.current.setDrawRequest(request) })
      await act(async () => { await result.current.handleAcceptDraw() })
      const { update } = await mockRunTransaction.mock.results[0].value
      expect(update).not.toHaveBeenCalled()
    })
  })
})
