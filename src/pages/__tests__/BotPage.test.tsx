import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { ToastProvider } from '@/components/Toast'
import BotPage from '../BotPage'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false })
}))

vi.mock('@/lib/botEngine', () => ({
  createBotEngine: () => ({
    getBestMove: vi.fn().mockResolvedValue(null),
    destroy: vi.fn(),
  })
}))

vi.mock('@/hooks/useBoardWidth', () => ({
  useBoardWidth: () => ({ stableWidth: 500, immediateWidth: 500 })
}))

vi.mock('@/components/board/ChessBoard', () => ({
  default: () => <div data-testid="mock-chessboard">Mock ChessBoard</div>
}))

vi.mock('@/lib/soundManager', () => ({
  soundManager: {
    play: vi.fn(),
    setEnabled: vi.fn(),
    setVolume: vi.fn(),
  }
}))

vi.mock('@/lib/firebase', () => ({
  db: null
}))

function LocationProbe() {
  const location = useLocation()
  return (
    <>
      <div data-testid="location">{location.pathname}</div>
      <div data-testid="search">{location.search}</div>
    </>
  )
}

function renderBot(entry = '/bot') {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <ToastProvider>
        <LocationProbe />
        <BotPage />
      </ToastProvider>
    </MemoryRouter>
  )
}

describe('BotPage — навигация', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('«Отмена» в настройке партии возвращает в хаб Ичи, а не в главное лобби', () => {
    renderBot()

    // Раздел «Игра» живёт под /ichi, поэтому отмена ведёт в /ichi.
    fireEvent.click(screen.getByText('Отмена'))

    expect(screen.getByTestId('location').textContent).toBe('/ichi')
  })

  it('в боковой колонке есть кнопка «Назад к Ичи»', () => {
    renderBot()

    const back = screen.getByText('Назад к Ичи')
    expect(back).toBeTruthy()

    fireEvent.click(back)
    expect(screen.getByTestId('location').textContent).toBe('/ichi')
  })

  it('параметры хаба (?color=&level=) сразу начинают партию без модалки', () => {
    renderBot('/bot?color=b&level=hard')

    // Модалка настройки закрыта — партия уже начата.
    expect(screen.queryByText('Отмена')).toBeNull()
    expect(screen.getByText(/Ичи сильный/)).toBeTruthy()

    // Параметры убраны из адреса: перезагрузка не начнёт партию заново.
    expect(screen.getByTestId('search').textContent).toBe('')
  })
})
