# Preset art-direction repair plan

## Problem

The wallpaper currently exposes eight curated presets, but most of their identity still comes from camera/view selection and clock placement. Preset rendering inherits the same `CUSTOM_SCENE_DEFAULTS`, while `VIEW_DIRECTORS` applies mostly modest modifiers. As a result, the presets read as related parameter snapshots rather than eight finished artworks, and the demo site can feel more expressive because its timeline creates distinct visual events: disk suppression, star-heavy lensing, redshift emphasis, macro material, and environmental scale.

## Non-negotiable rules

- Preset is a finished artwork. Its observation view, composition, material/light treatment, motion and clock grammar are fixed.
- Custom remains the continuous editor. Custom sliders must not be polluted by aggressive preset art direction.
- The eight presets must remain distinguishable in a small screenshot even with the clock hidden.
- HH/MM remain parallel as a pair. Date placement remains collision-safe.
- Prefer a small number of strong visual states over many modest multipliers.

## Stage 1 — Separate preset look/motion from Custom

Add explicit `look` and `motion` to each curated preset.

`look` owns:
- disk gain
- star gain
- exposure
- temperature multiplier
- outer disk radius
- turbulence
- bloom
- streak
- false-color emphasis

`motion` owns:
- camera drift
- disk rotation
- parallax response
- inclination breathing

Preset mode reads these values directly. Custom mode continues to derive the same resolved fields from the existing sliders plus observation-view corrections.

## Stage 2 — Make VIEW_DIRECTORS an observation layer

`VIEW_DIRECTORS` continues to own camera-family corrections such as framing, shift and roll. Its material/light modifiers are used for Custom observation views, not as the main identity of curated presets.

This removes the current coupling where a conservative Custom-oriented view modifier also has to function as the preset art director.

## Stage 3 — Eight distinct visual theses

### Signature — Hero Poster
The most complete black-hole image. Balanced disk, clean photon ring, restrained stars and bloom. Typography is a secondary hero, not a HUD.

### Horizon — Light Blade
A nearly edge-on luminous line. Low star field, reduced turbulence, long directional streak. The disk itself is the dominant graphic line.

### Terminal — Doppler Violence
The most aggressive preset. Knife-edge disk, strong approaching/receding asymmetry, compressed environment, stronger streak and selective false color. Camera motion stays slow while disk energy is high.

### Eclipse — Shadow Study
Disk and stars retreat. Shadow and higher-order photon structure become the subject. Almost no streak; slow motion; high formal stability.

### Void — Gravitational Sky
The disk nearly disappears. Lensed sky and stellar structure become the artwork, borrowing the successful visual logic of the demo's lensing passage.

### Close Pass — Material Macro
The only preset with intentionally high turbulence and fast disk rotation. Strong crop and surface detail produce a macro/material study.

### Wide — Cosmic Landscape
Small subject, broad environment, stronger stellar context, low bloom and low streak. Clock behaves as editorial caption rather than a hero object.

### Orbital — Circular Calm
Pulled-back polar view. Low turbulence, almost no streak, restrained bloom and slow motion. Circular geometry and negative space do the work.

## Stage 4 — Re-align clock grammar

Keep the current legibility guarantees, but stop flattening all pair orientation toward screen-horizontal.

- HH/MM always share one angle.
- Horizon follows the projected disk axis.
- Terminal follows the disk axis with a small shared offset.
- Orbital may use a shared tangent angle when it remains comfortable to read.
- Eclipse/Void/Wide stay close to horizontal.
- Date collision solver remains authoritative and may move or hide the date on cramped screens.

## Validation

For each preset, test at 16:9, 16:10, 21:9, 4:3 and portrait.

Primary acceptance test: hide the clock, capture all eight presets at thumbnail size, and verify that each is recognizable by silhouette, light distribution, environment and motion thesis rather than by label or camera angle alone.
