import { describe, it, expect, vi } from 'vitest'

// challenges.ts imports db from lib/firebase, which would try to initialise the
// SDK without credentials and print a warning. Only the pure helpers are under
// test here.
vi.mock('@/lib/firebase', () => ({ db: null }))

import {
  buildRematchGameData,
  timerFieldsFromControl,
  generateRoomCode,
  ROOM_CODE_LENGTH,
} from '../gameDoc'
import { isRematchChallenge } from '../challenges'
import type { GameData } from '@/types'

function finishedGame(overrides: Partial<GameData> = {}): Partial<GameData> {
  return {
    game_mode: 'classic',
    white_player_id: 'uid-white',
    white_name: 'Аня',
    black_player_id: 'uid-black',
    black_name: 'Борис',
    time_control: null,
    ...overrides,
  }
}

describe('buildRematchGameData — rematch contract', () => {
  it('swaps the sides: whoever was black becomes white', () => {
    const data = buildRematchGameData(finishedGame(), 'ABC123')

    expect(data.white_player_id).toBe('uid-black')
    expect(data.black_player_id).toBe('uid-white')
    expect(data.white_name).toBe('Борис')
    expect(data.black_name).toBe('Аня')
  })

  it('swaps the sides regardless of which player offered it', () => {
    // The offerer is not part of the payload: both players' seats are derived
    // from the finished game, so accepting from either client gives the same
    // result and the rematch cannot be mirrored by accident.
    const a = buildRematchGameData(finishedGame(), 'ABC123')
    const b = buildRematchGameData(finishedGame(), 'ZZZ999')
    expect(a.white_player_id).toBe(b.white_player_id)
    expect(a.black_player_id).toBe(b.black_player_id)
  })

  it('starts from the initial position with white to move', () => {
    const data = buildRematchGameData(finishedGame(), 'ABC123')
    expect(data.pgn).toBe('')
    expect(data.fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    expect(data.turn).toBe('w')
    expect(data.reactions).toEqual([])
  })

  it('carries classic over as untimed', () => {
    const data = buildRematchGameData(finishedGame({ game_mode: 'classic' }), 'ABC123')

    expect(data.game_mode).toBe('classic')
    expect(data.time_control).toBeNull()
    expect(data.white_time_left).toBeNull()
    expect(data.black_time_left).toBeNull()
    expect(data.last_timer_update).toBeNull()
  })

  it('copies the exact rapid time control verbatim', () => {
    const tc = { base: 900, increment: 5 }
    const data = buildRematchGameData(
      finishedGame({ game_mode: 'rapid', time_control: tc }),
      'ABC123',
    )

    expect(data.game_mode).toBe('rapid')
    expect(data.time_control).toEqual({ base: 900, increment: 5 })
    // seconds -> ms
    expect(data.white_time_left).toBe(900_000)
    expect(data.black_time_left).toBe(900_000)
  })

  it('parks the rapid clock so it starts on the first move', () => {
    const data = buildRematchGameData(
      finishedGame({ game_mode: 'rapid', time_control: { base: 600, increment: 0 } }),
      'ABC123',
    )

    // Starting the clock at creation burned the absent player's time with no
    // way to flag it, because flag detection needs a snapshot.
    expect(data.last_timer_update).toBeNull()
    expect(data.timer_status).toBe('paused')
  })

  it('never gives a rapid game an increment-less clock by accident', () => {
    // A rapid document with no time_control (e.g. created through the old
    // challenge path) must not silently become untimed.
    const data = buildRematchGameData(
      finishedGame({ game_mode: 'rapid', time_control: null }),
      'ABC123',
    )
    expect(data.time_control).toBeNull()
    expect(data.white_time_left).toBeNull()
  })

  it('keeps a non-null time control out of non-rapid modes', () => {
    const data = buildRematchGameData(
      finishedGame({ game_mode: 'fog_of_war', time_control: { base: 600, increment: 5 } }),
      'ABC123',
    )
    expect(data.game_mode).toBe('fog_of_war')
    expect(data.time_control).toBeNull()
  })

  it('defaults to classic when the finished game has no mode', () => {
    const data = buildRematchGameData(
      finishedGame({ game_mode: undefined }),
      'ABC123',
    )
    expect(data.game_mode).toBe('classic')
  })

  it('produces a valid room code', () => {
    const data = buildRematchGameData(finishedGame(), 'ABC123')
    expect(data.room_code).toBe('ABC123')
    expect(generateRoomCode(ROOM_CODE_LENGTH)).toHaveLength(ROOM_CODE_LENGTH)
  })

  it('clears per-game transient state', () => {
    const data = buildRematchGameData(finishedGame(), 'ABC123')
    expect(data.undo_request).toBeNull()
    expect(data.draw_request).toBeNull()
    expect(data.rematch_proposed_by).toBeNull()
    expect(data.rematch_game_id).toBeNull()
    expect(data.winner).toBeNull()
    expect(data.message).toBeNull()
  })
})

describe('timerFieldsFromControl', () => {
  it('treats a missing control as untimed', () => {
    const fields = timerFieldsFromControl(null)
    expect(fields.time_control).toBeNull()
    expect(fields.white_time_left).toBeNull()
    expect(fields.timer_status).toBeNull()
  })

  it('scales seconds to milliseconds', () => {
    const fields = timerFieldsFromControl({ base: 1800, increment: 5 })
    expect(fields.white_time_left).toBe(1_800_000)
    expect(fields.black_time_left).toBe(1_800_000)
    expect(fields.last_timer_update).toBeNull()
    expect(fields.timer_status).toBe('paused')
  })
})

describe('isRematchChallenge', () => {
  it('distinguishes the two kinds', () => {
    expect(isRematchChallenge({ kind: 'rematch' })).toBe(true)
    expect(isRematchChallenge({ kind: 'challenge' })).toBe(false)
    // Legacy documents written before `kind` existed
    expect(isRematchChallenge({})).toBe(false)
  })
})