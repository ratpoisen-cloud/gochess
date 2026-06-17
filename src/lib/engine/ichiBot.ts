import { PoisenChessEngine, type PieceType, type Color, type Move } from './PoisenChess'

const PIECE_VALUES: Record<PieceType, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
}

const PST_PAWN = [
   0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
]

const PST_KNIGHT = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
]

const PST_BISHOP = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
]

const PST_ROOK = [
   0,  0,  0,  0,  0,  0,  0,  0,
   5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
   0,  0,  0,  5,  5,  0,  0,  0,
]

const PST_QUEEN = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
   -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20,
]

const PST_KING = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20,
]

const PST: Record<PieceType, number[]> = {
  p: PST_PAWN, n: PST_KNIGHT, b: PST_BISHOP,
  r: PST_ROOK, q: PST_QUEEN, k: PST_KING,
}

function pst(type: PieceType, row: number, col: number, color: Color): number {
  const idx = color === 'w' ? row * 8 + col : (7 - row) * 8 + col
  return PST[type][idx]
}

function evaluate(engine: PoisenChessEngine): number {
  const board = engine.board()
  let score = 0

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (!p) continue
      const val = PIECE_VALUES[p.type] + pst(p.type, r, c, p.color)
      score += p.color === 'w' ? val : -val
    }
  }

  return score
}

function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => {
    const aVal = a.captured ? PIECE_VALUES[a.captured] * 100 - PIECE_VALUES[a.piece] : -999999
    const bVal = b.captured ? PIECE_VALUES[b.captured] * 100 - PIECE_VALUES[b.piece] : -999999
    if (aVal !== bVal) return bVal - aVal
    if (a.promotion && !b.promotion) return -1
    if (!a.promotion && b.promotion) return 1
    return 0
  })
}

function minimax(engine: PoisenChessEngine, depth: number, alpha: number, beta: number, isMaximizing: boolean): number {
  if (depth === 0) return evaluate(engine)

  const moves = orderMoves(engine.moves({ verbose: true }) as Move[])
  if (moves.length === 0) {
    if (engine.isCheckmate()) return isMaximizing ? -99999 : 99999
    return 0
  }

  if (isMaximizing) {
    for (const m of moves) {
      engine.move({ from: m.from, to: m.to, promotion: m.promotion })
      const score = minimax(engine, depth - 1, alpha, beta, false)
      engine.undo()
      if (score > alpha) alpha = score
      if (beta <= alpha) break
    }
    return alpha
  } else {
    for (const m of moves) {
      engine.move({ from: m.from, to: m.to, promotion: m.promotion })
      const score = minimax(engine, depth - 1, alpha, beta, true)
      engine.undo()
      if (score < beta) beta = score
      if (beta <= alpha) break
    }
    return beta
  }
}

export interface IchiConfig {
  depth: number
  randomness?: number
}

export function getIchiMove(fen: string, config: IchiConfig): { from: string; to: string; promotion?: string } | null {
  const engine = new PoisenChessEngine(fen)
  const moves = engine.moves({ verbose: true }) as Move[]
  if (moves.length === 0) return null
  if (moves.length === 1) {
    const m = moves[0]
    return { from: m.from, to: m.to, promotion: m.promotion }
  }

  if (config.randomness && Math.random() < config.randomness) {
    const m = moves[Math.floor(Math.random() * moves.length)]
    return { from: m.from, to: m.to, promotion: m.promotion }
  }

  const isMaximizing = engine.turn() === 'w'
  let bestScore = isMaximizing ? -Infinity : Infinity
  let bestMove: Move = moves[0]

  const orderedMoves = orderMoves(moves)

  for (const m of orderedMoves) {
    const result = engine.move({ from: m.from, to: m.to, promotion: m.promotion })
    if (!result) continue

    const score = minimax(engine, config.depth - 1, -Infinity, Infinity, !isMaximizing)
    engine.undo()

    if (isMaximizing ? score > bestScore : score < bestScore) {
      bestScore = score
      bestMove = m
    }
  }

  return { from: bestMove.from, to: bestMove.to, promotion: bestMove.promotion }
}
