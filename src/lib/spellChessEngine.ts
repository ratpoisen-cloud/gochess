export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type Color = 'w' | 'b';

export interface Piece {
  type: PieceType;
  color: Color;
}

export interface SpellState {
  frozenSquares: Record<string, number>;
  jumpSquare: string | null;
  shieldedSquares: Record<string, number>;
  portals: { from: string; to: string } | null;
  whiteSpells: Record<string, { charges: number; cooldown: number }>;
  blackSpells: Record<string, { charges: number; cooldown: number }>;
}

export class SpellChessEngine {
  board: (Piece | null)[][];
  turn: Color;
  halfMoveCount: number;
  spellState: SpellState;

  constructor(fen?: string) {
    this.board = Array(8).fill(null).map(() => Array(8).fill(null));
    this.turn = 'w';
    this.halfMoveCount = 0;
    this.spellState = {
      frozenSquares: {},
      jumpSquare: null,
      shieldedSquares: {},
      portals: null,
      whiteSpells: { freeze: { charges: 5, cooldown: 0 }, jump: { charges: 2, cooldown: 0 }, blast: { charges: 1, cooldown: 0 }, shield: { charges: 2, cooldown: 0 }, portal: { charges: 1, cooldown: 0 } },
      blackSpells: { freeze: { charges: 5, cooldown: 0 }, jump: { charges: 2, cooldown: 0 }, blast: { charges: 1, cooldown: 0 }, shield: { charges: 2, cooldown: 0 }, portal: { charges: 1, cooldown: 0 } }
    };

    if (fen) {
      this.load(fen);
    } else {
      this.reset();
    }
  }

  reset() {
    this.load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    this.halfMoveCount = 0;
    this.spellState.frozenSquares = {};
    this.spellState.shieldedSquares = {};
    this.spellState.jumpSquare = null;
    this.spellState.portals = null;
    const defaultSpells = () => ({
      freeze: { charges: 5, cooldown: 0 },
      jump: { charges: 2, cooldown: 0 },
      blast: { charges: 1, cooldown: 0 },
      shield: { charges: 2, cooldown: 0 },
      portal: { charges: 1, cooldown: 0 }
    });
    this.spellState.whiteSpells = defaultSpells();
    this.spellState.blackSpells = defaultSpells();
  }

  load(fen: string) {
    const [position, turn] = fen.split(' ');
    this.turn = turn as Color;
    
    const rows = position.split('/');
    for (let r = 0; r < 8; r++) {
      let c = 0;
      if (!rows[r]) continue;
      for (const char of rows[r]) {
        if (isNaN(parseInt(char))) {
          const type = char.toLowerCase() as PieceType;
          const color = char === char.toUpperCase() ? 'w' : 'b';
          this.board[r][c] = { type, color };
          c++;
        } else {
          c += parseInt(char);
        }
      }
    }
  }

  getPiece(square: string): Piece | null {
    const { r, c } = this.sqToIdx(square);
    return this.board[r][c];
  }

  sqToIdx(square: string) {
    const c = square.charCodeAt(0) - 97;
    const r = 8 - parseInt(square[1]);
    return { r, c };
  }

  idxToSq(r: number, c: number) {
    return String.fromCharCode(97 + c) + (8 - r);
  }

  isFrozen(square: string): boolean {
    const expiry = this.spellState.frozenSquares[square];
    return expiry !== undefined && expiry > this.halfMoveCount;
  }

