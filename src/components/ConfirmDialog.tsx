import { useState, useCallback } from 'react'
import Modal from './Modal'
import Button from './Button'

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface ConfirmDialogState extends ConfirmOptions {
  isOpen: boolean
  resolve: (value: boolean) => void
}

let confirmResolver: ((value: boolean) => void) | null = null

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState | null>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      confirmResolver = resolve
      setState({
        ...options,
        isOpen: true,
        resolve,
        confirmLabel: options.confirmLabel || 'Подтвердить',
        cancelLabel: options.cancelLabel || 'Отмена',
        danger: options.danger ?? false,
      })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    setState((prev) => (prev ? { ...prev, isOpen: false } : null))
    confirmResolver?.(true)
    confirmResolver = null
  }, [])

  const handleCancel = useCallback(() => {
    setState((prev) => (prev ? { ...prev, isOpen: false } : null))
    confirmResolver?.(false)
    confirmResolver = null
  }, [])

  const ConfirmDialog = state ? (
    <Modal
      isOpen={state.isOpen}
      onClose={handleCancel}
      title={state.title}
      maxWidth="min(92vw, 420px)"
    >
      <p className="text-text-secondary mb-[var(--space-24)] leading-[1.55]">
        {state.message}
      </p>
      <div className="flex justify-end gap-[10px]">
        <Button variant="outline" onClick={handleCancel}>
          {state.cancelLabel}
        </Button>
        <Button variant={state.danger ? 'danger' : 'success'} onClick={handleConfirm}>
          {state.confirmLabel}
        </Button>
      </div>
    </Modal>
  ) : null

  return { confirm, ConfirmDialog }
}
