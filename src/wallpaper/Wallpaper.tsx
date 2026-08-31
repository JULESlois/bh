import { useEffect, useRef, useState } from 'react'
import { Renderer } from '../gl/renderer'
import { cameraFrom } from '../scene/timeline'
import { TIME_SCALE } from '../physics/constants'
import { load, save, bindWallpaperEngine, DEFAULTS, type WpSettings } from './settings'

const PRESETS = [
  { dist: 30, incl: 81, fov: 58, expo: 1.0, disk: 1, star: 1 },
  { dist: 27, incl: 86.5, fov: 50, expo: 1.0, disk: 1, star: 1 },
  { dist: 24, incl: 63, fov: 30, expo: 1.15, disk: 1, star: 0.8 },
  { dist: 30, incl: 24, fov: 46, expo: 1.05, disk: 1, star: 0.9 },
  { dist: 16.5, incl: 78, fov: 68, expo: 0.95, disk: 1, star: 0.9 },
  { dist: 34, incl: 55, fov: 46, expo: 1.05, disk: 0.12, star: 1.7 },
  { dist: 47, incl: 71, fov: 62, expo: 0.92, disk: 1, star: 1.1 },
  { dist: 26, incl: 89.6, fov: 44, expo: 1.05, disk: 1, star: 1 },
  { dist: 26, incl: 13, fov: 44, expo: 1.1, disk: 1, star: 0.85 },
]

/**
 * View Director: geometry stays physical; these are photographic decisions.
 * User sliders remain the base values and are only relatively directed.
 */
const VIEW_DIRECTORS = [
  { framing: 1.00, shift: [0.00, 0.00], roll: 0.0, disk: 1.00, star: 1.00, glow: 1.00, streak: 1.00, expo: 1.00, turb: 1.00, diskOut: 1.00, temp: 1.00, motion: 1.00 },
  { framing: 0.96, shift: [0.05, -0.02], roll: -2.0, disk: 1.10, star: 0.82, glow: 1.12, streak: 1.28, expo: 0.98, turb: 0.88, diskOut: 0.94, temp: 1.02, motion: 0.82 },
  { framing: 0.92, shift: [-0.04, 0.03], roll: 1.0, disk: 0.58, star: 0.52, glow: 1.34, streak: 0.34, expo: 0.88, turb: 0.55, diskOut: 0.70, temp: 1.04, motion: 0.34 },
  { framing: 1.02, shift: [0.02, 0.05], roll: 4.5, disk: 0.96, star: 0.78, glow: 0.82, streak: 0.16, expo: 0.98, turb: 1.12, diskOut: 1.08, temp: 0.99, motion: 0.72 },
  { framing: 0.94, shift: [0.12, -0.04], roll: -3.0, disk: 1.14, star: 0.64, glow: 1.10, streak: 0.82, expo: 0.94, turb: 1.10, diskOut: 0.90, temp: 1.02, motion: 0.72 },
  { framing: 1.04, shift: [-0.08, 0.02], roll: 2.0, disk: 0.42, star: 1.42, glow: 0.52, streak: 0.12, expo: 0.86, turb: 0.35, diskOut: 0.82, temp: 0.96, motion: 0.58 },
  { framing: 1.08, shift: [0.03, 0.05], roll: 6.0, disk: 0.86, star: 1.18, glow: 0.76, streak: 0.50, expo: 0.96, turb: 0.90, diskOut: 1.08, temp: 0.99, motion: 1.16 },
  { framing: 0.94, shift: [0.08, -0.04], roll: -1.5, disk: 1.20, star: 0.62, glow: 1.18, streak: 1.46, expo: 0.92, turb: 0.80, diskOut: 0.88, temp: 1.06, motion: 0.46 },
  { framing: 1.00, shift: [-0.02, 0.08], roll: 8.0, disk: 1.02, star: 0.76, glow: 0.78, streak: 0.08, expo: 0.98, turb: 1.18, diskOut: 1.08, temp: 1.00, motion: 0.78 },
] as const

/**
 * Destination-specific entrance direction. The view still converges through
 * physical camera damping; these values only choreograph the reveal.
 */
