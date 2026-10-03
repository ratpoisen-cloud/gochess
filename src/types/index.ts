export type Color = 'w' | 'b'

export type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw'

export type BotLevel = 'very-easy' | 'easy' | 'medium' | 'hard'

export type GameMode = 'classic' | 'fog_of_war' | 'rapid' | 'spell_chess' | 'atomic_chess'

export interface User {
  uid: string
  displayName: string
  email: string
  photoURL: string | null
  customAvatarURL?: string | null
  lastSeen?: any
}

export interface GameData {
  id: string
  room_code: string | null
  white_player_id: string | null
  black_player_id: string | null
  white_name: string
  black_name: string
  pgn: string
  fen: string
  game_state: string
  game_type: string
  game_mode?: GameMode
  turn: Color
  winner: string | null
  message: string | null
  last_move_time: number | null
  created_at: any
  reactions: any[]
  undo_request: { from_id: string; created_at: number } | null
  draw_request: { from_id: string; created_at: number } | null
  /** uid of the player who offered a rematch; both are cleared by useRematch.resetRematch */
  rematch_proposed_by?: string | null
  /** id of the rematch game once it exists; the single source of truth for "already handled" */
  rematch_game_id?: string | null
  time_control?: { base: number; increment: number } | null
  white_time_left?: number | null
  black_time_left?: number | null
  last_timer_update?: number | null
  timer_status?: 'active' | 'paused' | null
  spell_state_json?: string | null
}

/**
 * A pending offer between two players.
 *
 * `kind: 'challenge'` is a fresh invitation from a lobby tile.
 * `kind: 'rematch'` is the mirror of a rematch offered from a finished game:
 * the same-mode, same-time-control, sides-swapped replay. The rematch also sets
 * `rematch_proposed_by` on the finished game document so the in-game "Принять
 * реванш" button stays instant; this document is what makes the offer visible
 * from the lobby, where a player who left the game page would otherwise never
 * see it. Both paths are idempotent through `rematch_game_id` on the source game.
 */
export type ChallengeKind = 'challenge' | 'rematch'

export interface Challenge {
  id: string
  kind?: ChallengeKind
  fromId: string
  fromName: string
  toId: string
  mode: GameMode
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  createdAt: any
  expiresAt: number
  gameId?: string
  /** rematch only: the finished game being replayed */
  sourceGameId?: string
  /** rematch only: the finished game's clock, copied verbatim into the rematch */
  timeControl?: { base: number; increment: number } | null
}
