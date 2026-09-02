import { cameraFrom } from '../scene/timeline'
import {
  CAMERA_PRESETS,
  COMPOSITIONS,
  SCENE_PRESETS,
  VIEW_DIRECTORS,
  type ClockEngineName,
  type ScenePresetId,
} from './presets'

const KEY = 'schwarzschild-wallpaper'
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

type Stored = {
  sceneMode?: 'preset' | 'custom'
  scenePreset?: ScenePresetId
  custom?: {
    basePreset?: ScenePresetId
    framing?: number
    roll?: number
    tilt?: number
    zoom?: number
    drift?: number
    parallax?: number
  }
}

type V3 = [number, number, number]
type V2 = [number, number]
type Point = { x: number; y: number }

const n = (v: unknown, fallback: number) => Number.isFinite(Number(v)) ? Number(v) : fallback
const validPreset = (v: unknown): v is ScenePresetId =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(SCENE_PRESETS, v)

function readStored(): Stored {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Stored } catch { return {} }
}

function rollBasis(right: V3, up: V3, degrees: number) {
  const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a)
  return {
    right: [right[0] * c + up[0] * s, right[1] * c + up[1] * s, right[2] * c + up[2] * s] as V3,
    up: [up[0] * c - right[0] * s, up[1] * c - right[1] * s, up[2] * c - right[2] * s] as V3,
  }
}

function resolve(s: Stored) {
  const custom = s.sceneMode === 'custom'
  const c = s.custom ?? {}
  const presetId = custom && validPreset(c.basePreset)
    ? c.basePreset
    : validPreset(s.scenePreset) ? s.scenePreset : 'signature'
  const preset = SCENE_PRESETS[presetId]
  const comp = COMPOSITIONS[preset.composition]
  const director = VIEW_DIRECTORS[preset.view]
  return {
    preset,
    framing: custom ? .72 + n(c.framing, .5) * .56 : 1,
    roll: comp.roll + (custom ? (n(c.roll, .5) - .5) * 30 : 0),
    tilt: custom ? n(c.tilt, .5) : .5,
    zoom: custom ? n(c.zoom, .5) : .5,
    azimRate: custom
      ? (.006 + n(c.drift, .46) * .03) * director.motion
      : .006 + preset.motion.drift * .03,
    parallax: custom ? n(c.parallax, .52) : preset.motion.parallax,
    breath: custom ? .5 : .5 * preset.motion.breath,
    compDist: comp.dist,
  }
}

const cssNumber = (style: CSSStyleDeclaration, name: string, fallback: number) => {
  const v = Number.parseFloat(style.getPropertyValue(name))
  return Number.isFinite(v) ? v : fallback
}

const crossY = (a: V3, b: V3) => a[2] * b[0] - a[0] * b[2]
const norm2 = (x: number, y: number): V2 => {
  const l = Math.hypot(x, y)
  return l > 1e-6 ? [x / l, y / l] : [1, 0]
}

const baseWeight: Record<ClockEngineName, number> = {
  monument: 205,
  eclipse: 205,
  blade: 210,
  orbit: 218,
  depth: 218,
  quiet: 220,
  relativistic: 212,
}

const baseTrack: Record<ClockEngineName, number> = {
  monument: -0.045,
  eclipse: 0.015,
  blade: 0.065,
  orbit: 0,
  depth: 0,
  quiet: 0,
  relativistic: 0.01,
}

