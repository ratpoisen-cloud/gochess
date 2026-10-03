import type { GameData, GameMode } from '@/types'

export interface TimeControl {
  base: number      // seconds
  increment: number // seconds
}

export const RAPID_PRESETS: TimeControl[] = [
  { base: 600, increment: 0 },
  { base: 900, increment: 0 },
  { base: 1800, increment: 0 },
  { base: 600, increment: 5 },
  { base: 900, increment: 5 },
  { base: 1800, increment: 5 },
]

export function formatTimeControl(tc: TimeControl): string {
  return `${tc.base / 60}+${tc.increment}`
}

/**
 * Room code alphabet: 32 characters with no visually ambiguous glyphs
 * (no I/O/0/1), so codes survive being read aloud or retyped.
 */
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRoomCode(length = 6): string {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]
  }
  return code
}

export const ROOM_CODE_LENGTH = 6

/**
 * Clock fields for a new online game document.
 *
 * `time_control` is stored in seconds but the clock counters are milliseconds
 * (see ColorPickerModal), so the base must be scaled on write. The clock is
 * parked in 'paused' with a null timestamp so it starts on the first move and
 * a game created long after the invite is not charged for the wait.
 *
 * Any creator that omits these fields produces an untimed game: useGameTimer
 * returns immediately when `time_control` is null, so a game advertised as
 * "rapid" silently plays with no clock and no way to lose on time.
 */
export function buildTimerFields(
  mode: GameMode,
  preset: TimeControl = RAPID_PRESETS[0],
): Record<string, unknown> {
  if (mode !== 'rapid') {
    return {
      time_control: null,
      white_time_left: null,
      black_time_left: null,
      last_timer_update: null,
      timer_status: 'paused',
    }
  }
  return timerFieldsFromControl(preset)
}

/**
 * Clock fields for an exact time control that is being carried over from
 * another game. Classic carries a null control and therefore stays untimed.
 */
export function timerFieldsFromControl(
  control: TimeControl | null | undefined,
): Record<string, unknown> {
  if (!control) {
    return {
      time_control: null,
      white_time_left: null,
      black_time_left: null,
      last_timer_update: null,
      timer_status: null,
    }
  }
  const ms = control.base * 1000
  return {
    time_control: { base: control.base, increment: control.increment },
    white_time_left: ms,
    black_time_left: ms,
    // Parked, not running. A rapid clock must start on the first move; starting
    // it at creation burned the absent player's time with no way to flag it,
    // because flag detection needs a snapshot and nothing else writes.
    last_timer_update: null,
    timer_status: 'paused',
  }
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/**
 * Build the document for a rematch of a finished game.
 *
 * Contract, applied identically whether the rematch is started from the
 * in-game "Принять реванш" button or by accepting the mirrored challenge:
 *   - same mode as the finished game
 *   - same time control verbatim (classic stays untimed)
 *   - sides swapped: whoever was black becomes white
 *   - clock parked so it starts on the first move
 */
export function buildRematchGameData(
  original: Partial<GameData>,
  roomCode: string,
): Record<string, unknown> {
  const mode: GameMode = original.game_mode ?? 'classic'
  const control = mode === 'rapid' ? (original.time_control ?? null) : null

  return {
    room_code: roomCode,
    white_player_id: original.black_player_id ?? null,
    white_name: original.black_name || 'Игрок',
    black_player_id: original.white_player_id ?? null,
    black_name: original.white_name || 'Игрок',
    game_type: 'online',
    game_mode: mode,
    pgn: '',
    fen: START_FEN,
    game_state: 'active',
    winner: null,
    message: null,
    turn: 'w',
    ...timerFieldsFromControl(control),
    created_at: null,
    last_move_time: null,
    reactions: [],
    undo_request: null,
    draw_request: null,
    rematch_proposed_by: null,
    rematch_game_id: null,
  }
}