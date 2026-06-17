export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
export type Color = 'w' | 'b'

export interface Piece {
  type: PieceType
  color: Color
}

export interface Move {
  from: string
  to: string
  piece: PieceType
  captured?: PieceType
  promotion?: PieceType
  color: Color
  flags: string
  san: string
  lan: string
  before?: string
  after?: string
}

interface HistoryEntry {
  move: Move
  castlingRights: string
  epSquare: string | null
  halfMoveClock: number
  board: (Piece | null)[][]
  turnColor: Color
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export class PoisenChessEngine {
  private _board: (Piece | null)[][] = []
  private _turn: Color = 'w'
  private castlingRights: string = 'KQkq'
  private epSquare: string | null = null
  private halfMoveClock = 0
  private fullMoveNumber = 1
  private _history: HistoryEntry[] = []
  private positionCount: Record<string, number> = {}

  constructor(fen?: string) {
    this.load(fen || START_FEN)
  }

  private resetBoard() {
    this._board = Array.from({ length: 8 }, () => Array(8).fill(null))
  }

  load(fen: string) {
    this.resetBoard()
    this._history = []
    this.positionCount = {}
    this.castlingRights = 'KQkq'
    this.epSquare = null
    this.halfMoveClock = 0
    this.fullMoveNumber = 1

    const parts = fen.split(' ')
    const position = parts[0]
    const rows = position.split('/')
    for (let r = 0; r < 8; r++) {
      let c = 0
      for (const ch of rows[r]) {
        if (isNaN(parseInt(ch))) {
          const type = ch.toLowerCase() as PieceType
          const color = ch === ch.toUpperCase() ? 'w' : 'b'
          this._board[r][c] = { type, color }
          c++
        } else {
          c += parseInt(ch)
        }
      }
    }

    if (parts[1]) this._turn = parts[1] as Color
    if (parts[2]) this.castlingRights = parts[2]
    if (parts[3] && parts[3] !== '-') this.epSquare = parts[3]
    if (parts[4]) this.halfMoveClock = parseInt(parts[4])
    if (parts[5]) this.fullMoveNumber = parseInt(parts[5])

    this.storePosition()
  }

  private idx(sq: string): { r: number; c: number } {
    return {
      c: sq.charCodeAt(0) - 97,
      r: 8 - parseInt(sq[1])
    }
  }

  private sq(r: number, c: number): string {
    return String.fromCharCode(97 + c) + (8 - r)
  }

  private storePosition() {
    const key = this.positionKey()
    this.positionCount[key] = (this.positionCount[key] || 0) + 1
  }

  private removePosition() {
    const key = this.positionKey()
    if (this.positionCount[key]) {
      this.positionCount[key]--
      if (this.positionCount[key] <= 0) delete this.positionCount[key]
    }
  }

  private positionKey(): string {
    const boardStr = this._board.map(row =>
      row.map(p => p ? (p.color === 'w' ? p.type.toUpperCase() : p.type) : '1').join('')
    ).join('/')
    return `${boardStr} ${this._turn} ${this.castlingRights} ${this.epSquare || '-'}`
  }

  get(square: string): Piece | null {
    const { r, c } = this.idx(square)
    return this._board[r][c]
  }

  fen(): string {
    let res = ''
    for (let r = 0; r < 8; r++) {
      let empty = 0
      for (let c = 0; c < 8; c++) {
        const p = this._board[r][c]
        if (!p) { empty++; continue }
        if (empty > 0) { res += empty; empty = 0 }
        res += p.color === 'w' ? p.type.toUpperCase() : p.type
      }
      if (empty > 0) res += empty
      if (r < 7) res += '/'
    }
    const ep = this.epSquare || '-'
    const castle = this.castlingRights || '-'
    return `${res} ${this._turn} ${castle} ${ep} ${this.halfMoveClock} ${this.fullMoveNumber}`
  }

  turn(): Color {
    return this._turn
  }

  board(): (Piece | null)[][] {
    return this._board.map(row => [...row])
  }

  private kingSquare(color: Color): string | null {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this._board[r][c]?.type === 'k' && this._board[r][c]?.color === color)
          return this.sq(r, c)
    return null
  }

