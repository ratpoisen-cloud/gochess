import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import MoveDust from '@/components/board/MoveDust'

describe('MoveDust', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('показывает пыль только после задержки (пока фигура ещё переезжает)', () => {
    render(<MoveDust delay={200} duration={800} />)

    expect(screen.queryByTestId('move-dust')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(screen.getByTestId('move-dust')).toBeInTheDocument()
  })

  it('убирает эффект из DOM после отыгрыша', () => {
    render(<MoveDust delay={200} duration={800} />)

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.getByTestId('move-dust')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(800)
    })
    expect(screen.queryByTestId('move-dust')).toBeNull()
  })

  it('низ пыли совмещается с базой фигур', () => {
    render(<MoveDust delay={0} duration={800} />)

    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(screen.getByTestId('move-dust')).toHaveStyle({ marginBottom: '10%' })
  })

  it('эффект не перехватывает клики по доске', () => {
    render(<MoveDust delay={0} duration={800} />)

    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(screen.getByTestId('move-dust').parentElement).toHaveClass('pointer-events-none')
  })
})
