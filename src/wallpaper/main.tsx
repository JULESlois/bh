import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles.css'
import './wallpaper.css'
import Wallpaper from './Wallpaper'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Wallpaper />
  </StrictMode>,
)
