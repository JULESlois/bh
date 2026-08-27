import { B_CRIT, RS } from '../physics/constants'
import type { Vec3 } from '../physics/geodesic'

/**
 * The whole site is one continuous camera move through Schwarzschild
 * spacetime, parameterized by scroll position t ∈ [0, 6]. The camera is
 * driven *only* by scroll (plus a whisper of pointer parallax), so every
 * transition — including the Einstein-ring alignment in section 4 — is
 * something you steer yourself.
 */

export const SECTIONS = 7
/** scroll distance per section, in viewport heights (1 = screen-by-screen,
 *  paired with CSS scroll snapping) */
export const SECTION_VH = 1.0

// keyframes at integer t
const K = {
  dist: [30, 22, 24, 27, 30, 22, 47],
  incl: [81, 79, 63, 86.5, 57, 76, 71],
  fov: [58, 46, 30, 50, 55, 44, 62],
  azim: [0.0, 0.7, 1.5, 2.4, 3.4, 4.3, 5.1],
  disk: [1, 1, 1, 1.1, 0.1, 1, 1],
  star: [1, 1, 0.7, 0.65, 2.1, 0.45, 1.1],
  expo: [1.0, 1.05, 1.2, 1.0, 1.05, 1.05, 0.92],
}

function smootherstep(x: number): number {
  x = Math.min(Math.max(x, 0), 1)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

function kf(chan: number[], t: number): number {
  const n = chan.length - 1
  const tt = Math.min(Math.max(t, 0), n)
  const i = Math.min(Math.floor(tt), n - 1)
  return chan[i] + (chan[i + 1] - chan[i]) * smootherstep(tt - i)
}

export interface CamState {
  pos: Vec3
  right: Vec3
  up: Vec3
  fwd: Vec3
  tanHalfFov: number
  dist: number
  inclDeg: number
  azim: number
  fovDeg: number
}

export interface FrameParams extends CamState {
  diskGain: number
  starGain: number
  falseColor: number
  exposure: number
}

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

export function cameraFrom(dist: number, inclDeg: number, azim: number, fovDeg: number): CamState {
  const i = (inclDeg * Math.PI) / 180
  const pos: Vec3 = [
    dist * Math.sin(i) * Math.cos(azim),
    dist * Math.cos(i),
    dist * Math.sin(i) * Math.sin(azim),
  ]
  const fwd = norm([-pos[0], -pos[1], -pos[2]])
  const right = norm(cross(fwd, [0, 1, 0]))
  const up = cross(right, fwd)
  return {
    pos,
    right,
    up,
    fwd,
    tanHalfFov: Math.tan(((fovDeg / 2) * Math.PI) / 180),
    dist,
    inclDeg,
    azim,
    fovDeg,
  }
}

export function paramsAt(
  t: number,
  pointerX: number,
  pointerY: number,
  azimOff = 0,
  inclOff = 0,
): FrameParams {
  const dist = kf(K.dist, t)
  const incl = Math.min(Math.max(kf(K.incl, t) + pointerY * 2.0 + inclOff, 12), 88.5)
  const azim = kf(K.azim, t) + pointerX * 0.05 + azimOff
  const fov = kf(K.fov, t)
  const cam = cameraFrom(dist, incl, azim, fov)

  // false color fades in across the redshift section only
  const falseColor =
    smoothstep(4.55, 5.0, t) - smoothstep(5.55, 6.0, t)

  // hold the disk dim through the whole lensing passage so the sky speaks
  const hold = smoothstep(3.85, 4.1, t) * (1 - smoothstep(4.5, 4.9, t))
  const diskGain = kf(K.disk, t) * (1 - hold) + 0.1 * hold

  return {
    ...cam,
    diskGain,
    starGain: kf(K.star, t),
    falseColor,
    exposure: kf(K.expo, t),
  }
}

function smoothstep(a: number, b: number, x: number): number {
  const k = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return k * k * (3 - 2 * k)
}

/** the companion star sits exactly behind the hole at t = 4.35:
 *  rays from the camera through the center escape along −poŝ, so the
 *  source must live at that sky direction for an Einstein ring. */
export function companionDir(azimOff = 0, inclOff = 0): Vec3 {
  const cam = cameraFrom(1, kf(K.incl, 4.35) + inclOff, kf(K.azim, 4.35) + azimOff, 55)
  return norm([-cam.pos[0], -cam.pos[1], -cam.pos[2]])
}

/**
 * Angular radius of the shadow for a static observer at distance d:
 * sinθ = b_c·√(1 − r_s/d)/d — used for the screen-space dashed annotation.
 */
export function shadowRadiusPx(dist: number, fovDeg: number, viewportH: number): number {
  const s = (B_CRIT * Math.sqrt(Math.max(1 - RS / dist, 0))) / dist
  const theta = Math.asin(Math.min(s, 1))
  return (Math.tan(theta) / Math.tan(((fovDeg / 2) * Math.PI) / 180)) * (viewportH / 2)
}

/** ray direction (world) for a viewport point, px/py in [-1,1], py up */
export function rayDir(cam: CamState, px: number, py: number, aspect: number): Vec3 {
  return norm([
    cam.fwd[0] + cam.tanHalfFov * (px * aspect * cam.right[0] + py * cam.up[0]),
    cam.fwd[1] + cam.tanHalfFov * (px * aspect * cam.right[1] + py * cam.up[1]),
    cam.fwd[2] + cam.tanHalfFov * (px * aspect * cam.right[2] + py * cam.up[2]),
  ])
}
