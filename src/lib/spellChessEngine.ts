export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type Color = 'w' | 'b';

export interface Piece {
  type: PieceType;
  color: Color;
}

export type SpellName = 'jump' | 'shield' | 'freeze' | 'portal' | 'blast' | 'berserk' | 'divineGrace' | 'shadowGrave' | 'mirage'

export const FREE_ACTIONS: SpellName[] = ['jump', 'shield', 'portal']
export const TERMINAL_ACTIONS: SpellName[] = ['freeze', 'blast', 'berserk', 'divineGrace', 'shadowGrave', 'mirage']

export const SPELL_UNLOCK: Record<SpellName, number> = {
  jump: 1,
  shield: 4,
  freeze: 10,
  portal: 10,
  blast: 16,
  berserk: 7,
  divineGrace: 13,
  shadowGrave: 13,
  mirage: 13,
}

export const WHITE_CHARGES: Record<SpellName, number> = {
  jump: 3, shield: 2, freeze: 2, portal: 1, blast: 1,
  berserk: 1, divineGrace: 1, shadowGrave: 0, mirage: 0,
}

export const BLACK_CHARGES: Record<SpellName, number> = {
  jump: 3, shield: 2, freeze: 2, portal: 1, blast: 1,
  berserk: 0, divineGrace: 0, shadowGrave: 1, mirage: 1,
}

export function defaultCharges(color: Color): Record<SpellName, number> {
  return { ...(color === 'w' ? WHITE_CHARGES : BLACK_CHARGES) }
}

