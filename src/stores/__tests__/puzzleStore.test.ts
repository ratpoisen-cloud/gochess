import { describe, it, expect, beforeEach } from 'vitest'
import { usePuzzleStore } from '../puzzleStore'

describe('puzzleStore', () => {
  beforeEach(() => {
    usePuzzleStore.getState().resetProgress()
  })

  it('initializes with default state', () => {
    const state = usePuzzleStore.getState()
    expect(state.solvedPuzzleIds).toEqual([])
    expect(state.currentStreak).toBe(0)
    expect(state.maxStreak).toBe(0)
    expect(state.selectedCategory).toBe('all')
  })

  it('marks puzzle as solved and increments streak', () => {
    usePuzzleStore.getState().markSolved('p1')
    let state = usePuzzleStore.getState()
    expect(state.solvedPuzzleIds).toContain('p1')
    expect(state.currentStreak).toBe(1)
    expect(state.maxStreak).toBe(1)
    expect(state.isSolved('p1')).toBe(true)
    expect(state.isSolved('p2')).toBe(false)

    // Solving a second puzzle
    usePuzzleStore.getState().markSolved('p2')
    state = usePuzzleStore.getState()
    expect(state.solvedPuzzleIds).toEqual(['p1', 'p2'])
    expect(state.currentStreak).toBe(2)
    expect(state.maxStreak).toBe(2)

    // Re-solving already solved puzzle doesn't duplicate ID but increments streak
    usePuzzleStore.getState().markSolved('p1')
    state = usePuzzleStore.getState()
    expect(state.solvedPuzzleIds).toEqual(['p1', 'p2'])
    expect(state.currentStreak).toBe(3)
    expect(state.maxStreak).toBe(3)
  })

  it('resets current streak on failure but preserves maxStreak', () => {
    usePuzzleStore.getState().markSolved('p1')
    usePuzzleStore.getState().markSolved('p2')
    expect(usePuzzleStore.getState().currentStreak).toBe(2)
    expect(usePuzzleStore.getState().maxStreak).toBe(2)

    usePuzzleStore.getState().failPuzzle()
    expect(usePuzzleStore.getState().currentStreak).toBe(0)
    expect(usePuzzleStore.getState().maxStreak).toBe(2)
  })

  it('switches category filter', () => {
    usePuzzleStore.getState().setCategory('fork')
    expect(usePuzzleStore.getState().selectedCategory).toBe('fork')

    usePuzzleStore.getState().setCategory('all')
    expect(usePuzzleStore.getState().selectedCategory).toBe('all')
  })
})
