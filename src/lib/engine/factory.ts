import { PoisenChessEngine } from './PoisenChess'
import type { EngineAPI } from './types'

export function createEngine(fen?: string): EngineAPI {
  return new PoisenChessEngine(fen)
}
