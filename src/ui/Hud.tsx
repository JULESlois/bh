import { useEffect, useRef, useState } from 'react'
import { store, useStore, type Focus } from '../store'
import { RS, B_CRIT, MASSES } from '../physics/constants'
import type { Hit } from '../physics/geodesic'

const fmt = (x: number, d = 2) => x.toFixed(d)
const deg = (rad: number) => `${Math.round((rad * 180) / Math.PI)}°`
const kelvin = (T: number) =>
  `${Math.round(T).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} K`
const clamp = (x: number, a: number, b: number) => Math.min(Math.max(x, a), b)

/** [label, value, highlight?] */
type Row = [string, string, boolean?]
interface Content {
  title: string
  rows: Row[]
  note?: string
}

function rayContent(hit: Hit, n: number): Content {
  switch (hit.kind) {
    case 'disk': {
      const order =
        hit.order === 1 ? 'direct image' : hit.order === 2 ? '1st lensed · far side' : `order ${hit.order} · ring`
      return {
        title: 'Accretion disk',
        rows: [
          ['ray', `№${n} · ${order}`],
          ['radius', `${fmt(hit.r)} M · ${fmt(hit.r / RS)} r_s`],
          ['v_orbit', `${fmt(hit.vOrb)} c`, true],
          ['shift g', fmt(hit.g, 3), true],
          ['T_obs', kelvin(hit.Tobs)],
        ],
      }
    }
    case 'shadow':
      return {
        title: 'Captured',
        rows: [
          ['ray', `№${n}`],
          ['b', `${fmt(hit.b)} M < b_c ${fmt(B_CRIT, 2)} M`, true],
          ['Δφ to horizon', deg(hit.dphi)],
        ],
        note: 'no future-directed path returns.',
      }
    case 'spiral':
      return {
        title: 'Photon-sphere orbit',
        rows: [
          ['ray', `№${n}`],
          ['b', `≈ b_c = ${fmt(B_CRIT, 3)} M`, true],
          ['winding', `${deg(hit.dphi)} near r = 3M`],
        ],
      }
    case 'sky':
      return {
        title: 'Escaped',
        rows: [
          ['ray', `№${n}`],
          ['b', `${fmt(hit.b)} M > b_c ${fmt(B_CRIT, 2)} M`],
          ['deflection α', `${fmt(hit.deflectionDeg, 1)}°`, true],
        ],
      }
  }
}

function termContent(f: Extract<Focus, { type: 'term' }>): Content {
  switch (f.key) {
    case 'shadow':
      return {
        title: 'Shadow',
        rows: [
          ['b_c', '3√3 GM/c² = 5.196 M', true],
          ['dashed ring', 'the capture cross-section'],
          ['Sgr A* · Earth', '51 µas — EHT: 51.8'],
        ],
        note: 'rays inside the circle plunge; outside, they escape.',
      }
    case 'photon':
      return {
        title: 'Photon ring',
        rows: [
          ['marker', 'a real ring at r = 3M', true],
          ['lensing', 'count its images'],
          ['b_crit', '3√3 GM/c²'],
        ],
        note: 'the marker is ray-traced like everything else.',
      }
    case 'isco':
      return {
        title: 'ISCO',
        rows: [
          ['radius', 'r = 6GM/c²', true],
          ['inside it', 'no stable circular orbit'],
          ['one lap', '4.5 ms · 31 min · 34 d'],
        ],
        note: 'at 10 M☉ · Sgr A* · M87* respectively.',
      }
    case 'einstein':
      return {
        title: 'Einstein ring',
        rows: [
          ['alignment', 'a full circle of light', true],
          ['slight offset', 'two unequal arcs'],
        ],
        note: 'the blue star aligns mid-passage to the next screen.',
      }
    case 'mass': {
      const m = MASSES[f.massIdx]
      return {
        title: m.label,
        rows: [
          ['horizon', m.horizon, true],
          ['ISCO lap', m.iscoPeriod],
        ],
        note: `${m.note}. click again to re-scale.`,
      }
    }
  }
}

function CalloutView({ f, out }: { f: Focus; out?: boolean }) {
  const c = f.type === 'ray' ? rayContent(f.hit, f.n) : termContent(f)
  const vw = window.innerWidth
  const vh = window.innerHeight
  const BW = 246
  const BH = 40 + c.rows.length * 21 + (c.note ? 30 : 0)
  const dirX = f.x < vw / 2 ? 1 : -1
  const dirY = f.y < vh * 0.45 ? 1 : -1
  const L1 = 48
  const ex = f.x + dirX * L1
  const ey = clamp(f.y + dirY * L1, 24, vh - BH - 24)
  let bx = dirX === 1 ? ex + 78 : ex - 78 - BW
  bx = clamp(bx, 10, vw - BW - 10)
  const lineEndX = dirX === 1 ? bx : bx + BW
  const by = clamp(ey - 21, 10, vh - BH - 10)
  const o = out ? ' out' : ''
  // the card unfolds out of the corner the polyline arrives at
  const side = dirX === -1 ? ' from-right' : ''

  return (
    <>
      {f.type === 'ray' && (
        <div className={`reticle${o}`} style={{ left: f.x, top: f.y }} />
      )}
      <svg className={`callout-line${o}`} width="100%" height="100%" aria-hidden>
        <polyline points={`${f.x},${f.y} ${ex},${ey} ${lineEndX},${ey}`} pathLength={1} />
      </svg>
      <aside
        className={`callout${o}${side}`}
        style={{ left: bx, top: by }}
        onClick={() => store.dismiss()}
      >
        <div className="ht">{c.title}</div>
        <dl className="rows">
          {c.rows.map(([k, v, hot]) => (
            <div className="row" key={k}>
              <dt>{k}</dt>
              <dd className={hot ? 'hot' : undefined}>{v}</dd>
            </div>
          ))}
        </dl>
        {c.note && <p className="note">{c.note}</p>}
      </aside>
    </>
  )
}

/**
 * Renders the current focus, and keeps the previous one mounted for the
 * length of its exit animation so replacements cross-fade: card fades
 * down, polyline retracts toward the click point, poster fades back.
 */
export default function Hud() {
  const s = useStore()
  const focus = s.focus
  const [leaving, setLeaving] = useState<Focus | null>(null)
  const prev = useRef<Focus | null>(null)

  useEffect(() => {
    const p = prev.current
    prev.current = focus
    if (p && (!focus || focus.id !== p.id)) {
      setLeaving(p)
      const tm = setTimeout(() => setLeaving(null), 280)
      return () => clearTimeout(tm)
    }
  }, [focus])

  return (
    <>
      {leaving && <CalloutView f={leaving} out key={`out${leaving.id}`} />}
      {focus && <CalloutView f={focus} key={focus.id} />}
    </>
  )
}
