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
  room_id: string
  players: {
    white: string
    whiteName: string
    black: string
    blackName: string
    whitePhotoURL: string
    blackPhotoURL: string
  }
  pgn: string
  fen: string
  game_state: 'active' | 'game_over'
  message: string | null
  turn: Color
  resign: Color | null
  last_move_time: number
  created_at: number
}
