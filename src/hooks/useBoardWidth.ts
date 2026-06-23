import { useState, useEffect, useRef, RefObject } from 'react'

export function useBoardWidth(ref: RefObject<HTMLElement | null>, active: boolean) {
  const [boardWidth, setBoardWidth] = useState(0)
  const [stableWidth, setStableWidth] = useState(0)
  const timerRef = useRef<any>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || !active) return

    const measure = () => {
      const rect = element.getBoundingClientRect()
      const width = rect.width

      if (width > 0) {
        setBoardWidth(width)

        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          if (width >= 300) {
            setStableWidth(width)
          }
        }, 150)
      } else {
        rafRef.current = requestAnimationFrame(() => measure())
      }
    }

    measure()

    observerRef.current = new ResizeObserver(() => {
      measure()
    })
    observerRef.current.observe(element)

    return () => {
      observerRef.current?.disconnect()
      observerRef.current = null
      if (timerRef.current) clearTimeout(timerRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [ref, active])

  const immediateWidth = boardWidth || stableWidth
  return { boardWidth, stableWidth, immediateWidth }
}
