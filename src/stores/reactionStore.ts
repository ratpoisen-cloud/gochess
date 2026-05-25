import { create } from 'zustand'
import type { Color } from '@/types'

export type AddReactionResult = 'ok' | 'square_occupied' | 'limit_reached'

export interface Reaction {
  id: string
  square: string
  emojiUrl: string
  playerId: string
  createdAt: number
}

interface ReactionState {
  reactions: Reaction[]
  reactionsWhite: number
  reactionsBlack: number
  addReaction: (r: Reaction, color?: Color) => AddReactionResult
  removeReaction: (id: string) => void
  setReactions: (reactions: Reaction[]) => void
  resetMoveCounter: () => void
}

const REACTION_TTL = 5000
const MAX_REACTIONS_PER_MOVE = 5

export const useReactionStore = create<ReactionState>((set, get) => ({
  reactions: [],
  reactionsWhite: 0,
  reactionsBlack: 0,

  addReaction: (r, color) => {
    const { reactions, reactionsWhite, reactionsBlack } = get()

    const existingOnSquare = reactions.some(e => e.square === r.square)
    if (existingOnSquare) return 'square_occupied'

    if (color) {
      const playerCount = color === 'w' ? reactionsWhite : reactionsBlack
      if (playerCount >= MAX_REACTIONS_PER_MOVE) return 'limit_reached'
    }

    set((s) => ({
      reactions: [...s.reactions, r],
      reactionsWhite: color === 'w' ? s.reactionsWhite + 1 : s.reactionsWhite,
      reactionsBlack: color === 'b' ? s.reactionsBlack + 1 : s.reactionsBlack,
    }))

    setTimeout(() => {
      get().removeReaction(r.id)
    }, REACTION_TTL)

    return 'ok'
  },

  removeReaction: (id) => {
    set((s) => ({ reactions: s.reactions.filter((r) => r.id !== id) }))
  },

  setReactions: (reactions) => set({ reactions }),
  
  resetMoveCounter: () => set({ reactionsWhite: 0, reactionsBlack: 0 }),
}))
