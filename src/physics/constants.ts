/**
 * Geometrized units: G = c = 1, M = 1.
 * Lengths are in units of GM/c². The Schwarzschild radius is r_s = 2.
 * These constants are shared verbatim by the GLSL ray tracer and the
 * TypeScript geodesic integrator used for click hit-testing, so the
 * pixel you click is classified by the same equations that rendered it.
 */

export const M = 1.0
/** Schwarzschild radius r_s = 2GM/c² */
export const RS = 2.0
/** Photon sphere r = 3GM/c² — circular photon orbits (unstable) */
export const R_PHOTON = 3.0
/** Innermost stable circular orbit r = 6GM/c² — inner edge of the disk */
export const R_ISCO = 6.0
/** Outer edge of the rendered accretion disk */
export const R_OUT = 28.0
/** Radius beyond which a ray is considered escaped to infinity */
export const R_ESC = 70.0
/** Critical impact parameter b_c = 3√3·GM/c² — edge of the shadow */
export const B_CRIT = 3 * Math.sqrt(3)
/** Display temperature scale of the disk (peak effective temperature, K).
 *  A real 10 M☉ disk peaks in X-rays; we rescale into the visible band. */
export const T_DISP = 5000.0
/** Peak of the Novikov–Thorne profile r^{-3/4}(1-√(6/r))^{1/4}, at r≈8.17 */
export const NT_PEAK = 0.1273
/** Simulation seconds → M units of coordinate time (disk rotation speed) */
export const TIME_SCALE = 9.0

/** Novikov–Thorne effective temperature profile, normalized to peak 1. */
export function ntProfile(r: number): number {
  const s = Math.max(1 - Math.sqrt(R_ISCO / r), 0)
  return (Math.pow(1 / r, 0.75) * Math.pow(s, 0.25)) / NT_PEAK
}

/** Keplerian angular velocity Ω = √(M/r³) of a circular geodesic. */
export function omegaK(r: number): number {
  return Math.pow(1 / r, 1.5)
}

/** Orbital speed measured by a local static observer, in units of c. */
export function orbitalSpeed(r: number): number {
  return (r * omegaK(r)) / Math.sqrt(Math.max(1 - RS / r, 1e-9))
}

/**
 * Combined gravitational + Doppler shift factor g = ν_obs/ν_emit for a
 * photon emitted by matter on a circular geodesic at radius r, received
 * by a distant static observer. bAxis is the photon's conserved impact
 * parameter about the disk axis, as computed for the *backward-traced*
 * ray (camera → disk), which flips its sign relative to the physical
 * photon — hence the plus sign.
 */
export function gFactor(r: number, bAxis: number): number {
  const g = Math.sqrt(Math.max(1 - 3 / r, 0)) / (1 + omegaK(r) * bAxis)
  return Math.min(Math.max(g, 0.05), 5)
}

/** Mass presets for the "click to re-scale the universe" readouts. */
export interface MassPreset {
  label: string
  msun: number
  /** horizon diameter, human units */
  horizon: string
  /** one ISCO orbital period 2π·6^1.5·GM/c³ */
  iscoPeriod: string
  /** angular shadow size from a canonical distance, if famous */
  note: string
}

export const MASSES: MassPreset[] = [
  {
    label: '10 M☉',
    msun: 10,
    horizon: 'Ø 59 km',
    iscoPeriod: '4.5 ms',
    note: 'a stellar-mass hole — X-ray binary class',
  },
  {
    label: 'Sgr A* · 4.15×10⁶ M☉',
    msun: 4.15e6,
    horizon: 'Ø 0.16 AU',
    iscoPeriod: '31 min',
    note: 'shadow from Earth: 51 µas — EHT measured 51.8',
  },
  {
    label: 'M87* · 6.5×10⁹ M☉',
    msun: 6.5e9,
    horizon: 'Ø 256 AU',
    iscoPeriod: '34 days',
    note: 'the first black hole ever photographed (2019)',
  },
]
