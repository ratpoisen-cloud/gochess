import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const BASE = import.meta.env.BASE_URL || '/'

interface BoardTheme {
  id: string
  label: string
  whiteSquare: string
  blackSquare: string
  highlightSelected: string
  highlightPossible: string
  highlightPossibleShadow: string
  highlightCapture: string
  highlightCaptureShadow: string
}

interface PieceSet {
  id: string
  label: string
  /** Шаблон пути к фигуре: `{piece}` — код фигуры (wK, bQ, ...). */
  path: string
  /** Пиксель-арт (PNG): рендерим без сглаживания. */
  pixelated?: boolean
  /**
   * Явные высоты фигур в долях клетки, по типу фигуры (K, Q, R, B, N, P).
   * Это высота самой картинки; видимая часть фигуры — `heights × (1 - artTop - artBottom)`.
   * Нужны наборам, у которых относительный рост фигур не зашит в картинку:
   * у обрезанных наборов (pixel3) и у наборов с квадратным холстом (pixel2).
   */
  heights?: Record<string, number>
  /**
   * Прозрачный низ в самой картинке (доля от высоты картинки), по типу фигуры.
   * Нужен, чтобы поставить все наборы на одну базу: отступ от низа клетки
   * у всех одинаковый (`STANDARD_BOTTOM_GAP`), как у Tatiana.
   * Значения сняты замером альфа-канала (см. AGENTS.md).
   */
  artBottom?: { default: number } & Record<string, number>
  /**
   * Прозрачный верх в самой картинке (доля от высоты картинки), по типу фигуры.
   * Нужен, чтобы считать отступ фигуры от верхней границы клетки.
   */
  artTop?: { default: number } & Record<string, number>
}

/** Стандартный отступ от низа клетки — как у набора Tatiana. */
export const STANDARD_BOTTOM_GAP = 0.1

/** Стандартный отступ от верха клетки — как у набора Tatiana. */
export const STANDARD_TOP_GAP = 0.1

export const BOARD_THEMES: Record<string, BoardTheme> = {
  forest: {
    id: 'forest',
    label: 'Forest',
    whiteSquare: '#e8eddc',
    blackSquare: '#4c6b3c',
    highlightSelected: 'rgba(152, 194, 128, 0.95)',
    highlightPossible: 'rgba(176, 214, 154, 0.95)',
    highlightPossibleShadow: 'rgba(88, 124, 66, 0.55)',
    highlightCapture: 'rgba(210, 109, 92, 0.92)',
    highlightCaptureShadow: 'rgba(140, 63, 50, 0.45)',
  },
  ocean: {
    id: 'ocean',
    label: 'Ocean',
    whiteSquare: '#dceaf4',
    blackSquare: '#3c5f77',
    highlightSelected: 'rgba(92, 169, 226, 0.95)',
    highlightPossible: 'rgba(108, 191, 236, 0.95)',
    highlightPossibleShadow: 'rgba(57, 112, 150, 0.5)',
    highlightCapture: 'rgba(223, 112, 101, 0.9)',
    highlightCaptureShadow: 'rgba(136, 68, 62, 0.44)',
  },
  dark: {
    id: 'dark',
    label: 'Dark',
    whiteSquare: '#8c8c8c',
    blackSquare: '#2f2f2f',
    highlightSelected: 'rgba(225, 225, 225, 0.9)',
    highlightPossible: 'rgba(205, 205, 205, 0.92)',
    highlightPossibleShadow: 'rgba(105, 105, 105, 0.48)',
    highlightCapture: 'rgba(230, 102, 102, 0.92)',
    highlightCaptureShadow: 'rgba(130, 65, 65, 0.45)',
  },
  marble: {
    id: 'marble',
    label: 'Marble',
    whiteSquare: '#f3f3f1',
    blackSquare: '#8a8f95',
    highlightSelected: 'rgba(122, 156, 190, 0.88)',
    highlightPossible: 'rgba(146, 170, 196, 0.92)',
    highlightPossibleShadow: 'rgba(79, 101, 127, 0.45)',
    highlightCapture: 'rgba(196, 96, 96, 0.9)',
    highlightCaptureShadow: 'rgba(123, 65, 65, 0.45)',
  },
  'middle-earth': {
    id: 'middle-earth',
    label: 'Middle Earth',
    whiteSquare: 'rgba(240, 217, 181, 0.82)',
    blackSquare: 'rgba(181, 136, 99, 0.82)',
    highlightSelected: 'rgba(214, 172, 115, 0.92)',
    highlightPossible: 'rgba(223, 188, 131, 0.95)',
    highlightPossibleShadow: 'rgba(126, 88, 57, 0.5)',
    highlightCapture: 'rgba(182, 82, 73, 0.9)',
    highlightCaptureShadow: 'rgba(102, 49, 43, 0.45)',
  },
  chesscom: {
    id: 'chesscom',
    label: 'Chess.com',
    whiteSquare: '#eeeed2',
    blackSquare: '#769656',
    highlightSelected: 'rgba(136, 177, 83, 0.9)',
    highlightPossible: 'rgba(156, 195, 104, 0.92)',
    highlightPossibleShadow: 'rgba(79, 111, 47, 0.46)',
    highlightCapture: 'rgba(217, 102, 94, 0.9)',
    highlightCaptureShadow: 'rgba(136, 66, 60, 0.44)',
  },
}

