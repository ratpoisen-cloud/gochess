/**
 * Разбор FEN для определения хода по двум соседним позициям.
 *
 * Нужна доске, чтобы понять, что фигура только что заняла новую клетку:
 * сравнение позиций даёт этот факт напрямую, без опоры на `lastMove`
 * (который меняется ещё и при восстановлении партии).
 */

/**
 * Раскладка позиции FEN в массив из 64 клеток в порядке a8 → h1.
 * Пустая клетка — '', фигура — буква FEN ('P', 'p', 'n', ...).
 */
export function fenPlacement(fen: string): string[] {
  const placement = fen.trim().split(/\s+/)[0] ?? ''
  const squares: string[] = []
  for (const char of placement) {
    if (char === '/') continue
    if (char >= '1' && char <= '8') {
      for (let i = 0; i < Number(char); i++) squares.push('')
    } else {
      squares.push(char)
    }
  }
  return squares
}

/** Индекс клетки (0..63, a8 → h1) в алгебраическую запись: 'e4'. */
export function squareName(index: number): string {
  const file = String.fromCharCode(97 + (index % 8))
  const rank = 8 - Math.floor(index / 8)
  return `${file}${rank}`
}

/**
 * Клетка, на которую встала фигура, по двум соседним позициям.
 *
 * Возвращает `null`, если позиция изменилась не одним ходом:
 * восстановление партии, отмена хода, смена задачи, взятие «епашта» —
 * там пыль из-под ноги показывать нечего.
 */
export function findLandedSquare(prevFen: string, nextFen: string): string | null {
  const before = fenPlacement(prevFen)
  const after = fenPlacement(nextFen)
  if (before.length !== 64 || after.length !== 64) return null

  const changed: number[] = []
  for (let i = 0; i < 64; i++) {
    if (before[i] !== after[i]) changed.push(i)
  }
  // Один ход меняет две клетки: откуда ушла фигура и куда встала.
  if (changed.length !== 2) return null

  // Клетка назначения — та, где после хода появилась фигура.
  const landed = changed.find((i) => after[i] !== '')
  return landed === undefined ? null : squareName(landed)
}
