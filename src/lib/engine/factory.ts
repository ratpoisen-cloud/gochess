import { PoisenChessEngine } from './PoisenChess'
import { SpellChessEngine } from '@/lib/spellChessEngine'
import type { EngineAPI } from './types'

export function createEngine(mode?: 'standard' | 'spell', fen?: string): EngineAPI {
  if (mode === 'spell') {
    const engine = new SpellChessEngine(fen)
    return engine as unknown as EngineAPI
  }
  return new PoisenChessEngine(fen)
}
