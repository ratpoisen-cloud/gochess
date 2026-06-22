import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import LobbyPage from './pages/LobbyPage'
import LoadingScreen from './components/LoadingScreen'
import ErrorBoundary from './components/ErrorBoundary'

const GamePage = lazy(() => import('./pages/GamePage'))
const BotPage = lazy(() => import('./pages/BotPage'))
const LocalPage = lazy(() => import('./pages/LocalPage'))
const OnlineHubPage = lazy(() => import('./pages/OnlineHubPage'))
const CompletedGamesPage = lazy(() => import('./pages/CompletedGamesPage'))
const OfflineHubPage = lazy(() => import('./pages/OfflineHubPage'))
const SpellLocalPage = lazy(() => import('./pages/SpellLocalPage'))
const AtomicLocalPage = lazy(() => import('./pages/AtomicLocalPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

function App() {
  const navigate = useNavigate()
  useEffect(() => {
    const saved = sessionStorage.getItem('gochess-redirect')
    if (saved) {
      sessionStorage.removeItem('gochess-redirect')
      navigate(saved)
    }
  }, [navigate])

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen isLoading={true} />}>
        <Routes>
          <Route path="/" element={<LobbyPage />} />
          <Route path="/game/:roomCode" element={<GamePage />} />
          <Route path="/online" element={<OnlineHubPage />} />
          <Route path="/offline" element={<OfflineHubPage />} />
          <Route path="/completed" element={<CompletedGamesPage />} />
          <Route path="/bot" element={<BotPage />} />
          <Route path="/local" element={<LocalPage />} />
          <Route path="/local/classic" element={<LocalPage />} />
          <Route path="/local/rapid" element={<LocalPage />} />
          <Route path="/local/spell" element={<SpellLocalPage />} />
          <Route path="/local/atomic" element={<AtomicLocalPage />} />
          <Route path="/spell-local" element={<SpellLocalPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
