/**
 * Открывающая книга Ичи.
 *
 * Книга строится из данных дебютов (src/lib/openingsData.ts): каждая позиция
 * главной линии превращается в запись «позиция → ход по теории». Ключ
 * позиции — первые четыре поля FEN (расстановка, чей ход, рокировка, en
 * passant), счётчики в ключ не входят.
 *
 * Книга используется ботом до того, как включается поиск: если позиция
 * известна, Ичи играет теоретический ход, а не перебирает варианты.
 */

import { OPENINGS } from '@/lib/openingsData'
import { positionKey, resolveOpeningSteps } from '@/lib/openings'

export interface BookMove {
  /** UCI хода (например, 'e2e4'). */
  uci: string
  /** SAN хода в виде движка. */
  san: string
  /** id дебюта, из которого взят ход. */
  openingId: string
  /** Название дебюта. */
  openingName: string
  /** ECO-код дебюта. */
  eco: string
}

function buildBook(): Map<string, BookMove[]> {
  const map = new Map<string, BookMove[]>()

  for (const opening of OPENINGS) {
    const steps = resolveOpeningSteps(opening)
    for (const step of steps) {
      if (!step.uci) continue
      const key = positionKey(step.fenBefore)
      const entry: BookMove = {
        uci: step.uci,
        san: step.engineSan,
        openingId: opening.id,
        openingName: opening.name,
        eco: opening.eco,
      }
      const list = map.get(key)
      if (list) {
        list.push(entry)
      } else {
        map.set(key, [entry])
      }
    }
  }

  return map
}

// Книга строится один раз — при первом обращении.
let bookMap: Map<string, BookMove[]> | null = null

function getBook(): Map<string, BookMove[]> {
  if (!bookMap) bookMap = buildBook()
  return bookMap
}

/** Все известные ходы книги для позиции. */
export function getBookMoves(fen: string): BookMove[] {
  return getBook().get(positionKey(fen)) ?? []
}

/** Ход книги конкретного дебюта для позиции. */
export function getOpeningBookMove(fen: string, openingId: string): BookMove | null {
  return getBookMoves(fen).find((m) => m.openingId === openingId) ?? null
}

/**
 * Ход, который бот сыграет по книге:
 * - если выбран дебют — строго его линия;
 * - иначе — единственный известный ход из книги (если вариантов больше,
 *   позиция считается неоднозначной и бот решает сам).
 */
export function getBotBookMove(fen: string, openingId?: string | null): BookMove | null {
  if (openingId) return getOpeningBookMove(fen, openingId)

  const moves = getBookMoves(fen)
  if (moves.length === 0) return null

  const distinct = new Set(moves.map((m) => m.uci))
  if (distinct.size !== 1) return null

  return moves[0]
}

/** Количество позиций в книге (для тестов и отладки). */
export function getBookSize(): number {
  return getBook().size
}
