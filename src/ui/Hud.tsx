import { store, useStore } from '../store'
import { RS, R_PHOTON, R_ISCO, R_OUT, B_CRIT } from '../physics/constants'
import type { Hit } from '../physics/geodesic'

const fmt = (x: number, d = 2) => x.toFixed(d)
const deg = (rad: number) => `${Math.round((rad * 180) / Math.PI)}°`
const kelvin = (T: number) =>
  `${Math.round(T).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} K`

/** [label, value, highlight?] */
type Row = [string, string, boolean?]

/** the photon's actual integrated trajectory, drawn in its orbital plane */
function Inset({ hit }: { hit: Hit }) {
  const S = 176
  const c = S / 2
  const pts = hit.path
  let maxR = 8
  for (let i = 0; i < pts.length; i += 2) {
    const r = Math.hypot(pts[i], pts[i + 1])
    if (r > maxR) maxR = r
  }
  maxR = Math.min(maxR, 48)
  const k = (c - 12) / maxR
  let d = ''
  let started = false
  for (let i = 0; i < pts.length; i += 2) {
    const x = c + pts[i] * k
    const y = c - pts[i + 1] * k
    if (x < -20 || x > S + 20 || y < -20 || y > S + 20) continue
    d += `${started ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
    started = true
  }
  const dl = hit.diskLine
  const endX = c + pts[pts.length - 2] * k
  const endY = c - pts[pts.length - 1] * k
  // scale rings every 10M, up to the largest that fits
  const rings: number[] = []
  for (let r = 10; r <= maxR; r += 10) rings.push(r)
  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden>
      {rings.map((r) => (
        <circle key={r} cx={c} cy={c} r={r * k} fill="none"
                stroke="#8a8578" strokeWidth="0.5" opacity="0.22" />
      ))}
      {rings.length > 0 && (
        <text x={c + rings[rings.length - 1] * k - 2} y={c - 4} textAnchor="end"
              fill="#8a8578" opacity="0.7"
              style={{ font: '500 7.5px IBM Plex Mono, monospace', letterSpacing: '0.08em' }}>
          {rings[rings.length - 1]}M
        </text>
      )}
      {/* disk cross-section in this photon's orbital plane */}
      {dl && (
        <>
          <line x1={c + dl[0] * R_ISCO * k} y1={c - dl[1] * R_ISCO * k}
                x2={c + dl[0] * R_OUT * k} y2={c - dl[1] * R_OUT * k}
                stroke="#ffb25e" strokeWidth="2.5" opacity="0.75" />
          <line x1={c - dl[0] * R_ISCO * k} y1={c + dl[1] * R_ISCO * k}
                x2={c - dl[0] * R_OUT * k} y2={c + dl[1] * R_OUT * k}
                stroke="#ffb25e" strokeWidth="2.5" opacity="0.75" />
        </>
      )}
      {/* photon sphere */}
      <circle cx={c} cy={c} r={R_PHOTON * k} fill="none" stroke="#6fd5ce"
              strokeWidth="0.7" strokeDasharray="3 4" opacity="0.5" />
      {/* horizon */}
      <circle cx={c} cy={c} r={RS * k} fill="#000" stroke="#8a8578" strokeWidth="0.8" />
      {/* the geodesic itself */}
      <path d={d} fill="none" stroke="#6fd5ce" strokeWidth="1.3" opacity="0.95" />
      {/* camera + terminus */}
      <circle cx={c + pts[0] * k} cy={c - pts[1] * k} r="2.6" fill="#e8e4dc" />
      <circle cx={endX} cy={endY} r="2.2"
              fill={hit.kind === 'disk' ? '#ffb25e' : hit.kind === 'sky' ? '#6fd5ce' : '#b81a0d'} />
      <text x={c + pts[0] * k + 5} y={c - pts[1] * k + 3}
            fill="#8a8578" style={{ font: '500 8px IBM Plex Mono, monospace', letterSpacing: '0.1em' }}>
        CAM
      </text>
    </svg>
  )
}

function report(hit: Hit): { title: string; rows: Row[] } {
  switch (hit.kind) {
    case 'disk': {
      const order =
        hit.order === 1
          ? 'direct'
          : hit.order === 2
            ? '1st lensed · far side'
            : `order ${hit.order} · ring regime`
      return {
        title: 'Accretion disk',
        rows: [
          ['image', order],
          ['radius', `${fmt(hit.r)} M · ${fmt(hit.r / RS)} r_s`],
          ['v_orbit', `${fmt(hit.vOrb)} c`, true],
          ['Ω', `${fmt(hit.omega, 4)} c³/GM`],
          ['shift g', fmt(hit.g, 3), true],
          ['T_obs', kelvin(hit.Tobs)],
          ['b', `${fmt(hit.b)} M`],
          ['Δφ swept', deg(hit.dphi)],
        ],
      }
    }
    case 'shadow':
      return {
        title: 'Captured',
        rows: [
          ['b', `${fmt(hit.b)} M  <  b_c ${fmt(B_CRIT, 3)} M`, true],
          ['Δφ to horizon', deg(hit.dphi)],
          ['fate', 'no path returns'],
        ],
      }
    case 'spiral':
      return {
        title: 'Photon-sphere orbit',
        rows: [
          ['b', `≈ b_c = ${fmt(B_CRIT, 3)} M`, true],
          ['winding', `${deg(hit.dphi)} near r = 3M`],
          ['fate', 'trapped, unresolved'],
        ],
      }
    case 'sky':
      return {
        title: 'Escaped to the stars',
        rows: [
          ['b', `${fmt(hit.b)} M  >  b_c ${fmt(B_CRIT, 3)} M`],
          ['deflection α', `${fmt(hit.deflectionDeg, 1)}°`, true],
          ['Δφ swept', deg(hit.dphi)],
        ],
      }
  }
}

export default function Hud() {
  const s = useStore()
  const rec = s.hitRec
  if (!rec) return null
  const { title, rows } = report(rec.hit)
  return (
    <>
      <div className="reticle" style={{ left: rec.x, top: rec.y }} key={rec.id} />
      <aside className="hud" onClick={() => store.setHit(null)} title="dismiss">
        <div className="hk">Ray report · geodesic №{rec.id}</div>
        <div className="ht">{title}</div>
        <dl className="rows">
          {rows.map(([k, v, hot]) => (
            <div className="row" key={k}>
              <dt>{k}</dt>
              <dd className={hot ? 'hot' : undefined}>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="hr" />
        <Inset hit={rec.hit} />
        <div className="dismiss">orbital-plane view · click to dismiss</div>
      </aside>
    </>
  )
}
