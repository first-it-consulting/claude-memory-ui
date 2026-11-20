import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// biome-ignore lint/style/noNonNullAssertion: #root exists in index.html - standard Vite entry pattern
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