  private isClear(r1: number, c1: number, r2: number, c2: number): boolean {
    const dr = r2 > r1 ? 1 : r2 < r1 ? -1 : 0
    const dc = c2 > c1 ? 1 : c2 < c1 ? -1 : 0
    let r = r1 + dr, c = c1 + dc
    while (r !== r2 || c !== c2) {
      if (this._board[r]?.[c]) return false
      r += dr
      c += dc
    }
    return true
  }

  isSquareAttacked(square: string, attackerColor: Color): boolean {
    const { r: tr, c: tc } = this.idx(square)
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this._board[r][c]
        if (!p || p.color !== attackerColor) continue
        const dr = tr - r
        const dc = tc - c
        const adr = Math.abs(dr)
        const adc = Math.abs(dc)
        switch (p.type) {
          case 'p': {
            const dir = attackerColor === 'w' ? -1 : 1
            if (dr === dir && adc === 1) return true
            break
          }
          case 'n':
            if ((adr === 2 && adc === 1) || (adr === 1 && adc === 2)) return true
            break
          case 'b':
            if (adr === adc && adr > 0 && this.isClear(r, c, tr, tc)) return true
            break
          case 'r':
            if ((dr === 0 || dc === 0) && (dr !== 0 || dc !== 0) && this.isClear(r, c, tr, tc)) return true
            break
          case 'q':
            if (adr === adc && adr > 0 && this.isClear(r, c, tr, tc)) return true
            if ((dr === 0 || dc === 0) && (dr !== 0 || dc !== 0) && this.isClear(r, c, tr, tc)) return true
            break
          case 'k':
            if (adr <= 1 && adc <= 1) return true
            break
        }
      }
    }
    return false
  }

  inCheck(color?: Color): boolean {
    const c = color ?? this._turn
    const ks = this.kingSquare(c)
    if (!ks) return false
    return this.isSquareAttacked(ks, c === 'w' ? 'b' : 'w')
  }

  private pseudoLegalMoves(square: string): { to: string; flags: string }[] {
    const p = this.get(square)
    if (!p) return []
    const { r, c } = this.idx(square)
    const moves: { to: string; flags: string }[] = []
    const color = p.color
    const enemy = color === 'w' ? 'b' : 'w'
    const addIf = (tr: number, tc: number, flags: string) => {
      if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
        const target = this._board[tr][tc]
        if (!target) {
          moves.push({ to: this.sq(tr, tc), flags })
        } else if (target.color === enemy) {
          moves.push({ to: this.sq(tr, tc), flags: flags + 'c' })
        }
      }
    }

    switch (p.type) {
      case 'p': {
        const dir = color === 'w' ? -1 : 1
        const startRow = color === 'w' ? 6 : 1
        const promoRow = color === 'w' ? 0 : 7

        if (!this._board[r + dir]?.[c]) {
          const flags = promoRow === r + dir ? 'p' : 'b'
          moves.push({ to: this.sq(r + dir, c), flags })
          if (r === startRow && !this._board[r + 2 * dir]?.[c]) {
            moves.push({ to: this.sq(r + 2 * dir, c), flags: 'b' })
          }
        }
        for (const dc of [-1, 1]) {
          const tc = c + dc
          if (tc < 0 || tc >= 8) continue
          const target = this._board[r + dir]?.[tc]
          if (target && target.color === enemy) {
            const flags = promoRow === r + dir ? 'pc' : 'c'
            moves.push({ to: this.sq(r + dir, tc), flags })
          }
          if (this.epSquare === this.sq(r + dir, tc)) {
            moves.push({ to: this.sq(r + dir, tc), flags: 'ep' })
          }
        }
        break
      }
      case 'n': {
        const offsets = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]
        offsets.forEach(([dr, dc]) => addIf(r + dr, c + dc, ''))
        break
      }
      case 'b':
        for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
          let tr = r + dr, tc = c + dc
          while (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
            if (!this._board[tr][tc]) { moves.push({ to: this.sq(tr, tc), flags: '' }); tr += dr; tc += dc; continue }
            if (this._board[tr][tc]?.color === enemy) moves.push({ to: this.sq(tr, tc), flags: 'c' })
            break
          }
        }
        break
      case 'r':
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          let tr = r + dr, tc = c + dc
          while (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
            if (!this._board[tr][tc]) { moves.push({ to: this.sq(tr, tc), flags: '' }); tr += dr; tc += dc; continue }
            if (this._board[tr][tc]?.color === enemy) moves.push({ to: this.sq(tr, tc), flags: 'c' })
            break
          }
        }
        break
      case 'q':
        for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
          let tr = r + dr, tc = c + dc
          while (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
            if (!this._board[tr][tc]) { moves.push({ to: this.sq(tr, tc), flags: '' }); tr += dr; tc += dc; continue }
            if (this._board[tr][tc]?.color === enemy) moves.push({ to: this.sq(tr, tc), flags: 'c' })
            break
          }
        }
        break
      case 'k':
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++)
            if (dr !== 0 || dc !== 0) addIf(r + dr, c + dc, '')
        if (color === 'w' && r === 7 && c === 4) {
          if (this.castlingRights.includes('K') && !this._board[7][5] && !this._board[7][6] &&
              this._board[7][7]?.type === 'r' && this._board[7][7]?.color === 'w') {
            if (!this.isSquareAttacked('e1', 'b') && !this.isSquareAttacked('f1', 'b') && !this.isSquareAttacked('g1', 'b'))
              moves.push({ to: 'g1', flags: 'k' })
          }
          if (this.castlingRights.includes('Q') && !this._board[7][3] && !this._board[7][2] && !this._board[7][1] &&
              this._board[7][0]?.type === 'r' && this._board[7][0]?.color === 'w') {
            if (!this.isSquareAttacked('e1', 'b') && !this.isSquareAttacked('d1', 'b') && !this.isSquareAttacked('c1', 'b'))
              moves.push({ to: 'c1', flags: 'q' })
          }
        }
        if (color === 'b' && r === 0 && c === 4) {
          if (this.castlingRights.includes('k') && !this._board[0][5] && !this._board[0][6] &&
              this._board[0][7]?.type === 'r' && this._board[0][7]?.color === 'b') {
            if (!this.isSquareAttacked('e8', 'w') && !this.isSquareAttacked('f8', 'w') && !this.isSquareAttacked('g8', 'w'))
              moves.push({ to: 'g8', flags: 'k' })
          }
          if (this.castlingRights.includes('q') && !this._board[0][3] && !this._board[0][2] && !this._board[0][1] &&
              this._board[0][0]?.type === 'r' && this._board[0][0]?.color === 'b') {
            if (!this.isSquareAttacked('e8', 'w') && !this.isSquareAttacked('d8', 'w') && !this.isSquareAttacked('c8', 'w'))
              moves.push({ to: 'c8', flags: 'q' })
          }
        }
        break
    }
    return moves
  }

  private makeMoveInternal(from: string, to: string, promotion?: string): Move | null {
    const { r: fr, c: fc } = this.idx(from)
    const { r: tr, c: tc } = this.idx(to)
    const piece = this._board[fr][fc]
    if (!piece) return null

    const saveBoard = this._board.map(row => [...row])
    const saveTurn = this._turn
    const saveCastle = this.castlingRights
    const saveEp = this.epSquare
    const saveHalf = this.halfMoveClock
    const saveFull = this.fullMoveNumber
    const saveFen = this.fen()

    const captured = this._board[tr][tc] || undefined
    let flags: string = ''
    let epCaptured: Piece | null = null
    const ptype = piece.type

    if (ptype === 'p') {
      if (to[1] === '8' || to[1] === '1') flags += 'p'
      if (Math.abs(tr - fr) === 2) flags += 'b'
    }

    const color = piece.color

    if (this.epSquare === to && ptype === 'p') {
      const epR = color === 'w' ? tr + 1 : tr - 1
      epCaptured = this._board[epR]?.[tc] || null
      this._board[epR][tc] = null
      flags += 'e'
    }

    this._board[tr][tc] = piece
    this._board[fr][fc] = null

    if (flags.includes('p')) {
      const promoType = promotion || 'q'
      this._board[tr][tc] = { type: promoType as PieceType, color }
    }

    if (ptype === 'k') {
      if (to === 'g1' && from === 'e1' && color === 'w') {
        this._board[7][5] = this._board[7][7]
        this._board[7][7] = null
        flags = 'k'
      } else if (to === 'c1' && from === 'e1' && color === 'w') {
        this._board[7][3] = this._board[7][0]
        this._board[7][0] = null
        flags = 'q'
      } else if (to === 'g8' && from === 'e8' && color === 'b') {
        this._board[0][5] = this._board[0][7]
        this._board[0][7] = null
        flags = 'k'
      } else if (to === 'c8' && from === 'e8' && color === 'b') {
        this._board[0][3] = this._board[0][0]
        this._board[0][0] = null
        flags = 'q'
      }
    }

    if (captured && captured.type === 'r') {
      if (from === 'h1' || to === 'h1') this.removeCastle('K', 'w')
      if (from === 'a1' || to === 'a1') this.removeCastle('Q', 'w')
      if (from === 'h8' || to === 'h8') this.removeCastle('k', 'b')
      if (from === 'a8' || to === 'a8') this.removeCastle('q', 'b')
    }

    if (captured && captured.type === 'r') {
      if (captured.color === 'w') {
        if (to === 'h1') this.removeCastle('K', 'w')
        if (to === 'a1') this.removeCastle('Q', 'w')
      } else {
        if (to === 'h8') this.removeCastle('k', 'b')
        if (to === 'a8') this.removeCastle('q', 'b')
      }
    }

    if (ptype === 'r') {
      if (from === 'h1' && color === 'w') this.removeCastle('K', 'w')
      if (from === 'a1' && color === 'w') this.removeCastle('Q', 'w')
      if (from === 'h8' && color === 'b') this.removeCastle('k', 'b')
      if (from === 'a8' && color === 'b') this.removeCastle('q', 'b')
    }

    if (ptype === 'k') {
      if (color === 'w') { this.removeCastle('K', 'w'); this.removeCastle('Q', 'w') }
      if (color === 'b') { this.removeCastle('k', 'b'); this.removeCastle('q', 'b') }
    }

    this.epSquare = null
    if (ptype === 'p' && Math.abs(tr - fr) === 2) {
      this.epSquare = this.sq((fr + tr) / 2, fc)
    }

    if (ptype === 'p' || captured) this.halfMoveClock = 0
    else this.halfMoveClock++

    this._turn = this._turn === 'w' ? 'b' : 'w'
    if (this._turn === 'w') this.fullMoveNumber++

    const promoStr = promotion && promotion !== ptype ? promotion : ''
    const moveObj: Move = {
      from, to,
      piece: ptype,
      captured: captured?.type || epCaptured?.type || undefined,
      promotion: promotion && promotion !== ptype ? (promotion as PieceType) : undefined,
      color,
      flags: flags || ((captured || epCaptured) ? 'c' : 'b'),
      san: '',
      lan: from + to + promoStr,
      before: saveFen,
      after: ''
    }

    moveObj.after = this.fen()

    const postBoard = this._board.map(row => [...row])
    const postTurn = this._turn
    const postCastle = this.castlingRights
    const postEp = this.epSquare
    const postHalf = this.halfMoveClock
    const postFull = this.fullMoveNumber

    this._board = saveBoard
    this._turn = saveTurn
    this.castlingRights = saveCastle
    this.epSquare = saveEp
    this.halfMoveClock = saveHalf
    this.fullMoveNumber = saveFull

    const body = this.sanBody(moveObj)

    this._board = postBoard
    this._turn = postTurn
    this.castlingRights = postCastle
    this.epSquare = postEp
    this.halfMoveClock = postHalf
    this.fullMoveNumber = postFull

    moveObj.san = body + this.sanSuffix()
    return moveObj
  }

  private removeCastle(flag: string, _forColor: Color) {
    this.castlingRights = this.castlingRights.replace(flag, '')
    if (!this.castlingRights) this.castlingRights = '-'
  }

  moves(): string[]
  moves(options: { square?: string; verbose?: false }): string[]
  moves(options: { square?: string; verbose: true }): Move[]
  moves(options?: { square?: string; verbose?: boolean }): string[] | Move[] {
    const targetSquare = options?.square
    const pieces = targetSquare
      ? [[targetSquare, this.get(targetSquare)] as const].filter(([_, p]) => p)
      : this._board.flatMap((row, r) =>
          row.map((p, c) => [this.sq(r, c), p] as const).filter(([_, p]) => p && p.color === this._turn)
        )

    const results: Move[] = []
    for (const [sq, _piece] of pieces) {
      const pseudo = this.pseudoLegalMoves(sq)
      for (const m of pseudo) {
        const testBoard = this._board.map(row => [...row])
        const testTurn = this._turn
        const testCastle = this.castlingRights
        const testEp = this.epSquare
        const testHalf = this.halfMoveClock
        const testFull = this.fullMoveNumber

        if (m.flags === 'p' || m.flags === 'pc') {
          for (const promo of ['q', 'r', 'b', 'n']) {
            const saveBoard = this._board.map(row => [...row])
            const saveTurn = this._turn
            const saveCastle = this.castlingRights
            const saveEp = this.epSquare
            const saveHalf = this.halfMoveClock
            const saveFull = this.fullMoveNumber
            const moved = this.makeMoveInternal(sq, m.to, promo)
            if (moved && !this.inCheck(moved.color)) {
              results.push(moved)
            }
            this._board = saveBoard
            this._turn = saveTurn
            this.castlingRights = saveCastle
            this.epSquare = saveEp
            this.halfMoveClock = saveHalf
            this.fullMoveNumber = saveFull
          }
        } else {
          const moved = this.makeMoveInternal(sq, m.to)
          if (moved && !this.inCheck(moved.color)) {
            results.push(moved)
          }
          this._board = testBoard
          this._turn = testTurn
          this.castlingRights = testCastle
          this.epSquare = testEp
          this.halfMoveClock = testHalf
          this.fullMoveNumber = testFull
        }
      }
    }

    if (options?.verbose === false) return results.map(m => m.san)
    if (options?.verbose === true) return results
    if (!options?.verbose && !targetSquare) return results.map(m => m.san)
    return results
  }

  private sanBody(move: Move): string {
    const p = move.piece
    if (move.flags === 'k' || move.flags === 'q') {
      return move.flags === 'k' ? 'O-O' : 'O-O-O'
    }

    const pieceChar = p === 'p' ? '' : p.toUpperCase()
    let disambig = ''
    if (p !== 'p' && p !== 'k') {
      const samePieces = this._board.flatMap((row, r) =>
        row.map((_piece, c) => ({ piece: _piece, sq: this.sq(r, c) }))
      ).filter(({ piece, sq }) =>
        piece?.type === p && piece?.color === move.color && sq !== move.from && sq !== move.to
      )
      const movesToSame = samePieces.filter(({ sq }) => {
        const pseudo = this.pseudoLegalMoves(sq)
        return pseudo.some(m => m.to === move.to)
      })

      if (movesToSame.length > 0) {
        const needsFile = movesToSame.some(({ sq }) => sq[0] !== move.from[0])
        const needsRank = movesToSame.some(({ sq }) => sq[1] !== move.from[1])
        disambig = needsFile ? move.from[0] : needsRank ? move.from[1] : move.from
      }
    } else if (p === 'p' && move.captured) {
      disambig = move.from[0]
    }

    const capture = move.captured ? 'x' : ''
    const to = move.to
    const promo = move.promotion ? `=${move.promotion.toUpperCase()}` : ''
    return `${pieceChar}${disambig}${capture}${to}${promo}`
  }

  private sanSuffix(): string {
    const givesCheck = this.inCheck(this._turn)
    if (!givesCheck) return ''
    return this.isCheckmate() ? '#' : '+'
  }

  move(m: { from: string; to: string; promotion?: string }): Move | null {
    const { from, to, promotion } = m
    const allMoves = this.moves({ verbose: true }) as Move[]
    const found = allMoves.find(mv => mv.from === from && mv.to === to && (!promotion || mv.promotion === promotion))
    if (!found) return null

    const entry: HistoryEntry = {
      move: { ...found },
      castlingRights: this.castlingRights,
      epSquare: this.epSquare,
      halfMoveClock: this.halfMoveClock,
      board: this._board.map(row => [...row]),
      turnColor: this._turn
    }
    this._history.push(entry)

    this.makeMoveInternal(from, to, promotion)
    this.storePosition()

    return found
  }

  undo(): Move | null {
    const entry = this._history.pop()
    if (!entry) return null

    this.removePosition()
    this._board = entry.board
    this._turn = entry.turnColor
    this.castlingRights = entry.castlingRights
    this.epSquare = entry.epSquare
    this.halfMoveClock = entry.halfMoveClock

    return entry.move
  }

  history(): string[]
  history(options: { verbose?: false }): string[]
  history(options: { verbose: true }): Move[]
  history(options?: { verbose?: boolean }): string[] | Move[] {
    if (options?.verbose) return this._history.map(e => e.move)
    return this._history.map(e => e.move.san)
  }

  pgn(): string {
    const headers = '[Event "?"]\n[Site "?"]\n[Date "?"]\n[Round "?"]\n[White "?"]\n[Black "?"]\n[Result "*"]\n\n'
    let moves = ''
    for (let i = 0; i < this._history.length; i++) {
      if (i % 2 === 0) moves += `${Math.floor(i / 2) + 1}. `
      moves += `${this._history[i].move.san} `
    }
    return headers + moves.trim()
  }

  loadPgn(pgn: string) {
    this.resetBoard()
    this._history = []
    this.positionCount = {}
    this.castlingRights = '-'
    this.epSquare = null
    this.halfMoveClock = 0
    this.fullMoveNumber = 1
    this._turn = 'w'

    this.load(START_FEN)

    const moveStr = pgn.replace(/\[.*?\]\s*/g, '').replace(/\{.*?\}/g, '').replace(/\d+\.\s*/g, '').replace(/[+#]/g, '').trim()
    const tokens = moveStr.split(/\s+/)

    for (const token of tokens) {
      if (!token) continue
      const parsed = this.parseSan(token)
      if (parsed) this.move(parsed)
    }
  }

  private parseSan(san: string): { from: string; to: string; promotion?: PieceType } | null {
    if (san.startsWith('O-O')) {
      const isKingside = san === 'O-O' || san.startsWith('O-O+') || san.startsWith('O-O#')
      if (this._turn === 'w') return { from: 'e1', to: isKingside ? 'g1' : 'c1' }
      return { from: 'e8', to: isKingside ? 'g8' : 'c8' }
    }

    const raw = san.replace(/[+#]/g, '')
    const legal = this.moves({ verbose: true }) as Move[]
    const candidates = legal.filter(m => m.san.replace(/[+#]/g, '') === raw)

    if (candidates.length > 0) {
      const m = candidates[0]
      return { from: m.from, to: m.to, promotion: m.promotion }
    }

    return null
  }

  private hasLegalMove(): boolean {
    const pieces: [string, Piece][] = []
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this._board[r][c] && this._board[r][c]!.color === this._turn)
          pieces.push([this.sq(r, c), this._board[r][c]!])

    for (const [sq] of pieces) {
      const pseudo = this.pseudoLegalMoves(sq)
      for (const m of pseudo) {
        const saveBoard = this._board.map(row => [...row])
        const saveTurn = this._turn
        const saveCastle = this.castlingRights
        const saveEp = this.epSquare
        const saveHalf = this.halfMoveClock
        const saveFull = this.fullMoveNumber

        const { r: fr, c: fc } = this.idx(sq)
        const { r: tr, c: tc } = this.idx(m.to)
        const piece = this._board[fr][fc]
        if (!piece) { this._board = saveBoard; continue }

        this._board[tr][tc] = piece
        this._board[fr][fc] = null

        if (this.epSquare === m.to && piece.type === 'p') {
          const epR = piece.color === 'w' ? tr + 1 : tr - 1
          this._board[epR][tc] = null
        }

        // Try each promotion if applicable
        const promoPieces = (m.flags === 'p' || m.flags === 'pc') ? ['q', 'r', 'b', 'n'] : [null]
        for (const promo of promoPieces) {
          if (promo) {
            this._board[tr][tc] = { type: promo as PieceType, color: piece.color }
          }
          if (!this.inCheck(piece.color)) {
            this._board = saveBoard; this._turn = saveTurn
            this.castlingRights = saveCastle; this.epSquare = saveEp
            this.halfMoveClock = saveHalf; this.fullMoveNumber = saveFull
            return true
          }
        }

        this._board = saveBoard; this._turn = saveTurn
        this.castlingRights = saveCastle; this.epSquare = saveEp
        this.halfMoveClock = saveHalf; this.fullMoveNumber = saveFull
      }
    }
    return false
  }

  isCheckmate(): boolean {
    if (!this.inCheck()) return false
    return !this.hasLegalMove()
  }

  isStalemate(): boolean {
    if (this.inCheck()) return false
    return !this.hasLegalMove()
  }

  isDraw(): boolean {
    if (this.isStalemate()) return true
    if (this.halfMoveClock >= 100) return true
    if (this.isInsufficientMaterial()) return true
    return this.isThreefoldRepetition()
  }

  isInsufficientMaterial(): boolean {
    const pieces = this._board.flat().filter(Boolean) as Piece[]
    if (pieces.length <= 2) return true

    const nonKing: Piece[] = []
    for (const p of pieces) {
      if (p.type !== 'k') nonKing.push(p)
    }

    if (nonKing.length === 1 && (nonKing[0].type === 'b' || nonKing[0].type === 'n')) {
      return true
    }

    if (nonKing.every(p => p.type === 'b')) {
      const bishopColors = nonKing.map(p => {
        for (let r = 0; r < 8; r++)
          for (let c = 0; c < 8; c++)
            if (this._board[r][c] === p) return (r + c) % 2
        return 0
      })
      if (bishopColors.every(c => c === bishopColors[0])) return true
    }

    return false
  }

  isThreefoldRepetition(): boolean {
    return Object.values(this.positionCount).some(c => c >= 3)
  }

  squareColor(sq: string): 'light' | 'dark' {
    const f = sq.charCodeAt(0) - 97
    const r = parseInt(sq[1]) - 1
    return (f + r) % 2 === 0 ? 'dark' : 'light'
  }

  isGameOver(): boolean {
    return this.isCheckmate() || this.isStalemate() || this.isDraw()
  }

  reset() {
    this.load(START_FEN)
  }
}
