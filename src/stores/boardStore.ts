import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const BASE = import.meta.env.BASE_URL || '/'

export interface BoardTheme {
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

export interface PieceSet {
  id: string
  label: string
  path: string
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
  tatiana: {
    id: 'tatiana',
    label: 'Tatiana',
    path: `${BASE}pieces/tatiana/{piece}.svg`,
  },
}

const PIECE_CODES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'] as const
type PieceCode = (typeof PIECE_CODES)[number]

interface BoardState {
  selectedTheme: string
  selectedPieceSet: string
  setSelectedTheme: (theme: string) => void
  setSelectedPieceSet: (pieceSet: string) => void
  getTheme: () => BoardTheme
  getPieceUrl: (color: 'w' | 'b', type: 'K' | 'Q' | 'R' | 'B' | 'N' | 'P') => string
  getAllPieceUrls: () => Record<string, { mountSquare: string; dropSquare: string; transformationSquare: string }>
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

      getPieceUrl: (color, type) => {
        const { selectedPieceSet } = get()
        const pieceSet = PIECE_SETS[selectedPieceSet] || PIECE_SETS.tatiana
        const code = `${color}${type}` as PieceCode
        return pieceSet.path.replace('{piece}', code)
      },

      getAllPieceUrls: () => {
        const { getPieceUrl } = get()
        const urls: Record<string, { mountSquare: string; dropSquare: string; transformationSquare: string }> = {}
        const pieces: Array<{ color: 'w' | 'b'; type: 'K' | 'Q' | 'R' | 'B' | 'N' | 'P' }> = [
          { color: 'w', type: 'K' }, { color: 'w', type: 'Q' }, { color: 'w', type: 'R' },
          { color: 'w', type: 'B' }, { color: 'w', type: 'N' }, { color: 'w', type: 'P' },
          { color: 'b', type: 'K' }, { color: 'b', type: 'Q' }, { color: 'b', type: 'R' },
          { color: 'b', type: 'B' }, { color: 'b', type: 'N' }, { color: 'b', type: 'P' },
        ]
        pieces.forEach(({ color, type }) => {
          const url = getPieceUrl(color, type)
          urls[`${color}${type}`] = {
            mountSquare: url,
            dropSquare: url,
            transformationSquare: url,
          }
        })
        return urls
      },
    }),
    {
      name: 'gochess-board-settings',
    }
  )
)
