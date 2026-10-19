import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import IchiHubPage from '../IchiHubPage'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false })
}))

describe('IchiHubPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders all three Ichi modes: Play, Training, and Puzzles', () => {
    render(
      <MemoryRouter>
        <IchiHubPage />
      </MemoryRouter>
    )

    expect(screen.getByText(/игра/i)).toBeTruthy()
    expect(screen.getByText(/обучение/i)).toBeTruthy()
    expect(screen.getByText(/пазлы/i)).toBeTruthy()

    // Links check
    const links = screen.getAllByRole('link')
    const hrefs = links.map(l => l.getAttribute('href'))

    expect(hrefs).toContain('/bot')
    expect(hrefs).toContain('/bot/training')
    expect(hrefs).toContain('/bot/puzzles')
  })
})
