import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CompletedGamesPage from '../CompletedGamesPage'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'test-user-123' }, loading: false })
}))

vi.mock('@/lib/firebase', () => ({
  db: null
}))

describe('CompletedGamesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders both Active and Archive tabs and navigation to lobby', () => {
    render(
      <MemoryRouter initialEntries={['/completed']}>
        <CompletedGamesPage defaultTab="completed" />
      </MemoryRouter>
    )

    expect(screen.getByText(/активные/i)).toBeTruthy()
    expect(screen.getByText(/архив/i)).toBeTruthy()
    expect(screen.getByText(/назад в лобби/i)).toBeTruthy()
  })

  it('renders active tab by default when defaultTab is active', () => {
    render(
      <MemoryRouter initialEntries={['/active']}>
        <CompletedGamesPage defaultTab="active" />
      </MemoryRouter>
    )

    expect(screen.getByText(/активные/i)).toBeTruthy()
    expect(screen.getByText(/архив/i)).toBeTruthy()
  })
})
