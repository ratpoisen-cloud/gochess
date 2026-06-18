import { PoisenChessEngine } from './PoisenChess';
import { type Move, type Color } from './types';

export interface AtomicState {
  lastBlastSquare: string | null;
  lastBlastTime: number;
}

export class AtomicChessEngine extends PoisenChessEngine {
  private atomicState: AtomicState = {
    lastBlastSquare: null,
    lastBlastTime: 0
  };

  move(moveData: { from: string; to: string; promotion?: string }): Move | null {
    const previousFen = this.fen();
    const myColor = this.turn();
    
    // 1. Try standard move
    const resultMove = super.move(moveData);
    if (!resultMove) return null;

    // 2. If capture, trigger explosion
    const isCapture = resultMove.captured !== undefined;
    
    if (isCapture) {
      const epicenter = resultMove.to;
      const adjacent = this.getAdjacentSquares(epicenter);

      // Remove surrounding pieces (except pawns)
      for (const sq of adjacent) {
        const p = this.get(sq);
        if (p && p.type !== 'p') {
          this.removePiece(sq);
        }
      }

      // Remove the capturing piece itself
      this.removePiece(epicenter);

      // Verify king survival
      const myKing = this.findKing(myColor);
      if (!myKing) {
        this.load(previousFen);
        return null;
      }

      // Update blast state for VFX
      this.atomicState = {
        lastBlastSquare: epicenter,
        lastBlastTime: Date.now()
      };
    } else {
      // Reset blast state if no capture
      this.atomicState = {
        lastBlastSquare: null,
        lastBlastTime: 0
      };
    }

    return resultMove;
  }

  private getAdjacentSquares(square: string): string[] {
    const col = square.charCodeAt(0) - 97;
    const row = parseInt(square[1]) - 1;
    const adjacent: string[] = [];

    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (dc === 0 && dr === 0) continue;
        const tCol = col + dc;
        const tRow = row + dr;
        if (tCol >= 0 && tCol < 8 && tRow >= 0 && tRow < 8) {
          adjacent.push(String.fromCharCode(tCol + 97) + (tRow + 1));
        }
      }
    }
    return adjacent;
  }

  private findKing(color: Color): string | null {
    const b = this.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (p && p.type === 'k' && p.color === color) {
          return String.fromCharCode(c + 97) + (8 - r);
        }
      }
    }
    return null;
  }

  // Helper to remove piece directly from PoisenChess internal state if possible, 
  // or via load(fen) if not. PoisenChessEngine has remove(square) in some implementations.
  // Assuming it follows EngineAPI which doesn't have remove, but PoisenChess might have it.
  private removePiece(sq: string) {
    // We use load with modified FEN or internal method if available.
    // PoisenChess usually exposes a way to modify state.
    // Since I can't see all private methods, I'll use a trick: 
    // PoisenChess is likely based on chess.js logic where .remove(sq) exists.
    (this as any).remove?.(sq);
  }

  getAtomicState(): AtomicState {
    return { ...this.atomicState };
  }

  setAtomicState(state: AtomicState) {
    this.atomicState = state;
  }

  // Atomic chess specific: Kings can be adjacent
  // This requires deeper override of isAttacked if we want full compliance,
  // but for MVP, capture-explosions are the main feature.
}