  getKingSquare(color: Color): string | null {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p?.type === 'k' && p.color === color) {
          return this.idxToSq(r, c);
        }
      }
    }
    return null;
  }

  isSquareAttacked(square: string, attackerColor: Color): boolean {
    const { r: tr, c: tc } = this.sqToIdx(square);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p || p.color !== attackerColor) continue;

        const dr = tr - r;
        const dc = tc - c;
        const adr = Math.abs(dr);
        const adc = Math.abs(dc);

        switch (p.type) {
          case 'p': {
            const dir = attackerColor === 'w' ? -1 : 1;
            if (dr === dir && adc === 1) return true;
            break;
          }
          case 'n': {
            if ((adr === 2 && adc === 1) || (adr === 1 && adc === 2)) return true;
            break;
          }
          case 'b': {
            if (adr === adc && adr > 0 && this.isClearDiagonal(r, c, tr, tc)) return true;
            break;
          }
          case 'r': {
            if ((dr === 0 || dc === 0) && (dr !== 0 || dc !== 0) && this.isClearStraight(r, c, tr, tc)) return true;
            break;
          }
          case 'q': {
            if (adr === adc && adr > 0 && this.isClearDiagonal(r, c, tr, tc)) return true;
            if ((dr === 0 || dc === 0) && (dr !== 0 || dc !== 0) && this.isClearStraight(r, c, tr, tc)) return true;
            break;
          }
          case 'k': {
            if (adr <= 1 && adc <= 1 && (dr !== 0 || dc !== 0)) return true;
            break;
          }
        }
      }
    }
    return false;
  }

  getLegalMoves(square: string): string[] {
    const piece = this.getPiece(square);
    if (!piece || piece.color !== this.turn || this.isFrozen(square)) return [];

    const moves: string[] = [];
    const { r, c } = this.sqToIdx(square);

    const addMove = (tr: number, tc: number) => {
      if (tr < 0 || tr >= 8 || tc < 0 || tc >= 8) return false;
      const target = this.board[tr][tc];
      if (!target) {
        moves.push(this.idxToSq(tr, tc));
        return true;
      } else if (target.color !== piece.color) {
        // Shield Check: Cannot move to capture a shielded piece
        const targetSq = this.idxToSq(tr, tc);
        if (this.spellState.shieldedSquares[targetSq] > this.halfMoveCount) {
          return false;
        }
        moves.push(targetSq);
        return false;
      }
      return false;
    };

    switch (piece.type) {
      case 'p': {
        const dir = piece.color === 'w' ? -1 : 1;
        const startRank = piece.color === 'w' ? 6 : 1;
        if (r + dir >= 0 && r + dir < 8 && !this.board[r + dir][c]) {
          moves.push(this.idxToSq(r + dir, c));
          if (r === startRank && !this.board[r + 2 * dir][c]) {
            moves.push(this.idxToSq(r + 2 * dir, c));
          }
        }
        for (const dc of [-1, 1]) {
          const tr = r + dir, tc = c + dc;
          if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
            const target = this.board[tr][tc];
            if (target && target.color !== piece.color) {
              const targetSq = this.idxToSq(tr, tc);
              if (!(this.spellState.shieldedSquares[targetSq] > this.halfMoveCount)) {
                moves.push(targetSq);
              }
            }
          }
        }
        break;
      }
      case 'n': {
        const offsets = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
        offsets.forEach(([dr, dc]) => addMove(r + dr, c + dc));
        break;
      }
      case 'b': this.addSlidingMoves(r, c, [[-1, -1], [-1, 1], [1, -1], [1, 1]], moves, piece.color); break;
      case 'r': this.addSlidingMoves(r, c, [[-1, 0], [1, 0], [0, -1], [0, 1]], moves, piece.color); break;
      case 'q': this.addSlidingMoves(r, c, [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]], moves, piece.color); break;
      case 'k':
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            addMove(r + dr, c + dc);
          }
        }
        break;
    }

    if (this.spellState.jumpSquare === square) {
      const jumpMoves = this.getJumpMoves(square, piece);
      jumpMoves.forEach(m => { if (!moves.includes(m)) moves.push(m); });
    }
    return moves;
  }

  private addSlidingMoves(r: number, c: number, dirs: number[][], moves: string[], color: Color) {
    dirs.forEach(([dr, dc]) => {
      let tr = r + dr, tc = c + dc;
      while (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
        const target = this.board[tr][tc];
        if (!target) {
          moves.push(this.idxToSq(tr, tc));
        } else {
          if (target.color !== color) {
            const targetSq = this.idxToSq(tr, tc);
            if (!(this.spellState.shieldedSquares[targetSq] > this.halfMoveCount)) {
              moves.push(targetSq);
            }
          }
          break;
        }
        tr += dr; tc += dc;
      }
    });
  }

  private getJumpMoves(square: string, piece: Piece): string[] {
    if (piece.type === 'n' || piece.type === 'k') return [];
    const { r, c } = this.sqToIdx(square);
    const moves: string[] = [];
    const dirs = piece.type === 'r' ? [[-1, 0], [1, 0], [0, -1], [0, 1]] :
                 piece.type === 'b' ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] :
                 piece.type === 'q' ? [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]] :
                 piece.type === 'p' ? [[(piece.color === 'w' ? -1 : 1), 0]] : [];

    dirs.forEach(([dr, dc]) => {
      let tr = r + dr, tc = c + dc;
      while (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
        if (this.board[tr][tc]) {
          const jr = tr + dr, jc = tc + dc;
          if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8) {
            const jt = this.board[jr][jc];
            if (!jt || jt.color !== piece.color) {
              const targetSq = this.idxToSq(jr, jc);
              if (!(this.spellState.shieldedSquares[targetSq] > this.halfMoveCount)) {
                moves.push(targetSq);
              }
            }
          }
          break;
        }
        tr += dr; tc += dc;
      }
    });
    return moves;
  }

  private isClearDiagonal(r1: number, c1: number, r2: number, c2: number): boolean {
    const dr = r2 > r1 ? 1 : -1;
    const dc = c2 > c1 ? 1 : -1;
    let r = r1 + dr, c = c1 + dc;
    while (r !== r2) {
      if (this.board[r][c]) return false;
      r += dr; c += dc;
    }
    return true;
  }

  private isClearStraight(r1: number, c1: number, r2: number, c2: number): boolean {
    if (r1 === r2) {
      const step = c2 > c1 ? 1 : -1;
      for (let c = c1 + step; c !== c2; c += step) {
        if (this.board[r1][c]) return false;
      }
    } else {
      const step = r2 > r1 ? 1 : -1;
      for (let r = r1 + step; r !== r2; r += step) {
        if (this.board[r][c1]) return false;
      }
    }
    return true;
  }

  move(from: string, to: string): boolean {
    const legal = this.getLegalMoves(from);
    if (!legal.includes(to)) return false;

    const { r: fr, c: fc } = this.sqToIdx(from);
    const { r: tr, c: tc } = this.sqToIdx(to);
    const piece = this.board[fr][fc];
    if (!piece) return false;

    this.board[tr][tc] = piece;
    this.board[fr][fc] = null;

    if (this.spellState.portals && to === this.spellState.portals.from) {
      const { r: pr, c: pc } = this.sqToIdx(this.spellState.portals.to);
      if (!this.board[pr][pc]) {
        this.board[pr][pc] = piece;
        this.board[tr][tc] = null;
      }
      this.spellState.portals = null;
    }

    this.spellState.jumpSquare = null;

    this.turn = this.turn === 'w' ? 'b' : 'w';
    this.halfMoveCount++;

    Object.values(this.spellState.whiteSpells).forEach(s => { if (s.cooldown > 0) s.cooldown--; });
    Object.values(this.spellState.blackSpells).forEach(s => { if (s.cooldown > 0) s.cooldown--; });

    return true;
  }

  castFreeze(targetSquare: string): boolean {
    const spells = this.turn === 'w' ? this.spellState.whiteSpells : this.spellState.blackSpells;
    if (spells.freeze.charges <= 0 || spells.freeze.cooldown > 0) return false;
    const { r, c } = this.sqToIdx(targetSquare);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const tr = r + dr, tc = c + dc;
        if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) this.spellState.frozenSquares[this.idxToSq(tr, tc)] = this.halfMoveCount + 3;
      }
    }
    spells.freeze.charges--; spells.freeze.cooldown = 3;
    return true;
  }

  castJump(targetSquare: string): boolean {
    const spells = this.turn === 'w' ? this.spellState.whiteSpells : this.spellState.blackSpells;
    if (spells.jump.charges <= 0 || spells.jump.cooldown > 0) return false;
    const piece = this.getPiece(targetSquare);
    if (!piece || piece.color !== this.turn || piece.type === 'n' || piece.type === 'k') return false;
    this.spellState.jumpSquare = targetSquare;
    spells.jump.charges--; spells.jump.cooldown = 3;
    return true;
  }

  castBlast(targetSquare: string): boolean {
    const spells = this.turn === 'w' ? this.spellState.whiteSpells : this.spellState.blackSpells;
    if (spells.blast.charges <= 0 || spells.blast.cooldown > 0) return false;
    const { r, c } = this.sqToIdx(targetSquare);
    [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
      const tr = r + dr, tc = c + dc;
      if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
        const p = this.board[tr][tc];
        const sqName = this.idxToSq(tr, tc);
        const isShielded = this.spellState.shieldedSquares[sqName] > this.halfMoveCount;
        if (p && p.type !== 'k' && !isShielded) this.board[tr][tc] = null;
      }
    });
    spells.blast.charges--; spells.blast.cooldown = 5;
    return true;
  }

  castShield(targetSquare: string): boolean {
    const spells = this.turn === 'w' ? this.spellState.whiteSpells : this.spellState.blackSpells;
    if (spells.shield.charges <= 0 || spells.shield.cooldown > 0) return false;
    const piece = this.getPiece(targetSquare);
    if (!piece || piece.color !== this.turn) return false;
    this.spellState.shieldedSquares[targetSquare] = this.halfMoveCount + 2;
    spells.shield.charges--; spells.shield.cooldown = 3;
    return true;
  }

  castPortal(from: string, to: string): boolean {
    const spells = this.turn === 'w' ? this.spellState.whiteSpells : this.spellState.blackSpells;
    if (spells.portal.charges <= 0 || spells.portal.cooldown > 0) return false;
    if (this.getPiece(from) || this.getPiece(to) || from === to) return false;
    this.spellState.portals = { from, to };
    spells.portal.charges--; spells.portal.cooldown = 6;
    return true;
  }

  fen(): string {
    let res = '';
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (!piece) empty++;
        else {
          if (empty > 0) { res += empty; empty = 0; }
          const char = piece.type === 'n' ? 'n' : piece.type;
          res += piece.color === 'w' ? char.toUpperCase() : char;
        }
      }
      if (empty > 0) res += empty;
      if (r < 7) res += '/';
    }
    res += ` ${this.turn} KQkq - 0 1`;
    return res;
  }

  isGameOver(): 'white' | 'black' | 'draw' | null {
    let whiteKing = false, blackKing = false;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p?.type === 'k') { if (p.color === 'w') whiteKing = true; else blackKing = true; }
      }
    }
    if (!whiteKing) return 'black';
    if (!blackKing) return 'white';
    return null;
  }
}
