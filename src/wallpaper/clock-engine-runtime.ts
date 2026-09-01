import { cameraFrom } from '../scene/timeline'
import {
  CAMERA_PRESETS,
  CLOCK_ART_LIBRARY,
  COMPOSITIONS,
  SCENE_PRESETS,
  VIEW_DIRECTORS,
  type ClockArtName,
  type ClockEngineName,
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
type Metrics = { w: number; h: number }
type Point = { x: number; y: number }

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
    composition: {
      dist: comp.dist * framing,
      shift: [comp.shift[0] + shiftX, comp.shift[1] + shiftY] as [number, number],
      roll: comp.roll + roll,
    },
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
    const w = window as typeof window & {
      wallpaperPropertyListener?: { applyUserProperties?: (p: Record<string, { value: unknown }>) => void }
    }
    w.wallpaperPropertyListener?.applyUserProperties?.({ customclockart: { value: 'relativistic' } })
  }
  opt.onclick = choose
  opt.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') choose() }
  grid.appendChild(opt)
}

const css = (node: HTMLElement, name: string, value: number | string, unit = 'px') =>
  node.style.setProperty(name, typeof value === 'number' ? `${value.toFixed(1)}${unit}` : value)

function metric(el: HTMLElement | null, fallbackSize: number): Metrics {
  if (!el) return { w: fallbackSize * 1.18, h: fallbackSize * .88 }
  return {
    w: Math.max(el.offsetWidth, fallbackSize * 1.05),
    h: Math.max(el.offsetHeight, fallbackSize * .72),
  }
}

function safePoint(p: Point, m: Metrics, w: number, h: number, safe: number): Point {
  const hx = Math.min(m.w * .5, Math.max((w - safe * 2) * .5, 0))
  const hy = Math.min(m.h * .5, Math.max((h - safe * 2) * .5, 0))
  return {
    x: clamp(p.x, safe + hx, w - safe - hx),
    y: clamp(p.y, safe + hy, h - safe - hy),
  }
}

function rayLimit(x: number, y: number, dx: number, dy: number, w: number, h: number, safe: number) {
  const limits: number[] = []
  if (dx > 1e-5) limits.push((w - safe - x) / dx)
  else if (dx < -1e-5) limits.push((safe - x) / dx)
  if (dy > 1e-5) limits.push((h - safe - y) / dy)
  else if (dy < -1e-5) limits.push((safe - y) / dy)
  return Math.max(0, Math.min(...limits.filter((v) => Number.isFinite(v) && v >= 0)))
}

function chooseMonument(
  holeX: number, holeY: number, axis: [number, number], shadowR: number,
  hm: Metrics, mm: Metrics, w: number, h: number, safe: number,
) {
  const corner = (left: boolean, top: boolean, m: Metrics): Point => ({
    x: left ? safe + m.w * .47 : w - safe - m.w * .47,
    y: top ? safe + m.h * .48 : h - safe - m.h * .48,
  })
  const defs = [
    { id: 0, left: true, top: true }, { id: 1, left: false, top: true },
    { id: 2, left: true, top: false }, { id: 3, left: false, top: false },
  ]
  const score = (p: Point) => {
    const dx = p.x - holeX, dy = p.y - holeY
    const radial = Math.hypot(dx, dy)
    const normal = Math.abs(dx * -axis[1] + dy * axis[0])
    const shadowPenalty = Math.max(shadowR * 1.75 - radial, 0) / Math.max(shadowR, 1)
    const diskPenalty = Math.max(shadowR * .82 - normal, 0) / Math.max(shadowR, 1)
    return radial / Math.max(Math.min(w, h), 1) + normal / Math.max(Math.min(w, h), 1) * .72
      - shadowPenalty * 2.4 - diskPenalty * 1.2
  }
  const ranked = defs.map((d) => ({ ...d, p: corner(d.left, d.top, hm) }))
    .sort((a, b) => score(b.p) - score(a.p))
  const hourPick = ranked[0]
  const minuteRanked = defs.map((d) => ({ ...d, p: corner(d.left, d.top, mm) }))
    .filter((d) => d.id !== hourPick.id)
    .sort((a, b) => {
      const oppositeA = Number(a.left !== hourPick.left) + Number(a.top !== hourPick.top)
      const oppositeB = Number(b.left !== hourPick.left) + Number(b.top !== hourPick.top)
      return (score(b.p) + oppositeB * .32) - (score(a.p) + oppositeA * .32)
    })
  return { hour: hourPick.p, minute: minuteRanked[0].p }
}

