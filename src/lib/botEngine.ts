import type { BotLevel } from '@/types'
import { createEngine } from '@/lib/engine'

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

/**
 * A hung or crashed worker must not freeze the UI forever (the "Ход
 * соперника" spinner had no exit). Each level gets a generous but finite
 * budget; on expiry the search is abandoned and a random legal move is
 * played instead.
 */
const SEARCH_BUDGET_MS: Record<BotLevel, number> = {
  'very-easy': 4000,
  easy: 5000,
  medium: 8000,
  hard: 12000,
}

/** Last-resort move when the worker never answers. */
function randomLegalMove(fen: string): string | null {
  try {
    const engine = createEngine('standard', fen)
    const moves = engine.moves({ verbose: true })
    if (!moves.length) return null
    const move = moves[Math.floor(Math.random() * moves.length)]
    return move.lan ?? move.from + move.to + (move.promotion ?? '')
  } catch {
    return null
  }
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

  /** Stop the worker and drop the in-flight request; a late message can
   *  no longer resolve anything because pendingRequestId is reset. */
  const terminateWorker = () => {
    try {
      if (worker) worker.terminate()
    } catch (error) {
      console.warn('[BotEngine] Termination warning:', error)
    } finally {
      worker = null
      clearPendingRequest()
    }
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

      const search = new Promise<string | null>((resolve, reject) => {
        const id = nextRequestId++
        pendingRequestId = id
        activeResolver = resolve
        activeRejector = reject

        worker!.postMessage({ id, fen, config: { depth: profile.depth, randomness: profile.randomness } })
      })

      let timeoutId: ReturnType<typeof setTimeout> | undefined
      const timeout = new Promise<string | null>((resolve) => {
        timeoutId = setTimeout(() => {
          console.warn(`[BotEngine] Search exceeded ${SEARCH_BUDGET_MS[level]}ms, falling back`)
          // Resolve the race with the fallback first — otherwise settling
          // `search` first would hand null to Promise.race.
          resolve(randomLegalMove(fen))
          if (activeResolver) activeResolver(null)
          terminateWorker()
        }, SEARCH_BUDGET_MS[level])
      })

      try {
        return await Promise.race([search, timeout])
      } finally {
        clearTimeout(timeoutId)
      }
    },
    destroy() {
      terminateWorker()
    },
  }
}
