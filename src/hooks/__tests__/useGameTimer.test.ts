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

function setTimerState(
  result: { current: ReturnType<typeof useGameTimer> },
  overrides: Partial<{
    timeControl: { base: number; increment: number }
    whiteTimeLeft: number | null
    blackTimeLeft: number | null
    lastTimerUpdate: number | null
  }>,
) {
  act(() => {
    if (overrides.timeControl !== undefined) result.current.setTimeControl(overrides.timeControl)
    if (overrides.whiteTimeLeft !== undefined) result.current.setWhiteTimeLeft(overrides.whiteTimeLeft)
    if (overrides.blackTimeLeft !== undefined) result.current.setBlackTimeLeft(overrides.blackTimeLeft)
    if (overrides.lastTimerUpdate !== undefined) result.current.setLastTimerUpdate(overrides.lastTimerUpdate)
  })
}

describe('useGameTimer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('buildTimerUpdate', () => {
    it('returns null when no timeControl', () => {
      const { result } = renderHook(() => useGameTimer(null))
      expect(result.current.buildTimerUpdate('w')).toBeNull()
    })

    it('returns initial update when no lastTimerUpdate', () => {
      const { result } = renderHook(() => useGameTimer(null))
      setTimerState(result, { timeControl: { base: 300000, increment: 0 } })
      const update = result.current.buildTimerUpdate('w')
      expect(update).not.toBeNull()
      expect(update).toHaveProperty('timer_status', 'active')
      expect(update).toHaveProperty('last_timer_update')
      expect(typeof update!.last_timer_update).toBe('number')
    })

    it('returns initial update when playerColor is null', () => {
      const { result } = renderHook(() => useGameTimer(null))
      setTimerState(result, {
        timeControl: { base: 300000, increment: 0 },
        lastTimerUpdate: 1000,
      })
      const update = result.current.buildTimerUpdate(null)
      expect(update).toHaveProperty('last_timer_update')
    })

    it('returns computed time left when timer exists', () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useGameTimer(null))
      setTimerState(result, {
        timeControl: { base: 300000, increment: 5 },
        whiteTimeLeft: 290000,
        lastTimerUpdate: Date.now(),
      })
      act(() => { vi.advanceTimersByTime(1000) })
      const update = result.current.buildTimerUpdate('w')
      expect(update).not.toBeNull()
      expect(update!.white_time_left).toBeLessThanOrEqual(290000 - 1000 + (5 * 1000))
      vi.useRealTimers()
    })

    it('includes increment in computed time', () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useGameTimer(null))
      setTimerState(result, {
        timeControl: { base: 300000, increment: 10 },
        whiteTimeLeft: 100000,
        lastTimerUpdate: Date.now(),
      })
      act(() => { vi.advanceTimersByTime(500) })
      const update = result.current.buildTimerUpdate('w')
      const expected = 100000 - 500 + (10 * 1000)
      expect(update!.white_time_left).toBe(expected)
      vi.useRealTimers()
    })
  })

  describe('isTimeout', () => {
    it('returns false when no timeControl', () => {
      const { result } = renderHook(() => useGameTimer(null))
      expect(result.current.isTimeout('w')).toBe(false)
    })

    it('returns false when no lastTimerUpdate', () => {
      const { result } = renderHook(() => useGameTimer(null))
      setTimerState(result, { timeControl: { base: 300000, increment: 0 } })
      expect(result.current.isTimeout('w')).toBe(false)
    })

    it('returns false when playerColor is null', () => {
      const { result } = renderHook(() => useGameTimer(null))
      setTimerState(result, {
        timeControl: { base: 300000, increment: 0 },
        lastTimerUpdate: 1000,
      })
      expect(result.current.isTimeout(null)).toBe(false)
    })

    it('returns false when time left is positive', () => {
      const { result } = renderHook(() => useGameTimer(null))
      setTimerState(result, {
        timeControl: { base: 300000, increment: 0 },
        whiteTimeLeft: 5000,
        lastTimerUpdate: Date.now(),
      })
      expect(result.current.isTimeout('w')).toBe(false)
    })

    it('returns true when time left is <= 0', () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useGameTimer(null))
      setTimerState(result, {
        timeControl: { base: 300000, increment: 0 },
        whiteTimeLeft: 500,
        lastTimerUpdate: Date.now(),
      })
      act(() => { vi.advanceTimersByTime(600) })
      expect(result.current.isTimeout('w')).toBe(true)
      vi.useRealTimers()
    })
  })

  describe('setTimerFromSnapshot', () => {
    it('updates all timer state from snapshot data', () => {
      const { result } = renderHook(() => useGameTimer('game-1'))
      const data = {
        time_control: { base: 600000, increment: 2 },
        white_time_left: 590000,
        black_time_left: 600000,
        last_timer_update: Date.now() - 1000,
        timer_status: 'active',
        game_state: 'playing',
        turn: 'w',
      } as unknown as GameData
      act(() => { result.current.setTimerFromSnapshot(data, 'w') })
      expect(result.current.timeControl).toEqual({ base: 600000, increment: 2 })
      expect(result.current.whiteTimeLeft).toBe(590000)
      expect(result.current.timerStatus).toBe('active')
    })

    it('does not run timeout detection when game is already over', () => {
      const { result } = renderHook(() => useGameTimer('game-1'))
      const data = {
        time_control: { base: 300000, increment: 0 },
        white_time_left: -5000,
        last_timer_update: Date.now() - 10000,
        timer_status: 'active',
        game_state: 'game_over',
        turn: 'w',
      } as unknown as GameData
      act(() => { result.current.setTimerFromSnapshot(data, 'b') })
      expect(mockRunTransaction).not.toHaveBeenCalled()
    })

    it('does not run timeout detection when timer is paused', () => {
      const { result } = renderHook(() => useGameTimer('game-1'))
      const data = {
        time_control: { base: 300000, increment: 0 },
        white_time_left: 100,
        last_timer_update: Date.now() - 10000,
        timer_status: 'paused',
        game_state: 'playing',
        turn: 'w',
      } as unknown as GameData
      act(() => { result.current.setTimerFromSnapshot(data, 'b') })
      expect(mockRunTransaction).not.toHaveBeenCalled()
    })

    it('does nothing when time_control is null', () => {
      const { result } = renderHook(() => useGameTimer('game-1'))
      act(() => { result.current.setTimerFromSnapshot({} as GameData, 'w') })
      expect(result.current.timeControl).toBeNull()
    })
  })
})
