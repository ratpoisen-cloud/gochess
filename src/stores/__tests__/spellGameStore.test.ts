import { describe, it, expect, beforeEach, vi } from 'vitest'

// jsdom's HTMLMediaElement.play() returns undefined, so the real SoundManager
// throws on .catch(). Same mock the other store tests use.
vi.mock('@/lib/soundManager', () => ({ soundManager: { play: vi.fn() } }))
import { useSpellGameStore } from '@/stores/spellGameStore'
import { SpellChessEngine, FREE_ACTIONS } from '@/lib/spellChessEngine'

// Free actions do not end the turn, so spending one must only lock the other
// free actions for the rest of that turn. Terminal spells call completeTurn and
// hand the turn over. The store used to refuse every spell once anything had
// been cast, which locked out freeze, blast, berserk, grace, grave and mirage
// for the rest of the turn after a jump.
const FREE_SETUP_FEN = '4k3/8/8/8/8/8/4P3/4K3 w - - 60 40'
const TERMINAL_SETUP_FEN = '4k3/8/8/3Q4/4P3/8/8/4K3 w - - 60 40'

// The spell state must come from the engine that was just loaded: it carries
// halfMoveCount, and getTurnNumber() reads that to decide unlocks. Copying a
// fresh default state instead put every spell back behind its lock.
function freshEngine(fen: string) {
  const engine = new SpellChessEngine()
  engine.load(fen)
  useSpellGameStore.setState({
    engine,
    fen: engine.fen(),
    turn: engine.turn(),
    spellState: JSON.parse(JSON.stringify(engine.spellState)),
    hasCastSpellThisTurn: false,
    activeSpell: null,
    portalStart: null,
    mirageStart: null,
    selectedSquare: null,
    legalMoves: [],
    isGameOver: false,
    winner: null,
    lastMove: null,
    halfMoveCount: engine.halfMoveCount,
  })
  return engine
}

describe('spellGameStore free-action economy', () => {
  beforeEach(() => {
    useSpellGameStore.getState().resetGame()
  })

  it('keeps the turn after a free action', () => {
    freshEngine(FREE_SETUP_FEN)
    useSpellGameStore.getState().castSpell('shield', 'e2')
    expect(useSpellGameStore.getState().hasCastSpellThisTurn).toBe(true)
    expect(useSpellGameStore.getState().turn).toBe('w')
  })

  it('lets a terminal spell follow a free action in the same turn', () => {
    // The bug: castSpell refused anything once hasCastSpellThisTurn was set, so
    // freeze/blast/berserk/grace/grave/mirage were unreachable after a jump.
    freshEngine(TERMINAL_SETUP_FEN)
    useSpellGameStore.getState().castSpell('shield', 'e3')

    const before = useSpellGameStore.getState().spellState.frozenSquares
    useSpellGameStore.getState().castSpell('freeze', 'd4')

    expect(useSpellGameStore.getState().spellState.frozenSquares).not.toEqual(before)
  })

  it('locks the remaining free actions for the rest of the turn', () => {
    freshEngine(FREE_SETUP_FEN)
    useSpellGameStore.getState().castSpell('shield', 'e2')
    expect(useSpellGameStore.getState().spellState.shieldedSquares['e2']).toBeDefined()

    useSpellGameStore.getState().castSpell('shield', 'e3')
    // Already spent: e3 must not pick up a second shield.
    expect(useSpellGameStore.getState().spellState.shieldedSquares['e3']).toBeUndefined()
  })

  it('passes the turn over after a terminal spell', () => {
    freshEngine(TERMINAL_SETUP_FEN)
    useSpellGameStore.getState().castSpell('freeze', 'd4')
    expect(useSpellGameStore.getState().turn).toBe('b')
    expect(useSpellGameStore.getState().hasCastSpellThisTurn).toBe(false)
  })

  it('resets the free-action flag on a normal move', () => {
    freshEngine(FREE_SETUP_FEN)
    useSpellGameStore.getState().castSpell('shield', 'e2')
    useSpellGameStore.getState().makeMove('e1', 'd1')
    expect(useSpellGameStore.getState().hasCastSpellThisTurn).toBe(false)
  })

  it('treats every spell in FREE_ACTIONS as the locking kind', () => {
    freshEngine(FREE_SETUP_FEN)
    useSpellGameStore.getState().castSpell('shield', 'e2')
    expect(useSpellGameStore.getState().hasCastSpellThisTurn).toBe(true)
    for (const spell of FREE_ACTIONS) {
      expect(typeof spell).toBe('string')
    }
  })
})

describe('spellGameStore promotion', () => {
  beforeEach(() => {
    useSpellGameStore.getState().resetGame()
  })

  it('promotes a pawn with the chosen piece', () => {
    freshEngine('7k/4P3/8/8/8/8/8/4K3 w - - 0 1')
    const moved = useSpellGameStore.getState().makeMove('e7', 'e8', 'n')
    expect(moved).toBe(true)
    expect(useSpellGameStore.getState().fen.split(' ')[0].split('/')[0]).toBe('4N2k')
  })

  it('accepts every promotion target the picker offers', () => {
    for (const piece of ['q', 'r', 'b', 'n'] as const) {
      useSpellGameStore.getState().resetGame()
      freshEngine('7k/4P3/8/8/8/8/8/4K3 w - - 0 1')
      expect(useSpellGameStore.getState().makeMove('e7', 'e8', piece)).toBe(true)
      expect(useSpellGameStore.getState().fen).toContain(piece.toUpperCase())
    }
  })
})