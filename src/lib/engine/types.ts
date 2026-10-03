export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
export type Color = 'w' | 'b'

export interface Piece {
  type: PieceType
  color: Color
}

export interface Move {
  from: string
  to: string
  piece: PieceType
  captured?: PieceType
  promotion?: PieceType
  color: Color
  flags: string
  san: string
  lan: string
  before?: string
  after?: string
}

export interface EngineAPI {
  load(fen: string): void
  loadPgn(pgn: string): void
  fen(): string
  pgn(): string
  turn(): Color
  board(): (Piece | null)[][]
  get(square: string): Piece | null
  move(m: { from: string; to: string; promotion?: string }): Move | null
  undo(): Move | null

  moves(): string[]
  moves(options: { square?: string; verbose?: false }): string[]
  moves(options: { square?: string; verbose: true }): Move[]
  moves(options?: { square?: string; verbose?: boolean }): string[] | Move[]

  history(): string[]
  history(options: { verbose?: false }): string[]
  history(options: { verbose: true }): Move[]
  history(options?: { verbose?: boolean }): string[] | Move[]

  inCheck(color?: Color): boolean
  isCheckmate(): boolean
  isStalemate(): boolean
  isDraw(): boolean
  isInsufficientMaterial(): boolean
  isThreefoldRepetition(): boolean
  isGameOver(): boolean
  squareColor(sq: string): 'light' | 'dark'
  gameResult(): string
  reset(): void
}