function writeField(
  el: HTMLElement | null,
  p: Point,
  engine: ClockEngineName,
  hole: Point,
  shadowR: number,
  axis: V2,
  approach: V2,
  dopplerStrength: number,
  motionScale: number,
) {
  if (!el || engine === 'quiet') return
  const dx = p.x - hole.x, dy = p.y - hole.y
  const r = Math.max(Math.hypot(dx, dy), 1)
  const radial: V2 = [dx / r, dy / r]
  const normal: V2 = [-axis[1], axis[0]]
  const signedNormal = dx * normal[0] + dy * normal[1]
  const normalDistance = Math.abs(signedNormal)

  // Disk proximity is measured against the projected disk axis; ring proximity
  // peaks just outside the shadow where the lensed structure is visually dense.
  const diskProx = 1 - clamp(normalDistance / Math.max(shadowR * 2.15, 72), 0, 1)
  const ringRadius = shadowR * 1.18
  const ringProx = 1 - clamp(Math.abs(r - ringRadius) / Math.max(shadowR * .95, 58), 0, 1)
  const doppler = clamp((radial[0] * approach[0] + radial[1] * approach[1]) * dopplerStrength, -1, 1)
  const tangentSense = clamp(radial[0] * axis[1] - radial[1] * axis[0], -1, 1)

  let sx = 1 + diskProx * .025 + ringProx * .035
  let sy = 1 - ringProx * .018
  let rot = tangentSense * ringProx * 2.2
  let weight = baseWeight[engine] + ringProx * 14
  let tracking = baseTrack[engine] - ringProx * .024
  let shiftX = 0
  let shiftY = 0

  if (engine === 'monument') {
    sx += diskProx * .055
    rot += Math.sign(signedNormal || 1) * diskProx * 1.6
    tracking += diskProx * .006
    const push = diskProx * 3.8 * motionScale
    shiftX += normal[0] * Math.sign(signedNormal || 1) * push
    shiftY += normal[1] * Math.sign(signedNormal || 1) * push
  } else if (engine === 'eclipse' || engine === 'relativistic') {
    sx += ringProx * .045
    sy -= ringProx * .018
    tracking -= ringProx * .010
    const pull = ringProx * Math.min(6, shadowR * .035) * motionScale
    shiftX -= radial[0] * pull
    shiftY -= radial[1] * pull
  } else if (engine === 'blade') {
    // bAxis < 0 is the approaching, blueshifted side in diskShade(). The text
    // follows the same sign: approaching type gains mass, width and optical glow.
    const approaching = Math.max(doppler, 0)
    const receding = Math.max(-doppler, 0)
    sx += approaching * .105 - receding * .035
    sy += receding * .018 - approaching * .008
    weight += approaching * 92 - receding * 48
    tracking += receding * .014 - approaching * .012
    rot += doppler * 1.35
    el.style.setProperty('--geo-bright', (0.88 + approaching * .22 - receding * .06).toFixed(3))
    el.style.setProperty(
      '--geo-shadow',
      approaching > .06 ? `0 0 ${(4 + approaching * 15).toFixed(1)}px var(--acc)` : 'none',
    )
  } else if (engine === 'orbit') {
    sx += ringProx * .025
    rot += tangentSense * 1.9
    tracking -= ringProx * .008
    const tangent: V2 = [-radial[1], radial[0]]
    const slip = ringProx * 2.6 * motionScale
    shiftX += tangent[0] * slip
    shiftY += tangent[1] * slip
  } else if (engine === 'depth') {
    const approaching = Math.max(doppler, 0)
    sx += ringProx * .025 + approaching * .025
    rot += doppler * .8
    tracking -= ringProx * .010
  }

  sx = clamp(sx, .96, 1.16)
  sy = clamp(sy, .94, 1.055)
  rot = clamp(rot, -5.5, 5.5) * motionScale
  weight = clamp(weight, 160, 320)
  tracking = clamp(tracking, -.075, .085)

  el.style.setProperty('--geo-scale-x', sx.toFixed(4))
  el.style.setProperty('--geo-scale-y', sy.toFixed(4))
  el.style.setProperty('--geo-rotate', `${rot.toFixed(2)}deg`)
  el.style.setProperty('--geo-track', `${tracking.toFixed(4)}em`)
  el.style.setProperty('--geo-weight', weight.toFixed(0))
  el.style.setProperty('--geo-shift-x', `${shiftX.toFixed(2)}px`)
  el.style.setProperty('--geo-shift-y', `${shiftY.toFixed(2)}px`)
}

