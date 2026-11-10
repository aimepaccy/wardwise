import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Typed notes were removed in favour of photos. Clear any typed draft an older version left in this browser.
try {
  localStorage.removeItem('lucy-notes-draft')
} catch {
  // Storage is blocked; there is nothing to clear.
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