export const PIECE_SETS: Record<string, PieceSet> = {
  alpha: {
    id: 'alpha',
    label: 'Alpha',
    path: `${BASE}pieces/alpha/{piece}.svg`,
    artTop: { default: 0.0977, Q: 0.1387, R: 0.1719, B: 0.0762, N: 0.0859, P: 0.1758 },
    artBottom: { default: 0.0996 },
  },
  pixel: {
    id: 'pixel',
    label: 'Pixel',
    path: `${BASE}pieces/pixel/{piece}.svg`,
    artTop: { default: 0.0625, P: 0.125 },
    artBottom: { default: 0.0625, P: 0.125 },
  },
  pixel2: {
    id: 'pixel2',
    label: 'Pixel 2',
    path: `${BASE}pieces/pixel2/{piece}.png`,
    pixelated: true,
    // Холст 16×16, поля по 1px сверху и снизу → видимая часть занимает 87.5% картинки.
    // Высота задана явно: у всех фигур, кроме пешки, видимая часть — 80% клетки
    // (как у Tatiana), поэтому сверху остаётся отступ STANDARD_TOP_GAP.
    // Пешка уменьшена на 30% против исходной картинки (была 87.5% клетки).
    artTop: { default: 0.0625 },
    artBottom: { default: 0.0625 },
    heights: { K: 0.9143, Q: 0.9143, R: 0.9143, B: 0.9143, N: 0.9143, P: 0.7 },
  },
  pixel3: {
    id: 'pixel3',
    label: 'Pixel 3',
    path: `${BASE}pieces/pixel3/{piece}.png`,
    pixelated: true,
    // Картинки обрезаны по контуру (artBottom = 0), рост фигур задан явно:
    // король 88% … пешка 68% клетки. База у всех общая — STANDARD_BOTTOM_GAP.
    artTop: { default: 0 },
    artBottom: { default: 0 },
    heights: { K: 0.88, Q: 0.86, R: 0.82, B: 0.84, N: 0.84, P: 0.68 },
  },
  tatiana: {
    id: 'tatiana',
    label: 'Tatiana',
    path: `${BASE}pieces/tatiana/{piece}.svg`,
    artTop: { default: 0.0996, R: 0.1582, P: 0.2227 },
    artBottom: { default: 0.0996, R: 0.1016 },
  },
}

/**
 * Путь к картинке фигуры конкретного набора.
 * Нужен превью наборов в настройках (там показываются все наборы сразу).
 */
export function getPieceSetUrl(pieceSetId: string, code: string): string {
  const pieceSet = PIECE_SETS[pieceSetId] || PIECE_SETS.tatiana
  return pieceSet.path.replace('{piece}', code)
}

/** Пиксель-арт (растр) рендерим без сглаживания, чтобы пиксели оставались чёткими. */
export function isPixelArtPieceSet(pieceSetId: string): boolean {
  return Boolean(PIECE_SETS[pieceSetId]?.pixelated)
}

/**
 * Высота фигуры в долях клетки, если набор задаёт её явно.
 * `null` — набор не задаёт высоты, картинка заполняет клетку целиком.
 */
export function getPieceSetHeight(pieceSetId: string, code: string): number | null {
  const heights = PIECE_SETS[pieceSetId]?.heights
  if (!heights) return null
  const height = heights[code[1]]
  return typeof height === 'number' ? height : null
}

