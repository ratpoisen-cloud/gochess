import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PuzzleTheme } from '@/lib/puzzlesData'

export interface PuzzleState {
  solvedPuzzleIds: string[]
  currentStreak: number
  maxStreak: number
  selectedCategory: PuzzleTheme | 'all'

  markSolved: (id: string) => void
  failPuzzle: () => void
  setCategory: (category: PuzzleTheme | 'all') => void
  isSolved: (id: string) => boolean
  resetProgress: () => void
}

export const usePuzzleStore = create<PuzzleState>()(
  persist(
    (set, get) => ({
      solvedPuzzleIds: [],
      currentStreak: 0,
      maxStreak: 0,
      selectedCategory: 'all',

      markSolved: (id: string) => {
        const { solvedPuzzleIds, currentStreak, maxStreak } = get()
        const isAlreadySolved = solvedPuzzleIds.includes(id)
        const newStreak = currentStreak + 1
        const newMax = Math.max(maxStreak, newStreak)

        set({
          solvedPuzzleIds: isAlreadySolved ? solvedPuzzleIds : [...solvedPuzzleIds, id],
          currentStreak: newStreak,
          maxStreak: newMax,
        })
      },

      failPuzzle: () => {
        set({ currentStreak: 0 })
      },

      setCategory: (category) => {
        set({ selectedCategory: category })
      },

      isSolved: (id: string) => {
        return get().solvedPuzzleIds.includes(id)
      },

      resetProgress: () => {
        set({
          solvedPuzzleIds: [],
          currentStreak: 0,
          maxStreak: 0,
          selectedCategory: 'all',
        })
      },
    }),
    {
      name: 'gochess-puzzles-storage',
    }
  )
)
