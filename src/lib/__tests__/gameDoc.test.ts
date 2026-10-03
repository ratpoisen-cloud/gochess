import { describe, it, expect } from 'vitest'
import {
  generateRoomCode,
  ROOM_CODE_LENGTH,
  buildTimerFields,
  type TimeControl,
} from '../gameDoc'

describe('generateRoomCode', () => {
  it('produces codes of the requested length from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode(ROOM_CODE_LENGTH)
      expect(code).toHaveLength(ROOM_CODE_LENGTH)
      // No I/O/0/1 — these get read aloud and retyped
      expect(code).not.toMatch(/[IO01]/)
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/)
    }
  })

  it('uses one alphabet everywhere, so a code means the same thing room to room', () => {
    // useRematch used to build codes from Math.random().toString(36), which
    // yields 0-9A-Z and therefore contains 0, 1, O and I — while rooms created
    // through ColorPickerModal used a 32-char alphabet without them. The same
    // six characters could mean two different things depending on origin.
    const alphabet = new Set(generateRoomCode(2000))
    expect(alphabet.has('0')).toBe(false)
    expect(alphabet.has('1')).toBe(false)
    expect(alphabet.has('O')).toBe(false)
    expect(alphabet.has('I')).toBe(false)
  })
})

describe('buildTimerFields', () => {
  it('leaves untimed modes without any clock', () => {
    for (const mode of ['classic', 'fog_of_war', 'spell_chess', 'atomic_chess'] as const) {
      const fields = buildTimerFields(mode)
      expect(fields.time_control).toBeNull()
      expect(fields.white_time_left).toBeNull()
      expect(fields.black_time_left).toBeNull()
      expect(fields.last_timer_update).toBeNull()
    }
  })

  it('gives rapid a clock in milliseconds, stored in seconds', () => {
    const preset: TimeControl = { base: 300, increment: 5 }
    const fields = buildTimerFields('rapid', preset)

    expect(fields.time_control).toEqual({ base: 300, increment: 5 })
    // seconds -> ms on the counters
    expect(fields.white_time_left).toBe(300_000)
    expect(fields.black_time_left).toBe(300_000)
    // parked so the clock starts on the first move
    expect(fields.last_timer_update).toBeNull()
    expect(fields.timer_status).toBe('paused')
  })
})