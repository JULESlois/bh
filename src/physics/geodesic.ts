import { RS, R_ISCO, R_OUT, R_ESC, T_DISP, ntProfile, omegaK, orbitalSpeed, gFactor, B_CRIT } from './constants'

/**
 * CPU twin of the GLSL ray tracer. When you click a pixel, the very same
 * Binet equation d²u/dφ² = 3u² − u is integrated with RK4 for that pixel's
 * ray, and the result is classified and measured. The inset diagram in the
 * HUD is this integration's actual (r, φ) trajectory in the ray's orbital
 * plane — spherical symmetry keeps every photon in one plane.
 */

export type Vec3 = [number, number, number]

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2])
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const norm = (a: Vec3): Vec3 => scale(a, 1 / (len(a) || 1))

export interface HitBase {
  /** photon path in ray-plane coordinates, [x0,y0, x1,y1, ...] */
  path: Float32Array
  /** direction of the disk-plane intersection line in ray-plane coords, or null */
  diskLine: [number, number] | null
  /** total swept angle φ, radians */
  dphi: number
  /** conserved impact parameter magnitude, in M */
  b: number
}

export type Hit =
  | (HitBase & {
      kind: 'disk'
      r: number
      order: number
      g: number
      Temit: number
      Tobs: number
      vOrb: number
      omega: number
    })
  | (HitBase & { kind: 'shadow' })
  | (HitBase & { kind: 'sky'; deflectionDeg: number })
  | (HitBase & { kind: 'spiral' })

export function traceRay(camPos: Vec3, dir: Vec3): Hit {
  const rr = len(camPos)
  const e1 = scale(camPos, 1 / rr)
  const d = norm(dir)
  const vrad = dot(d, e1)
  const tv = sub(d, scale(e1, vrad))
  const vt = len(tv)

  const Efac = Math.sqrt(Math.max(1 - RS / rr, 1e-9))
  const Lvec = scale(cross(camPos, d), 1 / Efac)
  const b = len(Lvec)
  const bAxis = Lvec[1]

  // degenerate exactly-radial ray
  if (vt < 1e-7) {
    const path = new Float32Array([rr, 0, vrad > 0 ? R_ESC : RS, 0])
    return vrad > 0
      ? { kind: 'sky', deflectionDeg: 0, path, diskLine: null, dphi: 0, b: 0 }
      : { kind: 'shadow', path, diskLine: null, dphi: 0, b: 0 }
  }

  const e2 = scale(tv, 1 / vt)

  // disk-plane ∩ ray-plane line, expressed in the (e1, e2) basis
  const nPlane = cross(e1, e2)
  const lineDir3 = cross(nPlane, [0, 1, 0])
  const lineLen = len(lineDir3)
  const diskLine: [number, number] | null =
    lineLen > 1e-4 ? [dot(lineDir3, e1) / lineLen, dot(lineDir3, e2) / lineLen] : null

  let u = 1 / rr
  let w = -u * (vrad / vt) * Math.sqrt(Math.max(1 - RS * u, 1e-9))
  const u0 = u
  const w0 = w
  let phi = 0
  const Yc = e1[1]
  const Ys = e2[1]
  let Yprev = Yc
  let uPrev = u
  let phiPrev = 0
  let crossings = 0

  const pts: number[] = [Math.cos(0) / u, Math.sin(0) / u]
  let sinceSample = 0

  const f = (uu: number, ww: number): [number, number] => [ww, 3 * uu * uu - uu]

  let outcome: 'shadow' | 'sky' | 'spiral' = 'spiral'
  let diskHit: { r: number; order: number } | null = null

  for (let i = 0; i < 20000; i++) {
    const h = Math.min(Math.max(0.06 / (1 + 9 * u), 0.005), 0.07)
    const [k1u, k1w] = f(u, w)
    const [k2u, k2w] = f(u + 0.5 * h * k1u, w + 0.5 * h * k1w)
    const [k3u, k3w] = f(u + 0.5 * h * k2u, w + 0.5 * h * k2w)
    const [k4u, k4w] = f(u + h * k3u, w + h * k3w)
    u += (h * (k1u + 2 * k2u + 2 * k3u + k4u)) / 6
    w += (h * (k1w + 2 * k2w + 2 * k3w + k4w)) / 6
    phi += h

    sinceSample += h
    if (sinceSample > 0.045 && u > 1e-9) {
      pts.push(Math.cos(phi) / u, Math.sin(phi) / u)
      sinceSample = 0
    }

    if (u > 1 / RS) {
      outcome = 'shadow'
      break
    }
    if (u < 1 / R_ESC && w < 0) {
      outcome = 'sky'
      break
    }
    if (phi > 8 * Math.PI) {
      outcome = 'spiral'
      break
    }

    const Ynow = Yc * Math.cos(phi) + Ys * Math.sin(phi)
    if (Ynow * Yprev < 0) {
      const ft = Yprev / (Yprev - Ynow)
      const uC = uPrev + (u - uPrev) * ft
      const rC = 1 / uC
      crossings++
      if (rC >= R_ISCO && rC <= R_OUT && !diskHit) {
        diskHit = { r: rC, order: crossings }
        const phiC = phiPrev + (phi - phiPrev) * ft
        pts.push(Math.cos(phiC) * rC, Math.sin(phiC) * rC)
        break
      }
    }
    Yprev = Ynow
    uPrev = u
    phiPrev = phi
  }

  if (u > 1e-9) pts.push(Math.cos(phi) / u, Math.sin(phi) / u)
  const path = new Float32Array(pts)
  const base: HitBase = { path, diskLine, dphi: phi, b }

  if (diskHit) {
    const g = gFactor(diskHit.r, bAxis)
    const Temit = T_DISP * ntProfile(diskHit.r)
    return {
      kind: 'disk',
      r: diskHit.r,
      order: diskHit.order,
      g,
      Temit,
      Tobs: g * Temit,
      vOrb: orbitalSpeed(diskHit.r),
      omega: omegaK(diskHit.r),
      ...base,
    }
  }
  if (outcome === 'shadow') return { kind: 'shadow', ...base }
  if (outcome === 'spiral') return { kind: 'spiral', ...base }

  // escaped: exit direction in plane coords for the deflection angle
  const cp = Math.cos(phi)
  const sp = Math.sin(phi)
  // d(pos)/dφ ∝ −w·ê_r + u·ê_t in the plane
  const ex = -w * cp + u * -sp
  const ey = -w * sp + u * cp
  // initial in-plane direction from the same coordinate expression at φ=0
  const a0 = Math.atan2(u0, -w0)
  const a1 = Math.atan2(ey, ex)
  let defl = a1 - a0
  while (defl > Math.PI) defl -= 2 * Math.PI
  while (defl < -Math.PI) defl += 2 * Math.PI
  // total bending includes full windings
  const winds = Math.floor(Math.max(phi - Math.PI, 0) / (2 * Math.PI))
  const deflectionDeg = Math.abs(defl) * (180 / Math.PI) + winds * 360
  return { kind: 'sky', deflectionDeg, ...base }
}

export function describeB(b: number): string {
  return b < B_CRIT
    ? `b = ${b.toFixed(2)} M  <  b_c = ${B_CRIT.toFixed(3)} M`
    : `b = ${b.toFixed(2)} M  >  b_c = ${B_CRIT.toFixed(3)} M`
}
