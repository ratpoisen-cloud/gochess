import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/Toast'
import IchiTrainingPage from '../IchiTrainingPage'
import { OPENINGS } from '@/lib/openingsData'
import { openingPositionFen, positionKey, START_FEN } from '@/lib/openings'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false })
}))

vi.mock('@/hooks/useBoardWidth', () => ({
  useBoardWidth: () => ({ stableWidth: 500, immediateWidth: 500 })
}))

vi.mock('@/lib/botEngine', () => ({
  createBotEngine: () => ({
    getBestMove: vi.fn().mockResolvedValue(null),
    destroy: vi.fn(),
  })
}))

vi.mock('@/components/board/ChessBoard', () => ({
  default: ({ position }: any) => (
    <div data-testid="mock-chessboard" data-position={position} />
  )
}))

function renderTraining(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <IchiTrainingPage />
      </ToastProvider>
    </MemoryRouter>
  )
}

function boardPosition(): string {
  const board = screen.getByTestId('mock-chessboard')
  return board.getAttribute('data-position') || ''
}

describe('IchiTrainingPage — дебют и сложность из хаба', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('без параметров тренирует стартовую позицию', () => {
    renderTraining('/bot/training')

    expect(positionKey(boardPosition())).toBe(positionKey(START_FEN))
    expect(screen.getByText(/Тренировка с Ичи/).textContent).toBe('Тренировка с Ичи')
  })

  it('ставит позицию в конце линии выбранного дебюта', () => {
    const opening = OPENINGS.find((item) => item.id === 'italian-game')!

    renderTraining('/bot/training?opening=italian-game&level=easy')

    expect(positionKey(boardPosition())).toBe(positionKey(openingPositionFen(opening)))
    expect(positionKey(boardPosition())).not.toBe(positionKey(START_FEN))
  })

  it('показывает выбранный дебют и сложность Ичи', () => {
    renderTraining('/bot/training?opening=italian-game&level=easy')

    const mentions = screen.getAllByText(/Итальянская защита/)
    expect(mentions.some((node) => (node.textContent || '').includes('C50'))).toBe(true)
    expect(screen.getAllByText('Лёгкий').length).toBeGreaterThan(0)
  })
})
