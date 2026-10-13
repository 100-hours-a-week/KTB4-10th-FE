import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './app/App.tsx'
import { initializeSentry } from './shared/lib/sentry.ts'
import { scheduleServiceWorkerRegistration } from './shared/lib/serviceWorker.ts'
import './styles/global.css'

initializeSentry()
scheduleServiceWorkerRegistration()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
