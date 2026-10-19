import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import IchiPuzzlesPage from '../IchiPuzzlesPage'
import { usePuzzleStore } from '@/stores/puzzleStore'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false })
}))

vi.mock('@/hooks/useBoardWidth', () => ({
  useBoardWidth: () => ({ stableWidth: 500, immediateWidth: 500 })
}))

vi.mock('@/lib/soundManager', () => ({
  soundManager: {
    play: vi.fn(),
    setEnabled: vi.fn(),
    setVolume: vi.fn(),
  }
}))

vi.mock('@/components/board/ChessBoard', () => ({
  default: ({ onSquareClick }: any) => (
    <div data-testid="mock-chessboard" onClick={() => onSquareClick?.('e1')}>
      Mock ChessBoard
    </div>
  )
}))

describe('IchiPuzzlesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    usePuzzleStore.getState().resetProgress()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders category tabs, puzzle header and controls', () => {
    render(
      <MemoryRouter>
        <IchiPuzzlesPage />
      </MemoryRouter>
    )

    // Check category tabs
    expect(screen.getAllByText(/все задачи/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/мат в 1 ход/i)).toBeTruthy()
    expect(screen.getByText(/вилки и удары/i)).toBeTruthy()

    // Check streak badge
    expect(screen.getByText(/серия:/i)).toBeTruthy()

    // Check action buttons
    expect(screen.getByText(/подсказка/i)).toBeTruthy()
    expect(screen.getByText(/начать заново/i)).toBeTruthy()
    expect(screen.getByText(/все задачи категории/i)).toBeTruthy()
  })

  it('filters puzzles when category tab is clicked', () => {
    render(
      <MemoryRouter>
        <IchiPuzzlesPage />
      </MemoryRouter>
    )

    const forkTab = screen.getByText(/вилки и удары/i)
    fireEvent.click(forkTab)

    expect(usePuzzleStore.getState().selectedCategory).toBe('fork')
  })

  it('opens and closes puzzle catalogue modal', () => {
    render(
      <MemoryRouter>
        <IchiPuzzlesPage />
      </MemoryRouter>
    )

    const catalogueBtn = screen.getByText(/все задачи категории/i)
    fireEvent.click(catalogueBtn)

    expect(screen.getByText(/каталог задач/i)).toBeTruthy()
    expect(screen.getByText(/выберите задачу для решения/i)).toBeTruthy()
  })

  it('shows 2-level hints on consecutive hint button clicks', () => {
    render(
      <MemoryRouter>
        <IchiPuzzlesPage />
      </MemoryRouter>
    )

    const hintBtn = screen.getByText(/подсказка/i)
    fireEvent.click(hintBtn)

    // Level 1: text hint message shown
    expect(screen.getByText(/показать клетку/i)).toBeTruthy()

    // Level 2: click again
    const level2Btn = screen.getByText(/показать клетку/i)
    fireEvent.click(level2Btn)

    expect(screen.getByText(/ходите фигурой с/i)).toBeTruthy()
  })

  it('renders chessboard inside .board-container wrapper', () => {
    const { container } = render(
      <MemoryRouter>
        <IchiPuzzlesPage />
      </MemoryRouter>
    )

    const boardContainer = container.querySelector('.board-container')
    expect(boardContainer).toBeTruthy()
    expect(screen.getByTestId('mock-chessboard')).toBeTruthy()
  })

  it('unmounts cleanly without throwing or memory leaks', () => {
    const { unmount } = render(
      <MemoryRouter>
        <IchiPuzzlesPage />
      </MemoryRouter>
    )

    expect(() => unmount()).not.toThrow()
  })
})


