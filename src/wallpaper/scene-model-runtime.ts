import {
  OBSERVATION_VIEW_ORDER,
  OBSERVATION_VIEWS,
  isCustomView,
  type CustomViewId,
} from './presets'

const KEY = 'schwarzschild-wallpaper'

type Stored = {
  sceneMode?: 'preset' | 'custom'
  custom?: { view?: CustomViewId; basePreset?: string }
}

function readStored(): Stored {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Stored } catch { return {} }
}

function chooseView(value: CustomViewId) {
  const w = window as typeof window & {
    wallpaperPropertyListener?: { applyUserProperties?: (p: Record<string, { value: unknown }>) => void }
  }
  w.wallpaperPropertyListener?.applyUserProperties?.({ customview: { value } })
}

function tidyPresetCatalog() {
  for (const family of Array.from(document.querySelectorAll<HTMLElement>('.preset-family'))) {
    const grid = family.querySelector<HTMLElement>('.preset-grid')
    const count = grid?.querySelectorAll('.preset-card').length ?? 0
    family.style.display = count ? '' : 'none'
    if (count) {
      const title = family.querySelector<HTMLElement>('.preset-family-title')
      if (title) title.textContent = 'directed scenes'
    }
  }
  for (const label of Array.from(document.querySelectorAll<HTMLElement>('.base-label'))) {
    if (label.textContent?.includes('base preset')) label.textContent = 'base preset · composition / clock source'
  }
}

function ensureCustomViewControl(settings: Stored) {
  const folds = Array.from(document.querySelectorAll<HTMLDetailsElement>('.wp-fold'))
  const camera = folds.find((el) => el.querySelector('summary')?.textContent?.trim() === 'camera / framing')
  if (!camera) return

  let control = camera.querySelector<HTMLElement>('[data-custom-view-control]')
  if (!control) {
    control = document.createElement('div')
    control.className = 'wctl custom-view-control'
    control.dataset.customViewControl = '1'

    const label = document.createElement('div')
    label.className = 'wlab'
    const name = document.createElement('span')
    name.textContent = 'black-hole view'
    const current = document.createElement('b')
    current.dataset.customViewCurrent = '1'
    label.append(name, current)

    const opts = document.createElement('div')
    opts.className = 'wopts wgrid3'
    const values: CustomViewId[] = ['preset', ...OBSERVATION_VIEW_ORDER]
    for (const value of values) {
      const opt = document.createElement('span')
      opt.className = 'opt'
      opt.dataset.customView = value
      opt.setAttribute('role', 'button')
      opt.tabIndex = 0
      opt.textContent = value === 'preset' ? 'preset view' : OBSERVATION_VIEWS[value].label.toLowerCase()
      const activate = () => chooseView(value)
      opt.onclick = activate
      opt.onkeydown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') activate()
      }
      opts.appendChild(opt)
    }

    control.append(label, opts)
    camera.querySelector('summary')?.insertAdjacentElement('afterend', control)
  }

  const selected = isCustomView(settings.custom?.view) ? settings.custom!.view! : 'preset'
  const current = control.querySelector<HTMLElement>('[data-custom-view-current]')
  if (current) current.textContent = selected === 'preset' ? 'preset' : OBSERVATION_VIEWS[selected].label
  for (const opt of Array.from(control.querySelectorAll<HTMLElement>('[data-custom-view]'))) {
    opt.classList.toggle('on', opt.dataset.customView === selected)
  }
}

let last = 0
function tick(now: number) {
  requestAnimationFrame(tick)
  if (now - last < 140) return
  last = now
  tidyPresetCatalog()
  const settings = readStored()
  if (settings.sceneMode === 'custom') ensureCustomViewControl(settings)
}

requestAnimationFrame(tick)
