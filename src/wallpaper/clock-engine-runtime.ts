import { cameraFrom } from '../scene/timeline'
import {
  CAMERA_PRESETS,
  CLOCK_ART_LIBRARY,
  COMPOSITIONS,
  SCENE_PRESETS,
  VIEW_DIRECTORS,
  type ClockArtName,
  type ScenePresetId,
} from './presets'

const KEY = 'schwarzschild-wallpaper'
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

type Stored = {
  sceneMode?: 'preset' | 'custom'
  scenePreset?: ScenePresetId
  bar?: boolean
  clock?: 'off' | '24' | '12'
  custom?: {
    basePreset?: ScenePresetId
    framing?: number
    shiftX?: number
    shiftY?: number
    roll?: number
    tilt?: number
    zoom?: number
    drift?: number
    parallax?: number
    clockArt?: 'auto' | ClockArtName
    clockScale?: number
    clockNear?: number
    clockDepth?: number
  }
}

type V3 = [number, number, number]

const n = (v: unknown, fallback: number) => Number.isFinite(Number(v)) ? Number(v) : fallback
const validPreset = (v: unknown): v is ScenePresetId =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(SCENE_PRESETS, v)
const validArt = (v: unknown): v is ClockArtName =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(CLOCK_ART_LIBRARY, v)

function rollBasis(right: V3, up: V3, degrees: number) {
  const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a)
  return {
    right: [right[0] * c + up[0] * s, right[1] * c + up[1] * s, right[2] * c + up[2] * s] as V3,
    up: [up[0] * c - right[0] * s, up[1] * c - right[1] * s, up[2] * c - right[2] * s] as V3,
  }
}

function readStored(): Stored {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Stored } catch { return {} }
}

function resolve(s: Stored) {
  const custom = s.sceneMode === 'custom'
  const c = s.custom ?? {}
  const presetId = custom && validPreset(c.basePreset)
    ? c.basePreset
    : validPreset(s.scenePreset) ? s.scenePreset : 'signature'
  const preset = SCENE_PRESETS[presetId]
  const comp = COMPOSITIONS[preset.composition]
  const framing = custom ? .72 + n(c.framing, .5) * .56 : 1
  const shiftX = custom ? (n(c.shiftX, .5) - .5) * .70 : 0
  const shiftY = custom ? (n(c.shiftY, .5) - .5) * .60 : 0
  const roll = custom ? (n(c.roll, .5) - .5) * 30 : 0
  const artName: ClockArtName = custom && c.clockArt !== 'auto' && validArt(c.clockArt)
    ? c.clockArt : preset.clockArt
  const baseArt = CLOCK_ART_LIBRARY[artName]
  const art = custom ? {
    ...baseArt,
    scale: baseArt.scale * (.72 + n(c.clockScale, .5) * .56),
    near: clamp(baseArt.near + (n(c.clockNear, .5) - .5) * .70, 0, 1),
    depth: clamp(baseArt.depth + (n(c.clockDepth, .5) - .5) * .90, 0, 1),
  } : baseArt
  return {
    custom, preset, art,
    composition: { dist: comp.dist * framing, shift: [comp.shift[0] + shiftX, comp.shift[1] + shiftY] as [number, number], roll: comp.roll + roll },
    tilt: custom ? n(c.tilt, .5) : .5,
    zoom: custom ? n(c.zoom, .5) : .5,
    drift: custom ? n(c.drift, .46) : .46,
    parallax: custom ? n(c.parallax, .52) : .52,
  }
}

function addExperimentalOption(settings: Stored) {
  const folds = Array.from(document.querySelectorAll<HTMLDetailsElement>('.wp-fold'))
  const fold = folds.find((el) => el.querySelector('summary')?.textContent?.trim() === 'clock composition')
  const grid = fold?.querySelector<HTMLElement>('.wopts.wgrid3')
  if (!grid || grid.querySelector('[data-runtime-relativistic]')) return
  const opt = document.createElement('span')
  opt.className = `opt${settings.custom?.clockArt === 'relativistic' ? ' on' : ''}`
  opt.textContent = 'relativistic'
  opt.dataset.runtimeRelativistic = '1'
  opt.setAttribute('role', 'button')
  opt.tabIndex = 0
  const choose = () => {
    const w = window as typeof window & { wallpaperPropertyListener?: { applyUserProperties?: (p: Record<string, { value: unknown }>) => void } }
    w.wallpaperPropertyListener?.applyUserProperties?.({ customclockart: { value: 'relativistic' } })
  }
  opt.onclick = choose
  opt.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') choose() }
  grid.appendChild(opt)
}

