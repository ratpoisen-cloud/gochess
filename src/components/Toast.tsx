import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (message: string, type: ToastType, duration?: number) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let toastIdCounter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType, duration = 4000) => {
    const id = `toast-${++toastIdCounter}`
    setToasts((prev) => [...prev, { id, message, type, duration }])

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  const typeBorderColors: Record<ToastType, string> = {
    success: 'var(--success)',
    error: 'var(--danger)',
    warning: '#d1a85f',
    info: '#7aa9d8',
  }

  return (
    <div
      className="fixed right-[12px] bottom-[12px] z-[1200] flex flex-col gap-[8px] pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="animate-toast-retro-in pointer-events-auto max-w-[min(92vw,360px)] p-[9px_11px] rounded-12 border border-[color-mix(in_srgb,var(--border)_94%,transparent)] shadow-[0_10px_24px_rgba(0,0,0,0.38)] opacity-100 translate-y-0 leading-[1.5] text-[0.76rem] font-medium saturate-100 cursor-pointer"
          style={{
            background: toast.type === 'info' ? 'var(--toast-info-bg)' : 'var(--toast-bg)',
            borderLeftWidth: '3px',
            borderLeftColor: typeBorderColors[toast.type],
            color: 'var(--text)',
          }}
          onClick={() => removeToast(toast.id)}
          role="alert"
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}
