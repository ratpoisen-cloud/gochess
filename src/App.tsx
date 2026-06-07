import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import LobbyPage from './pages/LobbyPage'
import LoadingScreen from './components/LoadingScreen'
import ErrorBoundary from './components/ErrorBoundary'

const GamePage = lazy(() => import('./pages/GamePage'))
const BotPage = lazy(() => import('./pages/BotPage'))
const LocalPage = lazy(() => import('./pages/LocalPage'))
const OnlineHubPage = lazy(() => import('./pages/OnlineHubPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AgentLogsPage = lazy(() => import('./pages/AgentLogsPage'))

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen isLoading={true} />}>
        <Routes>
          <Route path="/" element={<LobbyPage />} />
          <Route path="/game/:roomCode" element={<GamePage />} />
          <Route path="/online" element={<OnlineHubPage />} />
          <Route path="/bot" element={<BotPage />} />
          <Route path="/local" element={<LocalPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/agent-logs" element={<AgentLogsPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
