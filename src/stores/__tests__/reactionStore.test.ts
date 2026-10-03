import { describe, it, expect, beforeEach } from 'vitest'
import { useReactionStore } from '../reactionStore'
import type { Reaction } from '../reactionStore'

const reaction = (id: string, square: string): Reaction => ({
  id,
  square,
  emojiUrl: 'x.png',
  playerId: 'u1',
  createdAt: Date.now(),
})

describe('reactionStore', () => {
  beforeEach(() => {
    useReactionStore.setState({ reactions: [], reactionsWhite: 0, reactionsBlack: 0 })
  })

  it('canAddReaction validates without mutating state', () => {
    const r = reaction('a', 'e4')
    expect(useReactionStore.getState().canAddReaction(r, 'w')).toBe('ok')
    expect(useReactionStore.getState().reactions).toEqual([])
    expect(useReactionStore.getState().reactionsWhite).toBe(0)
  })

  it('rejects a second reaction on the same square', () => {
    const store = useReactionStore.getState()
    expect(store.addReaction(reaction('a', 'e4'), 'w')).toBe('ok')
    expect(useReactionStore.getState().addReaction(reaction('b', 'e4'), 'b')).toBe('square_occupied')
  })

  it('enforces the per-move limit per color', () => {
    const store = useReactionStore.getState()
    const squares = ['a1', 'a2', 'a3', 'a4', 'a5']
    for (const [i, sq] of squares.entries()) {
      expect(store.addReaction(reaction(`w${i}`, sq), 'w')).toBe('ok')
    }
    expect(useReactionStore.getState().addReaction(reaction('w6', 'a6'), 'w')).toBe('limit_reached')
    // the other color is unaffected
    expect(useReactionStore.getState().addReaction(reaction('b1', 'b1'), 'b')).toBe('ok')
    // a validation failure must not have committed anything
    expect(useReactionStore.getState().reactions).toHaveLength(6)
  })

  it('resetMoveCounter clears both counters', () => {
    useReactionStore.getState().addReaction(reaction('a', 'a1'), 'w')
    useReactionStore.getState().addReaction(reaction('b', 'a2'), 'b')
    useReactionStore.getState().resetMoveCounter()
    expect(useReactionStore.getState().reactionsWhite).toBe(0)
    expect(useReactionStore.getState().reactionsBlack).toBe(0)
  })
})
