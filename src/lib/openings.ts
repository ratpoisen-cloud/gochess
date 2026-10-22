/**
 * Мост между «человеческими» данными дебютов (SAN) и движком.
 *
 * - resolveOpeningLine() превращает линию дебюта в UCI-ходы и FEN-позиции,
 *   попутно проверяя легальность каждого хода: опечатка в данных всплывает
 *   сразу, а не в середине партии.
 * - positionKey() — канонический ключ позиции (первые 4 поля FEN) для
 *   открывающей книги Ичи.
 */

import { createEngine } from '@/lib/engine'
import type { EngineAPI, Move } from '@/lib/engine/types'
import type { Opening, OpeningStep } from './openingsData'

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/**
 * Канонический ключ позиции: расстановка, чей ход, рокировка, en passant.
 * Счётчики (halfmove/fullmove) в ключ не входят — они не влияют на ходы.
 */
export function positionKey(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(' ')
}

export function moveToUci(move: Move): string {
  return move.from + move.to + (move.promotion ?? '')
}

/** Убирает аннотации (!? +# $n) и превращает 0-0 в O-O. */
export function sanitizeSan(san: string): string {
  return san
    .trim()
    .replace(/\$\d+/g, '')
    .replace(/[!?]+/g, '')
    .replace(/[+#]+$/g, '')
    .replace(/0-0-0/g, 'O-O-O')
    .replace(/0-0/g, 'O-O')
}

/**
 * Приводит SAN к каноническому виду, чтобы «Nbd7» и «Nd7» совпадали,
 * а «exd5» и «d5» — нет. Ровно так же работает сопоставление с SAN движка.
 */
export function normalizeSan(san: string): string {
  const s = sanitizeSan(san)
  if (s === 'O-O-O') return 'O-O-O'
  if (s === 'O-O') return 'O-O'

  const piece = /^([KQRBN])([a-h]?[1-8]?)x?([a-h][1-8])(?:=([QRBN]))?$/.exec(s)
  if (piece) return piece[1] + piece[3] + (piece[4] ? '=' + piece[4] : '')

  const promoCapture = /^[a-h]x([a-h][1-8])=([QRBN])$/.exec(s)
  if (promoCapture) return 'x' + promoCapture[1] + '=' + promoCapture[2]

  const capture = /^[a-h]x([a-h][1-8])$/.exec(s)
  if (capture) return 'x' + capture[1]

  const promoPush = /^([a-h][1-8])=([QRBN])$/.exec(s)
  if (promoPush) return promoPush[1] + '=' + promoPush[2]

  const push = /^([a-h][1-8])$/.exec(s)
  if (push) return push[1]

  return s
}

/** Ищет легальный ход, соответствующий SAN. null — если такого хода нет. */
export function findMoveBySan(engine: EngineAPI, san: string): Move | null {
  const target = normalizeSan(san)
  const moves = engine.moves({ verbose: true })
  const exact = moves.find((m) => m.san === sanitizeSan(san))
  if (exact) return exact
  const matches = moves.filter((m) => normalizeSan(m.san) === target)
  return matches.length > 0 ? matches[0] : null
}

export interface ResolvedLine {
  /** UCI-ходы линии. */
  uci: string[]
  /** Канонический SAN каждого хода (от движка). */
  sans: string[]
  /** Позиции до каждого хода + финальная (длина = uci.length + 1). */
  positions: string[]
  /** true — все ходы легальны. */
  valid: boolean
  /** Индекс первого нелегального хода (-1, если всё в порядке). */
  errorIndex: number
  error?: string
}

const lineCache = new Map<string, ResolvedLine>()

/**
 * Прогоняет линию дебюта через движок и возвращает UCI-ходы и позиции.
 * Результат кэшируется по id дебюта.
 */
export function resolveOpeningLine(opening: Opening, startFen: string = START_FEN): ResolvedLine {
  const cached = lineCache.get(opening.id)
  if (cached) return cached

  const engine = createEngine('standard', startFen)
  const uci: string[] = []
  const sans: string[] = []
  const positions: string[] = [engine.fen()]

  for (let i = 0; i < opening.steps.length; i++) {
    const step = opening.steps[i]
    const move = findMoveBySan(engine, step.san)
    if (!move) {
      const result: ResolvedLine = {
        uci,
        sans,
        positions,
        valid: false,
        errorIndex: i,
        error: `Недопустимый ход на шаге ${i + 1}: ${step.san}`,
      }
      lineCache.set(opening.id, result)
      return result
    }
    uci.push(moveToUci(move))
    sans.push(move.san)
    engine.move({ from: move.from, to: move.to, promotion: move.promotion })
    positions.push(engine.fen())
  }

  const result: ResolvedLine = { uci, sans, positions, valid: true, errorIndex: -1 }
  lineCache.set(opening.id, result)
  return result
}

/** Сбрасывает кэш линий (используется в тестах). */
export function clearOpeningLineCache(): void {
  lineCache.clear()
}

/**
 * Шаг дебюта, дополненный машинными данными: UCI, SAN из движка и
 * позиция до хода.
 */
export interface ResolvedStep extends OpeningStep {
  index: number
  uci: string
  engineSan: string
  fenBefore: string
  fenAfter: string
}

/** Разбирает линию дебюта на шаги с UCI/FEN. */
export function resolveOpeningSteps(opening: Opening, startFen: string = START_FEN): ResolvedStep[] {
  const line = resolveOpeningLine(opening, startFen)
  const steps: ResolvedStep[] = []
  for (let i = 0; i < opening.steps.length; i++) {
    const step = opening.steps[i]
    steps.push({
      ...step,
      index: i,
      uci: line.uci[i] ?? '',
      engineSan: line.sans[i] ?? step.san,
      fenBefore: line.positions[i] ?? startFen,
      fenAfter: line.positions[i + 1] ?? startFen,
    })
  }
  return steps
}

/** Кто ходит на шаге i (0-based) при старте с белых. */
export function stepColor(index: number): 'w' | 'b' {
  return index % 2 === 0 ? 'w' : 'b'
}

/**
 * Позиция после главной линии дебюта.
 *
 * Именно с неё начинается тренировка (/bot/training): дебют выбран в хабе,
 * а игрок тренирует уже позицию, которую дебут создал.
 */
export function openingPositionFen(opening: Opening): string {
  const steps = resolveOpeningSteps(opening)
  return steps.length > 0 ? steps[steps.length - 1].fenAfter : START_FEN
}

/** Форматирует линию в вид «1. e4 e5 2. Nf3 Nc6». */
export function formatOpeningLine(sans: string[]): string {
  const parts: string[] = []
  for (let i = 0; i < sans.length; i++) {
    if (i % 2 === 0) parts.push(`${Math.floor(i / 2) + 1}.`)
    parts.push(sans[i])
  }
  return parts.join(' ')
}
