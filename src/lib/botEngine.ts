import type { BotLevel } from '@/types'

const BASE = import.meta.env.BASE_URL || '/'

interface BotProfile {
  skill: number
  depth: number
  movetime: number
}

const LEVELS: Record<BotLevel, BotProfile> = {
  'very-easy': { skill: 0, depth: 1, movetime: 200 },
  easy: { skill: 0, depth: 3, movetime: 50 },
  medium: { skill: 2, depth: 5, movetime: 100 },
  hard: { skill: 4, depth: 8, movetime: 220 },
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

  const onWorkerMessage = (event: MessageEvent) => {
    const line = String(event?.data || '').trim()
    if (!line) return

    if (line.startsWith('bestmove')) {
      const bestMove = line.split(/\s+/)[1] || null
      if (activeResolver) {
        activeResolver(bestMove)
      }
      clearPendingRequest()
    }
  }

  const send = (command: string) => {
    if (!worker) return
    worker.postMessage(command)
  }

  const ensureInitialized = () => {
    if (worker) return

    try {
      worker = new Worker(`${BASE}engine/stockfish-18-lite-single.js`)
    } catch (err) {
      console.error('[BotEngine] Failed to create worker:', err)
      return
    }

    worker.onmessage = onWorkerMessage
    worker.onerror = (error) => {
      console.error('[BotEngine] Worker error:', error)
      if (activeRejector) {
        activeRejector(error)
      }
      clearPendingRequest()
    }

    send('uci')
    send('isready')
    send(`setoption name Skill Level value ${profile.skill}`)
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

        send('stop')
        send(`position fen ${fen}`)
        send(`go depth ${profile.depth} movetime ${profile.movetime}`)
      })
    },
    destroy() {
      try {
        if (worker) {
          send('stop')
          send('quit')
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