let stored: Stored = readStored()
let lastRead = 0
let last = performance.now()
let azim = .6
let clock = 0
let ptxT = 0, ptyT = 0, ptx = 0, pty = 0
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

window.addEventListener('mousemove', (e) => {
  ptxT = e.clientX / Math.max(innerWidth, 1) * 2 - 1
  ptyT = e.clientY / Math.max(innerHeight, 1) * 2 - 1
}, { passive: true })

function tick(now: number) {
  requestAnimationFrame(tick)
  const dt = Math.min(now - last, 50)
  last = now
  clock += dt / 1000
  if (now - lastRead > 120) {
    stored = readStored()
    lastRead = now
  }

  const node = document.querySelector<HTMLElement>('.wp-clock')
  if (!node) return
  const engine = node.dataset.engine as ClockEngineName | undefined
  if (!engine || engine === 'quiet') return

  const style = getComputedStyle(node)
  const w = innerWidth, h = innerHeight
  const hole = {
    x: cssNumber(style, '--hole-x', w * .5),
    y: cssNumber(style, '--hole-y', h * .5),
  }
  const shadowR = Math.max(cssNumber(style, '--shadow-r', Math.min(w, h) * .11), 1)
  const axisDeg = cssNumber(style, '--axis-angle', 0)
  const aa = axisDeg * Math.PI / 180
  const axis: V2 = [Math.cos(aa), Math.sin(aa)]

  const hourEl = node.querySelector<HTMLElement>('.hour')
  const minuteEl = node.querySelector<HTMLElement>('.minute')
  const hour = {
    x: cssNumber(style, '--hour-x', hourEl?.getBoundingClientRect().x ?? w * .3),
    y: cssNumber(style, '--hour-y', hourEl?.getBoundingClientRect().y ?? h * .5),
  }
  const minute = {
    x: cssNumber(style, '--minute-x', minuteEl?.getBoundingClientRect().x ?? w * .7),
    y: cssNumber(style, '--minute-y', minuteEl?.getBoundingClientRect().y ?? h * .5),
  }

  // Reconstruct only the sign of the disk's angular-momentum impact parameter.
  // Position/size/axis come from the primary clock solver above, so transition
  // framing remains authoritative while this layer adds physical asymmetry.
  const R = resolve(stored)
  const P = CAMERA_PRESETS[R.preset.view]
  const V = VIEW_DIRECTORS[R.preset.view]
  const damp = 1 - Math.exp(-dt / 1000 * 3.2)
  ptx += (ptxT - ptx) * damp
  pty += (ptyT - pty) * damp
  azim += dt / 1000 * R.azimRate
  const dist = P.dist * R.compDist * R.framing * V.framing * (1.35 - .7 * R.zoom)
  const incl = clamp(P.incl + (R.tilt - .5) * 20 + Math.sin(clock * .18) * R.breath + pty * 2.6 * R.parallax, 12, 89.8)
  const cam = cameraFrom(dist, incl, azim + ptx * .07 * R.parallax, P.fov)
  const portrait = w < h
  const basis = rollBasis(cam.right as V3, cam.up as V3, (R.roll + V.roll) * (portrait ? .72 : 1))
  const aspect = w / Math.max(h, 1)
  const gradX = crossY(cam.pos as V3, basis.right) * aspect
  const gradY = -crossY(cam.pos as V3, basis.up)
  const rawApproach = norm2(-gradX, -gradY)
  const sign = rawApproach[0] * axis[0] + rawApproach[1] * axis[1] >= 0 ? 1 : -1
  const approach: V2 = [axis[0] * sign, axis[1] * sign]
  const inclinationStrength = clamp((Math.sin(incl * Math.PI / 180) - .28) / .72, 0, 1)
  const motionScale = reducedMotion ? .28 : 1

  writeField(hourEl, hour, engine, hole, shadowR, axis, approach, inclinationStrength, motionScale)
  writeField(minuteEl, minute, engine, hole, shadowR, axis, approach, inclinationStrength, motionScale)
}

requestAnimationFrame(tick)
