import { useEffect, useRef, useState } from 'react'
import { Renderer } from '../gl/renderer'
import { cameraFrom } from '../scene/timeline'
import { TIME_SCALE } from '../physics/constants'
import {
  bindWallpaperEngine,
  CUSTOM_SCENE_DEFAULTS,
  DEFAULTS,
  load,
  mergeSettings,
  save,
  type CustomScene,
  type WpSettings,
} from './settings'
import {
  CAMERA_PRESETS,
  CLOCK_ART_LIBRARY,
  COMPOSITIONS,
  SCENE_PRESETS,
  SCENE_PRESET_ORDER,
  VIEW_DIRECTORS,
  VIEW_TRANSITIONS,
  type ClockArtName,
  type ScenePresetId,
} from './presets'

const PALETTES: Record<string, number> = {
  crimson: 0.62,
  ember: 1.0,
  gold: 1.18,
  blue: 1.8,
}

const COMPANION_AZ = 2.4
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const FRAMING_PRESETS = SCENE_PRESET_ORDER.filter((id) => SCENE_PRESETS[id].family === 'framing')
const OBSERVATION_PRESETS = SCENE_PRESET_ORDER.filter((id) => SCENE_PRESETS[id].family === 'observation')

type V3 = [number, number, number]
type CustomNumberKey = Exclude<{
  [K in keyof CustomScene]: CustomScene[K] extends number ? K : never
}[keyof CustomScene], undefined>

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
            if (e.key === 'Enter' || e.key === ' ') props.on(v)
          }}
        >
          {label}
        </span>
      ))}
    </div>
  )
}

function Group(props: { label: string; value?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`wctl${props.className ? ` ${props.className}` : ''}`}>
      <div className="wlab">
        <span>{props.label}</span>
        {props.value && <b>{props.value}</b>}
      </div>
      {props.children}
    </div>
  )
}

function PresetCard(props: { id: ScenePresetId; active: boolean; onSelect: (id: ScenePresetId) => void }) {
  const p = SCENE_PRESETS[props.id]
  return (
    <button
      type="button"
      className={`preset-card${props.active ? ' on' : ''}`}
      onClick={() => props.onSelect(props.id)}
    >
      <span>{p.label}</span>
      <i>{p.short}</i>
    </button>
  )
}

function PresetCatalog(props: {
  selected: ScenePresetId
  onSelect: (id: ScenePresetId) => void
  compact?: boolean
}) {
  const group = (title: string, ids: readonly ScenePresetId[]) => (
    <div className="preset-family" key={title}>
      <div className="preset-family-title">{title}</div>
      <div className={`preset-grid${props.compact ? ' compact' : ''}`}>
        {ids.map((id) => (
          <PresetCard key={id} id={id} active={props.selected === id} onSelect={props.onSelect} />
        ))}
      </div>
    </div>
  )
  return <>{group('framing studies', FRAMING_PRESETS)}{group('observation studies', OBSERVATION_PRESETS)}</>
}

