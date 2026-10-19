import { describe, it, expect } from 'vitest'
import { PUZZLES, PUZZLE_THEMES } from '../puzzlesData'
import { createEngine } from '../engine'

describe('puzzlesData', () => {
  it('has valid non-empty puzzles list and themes', () => {
    expect(PUZZLES.length).toBeGreaterThanOrEqual(15)
    expect(PUZZLE_THEMES.length).toBe(6)
  })

  it('every puzzle has valid theme, description, explanation and unique id', () => {
    const ids = new Set<string>()

    for (const puzzle of PUZZLES) {
      expect(ids.has(puzzle.id)).toBe(false)
      ids.add(puzzle.id)

      expect(puzzle.title).toBeTruthy()
      expect(puzzle.hint).toBeTruthy()
      expect(puzzle.explanation).toBeTruthy()
      expect(puzzle.description).toBeTruthy()
      expect(puzzle.solution.length).toBeGreaterThan(0)
      expect(['mate_in_1', 'mate_in_2', 'fork', 'pin', 'endgame']).toContain(puzzle.theme)
      expect(['easy', 'medium', 'hard']).toContain(puzzle.difficulty)

      // Test engine can load FEN without crashing
      const engine = createEngine('standard', puzzle.fen)
      expect(engine.turn()).toBe(puzzle.playerColor)

      // Validate each move in solution is legal in sequence
      for (const uci of puzzle.solution) {
        const from = uci.slice(0, 2)
        const to = uci.slice(2, 4)
        const promotion = uci.length > 4 ? uci.slice(4, 5) : undefined

        const moveResult = engine.move({ from, to, promotion })
        expect(moveResult).not.toBeNull()
      }

      // If mate in 1 or mate in 2, verify final position is checkmate!
      if (puzzle.theme === 'mate_in_1' || puzzle.theme === 'mate_in_2') {
        expect(engine.isCheckmate()).toBe(true)
      }
    }
  })
})
