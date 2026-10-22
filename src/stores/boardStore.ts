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
   * Отступ фигуры от края клетки, доля от размера клетки (0…0.2).
   * Нужен наборам, у которых картинка обрезана вплотную к фигуре:
   * без отступа король/ферзь упираются в границу поля.
   */
  inset?: number
}

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
  },
  chessnut: {
    id: 'chessnut',
    label: 'Chessnut',
    path: `${BASE}pieces/chessnut/{piece}.svg`,
  },
  pixel: {
    id: 'pixel',
    label: 'Pixel',
    path: `${BASE}pieces/pixel/{piece}.svg`,
  },
  pixel2: {
    id: 'pixel2',
    label: 'Pixel 2',
    path: `${BASE}pieces/pixel2/{piece}.png`,
    pixelated: true,
  },
  pixel3: {
    id: 'pixel3',
    label: 'Pixel 3',
    path: `${BASE}pieces/pixel3/{piece}.png`,
    pixelated: true,
    inset: 0.12,
  },
  tatiana: {
    id: 'tatiana',
    label: 'Tatiana',
    path: `${BASE}pieces/tatiana/{piece}.svg`,
  },
  neutrall: {
    id: 'neutrall',
    label: 'Neutral',
    path: `${BASE}pieces/neutrall/{piece}.png`,
    pixelated: true,
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

/** Отступ фигуры от края клетки в долях клетки (0 — вплотную). */
export function getPieceSetInset(pieceSetId: string): number {
  const inset = PIECE_SETS[pieceSetId]?.inset
  return typeof inset === 'number' ? inset : 0
}

interface BoardState {
  selectedTheme: string
  selectedPieceSet: string
  setSelectedTheme: (theme: string) => void
  setSelectedPieceSet: (pieceSet: string) => void
  getTheme: () => BoardTheme
  getPieceUrl: (code: string) => string
  isPixelArt: () => boolean
  pieceInset: () => number
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
      selectedTheme: 'chesscom',
      selectedPieceSet: 'tatiana',

      setSelectedTheme: (theme) => set({ selectedTheme: theme }),
      setSelectedPieceSet: (pieceSet) => set({ selectedPieceSet: pieceSet }),

      getTheme: () => {
        const { selectedTheme } = get()
        return BOARD_THEMES[selectedTheme] || BOARD_THEMES.chesscom
      },

      getPieceUrl: (code) => {
        const { selectedPieceSet } = get()
        return getPieceSetUrl(selectedPieceSet, code)
      },

      isPixelArt: () => isPixelArtPieceSet(get().selectedPieceSet),
      pieceInset: () => getPieceSetInset(get().selectedPieceSet),
    }),
    {
      name: 'gochess-board-settings',
    }
  )
)
