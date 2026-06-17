import { useState, useCallback, useRef } from 'react'
import { useToast } from '@/components/Toast'

export function usePgnCopy(pgnFn: () => string) {
  const [copied, setCopied] = useState(false)
  const { addToast } = useToast()
  const pgnRef = useRef(pgnFn)
  pgnRef.current = pgnFn

  const copyPgn = useCallback(() => {
    try {
      navigator.clipboard.writeText(pgnRef.current())
      setCopied(true)
      addToast('PGN скопирован', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      addToast('Ошибка копирования', 'error')
    }
  }, [addToast])

  return { pgnCopied: copied, copyPgn }
}
