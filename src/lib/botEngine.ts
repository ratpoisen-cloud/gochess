import type { BotLevel } from '@/types'

interface BotProfile {
  depth: number
  randomness: number
}

const LEVELS: Record<BotLevel, BotProfile> = {
  'very-easy': { depth: 1, randomness: 0.5 },
  easy: { depth: 2, randomness: 0.3 },
  medium: { depth: 3, randomness: 0.1 },
  hard: { depth: 4, randomness: 0 },
}

export function createBotEngine(level: BotLevel = 'medium') {
  const profile = LEVELS[level]
  let worker: Worker | null = null
  let activeResolver: ((move: string | null) => void) | null = null
  let activeRejector: ((err: unknown) => void) | null = null
  let nextRequestId = 1
  let pendingRequestId = 0

  const clearPendingRequest = () => {
    activeResolver = null
    activeRejector = null
    pendingRequestId = 0
  }

  const ensureInitialized = () => {
    if (worker) return

    try {
      worker = new Worker(new URL('./bot/ichi.worker.ts', import.meta.url), { type: 'module' })
    } catch (err) {
      console.error('[BotEngine] Failed to create worker:', err)
      return
    }

    worker.onmessage = (event: MessageEvent<{ id: number; result: { from: string; to: string; promotion?: string } | null }>) => {
      const { id, result } = event.data
      if (id !== pendingRequestId) return

      if (activeResolver) {
        if (result) {
          const lan = result.from + result.to + (result.promotion || '')
          activeResolver(lan)
        } else {
          activeResolver(null)
        }
      }
      clearPendingRequest()
    }

    worker.onerror = (error) => {
      console.error('[BotEngine] Worker error:', error)
      if (activeRejector) activeRejector(error)
      clearPendingRequest()
    }
  }

  return {
    level,
    profile,
    async getBestMove(fen: string): Promise<string | null> {
      ensureInitialized()
      if (!fen || !worker) return null

      if (activeRejector) {
        activeRejector(new Error('Bot search interrupted'))
        clearPendingRequest()
      }

      return new Promise<string | null>((resolve, reject) => {
        const id = nextRequestId++
        pendingRequestId = id
        activeResolver = resolve
        activeRejector = reject

        worker!.postMessage({ id, fen, config: { depth: profile.depth, randomness: profile.randomness } })
      })
    },
    destroy() {
      try {
        if (worker) {
          worker.terminate()
        }
      } catch (error) {
        console.warn('[BotEngine] Termination warning:', error)
      } finally {
        worker = null
        clearPendingRequest()
      }
    },
  }
}
