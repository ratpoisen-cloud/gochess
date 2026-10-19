import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/Toast'
import ArcadeHubPage from '../ArcadeHubPage'

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

describe('ArcadeHubPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders all three arcade modes: Spell Chess, Atomic Chess, and Fog of War', () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <ArcadeHubPage />
        </ToastProvider>
      </MemoryRouter>
    )

    expect(screen.getByText('Магия')).toBeTruthy()
    expect(screen.getByText('Атомные')).toBeTruthy()
    expect(screen.getByText('Туман войны')).toBeTruthy()
    expect(screen.getByText('Свиток правил магии')).toBeTruthy()
  })
})
