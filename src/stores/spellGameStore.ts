import { create } from 'zustand'
import { SpellChessEngine, type SpellState, type PieceType, type SpellName, FREE_ACTIONS } from '@/lib/spellChessEngine'
import type { Color } from '@/types'
import { soundManager } from '@/lib/soundManager'

function copySpellState(s: SpellState): SpellState {
  return {
    ...s,
    bombs: { ...s.bombs },
    frozenSquares: { ...s.frozenSquares },
    shieldedSquares: { ...s.shieldedSquares },
    berserkTransforms: { ...s.berserkTransforms },
    charges: { w: { ...s.charges.w }, b: { ...s.charges.b } },
    impassableSquares: { ...s.impassableSquares },
  }
}

interface SpellGameState {
  engine: SpellChessEngine
  fen: string
  turn: Color
  spellState: SpellState
  selectedSquare: string | null
  legalMoves: string[]
  isGameOver: boolean
  winner: Color | null
  activeSpell: SpellName | null
  portalStart: string | null
  mirageStart: string | null
  halfMoveCount: number
  lastMove: { from: string; to: string } | null
  hasCastSpellThisTurn: boolean
  berserkTarget: string | null

  makeMove: (from: string, to: string) => boolean
  selectSquare: (square: string) => void
  castSpell: (spell: SpellName, square?: string) => void
  confirmBerserk: (square: string, type: PieceType) => void
  resetGame: () => void
}

const defaultEngine = new SpellChessEngine()

export const useSpellGameStore = create<SpellGameState>((set, get) => ({
  engine: defaultEngine,
  fen: defaultEngine.fen(),
  turn: 'w',
  spellState: copySpellState(defaultEngine.spellState),
  selectedSquare: null,
  legalMoves: [],
  isGameOver: false,
  winner: null,
  activeSpell: null,
  portalStart: null,
  mirageStart: null,
  halfMoveCount: 0,
  lastMove: null,
  hasCastSpellThisTurn: false,
  berserkTarget: null,

  makeMove: (from, to) => {
    const { engine } = get()
    const success = engine.move(from, to)
    if (success) {
      soundManager.play('move')
      const gameOver = engine.isGameOver()
      set({
        fen: engine.fen(),
        turn: engine.turn,
        spellState: copySpellState(engine.spellState),
        selectedSquare: null,
        legalMoves: [],
        isGameOver: !!gameOver,
        winner: gameOver === 'white' ? 'w' : gameOver === 'black' ? 'b' : null,
        lastMove: { from, to },
        activeSpell: null,
        portalStart: null,
        mirageStart: null,
        halfMoveCount: engine.halfMoveCount,
        hasCastSpellThisTurn: false,
      })
    }
    return success
  },

  selectSquare: (square) => {
    const { engine, selectedSquare, makeMove, activeSpell, castSpell, portalStart, mirageStart } = get()

    if (activeSpell) {
      if (activeSpell === 'portal') {
        if (!portalStart) {
          set({ portalStart: square })
          return
        }
        castSpell('portal', square)
        return
      }
      if (activeSpell === 'mirage') {
        if (!mirageStart) {
          const piece = engine.getPiece(square)
          if (piece && piece.color === engine.turn && piece.type !== 'k') {
            set({ mirageStart: square })
          }
          return
        }
        castSpell('mirage', square)
        return
      }
      if (activeSpell === 'shadowGrave') {
        const piece = engine.getPiece(square)
        if (piece && piece.color === engine.turn && piece.type !== 'k') {
          castSpell('shadowGrave', square)
        }
        return
      }
      if (activeSpell === 'divineGrace') {
        castSpell('divineGrace', square)
        return
      }
      if (activeSpell === 'berserk') {
        const piece = engine.getPiece(square)
        if (piece && piece.color === engine.turn && piece.type !== 'k') {
          set({ berserkTarget: square, activeSpell: null, selectedSquare: null, legalMoves: [] })
        }
        return
      }
      castSpell(activeSpell, square)
      return
    }

    const piece = engine.getPiece(square)
    if (selectedSquare === square) {
      set({ selectedSquare: null, legalMoves: [] })
      return
    }

    if (selectedSquare) {
      const isLegalMove = get().legalMoves.includes(square)
      if (isLegalMove) {
        if (makeMove(selectedSquare, square)) return
      }
    }

    if (piece && piece.color === engine.turn) {
      set({
        selectedSquare: square,
        legalMoves: engine.getLegalMoves(square),
      })
    } else {
      set({ selectedSquare: null, legalMoves: [] })
    }
  },

  castSpell: (spell, square) => {
    const { engine, activeSpell, portalStart, mirageStart, hasCastSpellThisTurn } = get()

    if (!square) {
      set({ activeSpell: activeSpell === spell ? null : spell, portalStart: null, mirageStart: null })
      return
    }

    if (hasCastSpellThisTurn) return

    let success = false
    switch (spell) {
      case 'freeze': success = engine.castFreeze(square); break
      case 'jump': success = engine.castJump(square); break
      case 'blast': success = engine.castBlast(square); break
      case 'shield': success = engine.castShield(square); break
      case 'portal': if (portalStart) success = engine.castPortal(portalStart, square); break
      case 'divineGrace': success = engine.castDivineGrace(square); break
      case 'shadowGrave': success = engine.castShadowGrave(square); break
      case 'mirage': if (mirageStart) success = engine.castMirage(mirageStart, square); break
    }

    if (success) {
      soundManager.play('move')
      const gameOver = engine.isGameOver()
      // Free actions keep the turn; terminal actions call completeTurn which switches turn
      const isFree = FREE_ACTIONS.includes(spell)
      set({
        spellState: copySpellState(engine.spellState),
        activeSpell: null,
        portalStart: null,
        mirageStart: null,
        selectedSquare: null,
        legalMoves: [],
        halfMoveCount: engine.halfMoveCount,
        turn: engine.turn,
        fen: engine.fen(),
        hasCastSpellThisTurn: isFree,
        isGameOver: !!gameOver,
        winner: gameOver === 'white' ? 'w' : gameOver === 'black' ? 'b' : null,
      })
    } else {
      set({ activeSpell: null, portalStart: null, mirageStart: null })
    }
  },

  confirmBerserk: (square, type) => {
    const { engine } = get()
    const success = engine.castBerserk(square, type)
    if (success) {
      soundManager.play('move')
      const gameOver = engine.isGameOver()
      set({
        spellState: copySpellState(engine.spellState),
        berserkTarget: null,
        selectedSquare: null,
        legalMoves: [],
        halfMoveCount: engine.halfMoveCount,
        turn: engine.turn,
        fen: engine.fen(),
        hasCastSpellThisTurn: false,
        isGameOver: !!gameOver,
        winner: gameOver === 'white' ? 'w' : gameOver === 'black' ? 'b' : null,
      })
    }
  },

  resetGame: () => {
    const engine = new SpellChessEngine()
    set({
      engine,
      fen: engine.fen(),
      turn: 'w',
      spellState: copySpellState(engine.spellState),
      selectedSquare: null,
      legalMoves: [],
      isGameOver: false,
      winner: null,
      activeSpell: null,
      portalStart: null,
      mirageStart: null,
      halfMoveCount: 0,
      lastMove: null,
      hasCastSpellThisTurn: false,
      berserkTarget: null,
    })
  }
}))
