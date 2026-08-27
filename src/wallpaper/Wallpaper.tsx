import { useEffect, useRef, useState } from 'react'
import { Renderer } from '../gl/renderer'
import { cameraFrom } from '../scene/timeline'
import { TIME_SCALE } from '../physics/constants'
import { load, save, bindWallpaperEngine, DEFAULTS, type WpSettings } from './settings'

/** camera presets: dist (M), inclination (deg), fov (deg), exposure */
const PRESETS = [
  { dist: 30, incl: 81, fov: 58, expo: 1.0 }, // signature
  { dist: 27, incl: 86.5, fov: 50, expo: 1.0 }, // edge-on
  { dist: 24, incl: 63, fov: 30, expo: 1.15 }, // photon ring
  { dist: 47, incl: 71, fov: 62, expo: 0.92 }, // wide
]
/** the companion star's azimuth: once per orbit the camera crosses it and
 *  the star slides exactly behind the hole — a periodic Einstein ring */
const COMPANION_AZ = 2.4

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function Seg(props: {
  cur: string
  opts: [string, string][]
  on: (v: string) => void
}) {
  return (
    <span className="opts">
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
    </span>
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

  // quality changes force a pipeline rebuild at the requested scale/steps
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

  // click outside closes the panel
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

    const st = {
      raf: 0,
      last: performance.now(),
      clock: 0,
      azim: 0.6,
      ptx: 0,
      pty: 0,
      ptxT: 0,
      ptyT: 0,
      // damped camera state, so preset switches glide
      dist: PRESETS[sRef.current.view].dist,
      incl: PRESETS[sRef.current.view].incl,
      fov: PRESETS[sRef.current.view].fov,
      expo: PRESETS[sRef.current.view].expo,
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

      // camera: drift + breathing + damped preset + parallax
      st.azim += (dt / 1000) * (0.006 + set.drift * 0.03)
      const P = PRESETS[set.view]
      const k = 1 - Math.exp((-dt / 1000) * 2.2)
      st.dist += (P.dist - st.dist) * k
      st.incl += (P.incl - st.incl) * k
      st.fov += (P.fov - st.fov) * k
      st.expo += (P.expo - st.expo) * k
      const damp = 1 - Math.exp((-dt / 1000) * 3.2)
      st.ptx += (st.ptxT - st.ptx) * damp
      st.pty += (st.ptyT - st.pty) * damp
      const breath = Math.sin(st.clock * 0.18) * 0.5
      const incl = Math.min(
        Math.max(st.incl + breath + st.pty * 2.6 * set.parallax, 12),
        88.5,
      )
      const azim = st.azim + st.ptx * 0.07 * set.parallax
      const cam = cameraFrom(st.dist, incl, azim, st.fov)
      // portrait fitting: never crop the hole on tall screens
      let thf = cam.tanHalfFov
      if (window.innerWidth < window.innerHeight) thf *= window.innerHeight / window.innerWidth
      // the companion sits opposite the camera's orbit at a fixed azimuth,
      // so every orbit it passes exactly behind — a recurring Einstein ring
      const comp = cameraFrom(1, incl, COMPANION_AZ, 55).pos
      const compDir: [number, number, number] = (() => {
        const l = Math.hypot(comp[0], comp[1], comp[2]) || 1
        return [-comp[0] / l, -comp[1] / l, -comp[2] / l]
      })()

      if (set.quality === 'auto') renderer.adapt(dt)
      renderer.render({
        camPos: cam.pos,
        right: cam.right,
        up: cam.up,
        fwd: cam.fwd,
        tanHalfFov: thf,
        time: st.clock * TIME_SCALE,
        diskGain: 1,
        starGain: 0.25 + 1.5 * set.stars,
        falseColor: 0,
        exposure: st.expo,
        markPhoton: 0,
        markIsco: 0,
        companionDir: compDir,
      })

      // clock — bar and colon every frame, text only when the second flips
      if (set.clock !== 'off') {
        const d = new Date()
        const ms = d.getMilliseconds()
        const cs = d.getSeconds()
        if (colRef.current)
          colRef.current.style.opacity =
            set.clockStyle === 'hud' && ms >= 500 ? '0.22' : '1'
        if (barRef.current)
          barRef.current.style.width = `${(((cs + ms / 1000) / 60) * 100).toFixed(2)}%`
        const key = `${set.clock}|${set.seconds}|${set.clockStyle}|${set.date}`
        if (cs !== st.lastSec || key !== st.lastClockKey) {
          st.lastSec = cs
          st.lastClockKey = key
          const mm = String(d.getMinutes()).padStart(2, '0')
          const ss = set.seconds ? `:${String(cs).padStart(2, '0')}` : ''
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
            const doy = Math.floor(
              (d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 864e5,
            )
            dateRef.current.textContent =
              `${DAYS[d.getDay()]} · ${MONTHS[d.getMonth()]} ${d.getDate()}` +
              (set.clockStyle === 'hud' ? ` · DOY ${doy}` : '')
          }
        }
      }

      // mouse trail — thin fading cyan line
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

  return (
    <>
      <canvas id="gl" ref={glRef} />
      <canvas className="wp-trail" ref={trailRef} />

      {s.clock !== 'off' && (
        <div
          className={`wp-clock p-${s.clockPos} sz-${s.clockSize} ac-${s.accent} st-${s.clockStyle}`}
        >
          <div className="t">
            <span ref={hRef} />
            <span className="col" ref={colRef}>
              :
            </span>
            <span ref={mRef} />
            <i ref={secRef} />
          </div>
          {s.clockStyle === 'hud' && (
            <div className="sbar">
              <i ref={barRef} />
            </div>
          )}
          {s.date && <div className="d" ref={dateRef} />}
        </div>
      )}

      {/* hidden settings hotspot — surfaces a corner bracket on hover */}
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
        <div className="ht">Settings</div>

        <div className="wp-sec">scene</div>
        <div className="wrow">
          <dt>view</dt>
          <Seg
            cur={String(s.view)}
            opts={[
              ['0', 'signature'],
              ['1', 'edge-on'],
              ['2', 'ring'],
              ['3', 'wide'],
            ]}
            on={(v) => setS({ ...s, view: Number(v) })}
          />
        </div>
        <div className="wrow">
          <dt>stars</dt>
          <input
            type="range"
            min={0}
            max={100}
            value={pct(s.stars)}
            onChange={(e) => setS({ ...s, stars: Number(e.target.value) / 100 })}
          />
        </div>
        <div className="wrow">
          <dt>drift</dt>
          <input
            type="range"
            min={0}
            max={100}
            value={pct(s.drift)}
            onChange={(e) => setS({ ...s, drift: Number(e.target.value) / 100 })}
          />
        </div>
        <div className="wrow">
          <dt>parallax</dt>
          <input
            type="range"
            min={0}
            max={100}
            value={pct(s.parallax)}
            onChange={(e) => setS({ ...s, parallax: Number(e.target.value) / 100 })}
          />
        </div>
        <div className="wrow">
          <dt>trail</dt>
          <Seg
            cur={s.trail ? 'on' : 'off'}
            opts={[
              ['off', 'off'],
              ['on', 'on'],
            ]}
            on={(v) => setS({ ...s, trail: v === 'on' })}
          />
        </div>
        <div className="wrow">
          <dt>quality</dt>
          <Seg
            cur={s.quality}
            opts={[
              ['auto', 'auto'],
              ['eco', 'eco'],
              ['max', 'max'],
            ]}
            on={(v) => setS({ ...s, quality: v as WpSettings['quality'] })}
          />
        </div>

        <div className="wp-sec">clock</div>
        <div className="wrow">
          <dt>mode</dt>
          <Seg
            cur={s.clock}
            opts={[
              ['off', 'off'],
              ['24', '24h'],
              ['12', '12h'],
            ]}
            on={(v) => setS({ ...s, clock: v as WpSettings['clock'] })}
          />
        </div>
        {s.clock !== 'off' && (
          <>
            <div className="wrow">
              <dt>style</dt>
              <Seg
                cur={s.clockStyle}
                opts={[
                  ['hud', 'hud'],
                  ['minimal', 'minimal'],
                ]}
                on={(v) => setS({ ...s, clockStyle: v as WpSettings['clockStyle'] })}
              />
            </div>
            <div className="wrow">
              <dt>position</dt>
              <Seg
                cur={s.clockPos}
                opts={[
                  ['tl', 'tl'],
                  ['tr', 'tr'],
                  ['bl', 'bl'],
                  ['bc', 'bc'],
                  ['br', 'br'],
                ]}
                on={(v) => setS({ ...s, clockPos: v as WpSettings['clockPos'] })}
              />
            </div>
            <div className="wrow">
              <dt>size</dt>
              <Seg
                cur={s.clockSize}
                opts={[
                  ['s', 's'],
                  ['m', 'm'],
                  ['l', 'l'],
                ]}
                on={(v) => setS({ ...s, clockSize: v as WpSettings['clockSize'] })}
              />
            </div>
            <div className="wrow">
              <dt>seconds</dt>
              <Seg
                cur={s.seconds ? 'on' : 'off'}
                opts={[
                  ['off', 'off'],
                  ['on', 'on'],
                ]}
                on={(v) => setS({ ...s, seconds: v === 'on' })}
              />
            </div>
            <div className="wrow">
              <dt>date</dt>
              <Seg
                cur={s.date ? 'on' : 'off'}
                opts={[
                  ['off', 'hide'],
                  ['on', 'show'],
                ]}
                on={(v) => setS({ ...s, date: v === 'on' })}
              />
            </div>
            <div className="wrow">
              <dt>accent</dt>
              <Seg
                cur={s.accent}
                opts={[
                  ['cyan', 'cyan'],
                  ['ember', 'ember'],
                  ['mono', 'mono'],
                ]}
                on={(v) => setS({ ...s, accent: v as WpSettings['accent'] })}
              />
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
