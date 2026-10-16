import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installGtm } from './gtm'

installGtm(import.meta.env.VITE_GTM_ID)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
