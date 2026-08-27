/**
 * CPU reference renderer — a line-by-line port of the GLSL scene shader,
 * driven by the real timeline. Used to visually verify physics, framing
 * and grading without a GPU. Usage: node refrender.mjs [t values...]
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { paramsAt, companionDir, rayDir } from '../src/scene/timeline'
import { RS, R_PHOTON, R_ISCO, R_OUT, R_ESC, T_DISP, NT_PEAK, TIME_SCALE } from '../src/physics/constants'

const W = Number(process.env.RW) || 640
const H = Number(process.env.RH) || 360
const STEPS = 620
const TIME = 26 * TIME_SCALE

type V3 = [number, number, number]
const fract = (x: number) => x - Math.floor(x)
const clamp = (x: number, a: number, b: number) => Math.min(Math.max(x, a), b)
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const smoothstep = (a: number, b: number, x: number) => {
  const k = clamp((x - a) / (b - a), 0, 1)
  return k * k * (3 - 2 * k)
}

function hash12(px: number, py: number): number {
  let p3x = fract(px * 0.1031), p3y = fract(py * 0.1031), p3z = fract(px * 0.1031)
  const d = p3x * (p3y + 33.33) + p3y * (p3z + 33.33) + p3z * (p3x + 33.33)
  p3x += d; p3y += d; p3z += d
  return fract((p3x + p3y) * p3z)
}
function hash33(px: number, py: number, pz: number): V3 {
  let x = fract(px * 0.1031), y = fract(py * 0.103), z = fract(pz * 0.0973)
  const d = x * (y + 33.33) + y * (x + 33.33) + z * (z + 33.33)
  x += d; y += d; z += d
  return [fract((x + y) * z), fract((x + x) * y), fract((y + x) * x)]
}
function vnoise(px: number, py: number): number {
  const ix = Math.floor(px), iy = Math.floor(py)
  let fx = px - ix, fy = py - iy
  fx = fx * fx * (3 - 2 * fx)
  fy = fy * fy * (3 - 2 * fy)
  const a = hash12(ix, iy), b = hash12(ix + 1, iy), c = hash12(ix, iy + 1), d = hash12(ix + 1, iy + 1)
  return mix(mix(a, b, fx), mix(c, d, fx), fy)
}
function fbm(px: number, py: number): number {
  let v = 0, a = 0.5
  for (let i = 0; i < 4; i++) {
    v += a * vnoise(px, py)
    px = px * 2.13 + 7.7
    py = py * 2.13 + 7.7
    a *= 0.5
  }
  return v
}
const gmod = (x: number, y: number) => x - y * Math.floor(x / y)
function vnoiseP(a: number, y: number, period: number): number {
  const ia = Math.floor(a), iy = Math.floor(y)
  let fa = a - ia, fy = y - iy
  fa = fa * fa * (3 - 2 * fa)
  fy = fy * fy * (3 - 2 * fy)
  const a0 = gmod(ia, period), a1 = gmod(ia + 1, period)
  const h00 = hash12(a0, iy), h10 = hash12(a1, iy)
  const h01 = hash12(a0, iy + 1), h11 = hash12(a1, iy + 1)
  return mix(mix(h00, h10, fa), mix(h01, h11, fa), fy)
}
function fbmDisk(chi: number, y: number, B: number): number {
  let v = 0, amp = 0.5
  const a = chi * 0.15915494309
  for (let i = 0; i < 4; i++) {
    v += amp * vnoiseP(a * B, y, B)
    B *= 2
    y = y * 2 + 7.7
    amp *= 0.5
  }
  return v
}
function blackbody(T: number): V3 {
  T = clamp(T, 500, 40000)
  const lam = [0.61, 0.549, 0.468]
  const rad = lam.map((l) => 1 / (l ** 5 * (Math.exp(14387.8 / (l * T)) - 1))) as V3
  const lum = rad[0] * 0.2126 + rad[1] * 0.7152 + rad[2] * 0.0722
  return [rad[0] / lum, rad[1] / lum, rad[2] / lum]
}
const COMP = companionDir()

function sky(d: V3, starGain: number): V3 {
  const col: V3 = [0, 0, 0]
  for (let s = 0; s < 2; s++) {
    const S = s === 0 ? 52 : 104
    const bx = Math.floor(d[0] * S - 0.5), by = Math.floor(d[1] * S - 0.5), bz = Math.floor(d[2] * S - 0.5)
    for (let i = 0; i < 8; i++) {
      const idx = bx + (i & 1), idy = by + ((i >> 1) & 1), idz = bz + ((i >> 2) & 1)
      const h = hash33(idx + S * 0.731, idy + S * 0.731, idz + S * 0.731)
      if (h[0] < 0.10) {
        let sx = idx + 0.5 + (h[0] - 0.5) * 0.9
        let sy = idy + 0.5 + (h[1] - 0.5) * 0.9
        let sz = idz + 0.5 + (h[2] - 0.5) * 0.9
        const l = Math.hypot(sx, sy, sz); sx /= l; sy /= l; sz /= l
        const a = Math.hypot(d[0] - sx, d[1] - sy, d[2] - sz)
        const br = h[1] ** 18 * 13 + h[1] ** 5 * 0.5
        const w = 0.0011 + 0.0028 * h[2] ** 9
        const amp = br * Math.exp((-a * a) / (2 * w * w)) * 0.09
        if (amp > 1e-4) {
          const bb = blackbody(mix(2600, 11500, h[2] * h[2]))
          col[0] += bb[0] * amp; col[1] += bb[1] * amp; col[2] += bb[2] * amp
        }
      }
    }
  }
  // galaxy band
  const nl = Math.hypot(0.38, 0.55, 0.74)
  const n: V3 = [0.38 / nl, 0.55 / nl, 0.74 / nl]
  const bandC = d[0] * n[0] + d[1] * n[1] + d[2] * n[2]
  const band = Math.exp((-bandC * bandC) / 0.022)
  if (band > 0.003) {
    const t1l = Math.hypot(n[2], 0, -n[0])
    const t1: V3 = [n[2] / t1l, 0, -n[0] / t1l] // cross(n, y-axis) normalized
    const t2: V3 = [n[1] * t1[2] - n[2] * t1[1], n[2] * t1[0] - n[0] * t1[2], n[0] * t1[1] - n[1] * t1[0]]
    const uvx = Math.atan2(d[0] * t2[0] + d[1] * t2[1] + d[2] * t2[2], d[0] * t1[0] + d[1] * t1[1] + d[2] * t1[2])
    const m = fbm(uvx * 2.6, bandC * 13)
    const dust = fbm(uvx * 6.5 + 3.3, bandC * 26)
    let g = band * (0.3 + 0.7 * m) * 0.05
    g *= 0.3 + 0.7 * smoothstep(0.72, 0.25, dust * band)
    col[0] += mix(1.0, 0.62, m) * g
    col[1] += mix(0.83, 0.72, m) * g
    col[2] += mix(0.66, 1.0, m) * g
  }
  col[0] = (col[0] + 0.0016) * starGain
  col[1] = (col[1] + 0.0018) * starGain
  col[2] = (col[2] + 0.0024) * starGain
  const ca = Math.max(d[0] * COMP[0] + d[1] * COMP[1] + d[2] * COMP[2], 0)
  const amp = (Math.pow(ca, 90000) * 5.5 + Math.pow(ca, 2500) * 0.06) * (0.5 + 0.5 * starGain)
  if (amp > 1e-5) {
    const cc = blackbody(9400)
    col[0] += cc[0] * amp; col[1] += cc[1] * amp; col[2] += cc[2] * amp
  }
  return col
}

function gRamp(g: number): V3 {
  const t = clamp((g - 1) / 0.38, -1, 1)
  const mid: V3 = [0.62, 0.6, 0.57]
  const red: V3 = [0.8, 0.08, 0.03]
  const blu: V3 = [0.05, 0.55, 0.95]
  const o = t < 0 ? red : blu
  const k = Math.abs(t)
  return [mix(mid[0], o[0], k), mix(mid[1], o[1], k), mix(mid[2], o[2], k)]
}

interface Uni { diskGain: number; starGain: number; falseColor: number }

function diskShade(hpx: number, hpz: number, rC: number, bAxis: number, u: Uni): { c: V3; a: number } {
  const phiAz = Math.atan2(hpz, hpx)
  const Om = Math.pow(1 / rC, 1.5)
  let g = Math.sqrt(Math.max(1 - 3 / rC, 0)) / (1 + Om * bAxis)
  g = clamp(g, 0.06, 5)
  const prof = Math.pow(1 / rC, 0.75) * Math.pow(Math.max(1 - Math.sqrt(R_ISCO / rC), 0), 0.25)
  let Tem = T_DISP * (prof / NT_PEAK)
  const chi = phiAz - Om * TIME
  const n1 = fbmDisk(chi, rC * 0.55, 9)
  const n2 = fbmDisk(chi + 2.1, rC * 1.7 + 13.1, 24)
  const dens = 0.60 + 0.52 * n1 + 0.28 * (n2 - 0.5)
  Tem *= mix(1, dens, 0.65)
  const Tobs = g * Tem
  const inten = Math.pow(Tobs / T_DISP, 4)
  const bb = blackbody(Tobs)
  const boost = 0.62 * Math.max(u.diskGain, 1)
  const phys: V3 = [bb[0] * inten * boost, bb[1] * inten * boost, bb[2] * inten * boost]
  const plum = phys[0] * 0.2126 + phys[1] * 0.7152 + phys[2] * 0.0722
  for (let k = 0; k < 3; k++) phys[k] = plum + (phys[k] - plum) * 1.22
  let alpha = smoothstep(R_ISCO, R_ISCO + 0.8, rC) * (1 - smoothstep(R_OUT - 6.5, R_OUT, rC))
  alpha *= 0.55 + 0.45 * smoothstep(0.15, 0.75, n1)
  alpha = clamp(alpha, 0, 0.96) * clamp(u.diskGain, 0, 1)
  const fcr = gRamp(g)
  const fk = 0.4 + 0.6 * smoothstep(0.1, 0.9, dens)
  const c: V3 = [
    mix(phys[0], fcr[0] * 1.15 * fk, u.falseColor),
    mix(phys[1], fcr[1] * 1.15 * fk, u.falseColor),
    mix(phys[2], fcr[2] * 1.15 * fk, u.falseColor),
  ]
  return { c, a: alpha }
}

function tracePixel(pos: V3, dir: V3, u: Uni): V3 {
  const rr = Math.hypot(...pos)
  const e1: V3 = [pos[0] / rr, pos[1] / rr, pos[2] / rr]
  const vrad = dir[0] * e1[0] + dir[1] * e1[1] + dir[2] * e1[2]
  const tv: V3 = [dir[0] - vrad * e1[0], dir[1] - vrad * e1[1], dir[2] - vrad * e1[2]]
  const vt = Math.hypot(...tv)
  const col: V3 = [0, 0, 0]
  let trans = 1
  if (vt < 1e-5) return vrad > 0 ? sky(dir, u.starGain) : [0, 0, 0]
  const e2: V3 = [tv[0] / vt, tv[1] / vt, tv[2] / vt]
  let uu = 1 / rr
  let w = -uu * (vrad / vt) * Math.sqrt(Math.max(1 - RS * uu, 1e-5))
  const Efac = Math.sqrt(Math.max(1 - RS / rr, 1e-5))
  const bAxis = (pos[2] * dir[0] - pos[0] * dir[2]) / Efac
  let phi = 0
  const Yc = e1[1], Ys = e2[1]
  let Yprev = Yc, uPrev = uu, wPrev = w, phiPrev = 0
  let escaped = false
  for (let i = 0; i < STEPS; i++) {
    const h = clamp(0.17 / (1 + 9 * uu), 0.014, 0.2)
    const k1u = w, k1w = 3 * uu * uu - uu
    const u2 = uu + 0.5 * h * k1u, w2 = w + 0.5 * h * k1w
    const k2u = w2, k2w = 3 * u2 * u2 - u2
    const u3 = uu + 0.5 * h * k2u, w3 = w + 0.5 * h * k2w
    const k3u = w3, k3w = 3 * u3 * u3 - u3
    const u4 = uu + h * k3u, w4 = w + h * k3w
    const k4u = w4, k4w = 3 * u4 * u4 - u4
    uu += (h * (k1u + 2 * k2u + 2 * k3u + k4u)) / 6
    w += (h * (k1w + 2 * k2w + 2 * k3w + k4w)) / 6
    phi += h
    if (uu > 1 / RS) break
    if (uu < 1 / R_ESC && w < 0) { escaped = true; break }
    if (phi > 6 * Math.PI) break
    const cphi = Math.cos(phi), sphi = Math.sin(phi)
    const Ynow = Yc * cphi + Ys * sphi
    if (Ynow * Yprev < 0) {
      const ft = Yprev / (Yprev - Ynow)
      let phiL = mix(phiPrev, phi, ft)
      const dY = -Yc * Math.sin(phiL) + Ys * Math.cos(phiL)
      phiL -= (Yc * Math.cos(phiL) + Ys * Math.sin(phiL)) / (Math.abs(dY) > 1e-6 ? dY : 1e-6)
      const hr = clamp(phiL - phiPrev, 0, h)
      let ru = uPrev, rw = wPrev
      const r1u = rw, r1w = 3 * ru * ru - ru
      const ru2 = ru + 0.5 * hr * r1u, rw2 = rw + 0.5 * hr * r1w
      const r2u = rw2, r2w = 3 * ru2 * ru2 - ru2
      const ru3 = ru + 0.5 * hr * r2u, rw3 = rw + 0.5 * hr * r2w
      const r3u = rw3, r3w = 3 * ru3 * ru3 - ru3
      const ru4 = ru + hr * r3u, rw4 = rw + hr * r3w
      const r4u = rw4
      const uC = ru + (hr * (r1u + 2 * r2u + 2 * r3u + r4u)) / 6
      const phiC = phiPrev + hr
      const rC = 1 / uC
      if (rC < R_OUT + 2 && rC >= R_ISCO && rC <= R_OUT) {
        const cc = Math.cos(phiC), sc = Math.sin(phiC)
        const hpx = (cc * e1[0] + sc * e2[0]) * rC
        const hpz = (cc * e1[2] + sc * e2[2]) * rC
        const { c, a } = diskShade(hpx, hpz, rC, bAxis, u)
        col[0] += trans * a * c[0]; col[1] += trans * a * c[1]; col[2] += trans * a * c[2]
        trans *= 1 - a
        if (trans < 0.02) break
      }
    }
    Yprev = Ynow; uPrev = uu; wPrev = w; phiPrev = phi
  }
  if (escaped) {
    const cphi = Math.cos(phi), sphi = Math.sin(phi)
    const ed: V3 = [0, 0, 0]
    for (let k = 0; k < 3; k++) ed[k] = -w * (cphi * e1[k] + sphi * e2[k]) + uu * (-sphi * e1[k] + cphi * e2[k])
    const l = Math.hypot(...ed)
    const s = sky([ed[0] / l, ed[1] / l, ed[2] / l], u.starGain)
    const fk = mix(1, 0.12, u.falseColor)
    col[0] += trans * s[0] * fk; col[1] += trans * s[1] * fk; col[2] += trans * s[2] * fk
  }
  return col
}

// ---------- PNG writer ----------
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}
function writePng(path: string, rgba: Uint8Array, w: number, h: number) {
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, w); dv.setUint32(4, h)
  ihdr[8] = 8; ihdr[9] = 6
  const raw = new Uint8Array(h * (w * 4 + 1))
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1)
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ])
  writeFileSync(path, png)
}

// ---------- render frames ----------
const aces = (x: number) => clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0, 1)

const ts = process.argv.slice(2).map(Number)
const list = ts.length ? ts : [0, 2, 3, 4.35]
for (const t of list) {
  const p = paramsAt(t, 0, 0)
  // portrait fitting, mirroring App.tsx: preserve the horizontal field
  if (H > W) p.tanHalfFov *= H / W
  const u: Uni = { diskGain: p.diskGain, starGain: p.starGain, falseColor: p.falseColor }
  const hdr = new Float32Array(W * H * 3)
  const t0 = Date.now()
  for (let y = 0; y < H; y++) {
    const py = -((y + 0.5) / H) * 2 + 1
    for (let x = 0; x < W; x++) {
      const px = ((x + 0.5) / W) * 2 - 1
      const dir = rayDir(p, px, py, W / H)
      const c = tracePixel(p.pos, dir, u)
      const o = (y * W + x) * 3
      hdr[o] = c[0]; hdr[o + 1] = c[1]; hdr[o + 2] = c[2]
    }
  }
  // cheap bloom: bright extract + 3x box blur at 1/4 res, then composite
  const bw = W >> 2, bh = H >> 2
  let bloom = new Float32Array(bw * bh * 3)
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const o = (y * bw + x) * 3
      const so = (y * 4 * W + x * 4) * 3
      for (let k = 0; k < 3; k++) {
        const v = hdr[so + k]
        const l = v
        bloom[o + k] = Math.max(l - 0.55, 0)
      }
    }
  for (let pass = 0; pass < 3; pass++) {
    const nb = new Float32Array(bw * bh * 3)
    for (let y = 0; y < bh; y++)
      for (let x = 0; x < bw; x++) {
        const o = (y * bw + x) * 3
        for (let k = 0; k < 3; k++) {
          let s = 0, n = 0
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const yy = y + dy, xx = x + dx
              if (yy < 0 || yy >= bh || xx < 0 || xx >= bw) continue
              s += bloom[(yy * bw + xx) * 3 + k]
              n++
            }
          nb[o + k] = s / n
        }
      }
    bloom = nb
  }
  const rgba = new Uint8Array(W * H * 4)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3
      // bilinear bloom fetch (mirrors GPU linear filtering)
      const fx = clamp(x / 4 - 0.5, 0, bw - 1.001)
      const fy = clamp(y / 4 - 0.5, 0, bh - 1.001)
      const x0 = Math.floor(fx), y0 = Math.floor(fy)
      const x1 = Math.min(x0 + 1, bw - 1), y1 = Math.min(y0 + 1, bh - 1)
      const tx = fx - x0, ty = fy - y0
      const cx = x / W - 0.5, cy = y / H - 0.5
      const r2 = cx * cx + cy * cy
      const vig = 1 - 0.42 * smoothstep(0.12, 0.62, r2)
      const oo = (y * W + x) * 4
      for (let k = 0; k < 3; k++) {
        const b00 = bloom[(y0 * bw + x0) * 3 + k], b10 = bloom[(y0 * bw + x1) * 3 + k]
        const b01 = bloom[(y1 * bw + x0) * 3 + k], b11 = bloom[(y1 * bw + x1) * 3 + k]
        const bl = mix(mix(b00, b10, tx), mix(b01, b11, tx), ty)
        let v = (hdr[o + k] + bl * 0.85) * p.exposure * vig
        v = aces(v)
        rgba[oo + k] = Math.round(Math.pow(v, 1 / 2.2) * 255)
      }
      rgba[oo + 3] = 255
    }
  const name = `/tmp/bh_t${String(t).replace('.', '_')}.png`
  writePng(name, rgba, W, H)
  console.log(`${name}  ${Date.now() - t0}ms  dist=${p.dist.toFixed(1)} incl=${p.inclDeg.toFixed(1)} fov=${p.fovDeg.toFixed(0)} disk=${p.diskGain.toFixed(2)} fc=${p.falseColor.toFixed(2)}`)
}
