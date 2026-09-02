import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles.css'
import './wallpaper.css'
import './clock-engines.css'
import './clock-expression.css'
import './clock-orbit-layout.css'
import './curated-scenes.css'
import './curated-layout.css'
import './curated-legibility.css'
import './panel-v2.css'
import './clock-engine-runtime'
import './clock-orbit-layout-runtime'
import './clock-expression-runtime'
import './curated-layout-runtime'
import './curated-legibility-runtime'
import './scene-model-runtime'
import Wallpaper from './Wallpaper'

createRoot(document.getElementById('root')!).render(
  <StrictMode><Wallpaper /></StrictMode>,
)
