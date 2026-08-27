import { store, useStore } from '../store'
import { RS, B_CRIT } from '../physics/constants'
import type { Hit } from '../physics/geodesic'

const fmt = (x: number, d = 2) => x.toFixed(d)
const deg = (rad: number) => `${Math.round((rad * 180) / Math.PI)}°`
const kelvin = (T: number) =>
  `${Math.round(T).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} K`
const clamp = (x: number, a: number, b: number) => Math.min(Math.max(x, a), b)

/** [label, value, highlight?] */
type Row = [string, string, boolean?]

function report(hit: Hit): { title: string; rows: Row[] } {
  switch (hit.kind) {
    case 'disk': {
      const order =
        hit.order === 1 ? 'direct image' : hit.order === 2 ? '1st lensed · far side' : `order ${hit.order} · ring`
      return {
        title: 'Accretion disk',
        rows: [
          ['image', order],
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
          ['b', `${fmt(hit.b)} M < b_c ${fmt(B_CRIT, 2)} M`, true],
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
        ],
      }
    case 'sky':
      return {
        title: 'Escaped',
        rows: [
          ['b', `${fmt(hit.b)} M > b_c ${fmt(B_CRIT, 2)} M`],
          ['deflection α', `${fmt(hit.deflectionDeg, 1)}°`, true],
        ],
      }
  }
}

/**
 * Poster fades out (App drives that), and the measured pixel is tied to a
 * small instrument box by a polyline: click → 45° elbow → horizontal run.
 * Dismissed by scrolling or clicking it; the poster fades back.
 */
export default function Hud() {
  const s = useStore()
  const rec = s.hitRec
  if (!rec) return null
  const { title, rows } = report(rec.hit)

  const vw = window.innerWidth
  const vh = window.innerHeight
  const BW = 246 // box width
  const BH = 46 + rows.length * 21 // approximate box height
  const dirX = rec.x < vw / 2 ? 1 : -1
  const dirY = rec.y < vh * 0.45 ? 1 : -1
  const L1 = 48
  const ex = rec.x + dirX * L1
  const ey = clamp(rec.y + dirY * L1, 24, vh - BH - 24)
  let bx = dirX === 1 ? ex + 78 : ex - 78 - BW
  bx = clamp(bx, 10, vw - BW - 10)
  const lineEndX = dirX === 1 ? bx : bx + BW
  const by = clamp(ey - 21, 10, vh - BH - 10)

  return (
    <>
      <div className="reticle" style={{ left: rec.x, top: rec.y }} key={rec.id} />
      <svg className="callout-line" width="100%" height="100%" aria-hidden>
        <polyline
          points={`${rec.x},${rec.y} ${ex},${ey} ${lineEndX},${ey}`}
          pathLength={1}
        />
      </svg>
      <aside
        className="callout"
        style={{ left: bx, top: by }}
        onClick={() => store.setHit(null)}
      >
        <div className="hk">Ray №{rec.id} · geodesic</div>
        <div className="ht">{title}</div>
        <dl className="rows">
          {rows.map(([k, v, hot]) => (
            <div className="row" key={k}>
              <dt>{k}</dt>
              <dd className={hot ? 'hot' : undefined}>{v}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </>
  )
}
