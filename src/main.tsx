import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import App from './App.tsx'
import './index.css'

const basename = import.meta.env.BASE_URL || '/'

// Restore SPA route after 404.html redirect on GitHub Pages
const savedPath = sessionStorage.getItem('gochess-redirect')
if (savedPath) {
  sessionStorage.removeItem('gochess-redirect')
  const cleanPath = savedPath.replace(new RegExp(`^${basename}`), '')
  const expectedPath = basename + (cleanPath || '')
  if (cleanPath !== undefined && window.location.pathname !== expectedPath) {
    window.history.replaceState(null, '', expectedPath)
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
