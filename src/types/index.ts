export type Color = 'w' | 'b'

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'

export type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw'

export type BotLevel = 'easy' | 'medium' | 'hard'

export interface User {
  uid: string
  displayName: string
  email: string
  photoURL: string | null
  customAvatarURL?: string | null
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
  turn: Color
  winner: string | null
  message: string | null
  last_move_time: number | null
  created_at: string
  reactions: any[]
  undo_request: { from_id: string; createdAt: number } | null
  draw_request: { from_id: string; createdAt: number } | null
  rematch_request: { from_id: string; proposed_room_id: string; createdAt: number } | null
}

export type GameType = 'bot' | 'local' | 'online'
