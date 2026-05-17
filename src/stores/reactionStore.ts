import { create } from 'zustand'

export const BOARD_REACTIONS = ['💀', '🤡', '😭', '😏', '👀', '🔥', '😴', '⚰️', '🖕🏻', '💅🏻', '⚔️', '🏴‍☠️', '🤝', '🐒', '🤬', '💩']
export const REACTION_TTL_MS = 7000
export const REACTION_MAX_PER_CYCLE = 5

export interface BoardReaction {
  id: string
  square: string
  emoji: string
  from: 'w' | 'b'
  timestamp: number
  expiresAt: number
}

interface ReactionState {
  activeReactions: BoardReaction[]
  reactionCountThisCycle: number
  currentCycleKey: string
  addReaction: (square: string, emoji: string, from: 'w' | 'b') => boolean
  canSendReaction: (cycleKey: string) => boolean
  clearExpired: () => void
  clearAll: () => void
}

export const useReactionStore = create<ReactionState>((set, get) => ({
  activeReactions: [],
  reactionCountThisCycle: 0,
  currentCycleKey: '',

  canSendReaction: (cycleKey) => {
    const { currentCycleKey, reactionCountThisCycle } = get()
    if (cycleKey !== currentCycleKey) return true
    return reactionCountThisCycle < REACTION_MAX_PER_CYCLE
  },

  addReaction: (square, emoji, from) => {
    const { activeReactions, canSendReaction } = get()

    const now = Date.now()
    const cycleKey = `${from}_${now}`

    if (!canSendReaction(cycleKey)) return false

    const existing = activeReactions.find((r) => r.square === square && r.expiresAt > now)
    if (existing) return false

    const reaction: BoardReaction = {
      id: `reaction_${now}_${Math.random().toString(36).slice(2, 8)}`,
      square,
      emoji,
      from,
      timestamp: now,
      expiresAt: now + REACTION_TTL_MS,
    }

    set({
      activeReactions: [...activeReactions, reaction].slice(-24),
      reactionCountThisCycle: get().currentCycleKey === cycleKey ? get().reactionCountThisCycle + 1 : 1,
      currentCycleKey: cycleKey,
    })

    return true
  },

  clearExpired: () => {
    const { activeReactions } = get()
    const now = Date.now()
    const filtered = activeReactions.filter((r) => r.expiresAt > now)
    if (filtered.length !== activeReactions.length) {
      set({ activeReactions: filtered })
    }
  },

  clearAll: () => {
    set({ activeReactions: [], reactionCountThisCycle: 0, currentCycleKey: '' })
  },
}))
