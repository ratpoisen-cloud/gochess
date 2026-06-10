import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import LobbyPage from './pages/LobbyPage'
import LoadingScreen from './components/LoadingScreen'
import ErrorBoundary from './components/ErrorBoundary'

const GamePage = lazy(() => import('./pages/GamePage'))
const BotPage = lazy(() => import('./pages/BotPage'))
const LocalPage = lazy(() => import('./pages/LocalPage'))
const OnlineHubPage = lazy(() => import('./pages/OnlineHubPage'))
const CompletedGamesPage = lazy(() => import('./pages/CompletedGamesPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen isLoading={true} />}>
        <Routes>
          <Route path="/" element={<LobbyPage />} />
          <Route path="/game/:roomCode" element={<GamePage />} />
          <Route path="/online" element={<OnlineHubPage />} />
          <Route path="/completed" element={<CompletedGamesPage />} />
          <Route path="/bot" element={<BotPage />} />
          <Route path="/local" element={<LocalPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
