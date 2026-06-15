import { create } from 'zustand'
import { SpellChessEngine, type SpellState, type PieceType } from '@/lib/spellChessEngine'
import type { Color } from '@/types'
import { soundManager } from '@/lib/soundManager'

interface SpellGameState {
  engine: SpellChessEngine
  fen: string
  turn: Color
  spellState: SpellState
  selectedSquare: string | null
  legalMoves: string[]
  isGameOver: boolean
  winner: Color | null
  activeSpell: 'freeze' | 'jump' | 'blast' | 'shield' | 'portal' | 'berserk' | null
  portalStart: string | null
  halfMoveCount: number
  lastMove: { from: string; to: string } | null
  hasCastSpellThisTurn: boolean
  berserkTarget: string | null

  makeMove: (from: string, to: string) => boolean
  selectSquare: (square: string) => void
  castSpell: (spell: 'freeze' | 'jump' | 'blast' | 'shield' | 'portal' | 'berserk', square?: string) => void
  confirmBerserk: (square: string, type: PieceType) => void
  resetGame: () => void
}

const defaultEngine = new SpellChessEngine()

export const useSpellGameStore = create<SpellGameState>((set, get) => ({
  engine: defaultEngine,
  fen: defaultEngine.fen(),
  turn: 'w',
  spellState: defaultEngine.spellState,
  selectedSquare: null,
  legalMoves: [],
  isGameOver: false,
  winner: null,
  activeSpell: null,
  portalStart: null,
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
        spellState: { ...engine.spellState, bombs: { ...engine.spellState.bombs }, frozenSquares: { ...engine.spellState.frozenSquares }, shieldedSquares: { ...engine.spellState.shieldedSquares }, berserkTransforms: { ...engine.spellState.berserkTransforms } },
        selectedSquare: null,
        legalMoves: [],
        isGameOver: !!gameOver,
        winner: gameOver === 'white' ? 'w' : gameOver === 'black' ? 'b' : null,
        lastMove: { from, to },
        activeSpell: null,
        portalStart: null,
        halfMoveCount: engine.halfMoveCount,
        hasCastSpellThisTurn: false
      })
    }
    return success
  },

  selectSquare: (square) => {
    const { engine, selectedSquare, makeMove, activeSpell, castSpell, portalStart } = get()
    
    if (activeSpell) {
      if (activeSpell === 'portal') {
        if (!portalStart) {
          set({ portalStart: square })
          return
        } else {
          castSpell('portal', square)
          return
        }
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
    const { engine, activeSpell, portalStart, hasCastSpellThisTurn } = get()
    
    if (!square) {
      set({ activeSpell: activeSpell === spell ? null : spell, portalStart: null })
      return
    }

    if (hasCastSpellThisTurn) return

    let success = false
    if (spell === 'freeze') success = engine.castFreeze(square)
    else if (spell === 'jump') success = engine.castJump(square)
    else if (spell === 'blast') success = engine.castBlast(square)
    else if (spell === 'shield') success = engine.castShield(square)
    else if (spell === 'portal' && portalStart) success = engine.castPortal(portalStart, square)

    if (success) {
      soundManager.play('move')
      set({
        spellState: { ...engine.spellState, bombs: { ...engine.spellState.bombs }, frozenSquares: { ...engine.spellState.frozenSquares }, shieldedSquares: { ...engine.spellState.shieldedSquares }, berserkTransforms: { ...engine.spellState.berserkTransforms } },
        activeSpell: null,
        portalStart: null,
        selectedSquare: null,
        legalMoves: [],
        halfMoveCount: engine.halfMoveCount,
        fen: engine.fen(),
        hasCastSpellThisTurn: true
      })
    } else {
      set({ activeSpell: null, portalStart: null })
    }
  },

  confirmBerserk: (square, type) => {
    const { engine } = get()
    const success = engine.castBerserk(square, type)
    if (success) {
      soundManager.play('move')
      set({
        spellState: { ...engine.spellState, bombs: { ...engine.spellState.bombs }, frozenSquares: { ...engine.spellState.frozenSquares }, shieldedSquares: { ...engine.spellState.shieldedSquares }, berserkTransforms: { ...engine.spellState.berserkTransforms } },
        berserkTarget: null,
        selectedSquare: null,
        legalMoves: [],
        halfMoveCount: engine.halfMoveCount,
        fen: engine.fen(),
        hasCastSpellThisTurn: true
      })
    }
  },

  resetGame: () => {
    const engine = new SpellChessEngine()
    set({
      engine,
      fen: engine.fen(),
      turn: 'w',
      spellState: engine.spellState,
      selectedSquare: null,
      legalMoves: [],
      isGameOver: false,
      winner: null,
      activeSpell: null,
      portalStart: null,
      halfMoveCount: 0,
      lastMove: null,
      hasCastSpellThisTurn: false,
      berserkTarget: null
    })
  }
}))
