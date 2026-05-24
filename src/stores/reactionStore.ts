import { create } from 'zustand'

export interface Reaction {
  id: string
  square: string
  emojiUrl: string
  playerId: string
  createdAt: number
}

interface ReactionState {
  reactions: Reaction[]
  addReaction: (r: Reaction) => void
  removeReaction: (id: string) => void
  setReactions: (reactions: Reaction[]) => void
}

const REACTION_TTL = 5000

export const useReactionStore = create<ReactionState>((set, get) => ({
  reactions: [],

  addReaction: (r) => {
    set((s) => ({ reactions: [...s.reactions, r] }))
    setTimeout(() => {
      get().removeReaction(r.id)
    }, REACTION_TTL)
  },

  removeReaction: (id) => {
    set((s) => ({ reactions: s.reactions.filter((r) => r.id !== id) }))
  },

  setReactions: (reactions) => set({ reactions }),
}))
