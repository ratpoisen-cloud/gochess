import { PoisenChessEngine } from './PoisenChess'
import { SpellChessEngine } from '@/lib/spellChessEngine'
import { AtomicChessEngine } from './AtomicChessEngine'
import type { EngineAPI } from './types'

export function createEngine(mode?: 'standard' | 'spell' | 'atomic', fen?: string): EngineAPI {
  if (mode === 'spell') {
    const engine = new SpellChessEngine(fen)
    return engine as unknown as EngineAPI
  }
  if (mode === 'atomic') {
    return new AtomicChessEngine(fen) as unknown as EngineAPI
  }
  return new PoisenChessEngine(fen)
}
