import { useEffect, useState } from 'react'
import { STANDARD_BOTTOM_GAP, useBoardStore } from '@/stores/boardStore'

const BASE = import.meta.env.BASE_URL || '/'

interface MoveDustProps {
  /** Задержка перед показом — время анимации переезда фигуры, мс. */
  delay?: number
  /** Длительность эффекта, мс. */
  duration?: number
  /** Ширина эффекта в долях клетки. */
  width?: number
  /** Файл эффекта: гифка проигрывается сама. */
  src?: string
}

/**
 * Пыль из-под ноги: эффект появления фигуры на новой клетке.
 *
 * Гифка (48×24, 8 кадров по 100 мс) показывается на клетке, куда встала
 * фигура, и через `duration` убирается — компонент ничего не держит в DOM.
 * Эффект появляется с задержкой `delay`: столько длится анимация переезда
 * фигуры, поэтому пыль поднимается уже под ногой, а не под летящей фигурой.
 *
 * Низ эффекта совмещается с базой фигур (`STANDARD_BOTTOM_GAP`), чтобы
 * пыль шла из-под ног, а не из-под клетки.
 */
export default function MoveDust({
  delay = 200,
  duration = 800,
  width = 1,
  src = `${BASE}effects/FootDust.gif`,
}: MoveDustProps) {
  const [shown, setShown] = useState(false)
  const isPixelArt = useBoardStore((s) => s.isPixelArt())

  useEffect(() => {
    const showTimer = setTimeout(() => setShown(true), delay)
    const hideTimer = setTimeout(() => setShown(false), delay + duration)
    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, [delay, duration])

  if (!shown) return null

  return (
    <div className="absolute inset-0 flex items-end justify-center pointer-events-none z-20" aria-hidden="true">
      <img
        src={src}
        alt=""
        data-testid="move-dust"
        draggable={false}
        style={{
          width: `${width * 100}%`,
          height: 'auto',
          marginBottom: `${STANDARD_BOTTOM_GAP * 100}%`,
          imageRendering: isPixelArt ? 'pixelated' : 'auto',
          // Пыль бело-голубая: на светлой клетке без тёмного контура
          // она почти не видна. Контур даёт эффекту читаемость на любом фоне.
          filter: 'drop-shadow(0 0 1.5px rgba(0, 0, 0, 0.55))',
        }}
      />
    </div>
  )
}
