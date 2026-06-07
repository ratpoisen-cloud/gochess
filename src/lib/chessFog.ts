import { Chess } from 'chess.js'

/**
 * Calculates which squares are visible to a player.
 * Visible squares are:
 * 1. Squares occupied by player's own pieces.
 * 2. Squares where player's pieces can legally move (attacks).
 * 3. For pawns, also the squares they attack (even if empty).
 */
export function getVisibleSquares(game: Chess, playerColor: 'w' | 'b'): string[] {
  const visible = new Set<string>()
  const board = game.board()

  // 1. Squares with own pieces
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c]
      if (piece && piece.color === playerColor) {
        const sq = `${'abcdefgh'[c]}${8 - r}`
        visible.add(sq)
      }
    }
  }

  // 2. Legal moves and attacks
  // Note: we need all moves, including those that are "illegal" because of a king in check
  // But in Fog of War, "check" is often ignored until the king is taken.
  // For now, we'll use game.moves for simplicity, but a more robust way is piece-by-piece.
  
  const moves = game.moves({ verbose: true })
  moves.forEach(m => {
    if (m.color === playerColor) {
      visible.add(m.to)
    }
  })

  // 3. Special case: Pawn attacks (pawn can't move forward to capture, but attacks diagonally)
  // game.moves already includes diagonal captures if piece is there.
  // Traditional Fog of War chess (like on Chess.com) usually shows diagonal squares for pawns anyway.
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c]
      if (piece && piece.color === playerColor && piece.type === 'p') {
        const row = 8 - r
        const files = 'abcdefgh'
        const targetRow = playerColor === 'w' ? row + 1 : row - 1
        
        if (targetRow >= 1 && targetRow <= 8) {
          [c - 1, c + 1].forEach(colIdx => {
            if (colIdx >= 0 && colIdx <= 7) {
              visible.add(`${files[colIdx]}${targetRow}`)
            }
          })
        }
      }
    }
  }

  return Array.from(visible)
}
