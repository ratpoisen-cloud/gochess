import { Routes, Route } from 'react-router-dom'
import LobbyPage from './pages/LobbyPage'
import BotPage from './pages/BotPage'
import LocalPage from './pages/LocalPage'
import SettingsPage from './pages/SettingsPage'
import AgentLogsPage from './pages/AgentLogsPage'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<LobbyPage />} />
        <Route path="/bot" element={<BotPage />} />
        <Route path="/local" element={<LocalPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/agent-logs" element={<AgentLogsPage />} />
      </Routes>
    </ErrorBoundary>
  )
}

export default App
