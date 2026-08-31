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

type ManualClockPos = Exclude<WpSettings['clockPos'], 'auto'>

/**
 * These are intentionally strong enough to read as different wallpapers,
 * not tiny variations of the same scientific camera. roll rotates the image
 * plane while leaving the physical camera position/geodesics untouched.
 */
const COMPOSITIONS: Record<
  WpSettings['composition'],
  { shift: [number, number]; dist: number; roll: number; clock: ManualClockPos }
> = {
  cinematic: { shift: [0.58, -0.05], dist: 0.84, roll: -5.5, clock: 'bl' },
  horizon: { shift: [-0.76, -0.46], dist: 0.68, roll: 3.5, clock: 'tr' },
  terminal: { shift: [0.64, 0.34], dist: 0.91, roll: -9.0, clock: 'bl' },
  centered: { shift: [0, 0], dist: 1.0, roll: 0, clock: 'bl' },
  void: { shift: [0.70, 0.18], dist: 1.48, roll: 7.0, clock: 'bl' },
  close: { shift: [0.48, -0.12], dist: 0.52, roll: -4.0, clock: 'tr' },
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
          onKeyDown={(e) => {
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
  const colRef = useRef<HTMLSpanElement>(null)
  const secRef = useRef<HTMLElement>(null)
  const barRef = useRef<HTMLElement>(null)
  const dateRef = useRef<HTMLDivElement>(null)
  const clockRef = useRef<HTMLDivElement>(null)
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
    const initialComp = COMPOSITIONS[sRef.current.composition]

    const st = {
      raf: 0,
      last: performance.now(),
      clock: 0,
      azim: 0.6,
      ptx: 0,
      pty: 0,
      ptxT: 0,
      ptyT: 0,
      dist: PRESETS[sRef.current.view].dist,
      incl: PRESETS[sRef.current.view].incl,
      fov: PRESETS[sRef.current.view].fov,
      expo: PRESETS[sRef.current.view].expo,
      disk: PRESETS[sRef.current.view].disk,
      star: PRESETS[sRef.current.view].star,
      shiftX: initialComp.shift[0],
      shiftY: initialComp.shift[1],
      roll: initialComp.roll,
      temp: PALETTES[sRef.current.palette] ?? 1,
      dout: 14 + 18 * sRef.current.diskSize,
      turbV: sRef.current.turb,
      diskClock: 0,
      clockX: window.innerWidth * 0.18,
      clockY: window.innerHeight * 0.82,
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

      st.azim += (dt / 1000) * (0.006 + set.drift * 0.03)
      const P = PRESETS[set.view]
      const C = COMPOSITIONS[set.composition]
      const w = window.innerWidth
      const h = window.innerHeight
      const portrait = w < h
      const compScale = portrait ? 0.56 : 1
      const k = 1 - Math.exp((-dt / 1000) * 2.2)

      st.dist += (P.dist * C.dist * (1.35 - 0.7 * set.zoom) - st.dist) * k
      st.incl += (P.incl + (set.tilt - 0.5) * 20 - st.incl) * k
      st.fov += (P.fov - st.fov) * k
      st.expo += (P.expo * (0.6 + 0.8 * set.expo) - st.expo) * k
      st.disk += (P.disk * (0.4 + 1.2 * set.diskBright) - st.disk) * k
      st.star += (P.star - st.star) * k
      st.shiftX += (C.shift[0] * compScale - st.shiftX) * k
      st.shiftY += (C.shift[1] * compScale - st.shiftY) * k
      st.roll += (C.roll * (portrait ? 0.72 : 1) - st.roll) * k
      st.temp += ((PALETTES[set.palette] ?? 1) - st.temp) * k
      st.dout += (14 + 18 * set.diskSize - st.dout) * k
      st.turbV += (set.turb - st.turbV) * k

      st.diskClock += (dt / 1000) * TIME_SCALE * (set.spin * 2.2)
      const damp = 1 - Math.exp((-dt / 1000) * 3.2)
      st.ptx += (st.ptxT - st.ptx) * damp
      st.pty += (st.ptyT - st.pty) * damp
      const breath = Math.sin(st.clock * 0.18) * 0.5
      const incl = Math.min(Math.max(st.incl + breath + st.pty * 2.6 * set.parallax, 12), 89.8)
      const azim = st.azim + st.ptx * 0.07 * set.parallax
      const cam = cameraFrom(st.dist, incl, azim, st.fov)
      const basis = rollBasis(cam.right as V3, cam.up as V3, st.roll)

      let thf = cam.tanHalfFov
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
        diskGain: st.disk,
        starGain: (0.25 + 1.5 * set.stars) * st.star,
        falseColor: 0,
        exposure: st.expo * (1 + lensPulse),
        markPhoton: 0,
        markIsco: 0,
        companionDir: compDir,
        tempScale: st.temp,
        diskOut: st.dout,
        turb: st.turbV,
        bloomAmt: 1.7 * set.glow,
        streakDir,
        streakAmt: set.quality === 'eco' ? 0 : set.streak,
      })

      if (set.clock !== 'off') {
        const d = new Date()
        const ms = d.getMilliseconds()
        const cs = d.getSeconds()
        if (colRef.current)
          colRef.current.style.opacity = set.colon === 'blink' && ms >= 500 ? '0.24' : '1'
        if (barRef.current)
          barRef.current.style.left = `${(((cs + ms / 1000) / 60) * 100).toFixed(2)}%`

        if (clockRef.current) {
          const node = clockRef.current
          const fx = set.float ? -st.ptx * 8 : 0
          const fy = set.float ? -st.pty * 6 : 0
          node.style.setProperty('--mx', `${fx.toFixed(1)}px`)
          node.style.setProperty('--my', `${fy.toFixed(1)}px`)

          if (set.clockAdaptive) {
            // The subject's screen position follows lens shift exactly. Put the
            // clock in the opposite negative-space region and scale it from the
            // short viewport edge plus composition occupancy.
            const holeX = 0.5 + lensShift[0] * 0.5
            const holeY = 0.5 - lensShift[1] * 0.5
            const shortEdge = Math.min(w, h)
            const base = clamp(shortEdge * 0.064, 30, 82)
            const occupancy = clamp(0.84 + C.dist * 0.16, 0.82, 1.07)
            const maxByWidth = Math.max(30, (w - 36) / (set.clock === '12' ? 4.7 : set.seconds ? 4.35 : 3.65))
            const autoSize = Math.min(base * occupancy, maxByWidth)
            const widthPx = autoSize * (set.clock === '12' ? 4.55 : set.seconds ? 4.2 : 3.55)
            const heightPx = autoSize * (1.02 + (set.bar ? 0.24 : 0) + (set.date !== 'off' ? 0.36 : 0))
            const safeX = clamp(w * 0.038, 18, 76)
            const safeY = clamp(h * 0.052, 20, 74)

            const centerPortrait = portrait && Math.abs(lensShift[0]) < 0.24
            const leftSide = holeX >= 0.5
            const topSide = holeY > 0.59
            let tx: number
            let alignText: 'left' | 'right' | 'center'
            if (centerPortrait) {
              tx = w * 0.5
              alignText = 'center'
            } else if (leftSide) {
              tx = safeX + widthPx * 0.5
              alignText = 'left'
            } else {
              tx = w - safeX - widthPx * 0.5
              alignText = 'right'
            }
            const ty = topSide ? safeY + heightPx * 0.5 : h - safeY - heightPx * 0.5
            const ck = 1 - Math.exp((-dt / 1000) * 3.8)
            st.clockX += (tx - st.clockX) * ck
            st.clockY += (ty - st.clockY) * ck

            node.style.left = `${st.clockX.toFixed(1)}px`
            node.style.top = `${st.clockY.toFixed(1)}px`
            node.style.removeProperty('right')
            node.style.removeProperty('bottom')
            node.style.setProperty('--clock-auto-size', `${autoSize.toFixed(1)}px`)
            node.style.setProperty('--clock-width', `${widthPx.toFixed(1)}px`)
            node.dataset.align = alignText
          } else {
            node.style.removeProperty('left')
            node.style.removeProperty('top')
            node.style.removeProperty('--clock-auto-size')
            node.style.removeProperty('--clock-width')
            delete node.dataset.align
          }
        }

        const key = `${set.clock}|${set.seconds}|${set.date}|${set.colon}`
        if (cs !== st.lastSec || key !== st.lastClockKey) {
          st.lastSec = cs
          st.lastClockKey = key
          const mm = String(d.getMinutes()).padStart(2, '0')
          const sep = set.colon === 'off' ? ' ' : ':'
          const ss = set.seconds ? `${sep}${String(cs).padStart(2, '0')}` : ''
          const hr = d.getHours()
          if (set.clock === '24') {
            if (hRef.current) hRef.current.textContent = String(hr).padStart(2, '0')
            if (secRef.current) secRef.current.textContent = ss
          } else {
            if (hRef.current) hRef.current.textContent = String(((hr + 11) % 12) + 1)
            if (secRef.current) secRef.current.textContent = `${ss} ${hr < 12 ? 'AM' : 'PM'}`
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
        onChange={(e) => setS({ ...s, [key]: Number(e.target.value) / 100 } as WpSettings)}
      />
    </Group>
  )

  const autoPos = COMPOSITIONS[s.composition].clock
  const manualClockPos = s.clockPos === 'auto' ? autoPos : s.clockPos
  const autoAccent = s.palette === 'blue' ? 'cyan' : 'ember'
  const clockAccent = s.accent === 'auto' ? autoAccent : s.accent
  const clockLayout = s.clockAdaptive ? ' adaptive' : ` p-${manualClockPos} sz-${s.clockSize}`

  return (
    <>
      <canvas id="gl" ref={glRef} />
      <canvas className="wp-trail" ref={trailRef} />

      {s.clock !== 'off' && (
        <div
          ref={clockRef}
          className={`wp-clock${clockLayout} ac-${clockAccent} f-${s.font}${s.brackets ? ' wc-br' : ''}`}
        >
          <div className="t">
            <span ref={hRef} />
            {s.colon !== 'off' && (
              <span className="col" ref={colRef}>
                :
              </span>
            )}
            <span ref={mRef} />
            <i ref={secRef} />
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
        onKeyDown={(e) => {
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
        <Group label="view">
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
                      ['auto', 'scene'],
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
              <Group label="colon">
                <Seg
                  cur={s.colon}
                  opts={[
                    ['blink', 'blink'],
                    ['on', 'on'],
                    ['off', 'off'],
                  ]}
                  on={(v) => setS({ ...s, colon: v as WpSettings['colon'] })}
                />
              </Group>
              <Group label="brackets">
                <Seg
                  cur={s.brackets ? 'on' : 'off'}
                  opts={[
                    ['off', 'off'],
                    ['on', 'on'],
                  ]}
                  on={(v) => setS({ ...s, brackets: v === 'on' })}
                />
              </Group>
            </div>
            <div className="wpair">
              <Group label="orbit scale">
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
            <div className="wpair">
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
              <Group label="mouse float">
                <Seg
                  cur={s.float ? 'on' : 'off'}
                  opts={[
                    ['off', 'off'],
                    ['on', 'on'],
                  ]}
                  on={(v) => setS({ ...s, float: v === 'on' })}
                />
              </Group>
            </div>
          </>
        )}

        <div
          className="wp-reset"
          role="button"
          tabIndex={0}
          onClick={() => setS({ ...DEFAULTS })}
          onKeyDown={(e) => {
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
