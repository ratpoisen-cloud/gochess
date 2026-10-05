import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import { createRef } from 'react'
import { MagicVFX, type MagicVFXHandle } from '@/components/MagicVFX'

interface Recorded {
  fills: Array<{ x: number; y: number; w: number; h: number }>
  clears: number
}

let recorded: Recorded
let translateX = 0
let translateY = 0
let transformStack: Array<[number, number]> = []

function stubContext(): CanvasRenderingContext2D {
  const ctx = {
    globalAlpha: 1,
    fillStyle: '',
    save: vi.fn(() => {
      transformStack.push([translateX, translateY])
    }),
    restore: vi.fn(() => {
      const previous = transformStack.pop()
      if (previous) {
        translateX = previous[0]
        translateY = previous[1]
      }
    }),
    translate: vi.fn((x: number, y: number) => {
      translateX += x
      translateY += y
    }),
    rotate: vi.fn(),
    setTransform: vi.fn(),
    clearRect: vi.fn(() => {
      recorded.clears++
    }),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
      recorded.fills.push({ x: x + translateX, y: y + translateY, w, h })
    })
  }
  return ctx as unknown as CanvasRenderingContext2D
}

const ATOMIC_BLAST_DURATION_MS = 1100

function advanceFrames(count: number, ms = 16) {
  for (let i = 0; i < count; i++) {
    act(() => {
      vi.advanceTimersByTime(ms)
    })
  }
}

function blast(ref: React.RefObject<MagicVFXHandle>) {
  act(() => {
    ref.current?.trigger({ x: 100, y: 100, type: 'atomic-blast', squareSize: 60 })
  })
}

describe('MagicVFX atomic blast', () => {
  beforeEach(() => {
    recorded = { fills: [], clears: 0 }
    translateX = 0
    translateY = 0
    transformStack = []
    vi.useFakeTimers()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => stubContext())
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('draws pixels when an atomic capture explodes', () => {
    const ref = createRef<MagicVFXHandle>()
    render(<MagicVFX ref={ref} boardWidth={480} />)
    blast(ref)
    advanceFrames(5)
    expect(recorded.fills.length).toBeGreaterThan(0)
  })

  it('clears the canvas every frame so no streaks are left behind', () => {
    const ref = createRef<MagicVFXHandle>()
    render(<MagicVFX ref={ref} boardWidth={480} />)
    blast(ref)
    recorded.clears = 0
    advanceFrames(10)
    expect(recorded.clears).toBe(10)
  })

  it('keeps drawing for most of a second, then stops for good', () => {
    const ref = createRef<MagicVFXHandle>()
    render(<MagicVFX ref={ref} boardWidth={480} />)
    blast(ref)
    advanceFrames(10)

    const fillsMidBlast = recorded.fills.length
    expect(fillsMidBlast).toBeGreaterThan(0)

    advanceFrames(Math.ceil(ATOMIC_BLAST_DURATION_MS / 16) + 20)

    const settledFills = recorded.fills.length
    advanceFrames(30)
    expect(recorded.fills.length).toBe(settledFills)
  })

  it('spawns an expanding shockwave ring on whole pixels', () => {
    const ref = createRef<MagicVFXHandle>()
    render(<MagicVFX ref={ref} boardWidth={480} />)
    blast(ref)

    advanceFrames(2)
    const earlyRadius = Math.max(...recorded.fills.map(f => Math.hypot(f.x - 100, f.y - 100)))
    recorded.fills.length = 0

    advanceFrames(10)
    const laterRadius = Math.max(...recorded.fills.map(f => Math.hypot(f.x - 100, f.y - 100)))

    expect(laterRadius).toBeGreaterThan(earlyRadius)
  })

  it('starts its shockwave at the epicentre rather than off-board', () => {
    const ref = createRef<MagicVFXHandle>()
    render(<MagicVFX ref={ref} boardWidth={480} />)
    blast(ref)
    advanceFrames(2)
    for (const f of recorded.fills) {
      expect(Math.abs(f.x - 100)).toBeLessThan(30)
      expect(Math.abs(f.y - 100)).toBeLessThan(30)
    }
  })

  it('survives being triggered twice in a row', () => {
    const ref = createRef<MagicVFXHandle>()
    render(<MagicVFX ref={ref} boardWidth={480} />)
    blast(ref)
    advanceFrames(3)
    blast(ref)
    advanceFrames(20)
    expect(recorded.fills.length).toBeGreaterThan(0)
    advanceFrames(Math.ceil(ATOMIC_BLAST_DURATION_MS / 16) + 20)
    const settled = recorded.fills.length
    advanceFrames(20)
    expect(recorded.fills.length).toBe(settled)
  })

  it('still fires the magic chess spell effects untouched', () => {
    const ref = createRef<MagicVFXHandle>()
    render(<MagicVFX ref={ref} boardWidth={480} />)

    const spells = ['ice-shatter', 'blast', 'jump', 'portal', 'confetti', 'sparkle', 'shield'] as const
    for (const type of spells) {
      recorded.fills.length = 0
      act(() => {
        ref.current?.trigger({ x: 100, y: 100, type })
      })
      advanceFrames(4)
      expect(recorded.fills.length, `${type} должен что-то рисовать`).toBeGreaterThan(0)
    }
  })

  it('scales the blast to the square size it is given', () => {
    const ref = createRef<MagicVFXHandle>()
    render(<MagicVFX ref={ref} boardWidth={480} />)

    const reachFor = (squareSize: number) => {
      recorded.fills.length = 0
      act(() => {
        ref.current?.trigger({ x: 300, y: 300, type: 'atomic-blast', squareSize })
      })
      advanceFrames(14)
      return Math.max(...recorded.fills.map(f => Math.hypot(f.x - 300, f.y - 300)))
    }

    const small = reachFor(30)
    const large = reachFor(120)
    expect(large).toBeGreaterThan(small * 2)
  })
})