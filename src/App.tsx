import { Routes, Route } from 'react-router-dom'
import LobbyPage from './pages/LobbyPage'
import GamePage from './pages/GamePage'
import BotPage from './pages/BotPage'
import SettingsPage from './pages/SettingsPage'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<LobbyPage />} />
        <Route path="/game/:roomId" element={<GamePage />} />
        <Route path="/bot" element={<BotPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </ErrorBoundary>
  )
}

export default App
