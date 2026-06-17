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

  const clearPendingRequest = () => {
    activeResolver = null
    activeRejector = null
  }

  const ensureInitialized = () => {
    if (worker) return

    try {
      worker = new Worker(new URL('./bot/ichi.worker.ts', import.meta.url), { type: 'module' })
    } catch (err) {
      console.error('[BotEngine] Failed to create worker:', err)
      return
    }

    worker.onmessage = (event: MessageEvent) => {
      if (activeResolver) {
        const data = event.data as { from: string; to: string; promotion?: string } | null
        if (data) {
          const lan = data.from + data.to + (data.promotion || '')
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
        activeResolver = resolve
        activeRejector = reject

        worker!.postMessage({ fen, config: { depth: profile.depth, randomness: profile.randomness } })
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
