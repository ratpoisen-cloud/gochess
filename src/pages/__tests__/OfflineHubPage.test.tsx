import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import OfflineHubPage from '../OfflineHubPage'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false })
}))

vi.mock('@/lib/firebase', () => ({
  db: null
}))

describe('OfflineHubPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders all four offline modes: Classic, Rapid, Magic, and Atomic', () => {
    render(
      <MemoryRouter>
        <OfflineHubPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Классика')).toBeTruthy()
    expect(screen.getByText('Рапид')).toBeTruthy()
    expect(screen.getByText('Магия')).toBeTruthy()
    expect(screen.getByText('Атомные')).toBeTruthy()

    const links = screen.getAllByRole('link')
    const hrefs = links.map(l => l.getAttribute('href'))

    expect(hrefs).toContain('/local/classic')
    expect(hrefs).toContain('/local/rapid')
    expect(hrefs).toContain('/local/spell')
    expect(hrefs).toContain('/local/atomic')
  })
})
