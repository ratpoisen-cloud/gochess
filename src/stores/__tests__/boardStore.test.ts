import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  useBoardStore,
  PIECE_SETS,
  STANDARD_BOTTOM_GAP,
  STANDARD_TOP_GAP,
  getPieceSetUrl,
  getPieceSetArtBottom,
  getPieceSetArtTop,
  getPieceSetHeight,
  getPieceBottomMargin,
  getPieceBottomGap,
  getPieceTopGap,
} from '@/stores/boardStore'

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

  it('содержит актуальные наборы фигур', () => {
    expect(Object.keys(PIECE_SETS).sort()).toEqual(
      ['alpha', 'pixel', 'pixel2', 'pixel3', 'tatiana']
    )
  })

  it('не содержит удалённых наборов', () => {
    expect(PIECE_SETS.chessnut).toBeUndefined()
    expect(PIECE_SETS.neutrall).toBeUndefined()
  })

  it('строит путь к фигуре с нужным расширением', () => {
    expect(getPieceSetUrl('tatiana', 'wK')).toContain('/pieces/tatiana/wK.svg')
    expect(getPieceSetUrl('pixel2', 'bQ')).toContain('/pieces/pixel2/bQ.png')
    expect(getPieceSetUrl('pixel3', 'wN')).toContain('/pieces/pixel3/wN.png')
    expect(getPieceSetUrl('alpha', 'bK')).toContain('/pieces/alpha/bK.svg')
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

  it('не даёт выбрать удалённый набор', () => {
    useBoardStore.getState().setSelectedPieceSet('chessnut')
    expect(useBoardStore.getState().selectedPieceSet).toBe('tatiana')
    expect(useBoardStore.getState().getPieceUrl('bK')).toContain('/pieces/tatiana/bK.svg')

    useBoardStore.getState().setSelectedPieceSet('pixel3')
    expect(useBoardStore.getState().selectedPieceSet).toBe('pixel3')
  })

  it('ставит все наборы на одну базу — как у Tatiana', () => {
    for (const pieceSet of Object.values(PIECE_SETS)) {
      expect(pieceSet.artBottom, `${pieceSet.id}: не задан прозрачный низ картинки`).toBeDefined()
      expect(pieceSet.artTop, `${pieceSet.id}: не задан прозрачный верх картинки`).toBeDefined()

      for (const code of REQUIRED_CODES) {
        const height = getPieceSetHeight(pieceSet.id, code) ?? 1
        const margin = getPieceBottomMargin(pieceSet.id, code)
        const visibleGap = margin + getPieceSetArtBottom(pieceSet.id, code) * height

        // видимый низ фигуры у всех наборов — на стандартном отступе
        expect(visibleGap, `${pieceSet.id}/${code}`).toBeCloseTo(STANDARD_BOTTOM_GAP, 6)
        expect(getPieceBottomGap(pieceSet.id, code), `${pieceSet.id}/${code}`)
          .toBeCloseTo(STANDARD_BOTTOM_GAP, 6)
        // сдвиг небольшой: картинка либо поднимается, либо чуть опускается
        expect(Math.abs(margin)).toBeLessThanOrEqual(STANDARD_BOTTOM_GAP + 0.05)
      }
    }
  })

  it('компенсирует прозрачный низ картинки сдвигом вверх', () => {
    // pixel3 обрезан по контуру — отступ целиком даёт рендер
    expect(getPieceSetArtBottom('pixel3', 'wK')).toBe(0)
    expect(getPieceBottomMargin('pixel3', 'wK')).toBeCloseTo(STANDARD_BOTTOM_GAP, 6)

    // Tatiana — стандарт: она уже стоит как надо, сдвига почти нет
    expect(Math.abs(getPieceBottomMargin('tatiana', 'wK'))).toBeLessThan(0.005)
    expect(Math.abs(getPieceBottomMargin('alpha', 'wQ'))).toBeLessThan(0.005)
  })

  it('держит обрезанный по контуру набор на стандартном отступе от низа', () => {
    for (const code of REQUIRED_CODES) {
      const margin = getPieceBottomMargin('pixel3', code)
      const height = getPieceSetHeight('pixel3', code) as number

      // видимый низ картинки — ровно STANDARD_BOTTOM_GAP, и фигура влезает в клетку
      expect(margin, `pixel3/${code}`).toBeCloseTo(STANDARD_BOTTOM_GAP, 6)
      expect(margin + height, `pixel3/${code}`).toBeLessThanOrEqual(1)
    }
  })

  it('оставляет отступ от верхней границы клетки у всех наборов', () => {
    for (const pieceSet of Object.values(PIECE_SETS)) {
      for (const code of REQUIRED_CODES) {
        // ни одна фигура не примыкает к верхней границе клетки
        expect(getPieceTopGap(pieceSet.id, code), `${pieceSet.id}/${code}`)
          .toBeGreaterThan(0.01)
      }
    }
  })

  it('ставит pixel2 на стандартные отступы сверху и снизу', () => {
    // pixel2 держит квадратный холст: высоты заданы явно, artTop/artBottom — поля картинки
    for (const code of REQUIRED_CODES.filter((c) => c[1] !== 'P')) {
      // видимый верх фигуры — ровно на стандартном отступе от верха клетки
      expect(getPieceTopGap('pixel2', code), `pixel2/${code}`)
        .toBeCloseTo(STANDARD_TOP_GAP, 3)
      // видимый низ — на стандартной базе
      expect(getPieceBottomGap('pixel2', code), `pixel2/${code}`)
        .toBeCloseTo(STANDARD_BOTTOM_GAP, 6)
    }
  })

  it('уменьшает пешку в наборе pixel2 против остальных фигур', () => {
    const king = getPieceSetHeight('pixel2', 'wK') as number
    const pawn = getPieceSetHeight('pixel2', 'wP') as number

    // пешка примерно на 25–30% ниже короля
    expect(pawn / king).toBeGreaterThan(0.7)
    expect(pawn / king).toBeLessThan(0.8)
    // белые и чёрные одной высоты
    expect(getPieceSetHeight('pixel2', 'bP')).toBe(pawn)

    // видимая часть пешки — 61.25% клетки против 87.5% у исходной картинки (−30%)
    const artContent = 1 - getPieceSetArtTop('pixel2', 'wP') - getPieceSetArtBottom('pixel2', 'wP')
    expect(pawn * artContent).toBeCloseTo(0.6125, 6)
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
    expect(getPieceSetHeight('alpha', 'wK')).toBeNull()
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
