import { useState, useEffect, RefObject } from 'react'

export function useBoardWidth(ref: RefObject<HTMLElement>) {
  const [boardWidth, setBoardWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    setBoardWidth(element.clientWidth)

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setBoardWidth(entry.contentRect.width)
        }
      }
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return boardWidth
}
