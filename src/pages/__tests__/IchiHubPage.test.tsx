import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import IchiHubPage from '../IchiHubPage'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false })
}))

// jsdom не умеет проигрывать звук: мок нужен, чтобы клик по плитке
// не ронял тест на soundManager.unlock.
vi.mock('@/lib/soundManager', () => ({
  soundManager: {
    play: vi.fn(),
    setEnabled: vi.fn(),
    setVolume: vi.fn(),
  }
}))

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

function renderHub() {
  render(
    <MemoryRouter>
      <LocationProbe />
      <IchiHubPage />
    </MemoryRouter>
  )
}

/** Клик по плитке хаба (заголовок раздела лежит внутри кнопки). */
function clickTile(title: string) {
  const tile = screen.getByText(title).closest('button')
  expect(tile).toBeTruthy()
  fireEvent.click(tile as HTMLButtonElement)
}

describe('IchiHubPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders all Ichi modes: Play, Training, Puzzles and Openings', () => {
    renderHub()

    expect(screen.getByText('Игра')).toBeTruthy()
    expect(screen.getByText('Обучение')).toBeTruthy()
    expect(screen.getByText('Пазлы')).toBeTruthy()
    expect(screen.getByText('Дебюты')).toBeTruthy()

    // Images check
    const trainingImg = screen.getByAltText(/обучение/i)
    expect(trainingImg.getAttribute('src')).toContain('Emojis_48x48_130.png')

    const puzzlesImg = screen.getByAltText(/пазлы/i)
    expect(puzzlesImg.getAttribute('src')).toContain('Emojis_48x48_281.png')
  })

  it('плитка «Игра» открывает выбор цвета и сложности', () => {
    renderHub()

    clickTile('Игра')

    expect(screen.getByText('Партия с Ичи')).toBeTruthy()
    expect(screen.getByText('Ваш цвет')).toBeTruthy()
    expect(screen.getByText('Сложность')).toBeTruthy()
  })

  it('выбор сложности в игре ведёт на страницу партии с параметрами', () => {
    renderHub()

    clickTile('Игра')
    fireEvent.click(screen.getByText('Средний'))

    expect(screen.getByTestId('location').textContent).toBe('/bot?color=w&level=medium')
  })

  it('меню обучения предлагает дебют и сложность', () => {
    renderHub()

    clickTile('Обучение')

    expect(screen.getByText('Тренировка с Ичи')).toBeTruthy()
    expect(screen.getByText('Выберите дебют и сложность соперника')).toBeTruthy()
    expect(screen.getByText('Итальянская защита')).toBeTruthy()

    fireEvent.click(screen.getByText('Средний'))
    expect(screen.getByTestId('location').textContent).toBe('/bot/training?level=medium')
  })

  it('меню пазлов показывает блоки задач', () => {
    renderHub()

    clickTile('Пазлы')
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Выберите блок задач')).toBeTruthy()

    fireEvent.click(screen.getByText('Мат в 1 ход'))
    expect(screen.getByTestId('location').textContent).toBe('/bot/puzzles?category=mate_in_1')
  })

  it('меню дебютов предлагает тренажёр и блоки дебютов', () => {
    renderHub()

    clickTile('Дебюты')
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Тренажёр')).toBeTruthy()
    expect(screen.getByText('Дебюты за белых')).toBeTruthy()
    expect(screen.getByText('Дебюты за чёрных')).toBeTruthy()

    fireEvent.click(screen.getByText('Тренажёр'))
    expect(screen.getByTestId('location').textContent).toBe('/bot/openings?mode=trainer&family=all')
  })
})
