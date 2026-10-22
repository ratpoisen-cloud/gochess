/**
 * Уровни сложности Ичи — единый источник для хаба, модалок настройки,
 * шапки партии и разбора query-параметров.
 */

import type { BotLevel } from '@/types'

export interface BotLevelInfo {
  id: BotLevel
  /** Подпись в интерфейсе: «Очень лёгкий». */
  label: string
  /** Короткая подпись для шапки партии: «средний». */
  short: string
}

export const BOT_LEVELS: BotLevelInfo[] = [
  { id: 'very-easy', label: 'Очень лёгкий', short: 'очень лёгкий' },
  { id: 'easy', label: 'Лёгкий', short: 'лёгкий' },
  { id: 'medium', label: 'Средний', short: 'средний' },
  { id: 'hard', label: 'Сильный', short: 'сильный' },
]

const LEVEL_IDS = BOT_LEVELS.map((level) => level.id)

/** Проверяет, что строка — корректный id уровня. */
export function isBotLevel(value: unknown): value is BotLevel {
  return typeof value === 'string' && (LEVEL_IDS as string[]).includes(value)
}

/** Разбирает уровень из query-параметра. null — если значения нет или оно неизвестно. */
export function parseBotLevel(value: string | null | undefined): BotLevel | null {
  if (!value) return null
  return isBotLevel(value) ? value : null
}

/** Подпись уровня для интерфейса. */
export function botLevelLabel(level: BotLevel): string {
  return BOT_LEVELS.find((item) => item.id === level)?.label ?? 'Средний'
}

/** Короткая подпись уровня для шапки партии. */
export function botLevelShort(level: BotLevel): string {
  return BOT_LEVELS.find((item) => item.id === level)?.short ?? 'средний'
}
