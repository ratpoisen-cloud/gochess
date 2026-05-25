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
  reactionsInCurrentMove: number
  addReaction: (r: Reaction) => boolean
  removeReaction: (id: string) => void
  setReactions: (reactions: Reaction[]) => void
  resetMoveCounter: () => void
}

const REACTION_TTL = 5000
const MAX_REACTIONS_PER_MOVE = 5

export const useReactionStore = create<ReactionState>((set, get) => ({
  reactions: [],
  reactionsInCurrentMove: 0,

  addReaction: (r) => {
    const { reactionsInCurrentMove, reactions } = get()
    
    // Rule: One emoji per square (replace if exists)
    const filtered = reactions.filter(existing => existing.square !== r.square)

    if (reactionsInCurrentMove >= MAX_REACTIONS_PER_MOVE) return false

    set((s) => ({ 
      reactions: [...filtered, r],
      reactionsInCurrentMove: s.reactionsInCurrentMove + 1
    }))

    setTimeout(() => {
      get().removeReaction(r.id)
    }, REACTION_TTL)

    return true
  },

  removeReaction: (id) => {
    set((s) => ({ reactions: s.reactions.filter((r) => r.id !== id) }))
  },

  setReactions: (reactions) => set({ reactions }),
  
  resetMoveCounter: () => set({ reactionsInCurrentMove: 0 }),
}))
