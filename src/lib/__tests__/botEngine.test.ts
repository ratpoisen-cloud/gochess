import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createBotEngine } from '../botEngine'
import { createEngine } from '@/lib/engine'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

type Reply = { from: string; to: string; promotion?: string } | null

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: { data: { id: number; result: Reply } }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  terminated = false
  constructor() {
    FakeWorker.instances.push(this)
  }
  postMessage(msg: { id: number; fen: string }) {
    if (FakeWorker.respond) {
      queueMicrotask(() => {
        this.onmessage?.({ data: { id: msg.id, result: { from: 'e2', to: 'e4' } } })
      })
    }
    // иначе молчит — имитация зависшего поиска
  }
  terminate() {
    this.terminated = true
  }
  static respond = false
  static reset() {
    FakeWorker.instances = []
    FakeWorker.respond = false
  }
}

describe('botEngine timeout', () => {
  beforeEach(() => {
    FakeWorker.reset()
    vi.stubGlobal('Worker', FakeWorker)
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('answers with a legal fallback when the worker hangs', async () => {
    const engine = createBotEngine('very-easy')
    const pending = engine.getBestMove(START_FEN)

    // Бюджет very-easy = 4000ms; воркер не отвечает вовсе.
    await vi.advanceTimersByTimeAsync(4100)
    const move = await pending

    expect(move).not.toBeNull()
    const legal = createEngine('standard', START_FEN)
      .moves({ verbose: true })
      .map((m) => m.lan)
    expect(legal).toContain(move)
    expect(FakeWorker.instances[0].terminated).toBe(true)

    engine.destroy()
  })

  it('uses the worker answer and clears the timer when it responds in time', async () => {
    FakeWorker.respond = true
    const engine = createBotEngine('very-easy')
    const pending = engine.getBestMove(START_FEN)

    await vi.advanceTimersByTimeAsync(10)
    const move = await pending
    expect(move).toBe('e2e4')

    // Таймер отменён: просрочка не подменяет результат
    await vi.advanceTimersByTimeAsync(5000)
    expect(await pending).toBe('e2e4')
    expect(FakeWorker.instances[0].terminated).toBe(false)

    engine.destroy()
  })

  it('recreates the worker after a timeout', async () => {
    const engine = createBotEngine('very-easy')
    const first = engine.getBestMove(START_FEN)
    await vi.advanceTimersByTimeAsync(4100)
    await first
    expect(FakeWorker.instances[0].terminated).toBe(true)

    // Следующий вызов заводит нового воркера, а не падает
    FakeWorker.respond = true
    const second = engine.getBestMove(START_FEN)
    await vi.advanceTimersByTimeAsync(10)
    expect(await second).toBe('e2e4')
    expect(FakeWorker.instances.length).toBe(2)

    engine.destroy()
  })
})
