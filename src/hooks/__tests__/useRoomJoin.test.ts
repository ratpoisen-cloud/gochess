import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockRunTransaction = vi.fn()
const mockGetDoc = vi.fn()
const mockGetDocs = vi.fn()

vi.mock('@/lib/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ id: 'room-1' })),
  query: vi.fn(),
  collection: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn((...args) => mockGetDocs(...args)),
  getDoc: vi.fn((...args) => mockGetDoc(...args)),
  runTransaction: vi.fn((_db, cb) => mockRunTransaction(_db, cb)),
}))

import { useRoomJoin } from '../useRoomJoin'
import type { User } from '@/types'

const user: User = { uid: 'user-b', displayName: 'Bob', photoURL: null } as User

function makeSnap(data: Record<string, unknown>) {
  return {
    id: 'room-1',
    ref: { id: 'room-1' },
    exists: () => true,
    data: () => data,
  }
}

describe('useRoomJoin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] })
  })

  it('claims a free seat and joins', async () => {
    mockGetDoc.mockResolvedValue(makeSnap({ white_player_id: 'user-a', black_player_id: null }))
    mockRunTransaction.mockImplementation(async (_db: unknown, cb: (t: unknown) => Promise<string>) => {
      const transaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({ white_player_id: 'user-a', black_player_id: null }),
        }),
        update: vi.fn(),
      }
      return cb(transaction)
    })

    const onJoined = vi.fn()
    const onError = vi.fn()
    renderHook(() => useRoomJoin('room-1', user, false, onJoined, onError, vi.fn()))

    await waitFor(() => expect(onJoined).toHaveBeenCalledWith('room-1'))
    expect(onError).not.toHaveBeenCalled()
  })

  it('rejects the loser of a seat race instead of joining without a chair', async () => {
    // Pre-transaction snapshot shows a free seat…
    mockGetDoc.mockResolvedValue(makeSnap({ white_player_id: 'user-a', black_player_id: null }))
    // …but inside the transaction the seat is already taken.
    mockRunTransaction.mockImplementation(async (_db: unknown, cb: (t: unknown) => Promise<string>) => {
      const transaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({ white_player_id: 'user-a', black_player_id: 'user-other' }),
        }),
        update: vi.fn(),
      }
      return cb(transaction)
    })

    const onJoined = vi.fn()
    const onError = vi.fn()
    renderHook(() => useRoomJoin('room-1', user, false, onJoined, onError, vi.fn()))

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Комната уже заполнена'))
    expect(onJoined).not.toHaveBeenCalled()
  })

  it('joins without a transaction when already seated', async () => {
    mockGetDoc.mockResolvedValue(makeSnap({ white_player_id: 'user-b', black_player_id: 'user-a' }))

    const onJoined = vi.fn()
    const onError = vi.fn()
    renderHook(() => useRoomJoin('room-1', user, false, onJoined, onError, vi.fn()))

    await waitFor(() => expect(onJoined).toHaveBeenCalledWith('room-1'))
    expect(mockRunTransaction).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('reports a missing room', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false })

    const onJoined = vi.fn()
    const onError = vi.fn()
    renderHook(() => useRoomJoin('room-1', user, false, onJoined, onError, vi.fn()))

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Комната не найдена'))
    expect(onJoined).not.toHaveBeenCalled()
  })
})
