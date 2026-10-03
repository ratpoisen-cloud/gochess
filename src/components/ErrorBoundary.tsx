import { Component, ReactNode } from 'react'
import Button from './Button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="min-h-[100dvh] flex items-center justify-center p-[var(--space-20)]">
          <div className="text-center max-w-[400px]">
            <h2 className="text-[var(--font-size-lg)] font-bold text-[var(--danger)] mb-[var(--space-16)]">
              Что-то пошло не так
            </h2>
            <p className="text-text-secondary text-[var(--font-size-sm)] mb-[var(--space-20)]">
              {this.state.error?.message || 'Неизвестная ошибка'}
            </p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Перезагрузить
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
