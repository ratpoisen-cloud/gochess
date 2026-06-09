export type Color = 'w' | 'b'

export type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw'

export type BotLevel = 'very-easy' | 'easy' | 'medium' | 'hard'

export type GameMode = 'classic' | 'fog_of_war'

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
  rematch_request: { from_id: string; proposed_room_id: string; created_at: number } | null
}

export interface Challenge {
  id: string
  fromId: string
  fromName: string
  toId: string
  mode: GameMode
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  createdAt: any
  expiresAt: number
  gameId?: string
}
