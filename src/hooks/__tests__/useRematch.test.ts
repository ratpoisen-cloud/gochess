import { describe, it, expect, vi, beforeEach } from 'vitest'

// Rematch bookkeeping: a rematch started from the in-game button must also close
// the mirrored lobby offer, otherwise the opponent later sees "Приглашение на
// реванш" for a game that has already begun.

vi.mock('@/lib/firebase', () => ({ db: {} }))
vi.mock('@/components/Toast', () => ({ useToast: () => ({ addToast: vi.fn() }) }))

// vi.mock is hoisted, so the fakes must be created inside the factory.
vi.mock('firebase/firestore', () => {
  const tx = { get: vi.fn(), update: vi.fn(), set: vi.fn() }
  return {
    __tx: tx,
    doc: vi.fn((_db: unknown, ...p: string[]) => ({
      path: p.join('/'),
      // Firestore auto-generates an id when called as doc(collectionRef)
      id: p.length ? p[p.length - 1] : 'generated-id',
    })),
    collection: vi.fn(() => ({})),
    query: vi.fn(() => ({})),
    where: vi.fn(() => ({})),
    getDocs: vi.fn(async () => ({ docs: [] })),
    updateDoc: vi.fn(async () => undefined),
    addDoc: vi.fn(async () => ({ id: 'challenge-1' })),
    getDoc: vi.fn(async () => ({ data: () => ({}) })),
    serverTimestamp: vi.fn(() => 1),
    runTransaction: vi.fn(async (_db: unknown, cb: (t: unknown) => Promise<unknown>) => cb(tx)),
  }
})

import { renderHook, act, waitFor } from '@testing-library/react'
import { getDocs, updateDoc, getDoc, __tx } from 'firebase/firestore'
import { useRematch } from '../useRematch'

const mocked = {
  txGet: __tx.get as unknown as ReturnType<typeof vi.fn>,
  txUpdate: __tx.update as unknown as ReturnType<typeof vi.fn>,
  txSet: __tx.set as unknown as ReturnType<typeof vi.fn>,
  getDocs: getDocs as unknown as ReturnType<typeof vi.fn>,
  updateDoc: updateDoc as unknown as ReturnType<typeof vi.fn>,
  getDoc: getDoc as unknown as ReturnType<typeof vi.fn>,
}

const opponent = { uid: 'uid-b', displayName: 'Борис', email: '', photoURL: null }

function makeHook(onReady?: (id: string) => void) {
  return renderHook(() => useRematch('game-1', opponent, onReady))
}

describe('useRematch — mirror bookkeeping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocked.txGet.mockResolvedValue({
      data: () => ({
        game_mode: 'rapid',
        time_control: { base: 300, increment: 5 },
        white_player_id: 'uid-w',
        black_player_id: 'uid-b',
        white_name: 'Аня',
        black_name: 'Борис',
        rematch_proposed_by: 'uid-w',
        rematch_game_id: null,
      }),
    })
    mocked.getDoc.mockResolvedValue({
      data: () => ({ rematch_proposed_by: 'uid-w', rematch_game_id: null }),
    })
    mocked.txUpdate.mockResolvedValue(undefined)
    mocked.txSet.mockResolvedValue(undefined)
    mocked.getDocs.mockResolvedValue({ docs: [{ ref: { id: 'challenge-1', path: 'challenges/challenge-1' } }] })
    mocked.updateDoc.mockResolvedValue(undefined)
  })

  it('closes the mirrored lobby offer when the rematch is created from the button', async () => {
    const { result } = makeHook()

    await act(async () => {
      await result.current.handleRematch('b')
    })

    await waitFor(() => expect(mocked.getDocs).toHaveBeenCalled())
    await waitFor(() =>
      expect(
        mocked.updateDoc.mock.calls.some(
          (c: unknown[]) => (c[1] as Record<string, unknown>)?.status === 'accepted',
        ),
      ).toBe(true),
    )
  })

  it('declining clears the flag on the finished game', async () => {
    const { result } = makeHook()

    await act(async () => {
      await result.current.handleDeclineRematch()
    })

    expect(mocked.updateDoc).toHaveBeenCalledWith(expect.anything(), {
      rematch_proposed_by: null,
      rematch_game_id: null,
    })
    expect(
      mocked.updateDoc.mock.calls.some(
        (c: unknown[]) => (c[1] as Record<string, unknown>)?.status === 'declined',
      ),
    ).toBe(true)
  })

  it('resetRematch clears the dialog state', () => {
    const { result } = makeHook()

    act(() => {
      result.current.setRematchGameId('g-2')
      result.current.setIsRematchProposed(true)
    })
    expect(result.current.rematchGameId).toBe('g-2')
    expect(result.current.isRematchProposed).toBe(true)

    act(() => { result.current.resetRematch() })
    expect(result.current.rematchGameId).toBeNull()
    expect(result.current.isRematchProposed).toBe(false)
  })

  it('snapshots without rematch fields close the dialog (no stale modal after navigation)', () => {
    const { result } = makeHook()

    // Finished game: rematch exists → "Реванш готов" opens.
    act(() => {
      result.current.setRematchFromSnapshot(
        { rematch_game_id: 'g-2', rematch_proposed_by: null } as never,
        opponent,
      )
    })
    expect(result.current.rematchGameId).toBe('g-2')

    // New room after navigation: no rematch fields → dialog must close.
    act(() => {
      result.current.setRematchFromSnapshot({} as never, opponent)
    })
    expect(result.current.rematchGameId).toBeNull()
    expect(result.current.isRematchProposed).toBe(false)
  })

  it('snapshot with a proposal from the opponent opens only the offer dialog', () => {
    const { result } = makeHook()
    act(() => {
      result.current.setRematchFromSnapshot(
        { rematch_game_id: null, rematch_proposed_by: 'uid-w' } as never,
        opponent,
      )
    })
    expect(result.current.isRematchProposed).toBe(true)
    expect(result.current.rematchGameId).toBeNull()
  })

  it('goToRematch does nothing while no rematch exists', () => {
    const onReady = vi.fn()
    const { result } = makeHook(onReady)
    act(() => { result.current.goToRematch() })
    expect(onReady).not.toHaveBeenCalled()
  })

  it('goToRematch navigates immediately once the rematch exists', () => {
    const onReady = vi.fn()
    const { result } = makeHook(onReady)
    act(() => { result.current.setRematchGameId('g-9') })
    act(() => { result.current.goToRematch() })
    expect(onReady).toHaveBeenCalledWith('g-9')
  })
})