function resolveScene(s: WpSettings) {
  const isCustom = s.sceneMode === 'custom'
  const controls = isCustom ? s.custom : CUSTOM_SCENE_DEFAULTS
  const presetId = isCustom ? controls.basePreset : s.scenePreset
  const preset = SCENE_PRESETS[presetId]
  const baseComposition = COMPOSITIONS[preset.composition]

  const framingMul = isCustom ? 0.72 + controls.framing * 0.56 : 1
  const shiftX = isCustom ? (controls.shiftX - 0.5) * 0.70 : 0
  const shiftY = isCustom ? (controls.shiftY - 0.5) * 0.60 : 0
  const roll = isCustom ? (controls.roll - 0.5) * 30 : 0

  const artName: ClockArtName =
    isCustom && controls.clockArt !== 'auto' ? controls.clockArt : preset.clockArt
  const baseArt = CLOCK_ART_LIBRARY[artName]
  const art = isCustom
    ? {
        ...baseArt,
        scale: baseArt.scale * (0.72 + controls.clockScale * 0.56),
        near: clamp(baseArt.near + (controls.clockNear - 0.5) * 0.70, 0, 1),
        depth: clamp(baseArt.depth + (controls.clockDepth - 0.5) * 0.90, 0, 1),
      }
    : baseArt

  return {
    isCustom,
    controls,
    presetId,
    preset,
    view: preset.view,
    composition: {
      dist: baseComposition.dist * framingMul,
      shift: [baseComposition.shift[0] + shiftX, baseComposition.shift[1] + shiftY] as [number, number],
      roll: baseComposition.roll + roll,
    },
    art,
    clockAdaptive: isCustom ? s.clockAdaptive : true,
  }
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

  const commitSettings = (next: WpSettings) => setS(next)
  const patchCustom = (patch: Partial<CustomScene>) =>
    setS((prev) => ({ ...prev, custom: { ...prev.custom, ...patch } }))

  useEffect(() => {
    sRef.current = s
    save(s)
  }, [s])

  useEffect(
    () => bindWallpaperEngine((patch) => setS((prev) => mergeSettings(prev, patch))),
    [],
  )

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
    const initial = resolveScene(sRef.current)
    const initialP = CAMERA_PRESETS[initial.view]
    const initialV = VIEW_DIRECTORS[initial.view]
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
      shiftX: initial.composition.shift[0] + initialV.shift[0],
      shiftY: initial.composition.shift[1] + initialV.shift[1],
      roll: initial.composition.roll + initialV.roll,
      temp: (PALETTES[sRef.current.palette] ?? 1) * initialV.temp,
      dout: (14 + 18 * initial.controls.diskSize) * initialV.diskOut,
      turbV: clamp(initial.controls.turb * initialV.turb, 0, 1),
      glowV: clamp(initial.controls.glow * initialV.glow, 0, 1.25),
      streakV: clamp(initial.controls.streak * initialV.streak, 0, 1.4),
      diskClock: 0,
      clockX: window.innerWidth * 0.18,
      clockY: window.innerHeight * 0.82,
      activePreset: initial.presetId,
      transitionT: 1,
      transitionDur: VIEW_TRANSITIONS[initial.view].duration,
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
      const R = resolveScene(set)
      const P = CAMERA_PRESETS[R.view]
      const V = VIEW_DIRECTORS[R.view]
      const T = VIEW_TRANSITIONS[R.view]
      const A = R.art
      const C = R.composition
      const ctl = R.controls

      if (R.presetId !== st.activePreset) {
        st.activePreset = R.presetId
        st.transitionT = reduceMotion ? 1 : 0
        st.transitionDur = T.duration
      }
      if (st.transitionT < 1)
        st.transitionT = Math.min(1, st.transitionT + dt / 1000 / st.transitionDur)

      const w = window.innerWidth
      const h = window.innerHeight
      const portrait = w < h
      const compScale = portrait ? 0.56 : 1
      const sceneRate = st.transitionT < 1 ? 1.45 : 2.2
      const k = 1 - Math.exp((-dt / 1000) * sceneRate)

      st.azim += (dt / 1000) * (0.006 + ctl.drift * 0.03) * V.motion
      st.dist += (P.dist * C.dist * V.framing * (1.35 - 0.7 * ctl.zoom) - st.dist) * k
      st.incl += (P.incl + (ctl.tilt - 0.5) * 20 - st.incl) * k
      st.fov += (P.fov - st.fov) * k
      st.expo += (P.expo * (0.6 + 0.8 * ctl.expo) * V.expo - st.expo) * k
      st.disk += (P.disk * (0.4 + 1.2 * ctl.diskBright) * V.disk - st.disk) * k
      st.star += (P.star * V.star - st.star) * k
      st.shiftX += ((C.shift[0] + V.shift[0]) * compScale - st.shiftX) * k
      st.shiftY += ((C.shift[1] + V.shift[1]) * compScale - st.shiftY) * k
      st.roll += ((C.roll + V.roll) * (portrait ? 0.72 : 1) - st.roll) * k
      st.temp += ((PALETTES[set.palette] ?? 1) * V.temp - st.temp) * k
      st.dout += (clamp((14 + 18 * ctl.diskSize) * V.diskOut, 12, 34) - st.dout) * k
      st.turbV += (clamp(ctl.turb * V.turb, 0, 1) - st.turbV) * k
      st.glowV += (clamp(ctl.glow * V.glow, 0, 1.25) - st.glowV) * k
      st.streakV += (clamp(ctl.streak * V.streak, 0, 1.4) - st.streakV) * k

      st.diskClock += (dt / 1000) * TIME_SCALE * (ctl.spin * 2.2)
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
      const incl = clamp(st.incl + breath + st.pty * 2.6 * ctl.parallax, 12, 89.8)
      const azim = st.azim + st.ptx * 0.07 * ctl.parallax
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
      const align = Math.max(0, cam.fwd[0] * compDir[0] + cam.fwd[1] * compDir[1] + cam.fwd[2] * compDir[2])
      const lensPulse = 0.042 * Math.pow(align, 1050)
      const lensShift: [number, number] = [
        st.shiftX + st.ptx * 0.024 * ctl.parallax,
        st.shiftY - st.pty * 0.018 * ctl.parallax,
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
        starGain: (0.25 + 1.5 * ctl.stars) * st.star * starReveal,
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

          if (R.clockAdaptive) {
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
              A.name === 'eclipse' || A.name === 'orbit' ? 'center' : st.clockX < holePxX ? 'left' : 'right'

            node.style.left = `${st.clockX.toFixed(1)}px`
            node.style.top = `${st.clockY.toFixed(1)}px`
            node.style.removeProperty('right')
            node.style.removeProperty('bottom')
            node.style.setProperty('--clock-auto-size', `${autoSize.toFixed(1)}px`)
            node.style.setProperty('--clock-width', `${widthPx.toFixed(1)}px`)
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
              const centreDist = Math.hypot(holePxX - (rect.left + rect.width * 0.5), holePxY - (rect.top + rect.height * 0.5))
              const legible = centreDist > maskR * 0.30 || A.name === 'eclipse'

              if (intersects && legible) {
                node.dataset.depth = 'on'
                node.style.setProperty('--depth-x', `${rx.toFixed(1)}px`)
                node.style.setProperty('--depth-y', `${ry.toFixed(1)}px`)
                node.style.setProperty('--depth-in', `${Math.max(maskR - 4, 1).toFixed(1)}px`)
                node.style.setProperty('--depth-mid', `${(maskR + 2).toFixed(1)}px`)
                node.style.setProperty('--depth-out', `${(maskR + 10).toFixed(1)}px`)
              } else delete node.dataset.depth
            } else delete node.dataset.depth
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
  const customSlider = (label: string, key: CustomNumberKey, fmt?: (x: number) => string) => {
    const value = s.custom[key] as number
    return (
      <Group label={label} value={fmt ? fmt(value) : `${pct(value)}%`}>
        <input
          type="range"
          min={0}
          max={100}
          value={pct(value)}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => patchCustom({ [key]: Number(e.target.value) / 100 })}
        />
      </Group>
    )
  }

  const selectedId = s.sceneMode === 'preset' ? s.scenePreset : s.custom.basePreset
  const selectedPreset = SCENE_PRESETS[selectedId]
  const effectiveAdaptive = s.sceneMode === 'preset' ? true : s.clockAdaptive
  const autoAccent = s.palette === 'blue' ? 'cyan' : 'ember'
  const clockAccent = s.accent === 'auto' ? autoAccent : s.accent
  const clockLayout = effectiveAdaptive ? ' adaptive' : ` p-${s.clockPos} sz-${s.clockSize}`

  const enterCustom = (basePreset: ScenePresetId) => {
    commitSettings({
      ...s,
      sceneMode: 'custom',
      custom: { ...CUSTOM_SCENE_DEFAULTS, basePreset },
    })
  }
  const setCustomBase = (basePreset: ScenePresetId) =>
    commitSettings({ ...s, custom: { ...CUSTOM_SCENE_DEFAULTS, basePreset } })

  return (
    <>
      <canvas id="gl" ref={glRef} />
      <canvas className="wp-trail" ref={trailRef} />

      {s.clock !== 'off' && (
        <div ref={clockRef} className={`wp-clock${clockLayout} ac-${clockAccent} f-${s.font}`}>
          <div className="depth-time" ref={timeMaskRef}>
            <div className="t">
              <span className="hour" ref={hRef} />
              <span className="minute" ref={mRef} />
              <i ref={secRef} />
            </div>
          </div>
          {s.bar && <div className="sbar" aria-hidden="true"><i ref={barRef} /></div>}
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

      <aside className={`wp-panel panel-v2${open ? ' open' : ''}`}>
        <div className="panel-head">
          <div>
            <div className="ht">Schwarzschild</div>
            <div className="panel-sub">{s.sceneMode === 'preset' ? 'directed preset' : `custom · ${selectedPreset.label}`}</div>
          </div>
          <span className="panel-state">{s.sceneMode}</span>
        </div>

        <div className="mode-switch">
          <Seg
            cur={s.sceneMode}
            opts={[[ 'preset', 'presets' ], [ 'custom', 'custom' ]]}
            on={(v) => {
              if (v === 'preset') commitSettings({ ...s, sceneMode: 'preset', scenePreset: selectedId })
              else if (s.custom.basePreset === s.scenePreset) commitSettings({ ...s, sceneMode: 'custom' })
              else enterCustom(s.scenePreset)
            }}
          />
        </div>

        <section className="panel-block scene-block">
          <div className="wp-sec">scene</div>
          {s.sceneMode === 'preset' ? (
            <>
              <PresetCatalog selected={s.scenePreset} onSelect={(scenePreset) => commitSettings({ ...s, scenePreset })} />
              <div className="preset-note">
                <b>{selectedPreset.label}</b>
                <span>{selectedPreset.description}</span>
                <button type="button" onClick={() => enterCustom(s.scenePreset)}>customize this preset</button>
              </div>
            </>
          ) : (
            <>
              <div className="base-label">base preset · immutable source</div>
              <PresetCatalog selected={s.custom.basePreset} onSelect={setCustomBase} compact />
              <div className="preset-note custom-note">
                <b>{selectedPreset.label}</b>
                <span>{selectedPreset.description}</span>
                <button type="button" onClick={() => setCustomBase(s.custom.basePreset)}>restore base values</button>
              </div>

              <details className="wp-fold" open>
                <summary>camera / framing</summary>
                {customSlider('framing', 'framing', (x) => `×${(0.72 + x * 0.56).toFixed(2)}`)}
                <div className="wpair">
                  {customSlider('shift x', 'shiftX', (x) => `${((x - 0.5) * 0.70).toFixed(2)}`)}
                  {customSlider('shift y', 'shiftY', (x) => `${((x - 0.5) * 0.60).toFixed(2)}`)}
                </div>
                <div className="wpair">
                  {customSlider('roll', 'roll', (x) => `${((x - 0.5) * 30).toFixed(0)}°`)}
                  {customSlider('tilt', 'tilt', (x) => `${((x - 0.5) * 20).toFixed(0)}°`)}
                </div>
                {customSlider('zoom', 'zoom', (x) => `×${(1.35 - 0.7 * x).toFixed(2)}`)}
              </details>

              <details className="wp-fold">
                <summary>material / light</summary>
                <div className="wpair">
                  {customSlider('disk', 'diskBright')}
                  {customSlider('radius', 'diskSize', (x) => `${Math.round(14 + 18 * x)} M`)}
                </div>
                <div className="wpair">
                  {customSlider('turbulence', 'turb')}
                  {customSlider('rotation', 'spin', (x) => `×${(x * 2.2).toFixed(1)}`)}
                </div>
                <div className="wpair">
                  {customSlider('stars', 'stars')}
                  {customSlider('exposure', 'expo', (x) => `×${(0.6 + 0.8 * x).toFixed(2)}`)}
                </div>
                <div className="wpair">
                  {customSlider('bloom', 'glow')}
                  {customSlider('streak', 'streak')}
                </div>
              </details>

              <details className="wp-fold">
                <summary>motion / response</summary>
                <div className="wpair">
                  {customSlider('orbit drift', 'drift')}
                  {customSlider('parallax', 'parallax')}
                </div>
              </details>

              <details className="wp-fold">
                <summary>clock composition</summary>
                <Group label="art direction">
                  <Seg
                    grid
                    cur={s.custom.clockArt}
                    opts={[
                      ['auto', 'preset'], ['poster', 'poster'], ['horizon', 'horizon'],
                      ['eclipse', 'eclipse'], ['orbit', 'orbit'], ['crop', 'crop'],
                      ['quiet', 'quiet'], ['caption', 'caption'], ['blade', 'blade'],
                    ]}
                    on={(v) => patchCustom({ clockArt: v as CustomScene['clockArt'] })}
                  />
                </Group>
                <div className="wpair">
                  {customSlider('type scale', 'clockScale', (x) => `×${(0.72 + x * 0.56).toFixed(2)}`)}
                  {customSlider('proximity', 'clockNear')}
                </div>
                {customSlider('depth overlap', 'clockDepth')}
                <div className="wpair">
                  <Group label="layout">
                    <Seg
                      cur={s.clockAdaptive ? 'adaptive' : 'manual'}
                      opts={[[ 'adaptive', 'adaptive' ], [ 'manual', 'manual' ]]}
                      on={(v) => commitSettings({ ...s, clockAdaptive: v === 'adaptive' })}
                    />
                  </Group>
                  {!s.clockAdaptive ? (
                    <Group label="size">
                      <Seg
                        cur={s.clockSize}
                        opts={[[ 's', 'small' ], [ 'm', 'medium' ], [ 'l', 'large' ]]}
                        on={(v) => commitSettings({ ...s, clockSize: v as WpSettings['clockSize'] })}
                      />
                    </Group>
                  ) : <div />}
                </div>
                {!s.clockAdaptive && (
                  <Group label="manual position">
                    <Seg
                      cur={s.clockPos}
                      opts={[[ 'tl', 'top·L' ], [ 'tr', 'top·R' ], [ 'bl', 'low·L' ], [ 'bc', 'low·C' ], [ 'br', 'low·R' ]]}
                      on={(v) => commitSettings({ ...s, clockPos: v as WpSettings['clockPos'] })}
                    />
                  </Group>
                )}
              </details>
            </>
          )}
        </section>

        <section className="panel-block">
          <div className="wp-sec">look</div>
          <Group label="palette">
            <Seg
              cur={s.palette}
              opts={[[ 'crimson', 'crimson' ], [ 'ember', 'ember' ], [ 'gold', 'gold' ], [ 'blue', 'blue' ]]}
              on={(v) => commitSettings({ ...s, palette: v as WpSettings['palette'] })}
            />
          </Group>
          <div className="wpair">
            <Group label="quality">
              <Seg
                cur={s.quality}
                opts={[[ 'auto', 'auto' ], [ 'eco', 'eco' ], [ 'max', 'max' ]]}
                on={(v) => commitSettings({ ...s, quality: v as WpSettings['quality'] })}
              />
            </Group>
            <Group label="trail">
              <Seg
                cur={s.trail ? 'on' : 'off'}
                opts={[[ 'off', 'off' ], [ 'on', 'on' ]]}
                on={(v) => commitSettings({ ...s, trail: v === 'on' })}
              />
            </Group>
          </div>
        </section>

        <section className="panel-block">
          <div className="wp-sec">clock</div>
          <div className="wpair">
            <Group label="mode">
              <Seg
                cur={s.clock}
                opts={[[ 'off', 'off' ], [ '24', '24h' ], [ '12', '12h' ]]}
                on={(v) => commitSettings({ ...s, clock: v as WpSettings['clock'] })}
              />
            </Group>
            <Group label="font">
              <Seg
                cur={s.font}
                opts={[[ 'mono', 'mono' ], [ 'display', 'disp' ], [ 'thin', 'thin' ]]}
                on={(v) => commitSettings({ ...s, font: v as WpSettings['font'] })}
              />
            </Group>
          </div>
          {s.clock !== 'off' && (
            <>
              <Group label="accent">
                <Seg
                  cur={s.accent}
                  opts={[[ 'auto', 'auto' ], [ 'cyan', 'cyan' ], [ 'ember', 'warm' ], [ 'mono', 'mono' ]]}
                  on={(v) => commitSettings({ ...s, accent: v as WpSettings['accent'] })}
                />
              </Group>
              <div className="wpair">
                <Group label="minute scale">
                  <Seg cur={s.bar ? 'on' : 'off'} opts={[[ 'off', 'off' ], [ 'on', 'on' ]]} on={(v) => commitSettings({ ...s, bar: v === 'on' })} />
                </Group>
                <Group label="seconds">
                  <Seg cur={s.seconds ? 'on' : 'off'} opts={[[ 'off', 'off' ], [ 'on', 'on' ]]} on={(v) => commitSettings({ ...s, seconds: v === 'on' })} />
                </Group>
              </div>
              <Group label="date">
                <Seg cur={s.date} opts={[[ 'off', 'off' ], [ 'date', 'date' ], [ 'full', 'full' ]]} on={(v) => commitSettings({ ...s, date: v as WpSettings['date'] })} />
              </Group>
            </>
          )}
        </section>

        <div className="reset-row">
          {s.sceneMode === 'custom' && (
            <button type="button" onClick={() => setCustomBase(s.custom.basePreset)}>restore custom</button>
          )}
          <button type="button" className="danger" onClick={() => commitSettings({ ...DEFAULTS, custom: { ...CUSTOM_SCENE_DEFAULTS } })}>reset all</button>
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