const VIEW_TRANSITIONS = [
  { duration: 1.35, dip: 0.07, focus: 0.03, starStart: 0.78, starDelay: 0.04, diskStart: 0.88, diskDelay: 0.00, streakStart: 0.55, streakDelay: 0.12, rollKick: 0.8, clockDelay: 0.04 },
  { duration: 1.55, dip: 0.10, focus: 0.05, starStart: 0.68, starDelay: 0.08, diskStart: 0.78, diskDelay: 0.00, streakStart: 0.16, streakDelay: 0.28, rollKick: -1.4, clockDelay: 0.10 },
  { duration: 2.10, dip: 0.20, focus: 0.13, starStart: 0.44, starDelay: 0.20, diskStart: 0.62, diskDelay: 0.08, streakStart: 0.18, streakDelay: 0.34, rollKick: 1.2, clockDelay: 0.22 },
  { duration: 1.70, dip: 0.08, focus: 0.04, starStart: 0.70, starDelay: 0.08, diskStart: 0.76, diskDelay: 0.02, streakStart: 0.18, streakDelay: 0.24, rollKick: 2.0, clockDelay: 0.10 },
  { duration: 1.45, dip: 0.13, focus: 0.08, starStart: 0.58, starDelay: 0.10, diskStart: 0.82, diskDelay: 0.00, streakStart: 0.36, streakDelay: 0.18, rollKick: -1.2, clockDelay: 0.12 },
  { duration: 2.25, dip: 0.16, focus: 0.02, starStart: 0.20, starDelay: 0.18, diskStart: 1.20, diskDelay: 0.00, streakStart: 0.08, streakDelay: 0.42, rollKick: 0.8, clockDelay: 0.30 },
  { duration: 1.85, dip: 0.08, focus: 0.00, starStart: 0.42, starDelay: 0.10, diskStart: 0.72, diskDelay: 0.04, streakStart: 0.28, streakDelay: 0.22, rollKick: 2.8, clockDelay: 0.12 },
  { duration: 1.95, dip: 0.18, focus: 0.09, starStart: 0.52, starDelay: 0.12, diskStart: 0.74, diskDelay: 0.02, streakStart: 0.03, streakDelay: 0.44, rollKick: -2.5, clockDelay: 0.18 },
  { duration: 1.80, dip: 0.08, focus: 0.04, starStart: 0.62, starDelay: 0.08, diskStart: 0.78, diskDelay: 0.02, streakStart: 0.12, streakDelay: 0.30, rollKick: 3.2, clockDelay: 0.14 },
] as const

/** HyperOS-inspired poster behaviour: the clock is part of the composition. */
const CLOCK_ARTS = [
  { name: 'poster',  scale: 1.04, width: 3.22, near: 0.56, yBias: -0.34, depth: 0.72 },
  { name: 'horizon', scale: 0.96, width: 3.38, near: 0.58, yBias:  0.56, depth: 0.58 },
  { name: 'eclipse', scale: 1.18, width: 3.48, near: 0.94, yBias: -0.18, depth: 0.90 },
  { name: 'orbit',   scale: 1.02, width: 3.12, near: 0.62, yBias: -0.92, depth: 0.66 },
  { name: 'crop',    scale: 1.08, width: 3.20, near: 0.82, yBias:  0.48, depth: 0.82 },
  { name: 'quiet',   scale: 0.82, width: 3.05, near: 0.14, yBias: -0.10, depth: 0.00 },
  { name: 'caption', scale: 0.88, width: 3.08, near: 0.20, yBias:  0.10, depth: 0.00 },
  { name: 'blade',   scale: 1.08, width: 3.32, near: 0.88, yBias:  0.64, depth: 0.86 },
  { name: 'orbit',   scale: 1.00, width: 3.12, near: 0.72, yBias: -1.02, depth: 0.74 },
] as const

const COMPOSITIONS: Record<
  WpSettings['composition'],
  { shift: [number, number]; dist: number; roll: number }
> = {
  cinematic: { shift: [0.58, -0.05], dist: 0.84, roll: -5.5 },
  horizon: { shift: [-0.76, -0.46], dist: 0.68, roll: 3.5 },
  terminal: { shift: [0.64, 0.34], dist: 0.91, roll: -9.0 },
  centered: { shift: [0, 0], dist: 1.0, roll: 0 },
  void: { shift: [0.70, 0.18], dist: 1.48, roll: 7.0 },
  close: { shift: [0.48, -0.12], dist: 0.52, roll: -4.0 },
}

const PALETTES: Record<string, number> = {
  crimson: 0.62,
  ember: 1.0,
  gold: 1.18,
  blue: 1.8,
}

const COMPANION_AZ = 2.4
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

type V3 = [number, number, number]
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
const smooth01 = (v: number) => {
  const x = clamp(v, 0, 1)
  return x * x * (3 - 2 * x)
}
const reveal = (p: number, start: number, delay: number) =>
  start + (1 - start) * smooth01((p - delay) / Math.max(1 - delay, 1e-4))

