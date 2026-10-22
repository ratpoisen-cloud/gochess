import { describe, it, expect } from 'vitest'
import { createEngine } from '@/lib/engine'
import {
  getBotBookMove,
  getBookMoves,
  getBookSize,
  getOpeningBookMove,
} from '../bot/openingBook'
import { START_FEN, resolveOpeningSteps } from '../openings'
import { getOpeningById } from '../openingsData'

describe('openingBook', () => {
  it('covers every position of the opening lines', () => {
    const italian = getOpeningById('italian-game')
    expect(italian).toBeDefined()

    const steps = resolveOpeningSteps(italian!)
    expect(steps.length).toBeGreaterThan(0)

    for (const step of steps) {
      const moves = getBookMoves(step.fenBefore)
      const found = moves.find((m) => m.uci === step.uci && m.openingId === italian!.id)
      expect(found).toBeDefined()
    }

    expect(getBookSize()).toBeGreaterThan(0)
  })

  it('plays the first move of the chosen opening', () => {
    const move = getBotBookMove(START_FEN, 'italian-game')
    expect(move?.uci).toBe('e2e4')
    expect(move?.san).toBe('e4')
    expect(move?.eco).toBe('C50')
  })

  it('follows the whole line of the chosen opening', () => {
    const engine = createEngine('standard', START_FEN)
    const italian = getOpeningById('italian-game')!
    const steps = resolveOpeningSteps(italian)

    for (const step of steps) {
      const move = getBotBookMove(engine.fen(), italian.id)
      expect(move?.uci).toBe(step.uci)

      const legal = engine.moves({ verbose: true }).map((m) => m.lan)
      expect(legal).toContain(step.uci)

      engine.move({ from: step.uci.slice(0, 2), to: step.uci.slice(2, 4) })
    }
  })

  it('does not answer for positions outside the book', () => {
    const engine = createEngine('standard', START_FEN)
    engine.move({ from: 'e2', to: 'e4' })
    engine.move({ from: 'd7', to: 'd5' })
    engine.move({ from: 'e4', to: 'e5' })
    // Позиция вне книг: ищем d5 — такой позиции в дебютных линиях нет.
    const fen = engine.fen()
    expect(getOpeningBookMove(fen, 'italian-game')).toBeNull()
    expect(getBotBookMove(fen, 'italian-game')).toBeNull()
  })

  it('is ambiguous at the start when no opening is chosen', () => {
    const moves = getBookMoves(START_FEN)
    expect(moves.length).toBeGreaterThan(1)
    // Разные дебюты начинаются по-разному — бот решает сам.
    expect(getBotBookMove(START_FEN)).toBeNull()
  })

  it('is ambiguous after 1.e4 when no opening is chosen', () => {
    const engine = createEngine('standard', START_FEN)
    engine.move({ from: 'e2', to: 'e4' })

    // После 1.e4 теория предлагает и ...e5, и ...c5, и ...c6, и ...e6 —
    // выбор остаётся за поиском бота.
    const moves = getBookMoves(engine.fen())
    expect(new Set(moves.map((m) => m.uci)).size).toBeGreaterThan(1)
    expect(getBotBookMove(engine.fen())).toBeNull()

    // Но выбранный дебют всегда даёт однозначный ответ.
    expect(getBotBookMove(engine.fen(), 'sicilian-najdorf')?.uci).toBe('c7c5')
    expect(getBotBookMove(engine.fen(), 'caro-kann-classical')?.uci).toBe('c7c6')
  })
})