let ptxT = 0, ptyT = 0, ptx = 0, pty = 0, azim = .6
let last = performance.now(), lastRead = 0
let stored: Stored = readStored()

window.addEventListener('mousemove', (e) => {
  ptxT = e.clientX / Math.max(innerWidth, 1) * 2 - 1
  ptyT = e.clientY / Math.max(innerHeight, 1) * 2 - 1
}, { passive: true })

function tick(now: number) {
  requestAnimationFrame(tick)
  const dt = Math.min(now - last, 50); last = now
  if (now - lastRead > 120) { stored = readStored(); lastRead = now; addExperimentalOption(stored) }
  const node = document.querySelector<HTMLElement>('.wp-clock')
  if (!node || stored.clock === 'off') return

  const R = resolve(stored), P = CAMERA_PRESETS[R.preset.view], V = VIEW_DIRECTORS[R.preset.view]
  const w = innerWidth, h = innerHeight, portrait = w < h, compScale = portrait ? .56 : 1
  const damp = 1 - Math.exp(-dt / 1000 * 3.2)
  ptx += (ptxT - ptx) * damp; pty += (ptyT - pty) * damp
  azim += dt / 1000 * (.006 + R.drift * .03) * V.motion

  const dist = P.dist * R.composition.dist * V.framing * (1.35 - .7 * R.zoom)
  const incl = clamp(P.incl + (R.tilt - .5) * 20 + pty * 2.6 * R.parallax, 12, 89.8)
  const cam = cameraFrom(dist, incl, azim + ptx * .07 * R.parallax, P.fov)
  const roll = (R.composition.roll + V.roll) * (portrait ? .72 : 1)
  const basis = rollBasis(cam.right as V3, cam.up as V3, roll)
  let thf = cam.tanHalfFov; if (portrait) thf *= h / w
  const lensShift: [number, number] = [
    (R.composition.shift[0] + V.shift[0]) * compScale + ptx * .024 * R.parallax,
    (R.composition.shift[1] + V.shift[1]) * compScale - pty * .018 * R.parallax,
  ]
  const holeX = (.5 + lensShift[0] * .5) * w, holeY = (.5 - lensShift[1] * .5) * h
  const shortEdge = Math.min(w, h), shadowR = clamp((5.196 / Math.max(dist, 5.5) / Math.max(thf, .055)) * h * .5, 26, shortEdge * .30)
  const sx = basis.up[1], sy = -basis.right[1], sl = Math.hypot(sx, sy)
  const axis = sl > 1e-4 ? [sx / sl, sy / sl] : [1, 0]
  const axisDeg = Math.atan2(axis[1], axis[0]) * 180 / Math.PI
  const engine = R.art.engine
  node.dataset.engine = engine
  node.dataset.bar = stored.bar === false ? 'off' : 'on'
  node.style.setProperty('--hole-x', `${holeX.toFixed(1)}px`)
  node.style.setProperty('--hole-y', `${holeY.toFixed(1)}px`)
  node.style.setProperty('--shadow-r', `${shadowR.toFixed(1)}px`)
  node.style.setProperty('--axis-angle', `${axisDeg.toFixed(2)}deg`)

  const factors = { monument: .18, eclipse: .105, blade: .105, orbit: .082, depth: .12, relativistic: .105, quiet: .064 } as const
  const engineSize = clamp(shortEdge * factors[engine] * R.art.scale, engine === 'monument' ? 92 : 44, engine === 'monument' ? 260 : 150)
  node.style.setProperty('--engine-size', `${engineSize.toFixed(1)}px`)

  const subjectRight = holeX > w * .5, subjectLow = holeY > h * .52
  node.style.setProperty('--monument-hx', `${(subjectRight ? clamp(w * .04, 8, 80) : clamp(w - engineSize * 1.55, 8, w - 40)).toFixed(1)}px`)
  node.style.setProperty('--monument-hy', `${(subjectLow ? clamp(h * .04, 8, 70) : clamp(h - engineSize * .9, 8, h - 40)).toFixed(1)}px`)
  node.style.setProperty('--monument-mx', `${(subjectRight ? clamp(w - engineSize * 1.48, 8, w - 40) : clamp(w * .04, 8, 80)).toFixed(1)}px`)
  node.style.setProperty('--monument-my', `${(subjectLow ? clamp(h - engineSize * .82, 8, h - 40) : clamp(h * .58, 8, h - 40)).toFixed(1)}px`)
  const metaX = subjectRight ? clamp(w * .04, 18, 76) : clamp(w - Math.min(w * .28, 360) - clamp(w * .04, 18, 76), 18, w - 180)
  node.style.setProperty('--meta-x', `${metaX.toFixed(1)}px`)
  node.style.setProperty('--meta-y', `${(subjectLow ? h - clamp(h * .06, 34, 82) : clamp(h * .08, 34, 90)).toFixed(1)}px`)

  const bladeSpan = clamp(shadowR * 2.15, 82, shortEdge * .38)
  node.style.setProperty('--blade-span', `${bladeSpan.toFixed(1)}px`)
  node.style.setProperty('--blade-width', `${(bladeSpan * 2).toFixed(1)}px`)
  const orbitR = clamp(shadowR * 1.62, 70, shortEdge * .28), phase = (new Date().getSeconds() + new Date().getMilliseconds() / 1000) / 60
  const oa = -Math.PI * .82 + phase * Math.PI * 1.64
  node.style.setProperty('--orbit-r', `${orbitR.toFixed(1)}px`)
  node.style.setProperty('--orbit-d', `${(orbitR * 2).toFixed(1)}px`)
  node.style.setProperty('--orbit-dot-x', `${(holeX + Math.cos(oa) * orbitR).toFixed(1)}px`)
  node.style.setProperty('--orbit-dot-y', `${(holeY + Math.sin(oa) * orbitR).toFixed(1)}px`)
  node.style.setProperty('--eclipse-meta-y', `${(holeY + shadowR * 1.42).toFixed(1)}px`)
  node.style.setProperty('--eclipse-date-y', `${(holeY + shadowR * 1.72).toFixed(1)}px`)

  const sep = clamp(shadowR * 1.05, 64, shortEdge * .22)
  node.style.setProperty('--depth-hx', `${(holeX - sep - ptx * 9 * R.parallax).toFixed(1)}px`)
  node.style.setProperty('--depth-hy', `${(holeY - shadowR * .36 - pty * 6 * R.parallax).toFixed(1)}px`)
  node.style.setProperty('--depth-mx', `${(holeX + sep + ptx * 20 * R.parallax).toFixed(1)}px`)
  node.style.setProperty('--depth-my', `${(holeY + shadowR * .42 + pty * 16 * R.parallax).toFixed(1)}px`)

  const timeText = `${node.querySelector('.hour')?.textContent || ''}  ${node.querySelector('.minute')?.textContent || ''}`.trim()
  node.dataset.timeText = timeText
  node.style.setProperty('--rel-left', `${(holeX - shadowR * 1.35).toFixed(1)}px`)
  node.style.setProperty('--rel-right', `${(holeX + shadowR * 1.35).toFixed(1)}px`)
  node.style.setProperty('--rel-in', `${(shadowR * .91).toFixed(1)}px`)
  node.style.setProperty('--rel-core', `${(shadowR * .98).toFixed(1)}px`)
  node.style.setProperty('--rel-mid', `${(shadowR * 1.18).toFixed(1)}px`)
  node.style.setProperty('--rel-out', `${(shadowR * 1.31).toFixed(1)}px`)
  node.style.setProperty('--rel-up', `${(-shadowR * .18).toFixed(1)}px`)
  node.style.setProperty('--rel-down', `${(shadowR * .18).toFixed(1)}px`)
  node.style.setProperty('--rel-date-y', `${(holeY + shadowR * 1.72).toFixed(1)}px`)

  const relOpt = document.querySelector<HTMLElement>('[data-runtime-relativistic]')
  if (relOpt) relOpt.classList.toggle('on', stored.custom?.clockArt === 'relativistic')
}

requestAnimationFrame(tick)
