import { memo } from 'react'
import type { CSSProperties } from 'react'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

interface BoardCoordinatesProps {
  boardWidth: number
  orientation: 'white' | 'black'
  lightSquare: string
  darkSquare: string
}

/**
 * Координаты доски (a–h по горизонтали, 1–8 по вертикали).
 *
 * Раньше их рисовал сам react-chessboard: глиф ложился в угол клетки
 * шрифтом `boardWidth / 64` (≈7px на доске 444px). В пиксельном
 * Press Start 2P такой размер превращал буквы в кашу, а нижний ряд
 * (a–h) и правый столбец обрезались краем доски — контейнер был на 4px
 * шире контентной области и прятал правый/нижний край вместе с буквами.
 *
 * Теперь координаты — собственный слой поверх доски: свой размер,
 * отступ от края клетки и цвет, контрастный той клетке, на которой
 * буква лежит (на светлой клетке — тёмная буква, и наоборот).
 */
function BoardCoordinates({ boardWidth, orientation, lightSquare, darkSquare }: BoardCoordinatesProps) {
  if (!boardWidth) return null

  const fontSize = Math.max(10, Math.round(boardWidth / 42))
  const inset = Math.max(3, Math.round(boardWidth / 140))

  const items: { key: string; text: string; color: string; style: CSSProperties }[] = []

  // Файлы (a–h) — правый нижний угол клетки нижнего ряда.
  for (let col = 0; col < 8; col++) {
    const file = orientation === 'black' ? FILES[7 - col] : FILES[col]
    const onLightSquare = (col + 7) % 2 === 0
    items.push({
      key: `file-${file}`,
      text: file,
      color: onLightSquare ? darkSquare : lightSquare,
      style: {
        left: `calc(${(col + 1) * 12.5}% - ${inset}px)`,
        bottom: inset,
        transform: 'translateX(-100%)',
      },
    })
  }

  // Ранги (1–8) — левый верхний угол клетки первого столбца.
  for (let row = 0; row < 8; row++) {
    const rank = orientation === 'black' ? row + 1 : 8 - row
    const onLightSquare = row % 2 === 0
    items.push({
      key: `rank-${rank}`,
      text: String(rank),
      color: onLightSquare ? darkSquare : lightSquare,
      style: {
        top: `calc(${row * 12.5}% + ${inset}px)`,
        left: inset,
      },
    })
  }

  return (
    <div
      className="absolute left-0 top-0 pointer-events-none select-none"
      style={{ zIndex: 5, width: boardWidth, height: boardWidth }}
      aria-hidden="true"
    >
      {items.map((item) => (
        <span
          key={item.key}
          className="absolute leading-none"
          style={{ fontSize, color: item.color, ...item.style }}
        >
          {item.text}
        </span>
      ))}
    </div>
  )
}

export default memo(BoardCoordinates)