/** Прозрачный низ самой картинки (доля её высоты). */
export function getPieceSetArtBottom(pieceSetId: string, code: string): number {
  const artBottom = PIECE_SETS[pieceSetId]?.artBottom
  if (!artBottom) return 0
  const value = artBottom[code[1]]
  const fallback = typeof artBottom.default === 'number' ? artBottom.default : 0
  return typeof value === 'number' ? value : fallback
}

/** Прозрачный верх самой картинки (доля её высоты). */
export function getPieceSetArtTop(pieceSetId: string, code: string): number {
  const artTop = PIECE_SETS[pieceSetId]?.artTop
  if (!artTop) return 0
  const value = artTop[code[1]]
  const fallback = typeof artTop.default === 'number' ? artTop.default : 0
  return typeof value === 'number' ? value : fallback
}

/**
 * Сдвиг картинки вверх от низа клетки в долях клетки.
 * Считается так, чтобы видимый низ фигуры у всех наборов стоял на одной базе —
 * `STANDARD_BOTTOM_GAP` от низа клетки (стандарт — набор Tatiana).
 *
 * Формула одна для всех наборов: картинка сдвигается настолько, чтобы её
 * прозрачный низ (artBottom) компенсировался. У наборов без явных высот
 * картинка занимает всю клетку (height = 1), у наборов с `heights` — часть
 * клетки, поэтому поле масштабируется вместе с картинкой.
 */
export function getPieceBottomMargin(pieceSetId: string, code: string): number {
  const height = getPieceSetHeight(pieceSetId, code) ?? 1
  return STANDARD_BOTTOM_GAP - getPieceSetArtBottom(pieceSetId, code) * height
}

/** Отступ видимого низа фигуры от нижней границы клетки (в долях клетки). */
export function getPieceBottomGap(pieceSetId: string, code: string): number {
  const height = getPieceSetHeight(pieceSetId, code) ?? 1
  return getPieceBottomMargin(pieceSetId, code) + getPieceSetArtBottom(pieceSetId, code) * height
}

/**
 * Отступ видимого верха фигуры от верхней границы клетки (в долях клетки).
 * Определяется высотой картинки и её прозрачными полями.
 */
export function getPieceTopGap(pieceSetId: string, code: string): number {
  const height = getPieceSetHeight(pieceSetId, code) ?? 1
  const content = height * (1 - getPieceSetArtTop(pieceSetId, code) - getPieceSetArtBottom(pieceSetId, code))
  return 1 - STANDARD_BOTTOM_GAP - content
}

interface BoardState {
  selectedTheme: string
  selectedPieceSet: string
  setSelectedTheme: (theme: string) => void
  setSelectedPieceSet: (pieceSet: string) => void
  getTheme: () => BoardTheme
  getPieceUrl: (code: string) => string
  isPixelArt: () => boolean
  pieceHeight: (code: string) => number | null
  pieceBottomMargin: (code: string) => number
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
      selectedTheme: 'chesscom',
      selectedPieceSet: 'tatiana',

      setSelectedTheme: (theme) => set({ selectedTheme: BOARD_THEMES[theme] ? theme : 'chesscom' }),
      setSelectedPieceSet: (pieceSet) => set({ selectedPieceSet: PIECE_SETS[pieceSet] ? pieceSet : 'tatiana' }),

      getTheme: () => {
        const { selectedTheme } = get()
        return BOARD_THEMES[selectedTheme] || BOARD_THEMES.chesscom
      },

      getPieceUrl: (code) => {
        const { selectedPieceSet } = get()
        return getPieceSetUrl(selectedPieceSet, code)
      },

      isPixelArt: () => isPixelArtPieceSet(get().selectedPieceSet),
      pieceHeight: (code) => getPieceSetHeight(get().selectedPieceSet, code),
      pieceBottomMargin: (code) => getPieceBottomMargin(get().selectedPieceSet, code),
    }),
    {
      name: 'gochess-board-settings',
      // У пользователя в localStorage мог остаться удалённый набор фигур —
      // откатываем на стандартный, иначе в настройках не выбрана ни одна плитка.
      merge: (persisted, current) => {
        const state = { ...current, ...(persisted as Partial<BoardState> | undefined) }
        if (!BOARD_THEMES[state.selectedTheme]) state.selectedTheme = 'chesscom'
        if (!PIECE_SETS[state.selectedPieceSet]) state.selectedPieceSet = 'tatiana'
        return state
      },
    }
  )
)
