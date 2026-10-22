import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { useBoardStore, PIECE_SETS, getPieceSetUrl, getPieceSetInset, getPieceSetHeight } from '@/stores/boardStore'

/** Коды фигур, которые движок и UI запрашивают у набора. */
const REQUIRED_CODES = [
  'wK', 'wQ', 'wR', 'wB', 'wN', 'wP',
  'bK', 'bQ', 'bR', 'bB', 'bN', 'bP',
]

const PUBLIC_DIR = path.resolve(process.cwd(), 'public')

describe('boardStore / наборы фигур', () => {
  beforeEach(() => {
    useBoardStore.setState({ selectedPieceSet: 'tatiana' })
  })

  it('содержит классические наборы', () => {
    expect(Object.keys(PIECE_SETS)).toEqual(
      expect.arrayContaining(['alpha', 'chessnut', 'pixel', 'tatiana'])
    )
  })

  it('содержит новые наборы фигур', () => {
    expect(PIECE_SETS.pixel2).toBeDefined()
    expect(PIECE_SETS.pixel3).toBeDefined()
    expect(PIECE_SETS.neutrall).toBeDefined()
  })

  it('строит путь к фигуре с нужным расширением', () => {
    expect(getPieceSetUrl('tatiana', 'wK')).toContain('/pieces/tatiana/wK.svg')
    expect(getPieceSetUrl('pixel2', 'bQ')).toContain('/pieces/pixel2/bQ.png')
    expect(getPieceSetUrl('pixel3', 'wN')).toContain('/pieces/pixel3/wN.png')
    expect(getPieceSetUrl('neutrall', 'bK')).toContain('/pieces/neutrall/bK.png')
  })

  it('getPieceUrl использует выбранный набор', () => {
    useBoardStore.getState().setSelectedPieceSet('pixel3')
    expect(useBoardStore.getState().getPieceUrl('wK')).toContain('/pieces/pixel3/wK.png')

    useBoardStore.getState().setSelectedPieceSet('pixel')
    expect(useBoardStore.getState().getPieceUrl('bK')).toContain('/pieces/pixel/bK.svg')
  })

  it('падает на набор по умолчанию для неизвестного id', () => {
    expect(getPieceSetUrl('unknown-set', 'wK')).toContain('/pieces/tatiana/wK.svg')
  })

  it('задаёт отступ от края клетки для обрезанных наборов', () => {
    expect(getPieceSetInset('pixel3')).toBeGreaterThan(0)
    // векторные наборы уже имеют поля в самой графике
    expect(getPieceSetInset('tatiana')).toBe(0)
    expect(getPieceSetInset('unknown-set')).toBe(0)
  })

  it('задаёт явные высоты фигур для набора с обрезанным холстом', () => {
    const heights = ['K', 'Q', 'R', 'B', 'N', 'P'].map((type) =>
      getPieceSetHeight('pixel3', `w${type}`)
    )

    // у каждой фигуры своя высота, все в пределах клетки
    for (const height of heights) {
      expect(height).not.toBeNull()
      expect(height as number).toBeGreaterThan(0)
      expect(height as number).toBeLessThanOrEqual(1)
    }

    const [king, queen, , , , pawn] = heights as number[]
    expect(king).toBeGreaterThan(queen)
    expect(queen).toBeGreaterThan(pawn)
    // пешка заметно ниже короля, но не теряется на доске
    expect(pawn / king).toBeGreaterThan(0.6)

    // белые и чёрные одной высоты
    expect(getPieceSetHeight('pixel3', 'bK')).toBe(king)
    // наборы без явных высот заполняют клетку целиком
    expect(getPieceSetHeight('tatiana', 'wK')).toBeNull()
    expect(getPieceSetHeight('pixel2', 'wK')).toBeNull()
  })

  it('для каждого набора есть все 12 файлов фигур', () => {
    for (const pieceSet of Object.values(PIECE_SETS)) {
      for (const code of REQUIRED_CODES) {
        const url = getPieceSetUrl(pieceSet.id, code)
        const relative = url.replace(/^.*\/public\//, '').replace(/^\//, '')
        const filePath = path.join(PUBLIC_DIR, relative)
        expect(fs.existsSync(filePath), `${pieceSet.id}: нет файла ${relative}`).toBe(true)
      }
    }
  })
})
