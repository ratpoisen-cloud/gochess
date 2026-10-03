import { describe, it, expect } from 'vitest'
import { gameRoute } from '../gameRoutes'

describe('gameRoute', () => {
  it('sends online games to their room', () => {
    expect(gameRoute({ id: 'abc', game_type: 'online' })).toBe('/game/abc')
  })

  it('sends bot games to the bot page loader', () => {
    expect(gameRoute({ id: 'abc', game_type: 'bot' })).toBe('/bot?game=abc')
  })

  it('has no route for local games (board lives in the store)', () => {
    expect(gameRoute({ id: 'abc', game_type: 'local' })).toBeNull()
  })

  it('is null when the id is missing', () => {
    expect(gameRoute({ game_type: 'online' })).toBeNull()
  })
})
