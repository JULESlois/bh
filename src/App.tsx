import { useEffect, useRef } from 'react'
import { Renderer } from './gl/renderer'
import { paramsAt, companionDir, shadowRadiusPx, rayDir, SECTIONS, SECTION_VH, type FrameParams } from './scene/timeline'
import { TIME_SCALE } from './physics/constants'
import { traceRay } from './physics/geodesic'
import { store, markerLevels } from './store'
import { domRefs } from './ui/dom'
import Overlay from './ui/Overlay'
import Hud from './ui/Hud'
import Chrome from './ui/Chrome'

const HINTS = [
  'scroll — the camera is yours',
  'click the underlined terms',
  'click the image — every pixel is a measurement',
  'click the disk — it reports its own physics',
  'keep scrolling — a star is passing behind',
  'false color: g, the measured shift',
  'click ↑ to return',
]

const COMPANION = companionDir()

function smoothstep(a: number, b: number, x: number): number {
  const k = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return k * k * (3 - 2 * k)
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<FrameParams | null>(null)
  const hitId = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current!
    let renderer: Renderer
    try {
      renderer = new Renderer(canvas)
    } catch (e) {
      store.setGlError(e instanceof Error ? e.message : String(e))
      return
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const st = {
      t: 0,
      ptx: 0,
      pty: 0,
      ptxT: 0,
      ptyT: 0,
      last: performance.now(),
      clock: 0,
      shadowAnno: 0,
      hintIdx: -1,
      raf: 0,
      lastRaw: 0,
      scrollTs: -1e9,
      railO: 0,
    }

    const resize = () => renderer.setSize(window.innerWidth, window.innerHeight)
    resize()
    window.addEventListener('resize', resize)

    // deep link: #t=3.5 jumps straight to that point of the fall
    const m = location.hash.match(/t=([\d.]+)/)
    if (m) {
      const target = Math.min(Math.max(parseFloat(m[1]), 0), SECTIONS - 1)
      st.t = target
      requestAnimationFrame(() =>
        window.scrollTo(0, target * window.innerHeight * SECTION_VH),
      )
    }

    const onPointer = (e: PointerEvent) => {
      st.ptxT = (e.clientX / window.innerWidth) * 2 - 1
      st.ptyT = (e.clientY / window.innerHeight) * 2 - 1
    }
    if (!reduced) window.addEventListener('pointermove', onPointer)

    const loop = (now: number) => {
      st.raf = requestAnimationFrame(loop)
      const dt = Math.min(now - st.last, 50)
      st.last = now
      st.clock += dt / 1000

      const vh = window.innerHeight
      const raw = Math.min(Math.max(window.scrollY / (vh * SECTION_VH), 0), SECTIONS - 1)
      const damp = 1 - Math.exp((-dt / 1000) * (reduced ? 9 : 3.6))
      st.t += (raw - st.t) * damp
      st.ptx += (st.ptxT - st.ptx) * damp
      st.pty += (st.ptyT - st.pty) * damp

      const t = st.t
      const p = paramsAt(t, st.ptx, st.pty)
      frameRef.current = p

      const ann = store.get().annotations
      const mk = 1 - Math.exp((-dt / 1000) * 5)
      markerLevels.photon += ((ann.photon ? 1 : 0) - markerLevels.photon) * mk
      markerLevels.isco += ((ann.isco ? 1 : 0) - markerLevels.isco) * mk

      renderer.adapt(dt)
      renderer.render({
        camPos: p.pos,
        right: p.right,
        up: p.up,
        fwd: p.fwd,
        tanHalfFov: p.tanHalfFov,
        time: st.clock * TIME_SCALE,
        diskGain: p.diskGain,
        starGain: p.starGain,
        falseColor: p.falseColor,
        exposure: p.exposure,
        markPhoton: markerLevels.photon,
        markIsco: markerLevels.isco,
        companionDir: COMPANION,
      })
      store.setBooted()

      // ---- direct DOM writes (no React on the hot path) ----
      for (let i = 0; i < SECTIONS; i++) {
        const el = domRefs[`sec${i}`] as HTMLElement | null
        if (!el) continue
        const rising = i === 0 ? 1 : smoothstep(i - 0.62, i - 0.2, t)
        const falling = i === SECTIONS - 1 ? 1 : 1 - smoothstep(i + 0.2, i + 0.62, t)
        const v = rising * falling
        const d = Math.min(Math.max(t - i, -1), 1)
        el.style.setProperty('--fx', v.toFixed(4))
        el.style.setProperty('--fxd', d.toFixed(4))
        el.style.visibility = v > 0.004 ? 'visible' : 'hidden'
      }

      // the rail surfaces only while the page is actually moving
      if (Math.abs(raw - st.lastRaw) > 0.0004) st.scrollTs = now
      st.lastRaw = raw
      st.railO += ((now - st.scrollTs < 1100 ? 1 : 0) - st.railO) * mk
      const rail = domRefs.rail as HTMLElement | null
      if (rail) rail.style.opacity = st.railO.toFixed(3)

      const thumb = domRefs.railThumb as HTMLElement | null
      if (thumb) thumb.style.top = `${(t / (SECTIONS - 1)) * 100}%`
      const ro = domRefs.railRo as HTMLElement | null
      if (ro)
        ro.textContent =
          `r_cam ${p.dist.toFixed(1)} M\n` +
          `incl  ${p.inclDeg.toFixed(1)}°\n` +
          `fov   ${p.fovDeg.toFixed(0)}°\n` +
          `t     ${t.toFixed(2)}`

      const hintIdx = Math.min(Math.max(Math.round(t), 0), SECTIONS - 1)
      if (hintIdx !== st.hintIdx) {
        st.hintIdx = hintIdx
        const h = domRefs.hint as HTMLElement | null
        if (h) h.textContent = HINTS[hintIdx]
      }

      const legend = domRefs.legend as HTMLElement | null
      if (legend) legend.style.opacity = p.falseColor.toFixed(3)
      const cue = domRefs.cue as HTMLElement | null
      if (cue) cue.style.opacity = (1 - smoothstep(0.04, 0.3, t)).toFixed(3)

      // dashed b_c ring — angular size computed from the live camera state
      st.shadowAnno += ((ann.shadow ? 1 : 0) - st.shadowAnno) * mk
      const wrap = domRefs.annoWrap as SVGElement | null
      if (wrap) {
        wrap.style.opacity = st.shadowAnno.toFixed(3)
        if (st.shadowAnno > 0.004) {
          const rpx = shadowRadiusPx(p.dist, p.fovDeg, vh)
          const cx = window.innerWidth / 2
          const cy = vh / 2
          const circ = domRefs.annoCircle as SVGElement | null
          const label = domRefs.annoText as SVGElement | null
          const line = domRefs.annoLine as SVGElement | null
          if (circ) {
            circ.setAttribute('cx', `${cx}`)
            circ.setAttribute('cy', `${cy}`)
            circ.setAttribute('r', `${Math.max(rpx, 4)}`)
          }
          const ax = cx + rpx * 0.7071
          const ay = cy - rpx * 0.7071
          if (line) {
            line.setAttribute('x1', `${ax}`)
            line.setAttribute('y1', `${ay}`)
            line.setAttribute('x2', `${ax + 26}`)
            line.setAttribute('y2', `${ay - 26}`)
          }
          if (label) {
            label.setAttribute('x', `${ax + 32}`)
            label.setAttribute('y', `${ay - 30}`)
          }
        }
      }
    }
    st.raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(st.raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointer)
    }
  }, [])

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = frameRef.current
    if (!p) return
    const w = window.innerWidth
    const h = window.innerHeight
    const px = (e.clientX / w) * 2 - 1
    const py = -((e.clientY / h) * 2 - 1)
    const hit = traceRay(p.pos, rayDir(p, px, py, w / h))
    store.setHit({ hit, x: e.clientX, y: e.clientY, id: ++hitId.current })
  }

  return (
    <>
      <canvas id="gl" ref={canvasRef} onClick={onCanvasClick} />
      <div
        className="scrollspace"
        style={{ height: `calc(100vh + ${(SECTIONS - 1) * SECTION_VH * 100}vh)` }}
      >
        {Array.from({ length: SECTIONS }, (_, i) => (
          <div key={i} className="snap" />
        ))}
      </div>
      <Overlay />
      <Hud />
      <Chrome />
    </>
  )
}