function pairAroundShadow(
  holeX: number, holeY: number, shadowR: number,
  hm: Metrics, mm: Metrics, w: number, h: number, safe: number, gap: number,
) {
  const horizontalRoom = Math.min(holeX - safe, w - safe - holeX)
  const neededHorizontal = shadowR + gap + Math.max(hm.w, mm.w)
  if (horizontalRoom >= neededHorizontal) {
    return {
      vertical: false,
      hour: safePoint({ x: holeX - shadowR - gap - hm.w * .5, y: holeY }, hm, w, h, safe),
      minute: safePoint({ x: holeX + shadowR + gap + mm.w * .5, y: holeY }, mm, w, h, safe),
    }
  }
  const above = holeY > h * .5
  const yA = above
    ? holeY - shadowR - gap - hm.h * .5
    : holeY + shadowR + gap + hm.h * .5
  const yB = above
    ? yA - gap - (hm.h + mm.h) * .55
    : yA + gap + (hm.h + mm.h) * .55
  return {
    vertical: true,
    hour: safePoint({ x: holeX, y: yB }, hm, w, h, safe),
    minute: safePoint({ x: holeX, y: yA }, mm, w, h, safe),
  }
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
  const shortEdge = Math.min(w, h)
  const safe = clamp(shortEdge * .035, 18, 54)
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
  const shadowR = clamp((5.196 / Math.max(dist, 5.5) / Math.max(thf, .055)) * h * .5, 26, shortEdge * .30)
  const sx = basis.up[1], sy = -basis.right[1], sl = Math.hypot(sx, sy)
  const axis: [number, number] = sl > 1e-4 ? [sx / sl, sy / sl] : [1, 0]
  const axisDeg = Math.atan2(axis[1], axis[0]) * 180 / Math.PI
  const engine: ClockEngineName = R.art.engine
  node.dataset.engine = engine
  node.dataset.bar = stored.bar === false ? 'off' : 'on'
  node.dataset.preset = R.preset.id
  css(node, '--hole-x', holeX)
  css(node, '--hole-y', holeY)
  css(node, '--shadow-r', shadowR)
  css(node, '--axis-angle', `${axisDeg.toFixed(2)}deg`, '')

  const factors = { monument: .155, eclipse: .098, blade: .092, orbit: .086, depth: .105, relativistic: .095, quiet: .064 } as const
  const engineSize = clamp(
    shortEdge * factors[engine] * R.art.scale,
    engine === 'monument' ? 82 : 42,
    engine === 'monument' ? Math.min(190, shortEdge * .24) : Math.min(132, shortEdge * .18),
  )
  css(node, '--engine-size', engineSize)

  // Force one layout pass after setting the actual type size. All subsequent
  // placement uses measured glyph boxes rather than assumed character widths.
  const hourEl = node.querySelector<HTMLElement>('.hour')
  const minuteEl = node.querySelector<HTMLElement>('.minute')
  const hm = metric(hourEl, engineSize)
  const mm = metric(minuteEl, engineSize)

  const setPair = (hour: Point, minute: Point) => {
    css(node, '--hour-x', hour.x); css(node, '--hour-y', hour.y)
    css(node, '--minute-x', minute.x); css(node, '--minute-y', minute.y)
  }

  if (engine === 'monument') {
    const p = chooseMonument(holeX, holeY, axis, shadowR, hm, mm, w, h, safe)
    setPair(p.hour, p.minute)
    const meta = safePoint({ x: p.hour.x, y: p.hour.y < h * .5 ? p.hour.y + hm.h * .9 : p.hour.y - hm.h * .9 }, { w: Math.min(w * .28, 320), h: 34 }, w, h, safe)
    css(node, '--meta-x', meta.x); css(node, '--meta-y', meta.y)
  } else if (engine === 'eclipse' || engine === 'relativistic') {
    const p = pairAroundShadow(holeX, holeY, shadowR, hm, mm, w, h, safe, engineSize * .18)
    setPair(p.hour, p.minute)
    node.dataset.pair = p.vertical ? 'vertical' : 'horizontal'
    const bottomY = clamp(holeY + shadowR + Math.max(engineSize * .95, 54), safe + 24, h - safe - 24)
    css(node, '--meta-x', clamp(holeX, safe + 80, w - safe - 80)); css(node, '--meta-y', bottomY)
  } else if (engine === 'blade') {
    const extent = Math.max(Math.hypot(hm.w, hm.h), Math.hypot(mm.w, mm.h)) * .52
    const plus = Math.max(rayLimit(holeX, holeY, axis[0], axis[1], w, h, safe) - extent, 0)
    const minus = Math.max(rayLimit(holeX, holeY, -axis[0], -axis[1], w, h, safe) - extent, 0)
    const desired = shadowR * 1.22 + engineSize * .62
    const sep = clamp(Math.min(desired, plus, minus), Math.min(shadowR * .92, desired), desired)
    const hour = safePoint({ x: holeX - axis[0] * sep, y: holeY - axis[1] * sep }, hm, w, h, safe)
    const minute = safePoint({ x: holeX + axis[0] * sep, y: holeY + axis[1] * sep }, mm, w, h, safe)
    setPair(hour, minute)
    css(node, '--blade-span', sep)
    css(node, '--blade-width', sep * 2)
    const normal: [number, number] = [-axis[1], axis[0]]
    const meta = safePoint({ x: holeX - axis[0] * sep + normal[0] * 34, y: holeY - axis[1] * sep + normal[1] * 34 }, { w: 220, h: 30 }, w, h, safe)
    css(node, '--meta-x', meta.x); css(node, '--meta-y', meta.y)
  } else if (engine === 'orbit') {
    const room = Math.max(46, Math.min(holeX - safe, w - safe - holeX, holeY - safe, h - safe - holeY))
    const orbitR = clamp(Math.min(shadowR * 1.58, room * .90), 46, shortEdge * .25)
    const topRoom = holeY - orbitR - safe
    const labelY = topRoom > engineSize * .85 ? holeY - orbitR - engineSize * .48 : holeY + orbitR + engineSize * .48
    const hour = safePoint({ x: holeX - hm.w * .58, y: labelY }, hm, w, h, safe)
    const minute = safePoint({ x: holeX + mm.w * .58, y: labelY }, mm, w, h, safe)
    setPair(hour, minute)
    css(node, '--orbit-r', orbitR); css(node, '--orbit-d', orbitR * 2)
    const nowDate = new Date(), phase = (nowDate.getSeconds() + nowDate.getMilliseconds() / 1000) / 60
    const oa = -Math.PI * .82 + phase * Math.PI * 1.64
    css(node, '--orbit-dot-x', holeX + Math.cos(oa) * orbitR)
    css(node, '--orbit-dot-y', holeY + Math.sin(oa) * orbitR)
    css(node, '--meta-x', clamp(holeX, safe + 80, w - safe - 80))
    css(node, '--meta-y', clamp(labelY + (labelY < holeY ? -engineSize * .72 : engineSize * .72), safe + 20, h - safe - 20))
  } else if (engine === 'depth') {
    const normal: [number, number] = [-axis[1], axis[0]]
    const sep = shadowR * 1.02 + engineSize * .48
    const parA = ptx * 8 * R.parallax, parB = ptx * 18 * R.parallax
    const hour = safePoint({ x: holeX - normal[0] * sep + parA, y: holeY - normal[1] * sep + pty * 5 * R.parallax }, hm, w, h, safe)
    const minute = safePoint({ x: holeX + normal[0] * sep + parB, y: holeY + normal[1] * sep + pty * 14 * R.parallax }, mm, w, h, safe)
    setPair(hour, minute)
    const meta = safePoint({ x: minute.x, y: minute.y + (minute.y < h * .65 ? mm.h * .9 : -mm.h * .9) }, { w: 220, h: 30 }, w, h, safe)
    css(node, '--meta-x', meta.x); css(node, '--meta-y', meta.y)
  }

  const timeText = `${hourEl?.textContent || ''}  ${minuteEl?.textContent || ''}`.trim()
  node.dataset.timeText = timeText
  css(node, '--rel-in', shadowR * .91)
  css(node, '--rel-core', shadowR * .98)
  css(node, '--rel-mid', shadowR * 1.18)
  css(node, '--rel-out', shadowR * 1.31)
  css(node, '--rel-up', -shadowR * .18)
  css(node, '--rel-down', shadowR * .18)

  const relOpt = document.querySelector<HTMLElement>('[data-runtime-relativistic]')
  if (relOpt) relOpt.classList.toggle('on', stored.custom?.clockArt === 'relativistic')
}

requestAnimationFrame(tick)
