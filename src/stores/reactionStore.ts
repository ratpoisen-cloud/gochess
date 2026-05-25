import { create } from 'zustand'
import type { Color } from '@/types'

export interface Reaction {
  id: string
  square: string
  emojiUrl: string
  playerId: string
  createdAt: number
}

export type AddReactionResult = 'ok' | 'square_occupied' | 'limit_reached'

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

    const existingOnSquare = reactions.find(
      (existing) => existing.square === r.square && existing.playerId === r.playerId
    )
    if (existingOnSquare) {
      return 'square_occupied'
    }

    if (color) {
      const count = color === 'w' ? reactionsWhite : reactionsBlack
      if (count >= MAX_REACTIONS_PER_MOVE) {
        return 'limit_reached'
      }
    }

    set((s) => ({
      reactions: [...s.reactions, r],
      reactionsWhite: s.reactionsWhite + (color === 'w' ? 1 : 0),
      reactionsBlack: s.reactionsBlack + (color === 'b' ? 1 : 0),
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
