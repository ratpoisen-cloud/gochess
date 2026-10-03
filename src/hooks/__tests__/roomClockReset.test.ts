import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

vi.mock('@/lib/firebase', () => ({ db: {} }))

const mockRunTransaction = vi.fn()
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ id: 'mock-doc' })),
  runTransaction: vi.fn((_db, cb) => mockRunTransaction(_db, cb)),
  collection: vi.fn(() => ({ id: 'mock-col' })),
  addDoc: vi.fn(() => ({ id: 'mock-doc' })),
  updateDoc: vi.fn(),
  getDoc: vi.fn(),
  serverTimestamp: vi.fn(() => Date.now()),
}))

import { useGameTimer } from '../useGameTimer'
import type { GameData } from '@/types'

function snap(overrides: Partial<GameData>): GameData {
  return {
    game_state: 'playing',
    turn: 'w',
    game_mode: 'classic',
    ...overrides,
  } as GameData
}

// Classic is untimed by design: its documents carry no `time_control`, and
// GamePage renders the two clocks only under `{timeControl && ...}`.
//
// The leak happened because GamePage is NOT remounted when only the
// /game/:roomId param changes — which is exactly what a rematch or accepting a
// challenge from inside a game does — and setTimerFromSnapshot early-returns on
// a document without time_control, leaving the previous rapid room's clock state
// in place. So the previous game's clocks kept rendering and ticking in a game
// that has no clock at all.

describe('useGameTimer — untimed (classic) documents', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('leaves no clock state at all for a document without time_control', () => {
    const { result } = renderHook(() => useGameTimer('game-1'))

    act(() => { result.current.setTimerFromSnapshot(snap({}), 'w') })

    expect(result.current.timeControl).toBeNull()
    expect(result.current.whiteTimeLeft).toBeNull()
    expect(result.current.blackTimeLeft).toBeNull()
    expect(result.current.timerStatus).toBeNull()
  })

  it('does not clear a previous room clock on its own — resetTimer must be called', () => {
    const { result } = renderHook(() => useGameTimer('game-1'))

    // Rapid room
    act(() => {
      result.current.setTimerFromSnapshot(
        snap({
          game_mode: 'rapid',
          time_control: { base: 600, increment: 5 },
          white_time_left: 600_000,
          black_time_left: 540_000,
          last_timer_update: Date.now(),
          timer_status: 'active',
        }),
        'w',
      )
    })
    expect(result.current.timeControl).toEqual({ base: 600, increment: 5 })
    expect(result.current.whiteTimeLeft).toBe(600_000)

    // Same hook instance, new untimed room: the snapshot alone does not clear it
    act(() => { result.current.setTimerFromSnapshot(snap({ game_mode: 'classic' }), 'w') })
    expect(result.current.timeControl).toEqual({ base: 600, increment: 5 })

    // ...which is why the per-room reset effect calls resetTimer()
    act(() => { result.current.resetTimer() })
    expect(result.current.timeControl).toBeNull()
    expect(result.current.whiteTimeLeft).toBeNull()
    expect(result.current.blackTimeLeft).toBeNull()
    expect(result.current.lastTimerUpdate).toBeNull()
    expect(result.current.timerStatus).toBeNull()
  })

  it('buildTimerUpdate writes nothing once reset, so no clock is persisted', () => {
    const { result } = renderHook(() => useGameTimer('game-1'))

    act(() => {
      result.current.setTimerFromSnapshot(
        snap({
          game_mode: 'rapid',
          time_control: { base: 300, increment: 0 },
          white_time_left: 300_000,
          black_time_left: 300_000,
          last_timer_update: Date.now(),
          timer_status: 'active',
        }),
        'w',
      )
    })
    expect(result.current.buildTimerUpdate('w')).not.toBeNull()

    act(() => { result.current.resetTimer() })

    // No time_control -> nothing is written for an untimed game
    expect(result.current.buildTimerUpdate('w')).toBeNull()
  })
})