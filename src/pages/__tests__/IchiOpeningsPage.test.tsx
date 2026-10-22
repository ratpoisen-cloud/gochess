import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/Toast'
import IchiOpeningsPage from '../IchiOpeningsPage'
import { useOpeningStore } from '@/stores/openingStore'

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
  default: ({ position }: any) => (
    <div data-testid="mock-chessboard" data-position={position} />
  )
}))

function renderOpenings(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <IchiOpeningsPage />
      </ToastProvider>
    </MemoryRouter>
  )
}

describe('IchiOpeningsPage — режим и блок дебютов из хаба', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useOpeningStore.getState().setFamily('all')
  })

  afterEach(() => {
    cleanup()
  })

  it('по умолчанию открывает тренажёр', () => {
    renderOpenings('/bot/openings')

    expect(screen.getByText('Линия дебюта')).toBeTruthy()
    expect(screen.queryByText('Каталог дебютов')).toBeNull()
  })

  it('режим reference открывает справочник', () => {
    renderOpenings('/bot/openings?mode=reference&family=semi-open')

    expect(screen.getByText('Каталог дебютов')).toBeTruthy()
    expect(screen.getByText('В начало')).toBeTruthy()
    expect(screen.queryByText('Линия дебюта')).toBeNull()
  })

  it('применяет блок дебютов из адреса', () => {
    renderOpenings('/bot/openings?mode=reference&family=semi-open')

    expect(useOpeningStore.getState().selectedFamily).toBe('semi-open')
  })
})
