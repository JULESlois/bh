import { useEffect, useRef } from 'react'
import { Renderer } from './gl/renderer'
import { paramsAt, companionDir, shadowRadiusPx, rayDir, SECTIONS, SECTION_VH, type FrameParams } from './scene/timeline'
import { TIME_SCALE } from './physics/constants'
import { traceRay } from './physics/geodesic'
import { store, markerLevels } from './store'
import { domRefs, actions } from './ui/dom'
import Overlay from './ui/Overlay'
import Hud from './ui/Hud'
import Chrome from './ui/Chrome'

function smoothstep(a: number, b: number, x: number): number {
  const k = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return k * k * (3 - 2 * k)
}
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<FrameParams | null>(null)

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
      raf: 0,
      lastRaw: 0,
      scrollTs: -1e9,
      railO: 0,
      hudO: 0,
      drift: 0,
      section: 0,
      anim: null as null | { from: number; to: number; t0: number; dur: number },
      cooldownTs: 0,
      wheelAcc: 0,
    }

    const resize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight)
      // keep the page locked to the current screen when the viewport changes
      if (!st.anim) window.scrollTo(0, st.section * window.innerHeight * SECTION_VH)
    }
    resize()
    window.addEventListener('resize', resize)

    // ---- forceful screen-by-screen paging -------------------------------
    const pageTo = (idx: number, now: number) => {
      idx = Math.min(Math.max(idx, 0), SECTIONS - 1)
      if (idx === st.section) return
      st.section = idx
      st.anim = {
        from: window.scrollY,
        to: idx * window.innerHeight * SECTION_VH,
        t0: now,
        dur: reduced ? 0 : 700,
      }
    }

    actions.pageTo = (idx: number) => pageTo(idx, performance.now())

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return // pinch-zoom gesture — not ours
      e.preventDefault()
      const now = performance.now()
      if (store.get().focus) {
        store.dismiss() // first gesture closes the callout
        st.cooldownTs = now + 250
        return
      }
      if (st.anim || now < st.cooldownTs) return
      st.wheelAcc += e.deltaY * (e.deltaMode === 1 ? 16 : 1)
      if (Math.abs(st.wheelAcc) > 24) {
        pageTo(st.section + Math.sign(st.wheelAcc), now)
        st.wheelAcc = 0
      }
    }
    window.addEventListener('wheel', onWheel, { passive: false })

    const onKey = (e: KeyboardEvent) => {
      const now = performance.now()
      let dir = 0
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) dir = 1
      else if (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) dir = -1
      else if (e.key === 'Home') { e.preventDefault(); pageTo(0, now); return }
      else if (e.key === 'End') { e.preventDefault(); pageTo(SECTIONS - 1, now); return }
      if (!dir) return
      e.preventDefault()
      if (store.get().focus) { store.dismiss(); return }
      if (!st.anim && now >= st.cooldownTs) pageTo(st.section + dir, now)
    }
    window.addEventListener('keydown', onKey)

    // deep link: #t=3 jumps straight to that screen
    const m = location.hash.match(/t=([\d.]+)/)
    if (m) {
      const target = Math.round(Math.min(Math.max(parseFloat(m[1]), 0), SECTIONS - 1))
      st.t = target
      st.section = target
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

      // drive the paging tween
      if (st.anim) {
        const k = st.anim.dur <= 0 ? 1 : Math.min((now - st.anim.t0) / st.anim.dur, 1)
        window.scrollTo(0, st.anim.from + (st.anim.to - st.anim.from) * easeInOut(k))
        if (k >= 1) {
          st.anim = null
          st.cooldownTs = now + 240 // swallow the momentum tail
          st.wheelAcc = 0
        }
      }

      const vh = window.innerHeight
      const raw = Math.min(Math.max(window.scrollY / (vh * SECTION_VH), 0), SECTIONS - 1)
      if (!st.anim) st.section = Math.round(raw) // sync after touch/native scrolls
      const damp = 1 - Math.exp((-dt / 1000) * (reduced ? 9 : 3.6))
      st.t += (raw - st.t) * damp
      st.ptx += (st.ptxT - st.ptx) * damp
      st.pty += (st.ptyT - st.pty) * damp

      // the hole never rests: slow orbital drift + inclination breathing,
      // on top of the differentially-rotating disk turbulence
      if (!reduced) st.drift += (dt / 1000) * 0.016
      const breath = reduced ? 0 : Math.sin(st.clock * 0.2) * 0.5

      const t = st.t
      const p = paramsAt(t, st.ptx, st.pty, st.drift, breath)
      // portrait fitting: the fov keyframes are vertical; on tall screens
      // preserve the horizontal field instead so the hole is never cropped
      if (window.innerWidth < vh) p.tanHalfFov *= vh / window.innerWidth
      frameRef.current = p

      const focus = store.get().focus
      if (focus && Math.abs(window.scrollY - focus.scrollY) > 40) store.dismiss()

      const term = focus?.type === 'term' ? focus.key : null
      const mk = 1 - Math.exp((-dt / 1000) * 5)
      markerLevels.photon += ((term === 'photon' ? 1 : 0) - markerLevels.photon) * mk
      markerLevels.isco += ((term === 'isco' ? 1 : 0) - markerLevels.isco) * mk
      st.hudO += ((focus ? 1 : 0) - st.hudO) * (1 - Math.exp((-dt / 1000) * 7))
      const poster = 1 - st.hudO

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
        companionDir: companionDir(st.drift, breath),
        tempScale: 1,
      })
      store.setBooted()

      // ---- direct DOM writes (no React on the hot path) ----
      for (let i = 0; i < SECTIONS; i++) {
        const el = domRefs[`sec${i}`] as HTMLElement | null
        if (!el) continue
        const rising = i === 0 ? 1 : smoothstep(i - 0.62, i - 0.2, t)
        const falling = i === SECTIONS - 1 ? 1 : 1 - smoothstep(i + 0.2, i + 0.62, t)
        const v = rising * falling * poster
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
      if (rail) rail.style.opacity = (st.railO * poster).toFixed(3)

      const thumb = domRefs.railThumb as HTMLElement | null
      if (thumb) thumb.style.top = `${(t / (SECTIONS - 1)) * 100}%`
      const ro = domRefs.railRo as HTMLElement | null
      if (ro)
        ro.textContent =
          `r_cam ${p.dist.toFixed(1)} M\n` +
          `incl  ${p.inclDeg.toFixed(1)}°\n` +
          `fov   ${p.fovDeg.toFixed(0)}°\n` +
          `t     ${t.toFixed(2)}`

      const legend = domRefs.legend as HTMLElement | null
      if (legend) legend.style.opacity = (p.falseColor * poster).toFixed(3)
      const cue = domRefs.cue as HTMLElement | null
      if (cue) cue.style.opacity = ((1 - smoothstep(0.04, 0.3, t)) * poster).toFixed(3)

      // brightness scrims behind the text on the hot screens — deliberately
      // on a wider, earlier window than the text so they never move in sync
      for (const [key, i] of [['scrim2', 2], ['scrim3', 3], ['scrim5', 5]] as const) {
        const el = domRefs[key] as HTMLElement | null
        if (!el) continue
        const v = smoothstep(i - 0.85, i - 0.32, t) * (1 - smoothstep(i + 0.32, i + 0.85, t))
        el.style.opacity = (v * poster).toFixed(3)
      }

      // dashed b_c ring — angular size computed from the live camera state
      st.shadowAnno += ((term === 'shadow' ? 1 : 0) - st.shadowAnno) * mk
      const wrap = domRefs.annoWrap as SVGElement | null
      if (wrap) {
        wrap.style.opacity = (st.shadowAnno * poster).toFixed(3)
        if (st.shadowAnno > 0.004) {
          const rpx = shadowRadiusPx(p.dist, p.tanHalfFov, vh)
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
      actions.pageTo = undefined
      window.removeEventListener('resize', resize)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
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
    store.openRay(hit, e.clientX, e.clientY)
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
