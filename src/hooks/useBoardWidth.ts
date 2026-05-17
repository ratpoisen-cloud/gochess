import { useState, useLayoutEffect, useRef, RefObject } from 'react'

export function useBoardWidth(ref: RefObject<HTMLElement>) {
  const [boardWidth, setBoardWidth] = useState(760)
  const prevWidthRef = useRef(760)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) {
      setBoardWidth(760)
      return
    }

    const updateWidth = () => {
      const width = element.getBoundingClientRect().width
      if (width > 0 && width !== prevWidthRef.current) {
        prevWidthRef.current = width
        setBoardWidth(width)
      }
    }

    // Immediate measurement
    requestAnimationFrame(updateWidth)

    // Use ResizeObserver for responsive changes
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width
        if (width > 0 && width !== prevWidthRef.current) {
          prevWidthRef.current = width
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
