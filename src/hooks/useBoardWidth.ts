import { useState, useEffect, useRef, RefObject } from 'react'

export function useBoardWidth(ref: RefObject<HTMLElement | null>) {
  const [boardWidth, setBoardWidth] = useState(0)
  const [stableWidth, setStableWidth] = useState(0)
  const timerRef = useRef<any>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const measure = () => {
      const rect = element.getBoundingClientRect()
      const width = rect.width
      
      if (width > 0) {
        setBoardWidth(width)
        
        // Debounce the "stable" width update to prevent flickering
        // and ensure we don't mount until it's at a reasonable size (> 300px)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          if (width >= 300) {
            setStableWidth(width)
          }
        }, 150)
      }
    }

    // Initial measurement after paint
    measure()

    const observer = new ResizeObserver(() => {
      measure()
    })

    observer.observe(element)

    return () => {
      observer.disconnect()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [ref])

  return { boardWidth, stableWidth }
}
