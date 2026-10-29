import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/nunito'
import '@fontsource-variable/source-serif-4'
import './styles/base.css'
import './styles/feed.css'
import './styles/widgets.css'
import './styles/settings.css'
import './styles/reader.css'
import './styles/responsive.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
