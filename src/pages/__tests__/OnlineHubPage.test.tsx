import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/Toast'
import OnlineHubPage from '../OnlineHubPage'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false })
}))

vi.mock('@/hooks/usePresence', () => ({
  usePresence: () => {}
}))

vi.mock('@/hooks/useChallenges', () => ({
  useChallenges: () => ({
    incomingChallenges: [],
    acceptChallenge: vi.fn(),
    declineChallenge: vi.fn(),
    sendChallenge: vi.fn(),
    now: Date.now()
  })
}))

vi.mock('@/lib/firebase', () => ({
  db: null
}))

describe('OnlineHubPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders Classic and Rapid modes', () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <OnlineHubPage />
        </ToastProvider>
      </MemoryRouter>
    )

    expect(screen.getByText('Классика')).toBeTruthy()
    expect(screen.getByText('Рапид')).toBeTruthy()
    expect(screen.getByText(/Стандартные правила/i)).toBeTruthy()
    expect(screen.getByText(/Быстрая игра с контролем времени/i)).toBeTruthy()
  })
})