export interface SpellState {
  frozenSquares: Record<string, number>;
  jumpSquare: string | null;
  shieldedSquares: Record<string, number>;
  portals: { from: string; to: string; expiry: number } | null;
  bombs: Record<string, Color>;
  berserkTransforms: Record<string, { fromType: PieceType; expiry: number }>;
  charges: Record<Color, Record<SpellName, number>>;
  impassableSquares: Record<string, number>;
  pendingBlastMine: { square: string; color: Color } | null;
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
      bombs: {},
      berserkTransforms: {},
      charges: { w: defaultCharges('w'), b: defaultCharges('b') },
      impassableSquares: {},
      pendingBlastMine: null,
    };

    if (fen) {
      this.load(fen);
    } else {
      this.reset();
    }
  }

  getTurnNumber(): number {
    return Math.floor(this.halfMoveCount / 2) + 1
  }

  reset() {
    this.load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    this.halfMoveCount = 0;
    this.spellState.frozenSquares = {};
    this.spellState.shieldedSquares = {};
    this.spellState.jumpSquare = null;
    this.spellState.portals = null;
    this.spellState.bombs = {};
    this.spellState.berserkTransforms = {};
    this.spellState.charges = { w: defaultCharges('w'), b: defaultCharges('b') };
    this.spellState.impassableSquares = {};
    this.spellState.pendingBlastMine = null;
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

  isImpassable(square: string): boolean {
    const expiry = this.spellState.impassableSquares[square];
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
    if (this.isImpassable(square)) return [];

    const moves: string[] = [];
    const { r, c } = this.sqToIdx(square);

    const addMove = (tr: number, tc: number) => {
      if (tr < 0 || tr >= 8 || tc < 0 || tc >= 8) return false;
      const targetSq = this.idxToSq(tr, tc);
      if (this.isImpassable(targetSq)) return false;
      const target = this.board[tr][tc];
      if (!target) {
        moves.push(targetSq);
        return true;
      } else if (target.color !== piece.color) {
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
          const sq = this.idxToSq(r + dir, c);
          if (!this.isImpassable(sq)) {
            moves.push(sq);
            if (r === startRank && !this.board[r + 2 * dir][c]) {
              const sq2 = this.idxToSq(r + 2 * dir, c);
              if (!this.isImpassable(sq2)) {
                moves.push(sq2);
              }
            }
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
        const targetSq = this.idxToSq(tr, tc);
        if (this.isImpassable(targetSq)) break;
        const target = this.board[tr][tc];
        if (!target) {
          moves.push(targetSq);
        } else {
          if (target.color !== color) {
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
            const targetSq = this.idxToSq(jr, jc);
            if (this.isImpassable(targetSq)) break;
            const jt = this.board[jr][jc];
            if (!jt || jt.color !== piece.color) {
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

  private canAffordSpell(spell: SpellName): { ok: boolean; reason?: 'charges' | 'locked' | 'color' } {
    const charge = this.spellState.charges[this.turn][spell]
    if (!charge || charge <= 0) return { ok: false, reason: 'charges' }
    const currentTurnNum = this.getTurnNumber()
    if (currentTurnNum < SPELL_UNLOCK[spell]) return { ok: false, reason: 'locked' }
    if (spell === 'divineGrace' && this.turn !== 'w') return { ok: false, reason: 'color' }
    if ((spell === 'shadowGrave' || spell === 'mirage') && this.turn !== 'b') return { ok: false, reason: 'color' }
    return { ok: true }
  }

  private deductCharge(spell: SpellName) {
    this.spellState.charges[this.turn][spell]--
  }

  completeTurn() {
    this.turn = this.turn === 'w' ? 'b' : 'w'
    this.halfMoveCount++

    // Process pending blast mine — explodes at start of caster's next turn
    if (this.spellState.pendingBlastMine && this.spellState.pendingBlastMine.color === this.turn) {
      this.triggerBlastExplosion(this.spellState.pendingBlastMine.square)
      this.spellState.pendingBlastMine = null
    }

    // Revert expired berserk transforms
    Object.keys(this.spellState.berserkTransforms).forEach(sq => {
      const t = this.spellState.berserkTransforms[sq];
      if (t.expiry <= this.halfMoveCount) {
        const p = this.getPiece(sq);
        if (p) p.type = t.fromType;
        delete this.spellState.berserkTransforms[sq];
      }
    })
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

    let landingSq = to;
    if (this.spellState.portals) {
      if (this.spellState.portals.expiry <= this.halfMoveCount) {
        this.spellState.portals = null;
      } else if (to === this.spellState.portals.from) {
        const { r: pr, c: pc } = this.sqToIdx(this.spellState.portals.to);
        if (!this.board[pr][pc]) {
          this.board[pr][pc] = piece;
          this.board[tr][tc] = null;
          landingSq = this.spellState.portals.to;
        }
        this.spellState.portals = null;
      }
    }

    // Transfer shield with moving piece
    const shieldExpiry = this.spellState.shieldedSquares[from];
    if (shieldExpiry !== undefined && shieldExpiry > this.halfMoveCount) {
      delete this.spellState.shieldedSquares[from];
      this.spellState.shieldedSquares[landingSq] = shieldExpiry;
    }

    // Bomb check — if step on a bomb, trigger blast explosion
    if (this.spellState.bombs && this.spellState.bombs[landingSq]) {
      this.triggerBlastExplosion(landingSq);
      delete this.spellState.bombs[landingSq];
    }

    this.spellState.jumpSquare = null;

    this.turn = this.turn === 'w' ? 'b' : 'w';
    this.halfMoveCount++;

    // Process pending blast mine — explodes at start of this player's turn
    if (this.spellState.pendingBlastMine && this.spellState.pendingBlastMine.color === this.turn) {
      this.triggerBlastExplosion(this.spellState.pendingBlastMine.square)
      this.spellState.pendingBlastMine = null
    }

    // Revert expired berserk transforms (for the side that just moved)
    Object.keys(this.spellState.berserkTransforms).forEach(sq => {
      const t = this.spellState.berserkTransforms[sq];
      if (t.expiry <= this.halfMoveCount) {
        const p = this.getPiece(sq);
        if (p) p.type = t.fromType;
        delete this.spellState.berserkTransforms[sq];
      }
    })

    return true;
  }

  // --- FREE ACTIONS (can still move after) ---

  castJump(targetSquare: string): boolean {
    const check = this.canAffordSpell('jump')
    if (!check.ok) return false
    const piece = this.getPiece(targetSquare);
    if (!piece || piece.color !== this.turn || piece.type === 'n' || piece.type === 'k' || this.isFrozen(targetSquare)) return false;
    this.spellState.jumpSquare = targetSquare;
    this.deductCharge('jump')
    return true;
  }

  castShield(targetSquare: string): boolean {
    const check = this.canAffordSpell('shield')
    if (!check.ok) return false
    const piece = this.getPiece(targetSquare);
    if (!piece || piece.color !== this.turn) return false;
    this.spellState.shieldedSquares[targetSquare] = this.halfMoveCount + 4;
    this.deductCharge('shield')
    return true;
  }

  castPortal(from: string, to: string): boolean {
    const check = this.canAffordSpell('portal')
    if (!check.ok) return false
    if (this.getPiece(from) || this.getPiece(to) || from === to) return false;
    this.spellState.portals = { from, to, expiry: this.halfMoveCount + 6 };
    this.deductCharge('portal')
    return true;
  }

  // --- TERMINAL ACTIONS (call completeTurn after) ---

  castFreeze(targetSquare: string): boolean {
    const check = this.canAffordSpell('freeze')
    if (!check.ok) return false
    const { r, c } = this.sqToIdx(targetSquare);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const tr = r + dr, tc = c + dc;
        if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
          this.spellState.frozenSquares[this.idxToSq(tr, tc)] = this.halfMoveCount + 6;
        }
      }
    }
    this.deductCharge('freeze')
    this.completeTurn()
    return true;
  }

  castBlast(targetSquare: string): boolean {
    const check = this.canAffordSpell('blast')
    if (!check.ok) return false

    // Place a mine that will explode at start of player's next turn
    this.spellState.pendingBlastMine = { square: targetSquare, color: this.turn }
    this.deductCharge('blast')
    this.completeTurn()
    return true;
  }

  castBerserk(targetSquare: string, pieceType: PieceType): boolean {
    const check = this.canAffordSpell('berserk')
    if (!check.ok) return false
    const piece = this.getPiece(targetSquare);
    if (!piece || piece.color !== this.turn || piece.type === 'k' || piece.type === pieceType || this.isFrozen(targetSquare)) return false;
    this.spellState.berserkTransforms[targetSquare] = { fromType: piece.type, expiry: this.halfMoveCount + 12 };
    piece.type = pieceType;
    this.deductCharge('berserk')
    this.completeTurn()
    return true;
  }

  castDivineGrace(targetSquare: string): boolean {
    const check = this.canAffordSpell('divineGrace')
    if (!check.ok) return false
    const { r, c } = this.sqToIdx(targetSquare);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const tr = r + dr, tc = c + dc;
        if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
          const sq = this.idxToSq(tr, tc);
          delete this.spellState.frozenSquares[sq];
        }
      }
    }
    this.deductCharge('divineGrace')
    this.completeTurn()
    return true;
  }

  castShadowGrave(targetSquare: string): boolean {
    const check = this.canAffordSpell('shadowGrave')
    if (!check.ok) return false
    const piece = this.getPiece(targetSquare);
    if (!piece || piece.color !== this.turn || piece.type === 'k' || this.isFrozen(targetSquare)) return false;

    // Remove own piece
    const { r: sr, c: sc } = this.sqToIdx(targetSquare);
    this.board[sr][sc] = null;

    // Mark square as impassable
    this.spellState.impassableSquares[targetSquare] = this.halfMoveCount + 6;

    // Find adjacent enemy pieces (not king)
    const adjacentEnemies: string[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const tr = sr + dr, tc = sc + dc;
        if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
          const enemy = this.board[tr][tc];
          if (enemy && enemy.color !== this.turn && enemy.type !== 'k') {
            adjacentEnemies.push(this.idxToSq(tr, tc));
          }
        }
      }
    }

    // Remove one random adjacent enemy
    if (adjacentEnemies.length > 0) {
      const target = adjacentEnemies[Math.floor(Math.random() * adjacentEnemies.length)];
      const { r: er, c: ec } = this.sqToIdx(target);
      this.board[er][ec] = null;
    }

    this.deductCharge('shadowGrave')
    this.completeTurn()
    return true;
  }

  castMirage(sq1: string, sq2: string): boolean {
    const check = this.canAffordSpell('mirage')
    if (!check.ok) return false

    const piece1 = this.getPiece(sq1);
    const piece2 = this.getPiece(sq2);
    if (!piece1 || !piece2 || piece1.color !== this.turn || piece2.color !== this.turn) return false;
    if (piece1.type === 'k' || piece2.type === 'k') return false;
    if (sq1 === sq2) return false;

    const { r: r1, c: c1 } = this.sqToIdx(sq1);
    const { r: r2, c: c2 } = this.sqToIdx(sq2);

    // Swap board positions
    this.board[r1][c1] = piece2;
    this.board[r2][c2] = piece1;

    // Swap shield if any
    const shield1 = this.spellState.shieldedSquares[sq1];
    const shield2 = this.spellState.shieldedSquares[sq2];
    if (shield1 !== undefined && shield1 > this.halfMoveCount) {
      delete this.spellState.shieldedSquares[sq1];
      if (shield2 !== undefined && shield2 > this.halfMoveCount) {
        delete this.spellState.shieldedSquares[sq2];
        this.spellState.shieldedSquares[sq1] = shield2;
        this.spellState.shieldedSquares[sq2] = shield1;
      } else {
        this.spellState.shieldedSquares[sq2] = shield1;
      }
    } else if (shield2 !== undefined && shield2 > this.halfMoveCount) {
      delete this.spellState.shieldedSquares[sq2];
      this.spellState.shieldedSquares[sq1] = shield2;
    }

    this.deductCharge('mirage')
    this.completeTurn()
    return true;
  }

  triggerBlastExplosion(centerSquare: string) {
    const { r, c } = this.sqToIdx(centerSquare);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const tr = r + dr, tc = c + dc;
        if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
          const sq = this.idxToSq(tr, tc);
          const p = this.board[tr][tc];
          const isShielded = this.spellState.shieldedSquares[sq] > this.halfMoveCount;
          if (p && p.type !== 'k' && !isShielded) {
            this.board[tr][tc] = null;
          }
        }
      }
    }
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
