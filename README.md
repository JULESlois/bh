# SCHWARZSCHILD

A one-page website that is a general-relativistic ray tracer. Every pixel,
every frame, is a photon launched backwards from the camera and integrated
through the Schwarzschild metric on the GPU. No textures, no video, no
pre-rendered assets — the black hole you see is computed from the geodesic
equation while you scroll.

React 19 + TypeScript + Vite + raw WebGL2. No other runtime dependencies.

## Run

```sh
npm install
npm run dev        # dev server
npm run build      # type-check + production build to dist/
npm run preview    # serve dist/
```

## The physics

Geometrized units G = c = 1, M = 1 (so r_s = 2). Spherical symmetry keeps
each photon in the plane spanned by the camera position and ray direction;
in that plane, with u = 1/r, the exact null-geodesic (Binet) equation

    d²u/dφ² = 3Mu² − u

is integrated per pixel with RK4 and an adaptive step in φ. Initial
conditions are set for a static observer at the camera (the √(1 − r_s/r)
factor), and equatorial-plane crossings are located by Newton-polishing the
analytic plane-height function plus one exact-size RK4 substep.

- **Shadow** — rays with impact parameter b < b_c = 3√3 M cross the horizon.
- **Photon ring** — near-critical rays wind around r = 3M and stack
  higher-order images of the disk; nothing is special-cased, the ring falls
  out of the integration.
- **Accretion disk** — thin disk from the ISCO (r = 6M) to r = 28M on
  Keplerian orbits Ω = √(M/r³). Effective temperature follows the
  Novikov–Thorne profile T ∝ r^(−3/4)(1 − √(6M/r))^(1/4), with turbulence
  sheared by differential rotation (a seam-free azimuth-periodic fbm).
- **Redshift/beaming** — each disk sample uses the exact combined factor
  g = √(1 − 3M/r) / (1 + Ωb) with b the photon's conserved angular momentum
  about the disk axis. A Planck spectrum at T maps to a Planck spectrum at
  gT, so color, temperature, and g⁴ beaming come from one evaluation.
- **Lensing** — the background starfield and a companion star are sampled
  by the ray's exit direction; the companion is positioned so it slides
  exactly behind the hole mid-scroll and smears into an Einstein ring.

Honest display compromises: disk temperature is rescaled into the visible
band (a real 10 M☉ disk peaks in X-rays), and the camera is treated as
static (no aberration from its slow orbital drift).

## Interaction model

No buttons, no nav. Three verbs:

- **Scroll** — the only camera control. Wheel and keyboard gestures are
  paged by a locked tween (touch falls back to mandatory CSS snap), so one
  gesture always lands on the next full screen of the continuous shot:
  hero → event horizon → photon sphere → disk → lensing (Einstein-ring
  passage) → false-color redshift view → epilogue. The native scrollbar is
  hidden; the progress rail surfaces only while the page moves. The camera
  itself never rests — a slow orbital drift and inclination breathing run
  on every screen, and the Einstein-ring star tracks the drift so the
  alignment stays exact.
- **Click anything** — one unified interaction. Clicking a pixel of the
  render runs the same Binet equation CPU-side (`src/physics/geodesic.ts`)
  and reports what that photon did; clicking an underlined physics term
  opens its card and draws its overlay on the render (ray-traced marker
  rings at r = 3M and the ISCO, the dashed b_c circle, the mass cycler).
  Either way the poster fades out and a polyline ties the click point to a
  chamfered instrument card; a new click, a scroll, or clicking the card
  retracts the line, fades the card, and brings the poster back.

Deep links for QA: append `#t=3.5` (0–6) to land at any scroll position.

## Wallpaper Engine

`wallpaper.html` is a second, static entry — the same ray tracer as a
desktop live wallpaper: no scroll narrative, a perpetually drifting
camera (the companion star still slides behind the hole once per orbit,
so an Einstein ring recurs on your desktop), plus an optional clock,
mouse parallax and a fading mouse trail.

Build once, and `dist/` is a complete Wallpaper Engine project — the
included `project.json` points at `wallpaper.html`:

```sh
npm run build
# copy dist/ to:  <Steam>/steamapps/common/wallpaper_engine/projects/myprojects/schwarzschild
```

Settings live in two equivalent places: Wallpaper Engine's own property
panel (View / Clock / Date / Mouse parallax / Mouse trail / Orbit drift /
Quality), or — with mouse input enabled — a hidden hotspot in the top-right
corner of the screen (a corner bracket appears on hover) that slides out
the in-page panel. Choices persist via localStorage. In a browser, the
same page is at `/wallpaper.html`.

## Layout of the code

    src/physics/constants.ts   shared truth: radii, profiles, g-factor
    src/physics/geodesic.ts    CPU integrator for click hit-testing
    src/gl/shaders.ts          GLSL: GR ray tracer + bloom + composite
    src/gl/renderer.ts         WebGL2 pipeline, HDR targets, auto-quality
    src/scene/timeline.ts      scroll → camera/mode keyframes
    src/ui/                    Overlay (copy), Hud (ray report), Chrome
    tools/refrender.ts         CPU twin of the shader → PNG, for review
    tools/dump-shaders.ts      extract GLSL for glslangValidator

The site auto-adapts internal resolution and integration step count to the
device's frame time (0.42×–1× render scale, 240–620 RK4 steps per ray).
