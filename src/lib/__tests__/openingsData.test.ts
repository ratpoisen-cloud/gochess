import { describe, it, expect } from 'vitest'
import { OPENINGS, OPENING_FAMILIES, type Opening } from '../openingsData'
import {
  resolveOpeningLine,
  findMoveBySan,
  normalizeSan,
  positionKey,
  sanitizeSan,
  stepColor,
} from '../openings'
import { createEngine } from '../engine'

const familyIds = OPENING_FAMILIES.map((f) => f.id)

describe('openingsData', () => {
  it('has a non-empty openings list with unique ids and ECO codes', () => {
    expect(OPENINGS.length).toBeGreaterThanOrEqual(4)

    const ids = new Set<string>()
    const ecos = new Set<string>()
    for (const opening of OPENINGS) {
      expect(ids.has(opening.id)).toBe(false)
      ids.add(opening.id)
      expect(ecos.has(opening.eco)).toBe(false)
      ecos.add(opening.eco)
    }
  })

  it('every opening has valid metadata, comments and a long enough line', () => {
    for (const opening of OPENINGS) {
      expect(opening.name).toBeTruthy()
      expect(opening.summary).toBeTruthy()
      expect(opening.idea).toBeTruthy()
      expect(opening.eco).toMatch(/^[A-E]\d{2}$/)
      expect(familyIds).toContain(opening.family)
      expect(['easy', 'medium', 'hard']).toContain(opening.difficulty)
      expect(['w', 'b']).toContain(opening.color)
      expect(opening.steps.length).toBeGreaterThanOrEqual(8)

      for (const step of opening.steps) {
        expect(step.san.trim()).toBeTruthy()
        expect(step.comment.trim().length).toBeGreaterThan(10)
      }
    }
  })

  it('the line contains moves of the opening color', () => {
    for (const opening of OPENINGS) {
      // Белые ходят первыми, поэтому в дебюте за белых первый ход — шаг 0,
      // а в дебюте за чёрных — шаг 1.
      const firstPlayerStep = opening.color === 'w' ? 0 : 1
      expect(stepColor(firstPlayerStep)).toBe(opening.color)
      expect(opening.steps.length).toBeGreaterThan(firstPlayerStep)
    }
  })

  it('every line is legal and reproducible by the engine', () => {
    for (const opening of OPENINGS) {
      const line = resolveOpeningLine(opening)
      expect(line.valid, `${opening.name}: ${line.error ?? 'ошибка'}`).toBe(true)
      expect(line.uci.length).toBe(opening.steps.length)
      expect(line.sans.length).toBe(opening.steps.length)
      expect(line.positions.length).toBe(opening.steps.length + 1)

      // SAN в данных должен совпадать с SAN движка — иначе ход неоднозначен
      // (например, «Ne2», когда на e2 могут пойти два коня).
      for (let i = 0; i < opening.steps.length; i++) {
        expect(line.sans[i].replace(/[+#]/g, ''), `${opening.name}, шаг ${i + 1}`).toBe(
          sanitizeSan(opening.steps[i].san),
        )
      }
    }
  })

  it('deviations point at a legal step of the player color and are legal moves', () => {
    for (const opening of OPENINGS) {
      const line = resolveOpeningLine(opening)
      expect(line.valid).toBe(true)

      for (const deviation of opening.deviations) {
        expect(deviation.at).toBeGreaterThanOrEqual(0)
        expect(deviation.at).toBeLessThan(opening.steps.length)
        // Отклонение делает игрок, значит шаг должен быть его цвета.
        expect(stepColor(deviation.at)).toBe(opening.color)
        expect(deviation.comment.trim().length).toBeGreaterThan(10)

        const theorySan = opening.steps[deviation.at].san
        expect(normalizeSan(deviation.san)).not.toBe(normalizeSan(theorySan))

        const engine = createEngine('standard', line.positions[deviation.at])
        const move = findMoveBySan(engine, deviation.san)
        expect(move, `${opening.name}: отклонение ${deviation.san} нелегально`).not.toBeNull()
      }
    }
  })
})

describe('openings helpers', () => {
  it('normalizes SAN to a comparable form', () => {
    expect(normalizeSan('Nbd7')).toBe('Nd7')
    expect(normalizeSan('Nfd7')).toBe('Nd7')
    expect(normalizeSan('exd5')).toBe('xd5')
    expect(normalizeSan('d5')).toBe('d5')
    expect(normalizeSan('e4')).toBe('e4')
    expect(normalizeSan('O-O')).toBe('O-O')
    expect(normalizeSan('0-0')).toBe('O-O')
    expect(normalizeSan('Nf3!')).toBe('Nf3')
    expect(normalizeSan('Qh5#')).toBe('Qh5')
    expect(normalizeSan('e8=Q')).toBe('e8=Q')
  })

  it('position key ignores move counters but keeps the position', () => {
    const a = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const b = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 12 34'
    expect(positionKey(a)).toBe(positionKey(b))

    const c = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1'
    expect(positionKey(a)).not.toBe(positionKey(c))
  })

  it('replays a known line and matches the engine history', () => {
    const opening = OPENINGS.find((o) => o.id === 'italian-game') as Opening
    const line = resolveOpeningLine(opening)

    const engine = createEngine('standard')
    for (const uci of line.uci) {
      engine.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
      })
    }

    expect(engine.history()).toEqual(line.sans)
    expect(engine.fen()).toBe(line.positions[line.positions.length - 1])
  })
})
