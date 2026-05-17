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
  const cleanPath = savedPath.replace(/^\/gochess/, '') || '/'
  if (cleanPath !== '/' && cleanPath !== window.location.pathname) {
    window.history.replaceState(null, '', basename + cleanPath)
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
