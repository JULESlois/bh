import type { ReactNode } from 'react'
import { store, useStore, type TermKey } from '../store'
import { MASSES } from '../physics/constants'
import { reg, actions } from './dom'

function Term(props: {
  k?: TermKey
  cycleMass?: boolean
  onActivate?: () => void
  active?: boolean
  children: ReactNode
}) {
  const on = (x: number, y: number) => {
    if (props.cycleMass) store.cycleMass()
    if (props.k) store.openTerm(props.k, x, y)
    props.onActivate?.()
  }
  return (
    <span
      className={`term${props.active ? ' active' : ''}`}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        on(e.clientX, e.clientY)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          const r = (e.target as HTMLElement).getBoundingClientRect()
          on(r.left + r.width / 2, r.top + r.height / 2)
        }
      }}
    >
      {props.children}
    </span>
  )
}

function Sec(props: { i: number; place: string; fx: string; children: ReactNode }) {
  return (
    <section
      ref={reg(`sec${props.i}`)}
      className={`sec p-${props.place} fx-${props.fx}`}
      aria-hidden
    >
      <div className="blk">
        <div className="inner">{props.children}</div>
      </div>
    </section>
  )
}

export default function Overlay() {
  const s = useStore()
  const f = s.focus
  const termActive = (k: TermKey) => f?.type === 'term' && f.key === k
  const mass = MASSES[s.massIdx]

  return (
    <>
      {/* 0 — HERO */}
      <Sec i={0} place="bl" fx="track">
        <h1 className="display display-xl">
          Schwarz
          <br />
          schild
        </h1>
        <p className="body">
          One photon per pixel, traced <em>backwards</em> through curved
          spacetime by integrating the geodesic equation of the Schwarzschild
          metric. Nothing on this page is painted, filmed, or textured.
        </p>
      </Sec>

      {/* 1 — EVENT HORIZON */}
      <Sec i={1} place="tr" fx="wipe">
        <h2 className="display">
          Event
          <br />
          horizon
        </h2>
        <p className="body">
          A one-way membrane at <em>r_s = 2GM/c²</em>. Inside, every possible
          future points at the singularity; no signal returns. The{' '}
          <Term k="shadow" active={termActive('shadow')}>shadow</Term> you see
          is wider than the horizon itself — the capture cross-section for
          light, radius <em>√27/2 · r_s ≈ 2.6 r_s</em>, and the blackest thing
          this screen can show.
        </p>
        <p className="body">
          Every scale here is set by the mass. For{' '}
          <Term k="mass" cycleMass active={termActive('mass')}>
            M = {mass.label} ⟳
          </Term>
          : horizon {mass.horizon}.
        </p>
      </Sec>

      {/* 2 — PHOTON SPHERE */}
      <Sec i={2} place="cl" fx="blur">
        <h2 className="display">
          Light
          <br />
          in orbit
        </h2>
        <p className="body">
          Close enough, gravity bends light into circles: at{' '}
          <em>r = 3GM/c²</em> photons orbit. Rays that graze it wind around —
          once, twice, <em>n</em> times — before escaping to your eye,
          stacking infinitely many images of the disk into the thin bright
          line hugging the shadow: the{' '}
          <Term k="photon" active={termActive('photon')}>photon ring</Term>.
        </p>
      </Sec>

      {/* 3 — ACCRETION DISK */}
      <Sec i={3} place="tl" fx="rise">
        <h2 className="display">
          Accretion
          <br />
          disk
        </h2>
        <p className="body">
          Plasma on Keplerian orbits, <em>r = 6M → 28M</em>,{' '}
          <em>Ω = √(GM/r³)</em>. At the inner edge — the{' '}
          <Term k="isco" active={termActive('isco')}>ISCO</Term>, r = 6GM/c² —
          it moves at <em>half the speed of light</em>. The approaching side
          is Doppler-boosted by g⁴; that is why one wing burns white while the
          other smolders red. Temperature follows Novikov–Thorne,{' '}
          <em>T ∝ r^−¾ (1 − √(6M/r))^¼</em>.
        </p>
      </Sec>

      {/* 4 — LENSING */}
      <Sec i={4} place="tr" fx="skew">
        <h2 className="display">
          Spacetime
          <br />
          is the lens
        </h2>
        <p className="body">
          The disk is dimmed so the sky can speak. Nothing near the shadow
          sits where it appears: starlight bends by <em>α ≈ 4GM/c²b</em>, the
          far side of the sky folds into rings, and a source sliding directly
          behind the hole smears into an{' '}
          <Term k="einstein" active={termActive('einstein')}>Einstein ring</Term>.
        </p>
      </Sec>

      {/* 5 — REDSHIFT */}
      <Sec i={5} place="tc" fx="wipey">
        <h2 className="display">
          The color
          <br />
          of gravity
        </h2>
        <p className="body">
          False color: every disk pixel shows its measured shift{' '}
          <em>g = √(1 − 3M/r) / (1 + Ωb)</em>. Red where clocks run slow and
          light climbs out tired; blue where beaming wins. One number sets
          brightness (∝ g⁴), temperature (T_obs = g·T) and color — three
          effects, one factor.
        </p>
      </Sec>

      {/* 6 — EPILOGUE */}
      <Sec i={6} place="c" fx="fade">
        <h2 className="display">
          Nothing here
          <br />
          is painted
        </h2>
        <p className="body" style={{ margin: '22px auto 0' }}>
          <em>d²u/dφ² + u = 3Mu²</em> — one line of geometry draws all of
          this. Schwarzschild solved Einstein's equations in 1915 while
          serving on the Russian front; Luminet plotted the first image of a
          disk by hand in 1979; the EHT photographed M87* in 2019. You just
          integrated a few hundred million geodesics by scrolling.
        </p>
        <p className="smallnote" style={{ margin: '18px auto 0', maxWidth: '46ch' }}>
          RK4 · adaptive Δφ · Planck spectra · ACES — disk temperature is
          rescaled into the visible band; a real 10 M☉ disk peaks in X-rays.
        </p>
        <p className="body" style={{ marginTop: 26 }}>
          <Term
            onActivate={() =>
              actions.pageTo ? actions.pageTo(0) : window.scrollTo({ top: 0, behavior: 'smooth' })
            }
          >
            ↑ back to the top
          </Term>
        </p>
      </Sec>
    </>
  )
}
