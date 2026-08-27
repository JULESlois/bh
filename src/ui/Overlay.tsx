import type { ReactNode } from 'react'
import { store, useStore, type Annotations } from '../store'
import { MASSES } from '../physics/constants'
import { reg } from './dom'

function Term(props: {
  k?: keyof Annotations
  onClick?: () => void
  active?: boolean
  children: ReactNode
}) {
  const on = () => {
    if (props.k) store.toggleAnnotation(props.k)
    props.onClick?.()
  }
  return (
    <span
      className={`term${props.active ? ' active' : ''}`}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        on()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          on()
        }
      }}
    >
      {props.children}
    </span>
  )
}

function Sec(props: {
  i: number
  place: string
  fx: string
  children: ReactNode
}) {
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
  const a = s.annotations
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
          <br />
          <span className="sub">Scroll to fall in.</span>
        </p>
      </Sec>

      {/* 1 — EVENT HORIZON */}
      <Sec i={1} place="tr" fx="wipe">
        <div className="kicker">r = 2GM/c²</div>
        <h2 className="display">
          Event
          <br />
          horizon
        </h2>
        <p className="body">
          A one-way membrane. Inside, every possible future points at the
          singularity; no signal returns. The <Term k="shadow" active={a.shadow}>shadow</Term>{' '}
          you see is wider than the horizon itself — it is the capture
          cross-section for light, radius <em>√27/2 · r_s ≈ 2.6 r_s</em>, and
          the blackest thing this screen can show.
        </p>
        <p className="body sub">
          Every scale here is set by the mass. For{' '}
          <Term onClick={() => store.cycleMass()}>M = {mass.label} ⟳</Term>:
          horizon {mass.horizon} — {mass.note}.
        </p>
        {a.shadow && (
          <div className="foot">
            dashed circle: b_c = 3√3 GM/c² = 5.196 GM/c² — the critical impact
            parameter. Rays inside it plunge; rays outside escape.
          </div>
        )}
      </Sec>

      {/* 2 — PHOTON SPHERE */}
      <Sec i={2} place="cl" fx="blur">
        <div className="kicker">r = 3GM/c²</div>
        <h2 className="display">
          Light
          <br />
          in orbit
        </h2>
        <p className="body">
          Close enough, gravity bends light into circles. Photons grazing{' '}
          <em>r = 3M</em> wind around — once, twice, <em>n</em> times — before
          escaping to your eye, stacking infinitely many images of the disk
          into the thin bright line hugging the shadow: the{' '}
          <Term k="photon" active={a.photon}>photon ring</Term>.
        </p>
        {a.photon && (
          <div className="foot">
            the dashed marker is a real ring at r = 3M, ray-traced like
            everything else — count its images above and below the shadow.
          </div>
        )}
      </Sec>

      {/* 3 — ACCRETION DISK */}
      <Sec i={3} place="tl" fx="rise">
        <div className="kicker">r = 6M → 28M</div>
        <h2 className="display">
          Accretion
          <br />
          disk
        </h2>
        <p className="body">
          Plasma on Keplerian orbits. At the inner edge — the{' '}
          <Term k="isco" active={a.isco}>ISCO</Term>, r = 6GM/c² — it moves at{' '}
          <em>half the speed of light</em>. The approaching side is
          Doppler-boosted by g⁴; that is why one wing burns white while the
          other smolders red. Temperature follows Novikov–Thorne,{' '}
          <em>T ∝ r^−¾ (1 − √(6M/r))^¼</em>.
        </p>
        {a.isco && (
          <div className="foot">
            no stable circular orbit exists inside r = 6GM/c². One ISCO lap:
            4.5 ms at 10 M☉ · 31 min at Sgr A* · 34 days at M87*.
          </div>
        )}
      </Sec>

      {/* 4 — LENSING */}
      <Sec i={4} place="tr" fx="skew">
        <div className="kicker">α ≈ 4GM / c²b</div>
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
          <Term k="einstein" active={a.einstein}>Einstein ring</Term>.
        </p>
        <p className="body sub">Keep scrolling — a star is about to pass behind.</p>
        {a.einstein && (
          <div className="foot">
            perfect alignment → a full circle of light; slight offset → two
            arcs of unequal brightness. Watch the blue star as you scroll.
          </div>
        )}
      </Sec>

      {/* 5 — REDSHIFT */}
      <Sec i={5} place="tc" fx="wipey">
        <div className="kicker">g = ν_obs / ν_emit</div>
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
          <Term onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            ↑ back to the top
          </Term>
        </p>
      </Sec>
    </>
  )
}
