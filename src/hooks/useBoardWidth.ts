import { useState, useEffect, RefObject } from 'react'

export function useBoardWidth(ref: RefObject<HTMLElement>) {
  const [boardWidth, setBoardWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const updateWidth = () => {
      const width = element.getBoundingClientRect().width
      if (width > 0) {
        setBoardWidth(width)
      }
    }

    // Initial check
    updateWidth()

    // Use ResizeObserver for responsive changes
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width
        if (width > 0) {
          setBoardWidth(width)
        }
      }
    })

    observer.observe(element)

    // Fallback for some browsers or cases where ResizeObserver might be delayed
    window.addEventListener('resize', updateWidth)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateWidth)
    }
  }, [])

  return boardWidth
}
