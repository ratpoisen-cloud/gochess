import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import ChessTimer from '@/components/board/ChessTimer'

// ChessTimer used to derive every tick from `lastTickRef`, which was only reset
// when the `timeLeft` prop changed. The opponent's move writes only their own
// clock key, so our `timeLeft` prop stays identical while the opponent thinks —
// and the first tick after our turn started subtracted the opponent's entire
// thinking time from our clock, compounding every move until we lost on time.

function displayedMs(): number {
  const el = screen.getByText(/^\d+:\d{2}$/)
  const [m, s] = el.textContent!.split(':')
  return (Number(m) * 60 + Number(s)) * 1000
}

describe('ChessTimer — clock is not charged for the opponent thinking time', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('does not subtract the opponent thinking time when the turn comes back', () => {
    const { rerender } = render(
      <ChessTimer timeLeft={600_000} isActive label="White" onTimeout={() => {}} />,
    )
    expect(displayedMs()).toBe(600_000)

    // Our own 30 s of thinking — the clock must count it down.
    act(() => { vi.advanceTimersByTime(30_000) })
    expect(displayedMs()).toBe(570_000)

    // Opponent's turn: our clock is frozen, and the prop is NOT rewritten by
    // their move (buildTimerUpdate only touches the mover's own key).
    rerender(<ChessTimer timeLeft={600_000} isActive={false} label="White" onTimeout={() => {}} />)

    act(() => { vi.advanceTimersByTime(45_000) })
    expect(displayedMs()).toBe(570_000)

    // Our turn again. The prop value is byte-identical, so the [timeLeft]
    // effect does not re-run — the ticker has to re-base on isActive.
    rerender(<ChessTimer timeLeft={600_000} isActive label="White" onTimeout={() => {}} />)

    const beforeTick = displayedMs()

    // One second of our own thinking.
    act(() => { vi.advanceTimersByTime(1_000) })
    const afterTick = displayedMs()

    // We lost exactly our own second. Before the fix this dropped by ~46 s.
    expect(beforeTick - afterTick).toBeLessThanOrEqual(2_000)
    expect(beforeTick - afterTick).toBeGreaterThanOrEqual(0)
  })

  it('accumulates correctly over several move pairs', () => {
    const { rerender } = render(
      <ChessTimer timeLeft={600_000} isActive label="White" onTimeout={() => {}} />,
    )

    // Three cycles: we think 2 s, opponent thinks 20 s each time.
    for (let i = 0; i < 3; i++) {
      act(() => { vi.advanceTimersByTime(2_000) })
      rerender(<ChessTimer timeLeft={600_000} isActive={false} label="White" onTimeout={() => {}} />)
      act(() => { vi.advanceTimersByTime(20_000) })
      rerender(<ChessTimer timeLeft={600_000} isActive label="White" onTimeout={() => {}} />)
    }

    // Only our own 6 s may have been spent: 600000 - 6000.
    expect(displayedMs()).toBe(594_000)
  })

  it('still counts down our own clock once running', () => {
    render(<ChessTimer timeLeft={100_000} isActive label="White" onTimeout={() => {}} />)
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(displayedMs()).toBe(90_000)
  })

  it('fires onTimeout exactly once when the clock expires', () => {
    const onTimeout = vi.fn()
    render(<ChessTimer timeLeft={2_000} isActive label="White" onTimeout={onTimeout} />)

    act(() => { vi.advanceTimersByTime(5_000) })

    expect(onTimeout).toHaveBeenCalledTimes(1)
    expect(displayedMs()).toBe(0)
  })

  it('does not fire onTimeout while it is not our turn', () => {
    const onTimeout = vi.fn()
    const { rerender } = render(
      <ChessTimer timeLeft={2_000} isActive={false} label="White" onTimeout={onTimeout} />,
    )

    act(() => { vi.advanceTimersByTime(30_000) })
    expect(onTimeout).not.toHaveBeenCalled()

    // Taking the turn with an already-expired clock must report it exactly once.
    rerender(<ChessTimer timeLeft={2_000} isActive label="White" onTimeout={onTimeout} />)
    act(() => { vi.advanceTimersByTime(300) })
    expect(onTimeout).not.toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(3_000) })
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })
})