function rollBasis(right: V3, up: V3, degrees: number): { right: V3; up: V3 } {
  const a = (degrees * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return {
    right: [
      right[0] * c + up[0] * s,
      right[1] * c + up[1] * s,
      right[2] * c + up[2] * s,
    ],
    up: [up[0] * c - right[0] * s, up[1] * c - right[1] * s, up[2] * c - right[2] * s],
  }
}

function Seg(props: {
  cur: string
  opts: [string, string][]
  on: (v: string) => void
  grid?: boolean
}) {
  return (
    <div className={`wopts${props.grid ? ' wgrid3' : ''}`}>
      {props.opts.map(([v, label]) => (
        <span
          key={v}
          className={`opt${props.cur === v ? ' on' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => props.on(v)}
          onKeyDown={(e: React.KeyboardEvent<HTMLSpanElement>) => {
            if (e.key === 'Enter') props.on(v)
          }}
        >
          {label}
        </span>
      ))}
    </div>
  )
}

function Group(props: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="wctl">
      <div className="wlab">
        <span>{props.label}</span>
        {props.value && <b>{props.value}</b>}
      </div>
      {props.children}
    </div>
  )
}

export default function Wallpaper() {
  const glRef = useRef<HTMLCanvasElement>(null)
  const trailRef = useRef<HTMLCanvasElement>(null)
  const hRef = useRef<HTMLSpanElement>(null)
  const mRef = useRef<HTMLSpanElement>(null)
  const secRef = useRef<HTMLElement>(null)
  const barRef = useRef<HTMLElement>(null)
  const dateRef = useRef<HTMLDivElement>(null)
  const clockRef = useRef<HTMLDivElement>(null)
  const timeMaskRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<Renderer | null>(null)

  const [s, setS] = useState<WpSettings>(load)
  const sRef = useRef(s)
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    sRef.current = s
    save(s)
  }, [s])

  useEffect(() => bindWallpaperEngine((patch) => setS((p) => ({ ...p, ...patch }))), [])

  useEffect(() => {
    const r = rendererRef.current
    if (!r) return
    if (s.quality === 'eco') {
      r.tier = 0
      r.scale = 0.5
    } else if (s.quality === 'max') {
      r.tier = 2
      r.scale = 1
    }
    r.setSize(window.innerWidth, window.innerHeight)
  }, [s.quality])

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.wp-panel,.wp-hot')) setOpen(false)
    }
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [open])

  useEffect(() => {
    let renderer: Renderer
    try {
      renderer = new Renderer(glRef.current!)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      return
    }
    rendererRef.current = renderer

    const trailCanvas = trailRef.current!
    const tctx = trailCanvas.getContext('2d')!
    const tdpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const initialView = clamp(Math.round(sRef.current.view), 0, 8)
    const initialP = PRESETS[initialView]
    const initialV = VIEW_DIRECTORS[initialView]
    const initialC = COMPOSITIONS[sRef.current.composition]
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    const st = {
      raf: 0,
      last: performance.now(),
      clock: 0,
      azim: 0.6,
      ptx: 0,
      pty: 0,
      ptxT: 0,
      ptyT: 0,
      dist: initialP.dist,
      incl: initialP.incl,
      fov: initialP.fov,
      expo: initialP.expo * initialV.expo,
      disk: initialP.disk * initialV.disk,
      star: initialP.star * initialV.star,
      shiftX: initialC.shift[0] + initialV.shift[0],
      shiftY: initialC.shift[1] + initialV.shift[1],
      roll: initialC.roll + initialV.roll,
      temp: (PALETTES[sRef.current.palette] ?? 1) * initialV.temp,
      dout: (14 + 18 * sRef.current.diskSize) * initialV.diskOut,
      turbV: clamp(sRef.current.turb * initialV.turb, 0, 1),
      glowV: clamp(sRef.current.glow * initialV.glow, 0, 1.25),
      streakV: clamp(sRef.current.streak * initialV.streak, 0, 1.4),
      diskClock: 0,
      clockX: window.innerWidth * 0.18,
      clockY: window.innerHeight * 0.82,
      activeView: initialView,
      transitionT: 1,
      transitionDur: VIEW_TRANSITIONS[initialView].duration,
      lastSec: -1,
      lastClockKey: '',
    }

    const trail: { x: number; y: number; t: number }[] = []

    const resize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight)
      trailCanvas.width = Math.round(window.innerWidth * tdpr)
      trailCanvas.height = Math.round(window.innerHeight * tdpr)
    }
    resize()
    window.addEventListener('resize', resize)

    const onMove = (e: MouseEvent) => {
      st.ptxT = (e.clientX / window.innerWidth) * 2 - 1
      st.ptyT = (e.clientY / window.innerHeight) * 2 - 1
      if (sRef.current.trail) {
        const last = trail[trail.length - 1]
        if (!last || Math.hypot(e.clientX - last.x, e.clientY - last.y) > 4) {
          trail.push({ x: e.clientX, y: e.clientY, t: performance.now() })
          if (trail.length > 140) trail.shift()
        }
      }
    }
    window.addEventListener('mousemove', onMove)

    const loop = (now: number) => {
      st.raf = requestAnimationFrame(loop)
      const dt = Math.min(now - st.last, 50)
      st.last = now
      st.clock += dt / 1000
      const set = sRef.current

      const view = clamp(Math.round(set.view), 0, 8)
      if (view !== st.activeView) {
        st.activeView = view
        st.transitionT = reduceMotion ? 1 : 0
        st.transitionDur = VIEW_TRANSITIONS[view].duration
      }
      if (st.transitionT < 1)
        st.transitionT = Math.min(1, st.transitionT + dt / 1000 / st.transitionDur)

      const P = PRESETS[view]
      const V = VIEW_DIRECTORS[view]
      const T = VIEW_TRANSITIONS[view]
      const A = CLOCK_ARTS[view]
      const C = COMPOSITIONS[set.composition]
      const w = window.innerWidth
      const h = window.innerHeight
      const portrait = w < h
      const compScale = portrait ? 0.56 : 1
      const sceneRate = st.transitionT < 1 ? 1.45 : 2.2
      const k = 1 - Math.exp((-dt / 1000) * sceneRate)

      st.azim += (dt / 1000) * (0.006 + set.drift * 0.03) * V.motion
      st.dist += (P.dist * C.dist * V.framing * (1.35 - 0.7 * set.zoom) - st.dist) * k
      st.incl += (P.incl + (set.tilt - 0.5) * 20 - st.incl) * k
      st.fov += (P.fov - st.fov) * k
      st.expo += (P.expo * (0.6 + 0.8 * set.expo) * V.expo - st.expo) * k
      st.disk += (P.disk * (0.4 + 1.2 * set.diskBright) * V.disk - st.disk) * k
      st.star += (P.star * V.star - st.star) * k
      st.shiftX += ((C.shift[0] + V.shift[0]) * compScale - st.shiftX) * k
      st.shiftY += ((C.shift[1] + V.shift[1]) * compScale - st.shiftY) * k
      st.roll += ((C.roll + V.roll) * (portrait ? 0.72 : 1) - st.roll) * k
      st.temp += ((PALETTES[set.palette] ?? 1) * V.temp - st.temp) * k
      st.dout += (clamp((14 + 18 * set.diskSize) * V.diskOut, 12, 34) - st.dout) * k
      st.turbV += (clamp(set.turb * V.turb, 0, 1) - st.turbV) * k
      st.glowV += (clamp(set.glow * V.glow, 0, 1.25) - st.glowV) * k
      st.streakV += (clamp(set.streak * V.streak, 0, 1.4) - st.streakV) * k

      st.diskClock += (dt / 1000) * TIME_SCALE * (set.spin * 2.2)
      const damp = 1 - Math.exp((-dt / 1000) * 3.2)
      st.ptx += (st.ptxT - st.ptx) * damp
      st.pty += (st.ptyT - st.pty) * damp

      const tp = st.transitionT
      const te = smooth01(tp)
      const pulse = Math.sin(Math.PI * tp)
      const starReveal = reveal(tp, T.starStart, T.starDelay)
      const diskReveal = reveal(tp, T.diskStart, T.diskDelay)
      const streakReveal = reveal(tp, T.streakStart, T.streakDelay)
      const transitionExposure = 1 - T.dip * pulse
      const transitionFocus = 1 - T.focus * pulse
      const rollTransient = T.rollKick * pulse * (1 - te)
      const clockReveal = 0.56 + 0.44 * smooth01((tp - T.clockDelay) / Math.max(1 - T.clockDelay, 1e-4))

      const breath = Math.sin(st.clock * 0.18) * 0.5
      const incl = Math.min(Math.max(st.incl + breath + st.pty * 2.6 * set.parallax, 12), 89.8)
      const azim = st.azim + st.ptx * 0.07 * set.parallax
      const cam = cameraFrom(st.dist, incl, azim, st.fov)
      const basis = rollBasis(cam.right as V3, cam.up as V3, st.roll + rollTransient)

      let thf = cam.tanHalfFov * transitionFocus
      if (portrait) thf *= h / w

      const comp = cameraFrom(1, incl, COMPANION_AZ, 55).pos
      const compDir: V3 = (() => {
        const l = Math.hypot(comp[0], comp[1], comp[2]) || 1
        return [-comp[0] / l, -comp[1] / l, -comp[2] / l]
      })()

      const sx = basis.up[1]
      const sy = -basis.right[1]
      const sl = Math.hypot(sx, sy)
      const streakDir: [number, number] = sl > 1e-4 ? [sx / sl, sy / sl] : [1, 0]

      const align = Math.max(
        0,
        cam.fwd[0] * compDir[0] + cam.fwd[1] * compDir[1] + cam.fwd[2] * compDir[2],
      )
      const lensPulse = 0.042 * Math.pow(align, 1050)
      const lensShift: [number, number] = [
        st.shiftX + st.ptx * 0.024 * set.parallax,
        st.shiftY - st.pty * 0.018 * set.parallax,
      ]

      if (set.quality === 'auto') renderer.adapt(dt)
      renderer.render({
        camPos: cam.pos,
        right: basis.right,
        up: basis.up,
        fwd: cam.fwd,
        tanHalfFov: thf,
        lensShift,
        time: st.diskClock,
        wallTime: st.clock,
        diskGain: st.disk * diskReveal,
        starGain: (0.25 + 1.5 * set.stars) * st.star * starReveal,
        falseColor: 0,
        exposure: st.expo * transitionExposure * (1 + lensPulse),
        markPhoton: 0,
        markIsco: 0,
        companionDir: compDir,
        tempScale: st.temp,
        diskOut: st.dout,
        turb: st.turbV,
        bloomAmt: 1.7 * st.glowV * (0.76 + 0.24 * te),
        streakDir,
        streakAmt: set.quality === 'eco' ? 0 : st.streakV * streakReveal,
      })

      if (set.clock !== 'off') {
        const d = new Date()
        const ms = d.getMilliseconds()
        const cs = d.getSeconds()

        if (barRef.current)
          barRef.current.style.left = `${(((cs + ms / 1000) / 60) * 100).toFixed(2)}%`

        if (clockRef.current) {
          const node = clockRef.current
          node.dataset.art = A.name
          node.style.setProperty('--clock-enter', clockReveal.toFixed(3))

          if (set.clockAdaptive) {
            const holeX = 0.5 + lensShift[0] * 0.5
            const holeY = 0.5 - lensShift[1] * 0.5
            const holePxX = holeX * w
            const holePxY = holeY * h
            const shortEdge = Math.min(w, h)
            const shadowR = clamp((5.196 / Math.max(st.dist, 5.5) / Math.max(thf, 0.055)) * h * 0.5, 26, shortEdge * 0.30)
            const base = clamp(shortEdge * 0.064 * A.scale, 28, A.name === 'eclipse' ? 98 : 88)
            const occupancy = clamp(0.84 + C.dist * V.framing * 0.16, 0.82, 1.08)
            const widthFactor = A.width + (set.clock === '12' ? 0.82 : set.seconds ? 0.58 : 0)
            const maxByWidth = Math.max(28, (w - 36) / widthFactor)
            const autoSize = Math.min(base * occupancy, maxByWidth)
            const widthPx = autoSize * widthFactor
            const heightPx = autoSize * (0.98 + (set.bar ? 0.22 : 0) + (set.date !== 'off' ? 0.34 : 0))
            const safeX = clamp(w * 0.038, 18, 76)
            const safeY = clamp(h * 0.052, 20, 74)
            const subjectRight = holePxX >= w * 0.5
            const subjectLow = holePxY >= h * 0.52

            const farX = subjectRight ? safeX + widthPx * 0.5 : w - safeX - widthPx * 0.5
            const overlap = widthPx * (A.name === 'eclipse' ? 0.16 : A.name === 'blade' ? 0.11 : 0.075)
            const nearX = subjectRight
              ? holePxX - shadowR + overlap - widthPx * 0.5
              : holePxX + shadowR - overlap + widthPx * 0.5
            let tx = farX + (nearX - farX) * A.near

            const farY = subjectLow ? safeY + heightPx * 0.5 : h - safeY - heightPx * 0.5
            const nearY = holePxY + A.yBias * shadowR
            let ty = farY + (nearY - farY) * Math.min(A.near * 0.82, 0.78)

            if (portrait && (A.name === 'orbit' || A.name === 'eclipse') && Math.abs(lensShift[0]) < 0.30)
              tx = w * 0.5

            tx = clamp(tx, safeX + widthPx * 0.5, w - safeX - widthPx * 0.5)
            ty = clamp(ty, safeY + heightPx * 0.5, h - safeY - heightPx * 0.5)

            const ck = 1 - Math.exp((-dt / 1000) * (st.transitionT < 1 ? 2.2 : 3.8))
            st.clockX += (tx - st.clockX) * ck
            st.clockY += (ty - st.clockY) * ck

            const alignText: 'left' | 'right' | 'center' =
              A.name === 'eclipse' || A.name === 'orbit'
                ? 'center'
                : st.clockX < holePxX
                  ? 'left'
                  : 'right'

            node.style.left = `${st.clockX.toFixed(1)}px`
            node.style.top = `${st.clockY.toFixed(1)}px`
            node.style.removeProperty('right')
            node.style.removeProperty('bottom')
            node.style.setProperty('--clock-auto-size', `${autoSize.toFixed(1)}px`)
            node.style.setProperty('--clock-width', `${widthPx.toFixed(1)}px`)
            node.style.setProperty('--shadow-r', `${shadowR.toFixed(1)}px`)
            node.dataset.align = alignText

            const maskNode = timeMaskRef.current
            if (maskNode && A.depth > 0.01 && st.transitionT > 0.44) {
              const rect = maskNode.getBoundingClientRect()
              const rx = holePxX - rect.left
              const ry = holePxY - rect.top
              const dx = Math.max(Math.abs(holePxX - (rect.left + rect.width * 0.5)) - rect.width * 0.5, 0)
              const dy = Math.max(Math.abs(holePxY - (rect.top + rect.height * 0.5)) - rect.height * 0.5, 0)
              const maskR = shadowR * A.depth
              const intersects = Math.hypot(dx, dy) < maskR * 0.92
              const centreDist = Math.hypot(
                holePxX - (rect.left + rect.width * 0.5),
                holePxY - (rect.top + rect.height * 0.5),
              )
              const legible = centreDist > maskR * 0.30 || A.name === 'eclipse'

              if (intersects && legible) {
                node.dataset.depth = 'on'
                node.style.setProperty('--depth-x', `${rx.toFixed(1)}px`)
                node.style.setProperty('--depth-y', `${ry.toFixed(1)}px`)
                node.style.setProperty('--depth-in', `${Math.max(maskR - 4, 1).toFixed(1)}px`)
                node.style.setProperty('--depth-mid', `${(maskR + 2).toFixed(1)}px`)
                node.style.setProperty('--depth-out', `${(maskR + 10).toFixed(1)}px`)
              } else {
                delete node.dataset.depth
              }
            } else {
              delete node.dataset.depth
            }
          } else {
            node.style.removeProperty('left')
            node.style.removeProperty('top')
            node.style.removeProperty('right')
            node.style.removeProperty('bottom')
            node.style.removeProperty('--clock-auto-size')
            node.style.removeProperty('--clock-width')
            delete node.dataset.align
            delete node.dataset.depth
          }
        }

        const key = `${set.clock}|${set.seconds}|${set.date}`
        if (cs !== st.lastSec || key !== st.lastClockKey) {
          st.lastSec = cs
          st.lastClockKey = key
          const mm = String(d.getMinutes()).padStart(2, '0')
          const ss = String(cs).padStart(2, '0')
          const hr = d.getHours()

          if (set.clock === '24') {
            if (hRef.current) hRef.current.textContent = String(hr).padStart(2, '0')
            if (secRef.current) secRef.current.textContent = set.seconds ? ss : ''
          } else {
            if (hRef.current) hRef.current.textContent = String(((hr + 11) % 12) + 1).padStart(2, '0')
            if (secRef.current)
              secRef.current.textContent = set.seconds ? `${ss} ${hr < 12 ? 'AM' : 'PM'}` : hr < 12 ? 'AM' : 'PM'
          }
          if (mRef.current) mRef.current.textContent = mm
          if (dateRef.current) {
            const doy = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 864e5)
            const wk = Math.max(1, Math.ceil(doy / 7))
            dateRef.current.textContent =
              `${DAYS[d.getDay()]} · ${MONTHS[d.getMonth()]} ${d.getDate()}` +
              (set.date === 'full' ? ` · DOY ${doy} · WK ${wk}` : '')
          }
        }
      }

      tctx.clearRect(0, 0, trailCanvas.width, trailCanvas.height)
      if (set.trail && trail.length > 1) {
        while (trail.length && now - trail[0].t > 900) trail.shift()
        tctx.globalCompositeOperation = 'lighter'
        tctx.lineCap = 'round'
        for (let i = 1; i < trail.length; i++) {
          const a = trail[i - 1]
          const b = trail[i]
          const age = (now - b.t) / 900
          const alpha = Math.max(1 - age, 0)
          tctx.strokeStyle = `rgba(111, 213, 206, ${(alpha * alpha * 0.5).toFixed(3)})`
          tctx.lineWidth = (0.6 + alpha * 0.9) * tdpr
          tctx.beginPath()
          tctx.moveTo(a.x * tdpr, a.y * tdpr)
          tctx.lineTo(b.x * tdpr, b.y * tdpr)
          tctx.stroke()
        }
      }
    }

    st.raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(st.raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
    }
  }, [])

  const pct = (x: number) => Math.round(x * 100)
  type SliderKey =
    | 'stars'
    | 'drift'
    | 'parallax'
    | 'tilt'
    | 'zoom'
    | 'diskBright'
    | 'diskSize'
    | 'turb'
    | 'spin'
    | 'glow'
    | 'streak'
    | 'expo'

  const slider = (label: string, key: SliderKey, fmt?: (x: number) => string) => (
    <Group label={label} value={fmt ? fmt(s[key]) : `${pct(s[key])}%`}>
      <input
        type="range"
        min={0}
        max={100}
        value={pct(s[key])}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setS({ ...s, [key]: Number(e.target.value) / 100 } as WpSettings)
        }
      />
    </Group>
  )

  const autoAccent = s.palette === 'blue' ? 'cyan' : 'ember'
  const clockAccent = s.accent === 'auto' ? autoAccent : s.accent
  const clockLayout = s.clockAdaptive ? ' adaptive' : ` p-${s.clockPos} sz-${s.clockSize}`

  return (
    <>
      <canvas id="gl" ref={glRef} />
      <canvas className="wp-trail" ref={trailRef} />

      {s.clock !== 'off' && (
        <div
          ref={clockRef}
          className={`wp-clock${clockLayout} ac-${clockAccent} f-${s.font}`}
        >
          <div className="depth-time" ref={timeMaskRef}>
            <div className="t">
              <span className="hour" ref={hRef} />
              <span className="minute" ref={mRef} />
              <i ref={secRef} />
            </div>
          </div>
          {s.bar && (
            <div className="sbar" aria-hidden="true">
              <i ref={barRef} />
            </div>
          )}
          {s.date !== 'off' && <div className="d" ref={dateRef} />}
        </div>
      )}

      <div
        className="wp-hot"
        role="button"
        tabIndex={0}
        aria-label="settings"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter') setOpen((o) => !o)
        }}
      />

      <aside className={`wp-panel${open ? ' open' : ''}`}>
        <div className="ht">Schwarzschild</div>

        <div className="wp-sec">composition</div>
        <Group label="framing">
          <Seg
            grid
            cur={s.composition}
            opts={[
              ['cinematic', 'cinematic'],
              ['horizon', 'horizon'],
              ['terminal', 'terminal'],
              ['centered', 'center'],
              ['void', 'void'],
              ['close', 'close'],
            ]}
            on={(v) => setS({ ...s, composition: v as WpSettings['composition'] })}
          />
        </Group>

        <Group label="view · directed">
          <Seg
            grid
            cur={String(s.view)}
            opts={[
              ['0', 'signature'],
              ['1', 'edge-on'],
              ['7', 'knife-edge'],
              ['2', 'ring'],
              ['4', 'near'],
              ['3', 'face-on'],
              ['8', 'polar'],
              ['5', 'silhouette'],
              ['6', 'wide'],
            ]}
            on={(v) => setS({ ...s, view: Number(v) })}
          />
        </Group>

        {slider('tilt', 'tilt', (x) => `${((x - 0.5) * 20).toFixed(0)}°`)}
        {slider('zoom', 'zoom', (x) => `×${(1.35 - 0.7 * x).toFixed(2)}`)}
        {slider('orbit drift', 'drift')}
        {slider('parallax', 'parallax')}

        <div className="wp-sec">disk</div>
        <Group label="palette">
          <Seg
            cur={s.palette}
            opts={[
              ['crimson', 'crimson'],
              ['ember', 'ember'],
              ['gold', 'gold'],
              ['blue', 'blue'],
            ]}
            on={(v) => setS({ ...s, palette: v as WpSettings['palette'] })}
          />
        </Group>
        {slider('brightness', 'diskBright')}
        {slider('outer radius', 'diskSize', (x) => `${Math.round(14 + 18 * x)} M`)}
        {slider('turbulence', 'turb')}
        {slider('rotation', 'spin', (x) => `×${(x * 2.2).toFixed(1)}`)}

        <div className="wp-sec">image</div>
        {slider('stars', 'stars')}
        {slider('bloom', 'glow')}
        {slider('streak', 'streak')}
        {slider('exposure', 'expo', (x) => `×${(0.6 + 0.8 * x).toFixed(2)}`)}
        <div className="wpair">
          <Group label="trail">
            <Seg
              cur={s.trail ? 'on' : 'off'}
              opts={[
                ['off', 'off'],
                ['on', 'on'],
              ]}
              on={(v) => setS({ ...s, trail: v === 'on' })}
            />
          </Group>
          <Group label="quality">
            <Seg
              cur={s.quality}
              opts={[
                ['auto', 'auto'],
                ['eco', 'eco'],
                ['max', 'max'],
              ]}
              on={(v) => setS({ ...s, quality: v as WpSettings['quality'] })}
            />
          </Group>
        </div>

        <div className="wp-sec">clock</div>
        <div className="wpair">
          <Group label="mode">
            <Seg
              cur={s.clock}
              opts={[
                ['off', 'off'],
                ['24', '24h'],
                ['12', '12h'],
              ]}
              on={(v) => setS({ ...s, clock: v as WpSettings['clock'] })}
            />
          </Group>
          {s.clock !== 'off' ? (
            <Group label="layout">
              <Seg
                cur={s.clockAdaptive ? 'adaptive' : 'manual'}
                opts={[
                  ['adaptive', 'adaptive'],
                  ['manual', 'manual'],
                ]}
                on={(v) => setS({ ...s, clockAdaptive: v === 'adaptive' })}
              />
            </Group>
          ) : (
            <div />
          )}
        </div>

        {s.clock !== 'off' && (
          <>
            <div className="wpair">
              <Group label="font">
                <Seg
                  cur={s.font}
                  opts={[
                    ['mono', 'mono'],
                    ['display', 'disp'],
                    ['thin', 'thin'],
                  ]}
                  on={(v) => setS({ ...s, font: v as WpSettings['font'] })}
                />
              </Group>
              <Group label="accent">
                <Seg
                  cur={s.accent}
                  opts={[
                    ['auto', 'auto'],
                    ['cyan', 'cyan'],
                    ['ember', 'warm'],
                    ['mono', 'mono'],
                  ]}
                  on={(v) => setS({ ...s, accent: v as WpSettings['accent'] })}
                />
              </Group>
            </div>

            {!s.clockAdaptive && (
              <>
                <Group label="position">
                  <Seg
                    cur={s.clockPos}
                    opts={[
                      ['tl', 'top·L'],
                      ['tr', 'top·R'],
                      ['bl', 'low·L'],
                      ['bc', 'low·C'],
                      ['br', 'low·R'],
                    ]}
                    on={(v) => setS({ ...s, clockPos: v as WpSettings['clockPos'] })}
                  />
                </Group>
                <Group label="size">
                  <Seg
                    cur={s.clockSize}
                    opts={[
                      ['s', 'small'],
                      ['m', 'medium'],
                      ['l', 'large'],
                    ]}
                    on={(v) => setS({ ...s, clockSize: v as WpSettings['clockSize'] })}
                  />
                </Group>
              </>
            )}

            <div className="wpair">
              <Group label="minute scale">
                <Seg
                  cur={s.bar ? 'on' : 'off'}
                  opts={[
                    ['off', 'off'],
                    ['on', 'on'],
                  ]}
                  on={(v) => setS({ ...s, bar: v === 'on' })}
                />
              </Group>
              <Group label="seconds">
                <Seg
                  cur={s.seconds ? 'on' : 'off'}
                  opts={[
                    ['off', 'off'],
                    ['on', 'on'],
                  ]}
                  on={(v) => setS({ ...s, seconds: v === 'on' })}
                />
              </Group>
            </div>

            <Group label="date">
              <Seg
                cur={s.date}
                opts={[
                  ['off', 'off'],
                  ['date', 'date'],
                  ['full', 'full'],
                ]}
                on={(v) => setS({ ...s, date: v as WpSettings['date'] })}
              />
            </Group>
          </>
        )}

        <div
          className="wp-reset"
          role="button"
          tabIndex={0}
          onClick={() => setS({ ...DEFAULTS })}
          onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Enter') setS({ ...DEFAULTS })
          }}
        >
          reset defaults
        </div>
      </aside>

      {err && (
        <div className="boot">
          <div className="bw">
            <div className="bt">Schwarzschild</div>
            <div className="berr">This wallpaper needs WebGL2. {err}</div>
          </div>
        </div>
      )}
    </>
  )
}
