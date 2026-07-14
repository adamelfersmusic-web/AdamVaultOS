import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/index.css'
import '@fontsource-variable/fraunces/index.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/views.css'
import './styles/graph.css'
import './styles/pages.css'
import './styles/canvas.css'
import './styles/ceremony.css'
import { init } from './lib/store'
import { initTheme } from './lib/theme'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'

initTheme() // before first paint — no dark flash on light mode
init()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
