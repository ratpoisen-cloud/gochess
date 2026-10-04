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

  private genDepth = 0;

  move(moveData: { from: string; to: string; promotion?: string }): Move | null {
    const myColor = this.turn();
    const oppColor: Color = myColor === 'w' ? 'b' : 'w';

    const resultMove = super.move(moveData);
    if (!resultMove) return null;

    if (resultMove.captured !== undefined) {
      const epicenter = resultMove.to;
      const preBlastKey = this.positionKey();

      for (const sq of this.getAdjacentSquares(epicenter)) {
        const p = this.get(sq);
        if (p && p.type !== 'p') {
          this.removePiece(sq);
        }
      }
      this.removePiece(epicenter);

      if (!this.findKing(myColor)) {
        this.undo();
        this.removePosition(preBlastKey);
        return null;
      }

      this.removePosition(preBlastKey);
      this.storePosition();

      this.atomicState = {
        lastBlastSquare: epicenter,
        lastBlastTime: Date.now()
      };
    } else {
      this.atomicState = {
        lastBlastSquare: null,
        lastBlastTime: 0
      };
    }

    let suffix = '';
    if (this.findKing(oppColor)) {
      const givesCheck = this.inCheck();
      if (this.isCheckmate()) {
        this._gameResult = this.turn() === 'w' ? '0-1' : '1-0';
        suffix = '#';
      } else if (this.isDraw()) {
        this._gameResult = '1/2-1/2';
        suffix = givesCheck ? '+' : '';
      } else {
        this._gameResult = '*';
        suffix = givesCheck ? '+' : '';
      }
    } else {
      this._gameResult = myColor === 'w' ? '1-0' : '0-1';
    }

    resultMove.san = resultMove.san.replace(/[+#]+$/, '') + suffix;
    resultMove.after = this.fen();
    const lastEntry = this._history[this._history.length - 1];
    if (lastEntry) {
      lastEntry.move.san = resultMove.san;
      lastEntry.move.after = resultMove.after;
    }

    return resultMove;
  }

  undo(): Move | null {
    const undone = super.undo();
    if (undone) {
      this.atomicState = { lastBlastSquare: null, lastBlastTime: 0 };
    }
    return undone;
  }

  moves(): string[]
  moves(options: { square?: string; verbose?: false }): string[]
  moves(options: { square?: string; verbose: true }): Move[]
  moves(options?: { square?: string; verbose?: boolean }): string[] | Move[] {
    this.genDepth++;
    try {
      const raw = super.moves({ square: options?.square, verbose: true });
      const filtered = raw.filter((m) => !m.captured || this.survivesExplosion(m));
      if (options?.verbose === true) return filtered;
      return filtered.map((m) => m.san);
    } finally {
      this.genDepth--;
    }
  }

  isCheckmate(): boolean {
    if (this.genDepth > 0) return false;
    if (!this.inCheck()) return false;
    return this.moves().length === 0;
  }

  isStalemate(): boolean {
    if (this.genDepth > 0) return false;
    if (!this.findKing('w') || !this.findKing('b')) return false;
    if (this.inCheck()) return false;
    return this.moves().length === 0;
  }

  private survivesExplosion(m: Move): boolean {
    if (m.piece === 'k') return false;
    const kingSq = this.findKing(m.color);
    if (!kingSq) return false;
    const dx = Math.abs(kingSq.charCodeAt(0) - m.to.charCodeAt(0));
    const dy = Math.abs(parseInt(kingSq[1], 10) - parseInt(m.to[1], 10));
    return dx > 1 || dy > 1;
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

  private removePiece(sq: string) {
    const c = sq.charCodeAt(0) - 97;
    const r = 8 - parseInt(sq[1]);
    this._board[r][c] = null;
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
