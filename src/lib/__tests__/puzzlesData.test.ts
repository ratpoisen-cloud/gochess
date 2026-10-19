import { describe, it, expect } from 'vitest'
import { PUZZLES } from '../puzzlesData'
import { createEngine } from '../engine'

describe('puzzlesData', () => {
  it('has valid non-empty puzzles list', () => {
    expect(PUZZLES.length).toBeGreaterThanOrEqual(5)
  })

  it('every puzzle has valid FEN, unique id and legal solution moves', () => {
    const ids = new Set<string>()

    for (const puzzle of PUZZLES) {
      expect(ids.has(puzzle.id)).toBe(false)
      ids.add(puzzle.id)

      expect(puzzle.title).toBeTruthy()
      expect(puzzle.hint).toBeTruthy()
      expect(puzzle.solution.length).toBeGreaterThan(0)

      // Test engine can load FEN without crashing
      const engine = createEngine('standard', puzzle.fen)
      expect(engine.turn()).toBe(puzzle.playerColor)

      // Validate each move in solution
      for (const uci of puzzle.solution) {
        const from = uci.slice(0, 2)
        const to = uci.slice(2, 4)
        const promotion = uci.length > 4 ? uci.slice(4, 5) : undefined

        const moveResult = engine.move({ from, to, promotion })
        expect(moveResult).not.toBeNull()
      }
    }
  })
})
