export type CompositionId = 'cinematic' | 'horizon' | 'terminal' | 'centered' | 'void' | 'close' | 'wide' | 'orbital'
export type ScenePresetId =
  | 'signature' | 'horizon' | 'terminal' | 'centered' | 'void' | 'close'
  | 'edge' | 'ring' | 'face' | 'near' | 'silhouette' | 'wide' | 'knife' | 'polar'
export type ClockEngineName = 'monument' | 'eclipse' | 'blade' | 'orbit' | 'depth' | 'quiet' | 'relativistic'
export type ClockArtName = 'poster' | 'horizon' | 'eclipse' | 'orbit' | 'crop' | 'quiet' | 'caption' | 'blade' | 'relativistic'
export type ObservationViewId = 'balanced' | 'edge' | 'ring' | 'face' | 'near' | 'silhouette' | 'wide' | 'knife' | 'polar'
export type CustomViewId = 'preset' | ObservationViewId

/**
 * Observation views are physical camera families. Curated presets choose one
 * canonical view each; Custom may explicitly override that choice.
 */
export const CAMERA_PRESETS = [
  // balanced / Signature
  { dist: 30.5, incl: 80.0, fov: 59, expo: 0.98, disk: 1.00, star: 0.96 },
  // edge-on / Horizon
  { dist: 28.5, incl: 87.1, fov: 52, expo: 0.96, disk: 1.02, star: 0.90 },
  // photon ring / Eclipse
  { dist: 26.5, incl: 62.0, fov: 35, expo: 1.08, disk: 0.94, star: 0.78 },
  // face-on / Custom-only study
  { dist: 30.0, incl: 24.0, fov: 46, expo: 1.05, disk: 1.00, star: 0.90 },
  // near / Close Pass
  { dist: 18.0, incl: 77.0, fov: 70, expo: 0.94, disk: 1.00, star: 0.86 },
  // silhouette / Void
  { dist: 36.0, incl: 56.0, fov: 50, expo: 1.00, disk: 0.10, star: 1.75 },
  // wide / Wide
  { dist: 45.0, incl: 70.0, fov: 64, expo: 0.90, disk: 0.94, star: 1.18 },
  // knife-edge / Terminal
  { dist: 28.0, incl: 89.35, fov: 46, expo: 1.00, disk: 1.00, star: 0.86 },
  // polar / Orbital
  { dist: 30.0, incl: 11.5, fov: 48, expo: 1.04, disk: 0.96, star: 0.86 },
] as const

/**
 * Observation-family corrections. In curated Preset mode these values remain
 * responsible for camera framing/shift/roll only. Their material/light fields
 * are retained for Custom, where changing observation view should remain a
 * continuous and predictable operation.
 */
export const VIEW_DIRECTORS = [
  { framing: 0.98, shift: [0.01, 0.00], roll: -0.8, disk: 1.00, star: 0.94, glow: 0.96, streak: 0.86, expo: 0.97, turb: 0.94, diskOut: 1.00, temp: 1.00, motion: 0.76 },
  { framing: 0.95, shift: [0.02, -0.01], roll: -1.3, disk: 1.13, star: 0.72, glow: 1.04, streak: 1.38, expo: 0.94, turb: 0.76, diskOut: 0.91, temp: 1.02, motion: 0.54 },
  { framing: 1.08, shift: [-0.02, 0.01], roll: 0.6, disk: 0.50, star: 0.44, glow: 1.18, streak: 0.18, expo: 0.84, turb: 0.46, diskOut: 0.63, temp: 1.04, motion: 0.24 },
  { framing: 1.02, shift: [0.02, 0.05], roll: 4.5, disk: 0.96, star: 0.78, glow: 0.82, streak: 0.16, expo: 0.98, turb: 1.12, diskOut: 1.08, temp: 0.99, motion: 0.72 },
  { framing: 0.94, shift: [0.10, -0.03], roll: -2.2, disk: 1.16, star: 0.58, glow: 0.96, streak: 0.66, expo: 0.90, turb: 1.14, diskOut: 0.88, temp: 1.02, motion: 0.48 },
  { framing: 1.05, shift: [-0.05, 0.01], roll: 1.8, disk: 0.32, star: 1.55, glow: 0.38, streak: 0.06, expo: 0.80, turb: 0.24, diskOut: 0.74, temp: 0.96, motion: 0.34 },
  { framing: 1.02, shift: [0.02, 0.03], roll: 3.8, disk: 0.78, star: 1.30, glow: 0.62, streak: 0.34, expo: 0.92, turb: 0.80, diskOut: 1.02, temp: 0.99, motion: 0.66 },
  { framing: 0.91, shift: [0.05, -0.02], roll: -1.2, disk: 1.18, star: 0.50, glow: 1.04, streak: 1.58, expo: 0.88, turb: 0.72, diskOut: 0.84, temp: 1.06, motion: 0.28 },
  { framing: 1.02, shift: [-0.01, 0.03], roll: 5.0, disk: 0.88, star: 0.72, glow: 0.64, streak: 0.04, expo: 0.92, turb: 1.04, diskOut: 0.94, temp: 1.00, motion: 0.48 },
] as const

export const VIEW_TRANSITIONS = [
  { duration: 1.45, dip: 0.07, focus: 0.03, starStart: 0.78, starDelay: 0.04, diskStart: 0.88, diskDelay: 0.00, streakStart: 0.55, streakDelay: 0.14, rollKick: 0.7, clockDelay: 0.05 },
  { duration: 1.70, dip: 0.12, focus: 0.06, starStart: 0.64, starDelay: 0.10, diskStart: 0.76, diskDelay: 0.02, streakStart: 0.08, streakDelay: 0.34, rollKick: -1.5, clockDelay: 0.12 },
  { duration: 2.25, dip: 0.20, focus: 0.11, starStart: 0.38, starDelay: 0.22, diskStart: 0.54, diskDelay: 0.10, streakStart: 0.10, streakDelay: 0.40, rollKick: 1.0, clockDelay: 0.24 },
  { duration: 1.70, dip: 0.08, focus: 0.04, starStart: 0.70, starDelay: 0.08, diskStart: 0.76, diskDelay: 0.02, streakStart: 0.18, streakDelay: 0.24, rollKick: 2.0, clockDelay: 0.10 },
  { duration: 1.55, dip: 0.13, focus: 0.07, starStart: 0.56, starDelay: 0.10, diskStart: 0.80, diskDelay: 0.02, streakStart: 0.32, streakDelay: 0.20, rollKick: -1.1, clockDelay: 0.12 },
  { duration: 2.40, dip: 0.18, focus: 0.01, starStart: 0.16, starDelay: 0.20, diskStart: 1.24, diskDelay: 0.00, streakStart: 0.04, streakDelay: 0.46, rollKick: 0.6, clockDelay: 0.34 },
  { duration: 2.00, dip: 0.09, focus: 0.00, starStart: 0.38, starDelay: 0.12, diskStart: 0.68, diskDelay: 0.06, streakStart: 0.24, streakDelay: 0.26, rollKick: 2.0, clockDelay: 0.14 },
  { duration: 2.05, dip: 0.20, focus: 0.10, starStart: 0.46, starDelay: 0.14, diskStart: 0.70, diskDelay: 0.04, streakStart: 0.02, streakDelay: 0.48, rollKick: -2.8, clockDelay: 0.20 },
  { duration: 1.95, dip: 0.09, focus: 0.03, starStart: 0.58, starDelay: 0.10, diskStart: 0.74, diskDelay: 0.04, streakStart: 0.08, streakDelay: 0.34, rollKick: 2.4, clockDelay: 0.16 },
] as const

/** Camera framing is part of each curated artwork. */
export const COMPOSITIONS: Record<CompositionId, { shift: readonly [number, number]; dist: number; roll: number }> = {
  cinematic: { shift: [0.54, -0.03], dist: 0.88, roll: -5.0 },
  horizon: { shift: [-0.67, -0.38], dist: 0.76, roll: 3.0 },
  terminal: { shift: [0.60, 0.30], dist: 0.88, roll: -10.0 },
  centered: { shift: [0.00, 0.00], dist: 1.08, roll: 0.0 },
  void: { shift: [0.62, 0.14], dist: 1.42, roll: 6.0 },
  close: { shift: [0.42, -0.10], dist: 0.62, roll: -4.0 },
  wide: { shift: [0.50, 0.12], dist: 1.24, roll: 4.0 },
  orbital: { shift: [0.02, 0.02], dist: 1.12, roll: -1.0 },
}

type ClockArt = {
  name: ClockArtName
  engine: ClockEngineName
  scale: number
  width: number
  near: number
  yBias: number
  depth: number
}

/** Typography is deliberately quieter than the previous experimental pass. */
export const CLOCK_ART_LIBRARY: Record<ClockArtName, ClockArt> = {
  poster:       { name: 'poster',       engine: 'monument',     scale: 1.12, width: 3.10, near: 0.48, yBias: -0.28, depth: 0.50 },
  horizon:      { name: 'horizon',      engine: 'blade',        scale: 1.04, width: 3.30, near: 0.72, yBias:  0.44, depth: 0.48 },
  eclipse:      { name: 'eclipse',      engine: 'eclipse',      scale: 1.04, width: 3.35, near: 0.88, yBias:  0.00, depth: 0.86 },
  orbit:        { name: 'orbit',        engine: 'orbit',        scale: 0.92, width: 3.00, near: 0.62, yBias:  0.00, depth: 0.44 },
  crop:         { name: 'crop',         engine: 'depth',        scale: 1.06, width: 3.10, near: 0.80, yBias:  0.34, depth: 0.74 },
  quiet:        { name: 'quiet',        engine: 'quiet',        scale: 0.68, width: 2.90, near: 0.08, yBias: -0.06, depth: 0.00 },
  caption:      { name: 'caption',      engine: 'monument',     scale: 0.80, width: 2.90, near: 0.14, yBias:  0.06, depth: 0.00 },
  blade:        { name: 'blade',        engine: 'blade',        scale: 1.04, width: 3.20, near: 0.84, yBias:  0.50, depth: 0.72 },
  relativistic: { name: 'relativistic', engine: 'relativistic', scale: 0.98, width: 3.25, near: 0.86, yBias: -0.08, depth: 0.84 },
}

export const OBSERVATION_VIEWS: Record<ObservationViewId, { id: ObservationViewId; label: string; short: string; index: number }> = {
  balanced:   { id: 'balanced', label: 'Balanced', short: 'hero', index: 0 },
  edge:       { id: 'edge', label: 'Edge-on', short: 'thin disk', index: 1 },
  ring:       { id: 'ring', label: 'Photon ring', short: 'lensed', index: 2 },
  face:       { id: 'face', label: 'Face-on', short: 'rotation', index: 3 },
  near:       { id: 'near', label: 'Near', short: 'material', index: 4 },
  silhouette: { id: 'silhouette', label: 'Silhouette', short: 'dark field', index: 5 },
  wide:       { id: 'wide', label: 'Wide', short: 'scale', index: 6 },
  knife:      { id: 'knife', label: 'Knife-edge', short: 'doppler', index: 7 },
  polar:      { id: 'polar', label: 'Polar', short: 'circular', index: 8 },
}
export const OBSERVATION_VIEW_ORDER: readonly ObservationViewId[] = ['balanced','edge','ring','face','near','silhouette','wide','knife','polar']
export const isObservationView = (v: unknown): v is ObservationViewId =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(OBSERVATION_VIEWS, v)
export const isCustomView = (v: unknown): v is CustomViewId => v === 'preset' || isObservationView(v)
export const viewIdFromIndex = (view: number): ObservationViewId =>
  OBSERVATION_VIEW_ORDER[Math.min(Math.max(Math.round(view), 0), 8)]

export type SceneLook = Readonly<{
  /** Multipliers against the physical camera family's base values. */
  disk: number
  stars: number
  exposure: number
  temp: number
  /** Direct renderer-space art-direction values. */
  diskOut: number
  turb: number
  glow: number
  streak: number
  falseColor: number
}>

export type SceneMotion = Readonly<{
  /** Normalized controls consumed by the wallpaper loop. */
  drift: number
  spin: number
  parallax: number
  breath: number
}>

const LEGACY_LOOK: SceneLook = {
  disk: 1,
  stars: 1,
  exposure: 1,
  temp: 1,
  diskOut: 26,
  turb: 0.65,
  glow: 0.55,
  streak: 0.30,
  falseColor: 0,
}
const LEGACY_MOTION: SceneMotion = { drift: 0.35, spin: 0.45, parallax: 0.42, breath: 0.55 }

const CURATED_LOOK = {
  signature: { disk: 1.05, stars: 0.78, exposure: 0.98, temp: 1.00, diskOut: 26.0, turb: 0.56, glow: 0.52, streak: 0.22, falseColor: 0.00 },
  horizon:   { disk: 1.18, stars: 0.42, exposure: 0.92, temp: 1.02, diskOut: 21.0, turb: 0.36, glow: 0.58, streak: 1.12, falseColor: 0.04 },
  terminal:  { disk: 1.34, stars: 0.22, exposure: 0.82, temp: 1.06, diskOut: 18.5, turb: 0.42, glow: 0.72, streak: 1.34, falseColor: 0.46 },
  centered:  { disk: 0.22, stars: 0.20, exposure: 0.82, temp: 1.03, diskOut: 16.0, turb: 0.18, glow: 0.62, streak: 0.02, falseColor: 0.00 },
  void:      { disk: 0.05, stars: 1.35, exposure: 0.86, temp: 0.97, diskOut: 17.0, turb: 0.12, glow: 0.12, streak: 0.00, falseColor: 0.00 },
  close:     { disk: 1.42, stars: 0.28, exposure: 0.88, temp: 1.03, diskOut: 27.0, turb: 0.95, glow: 0.50, streak: 0.28, falseColor: 0.12 },
  wide:      { disk: 0.62, stars: 1.15, exposure: 0.92, temp: 0.99, diskOut: 31.0, turb: 0.42, glow: 0.24, streak: 0.10, falseColor: 0.00 },
  polar:     { disk: 0.86, stars: 0.52, exposure: 0.94, temp: 1.00, diskOut: 24.0, turb: 0.28, glow: 0.28, streak: 0.00, falseColor: 0.00 },
} as const satisfies Record<'signature' | 'horizon' | 'terminal' | 'centered' | 'void' | 'close' | 'wide' | 'polar', SceneLook>

const CURATED_MOTION = {
  signature: { drift: 0.40, spin: 0.42, parallax: 0.48, breath: 0.55 },
  horizon:   { drift: 0.16, spin: 0.36, parallax: 0.22, breath: 0.18 },
  terminal:  { drift: 0.10, spin: 0.72, parallax: 0.14, breath: 0.08 },
  centered:  { drift: 0.06, spin: 0.16, parallax: 0.12, breath: 0.05 },
  void:      { drift: 0.12, spin: 0.12, parallax: 0.18, breath: 0.08 },
  close:     { drift: 0.20, spin: 0.82, parallax: 0.34, breath: 0.32 },
  wide:      { drift: 0.26, spin: 0.30, parallax: 0.38, breath: 0.24 },
  polar:     { drift: 0.18, spin: 0.22, parallax: 0.20, breath: 0.12 },
} as const satisfies Record<'signature' | 'horizon' | 'terminal' | 'centered' | 'void' | 'close' | 'wide' | 'polar', SceneMotion>

/*
 * Temporary compatibility bridge: the render/clock callers currently read
 * preset.view directly. Preset mode always receives the canonical value; only
 * Custom may override it. This bridge can disappear once resolveScene becomes
 * the sole scene-state owner.
 */
interface RuntimeSceneState {
  sceneMode?: string
  custom?: { basePreset?: string; view?: CustomViewId }
}
let runtimeScene: RuntimeSceneState = {}
function syncRuntimeScene(value?: RuntimeSceneState) {
  if (value) {
    runtimeScene = value
    return
  }
  if (typeof window === 'undefined') return
  try {
    runtimeScene = JSON.parse(localStorage.getItem('schwarzschild-wallpaper') || '{}') as RuntimeSceneState
  } catch {
    runtimeScene = {}
  }
}
if (typeof window !== 'undefined') {
  syncRuntimeScene()
  window.addEventListener('schwarzschild-settings-changed', (event) => {
    syncRuntimeScene((event as CustomEvent<RuntimeSceneState>).detail)
  })
}
function effectiveView(id: ScenePresetId, canonical: number) {
  const selected = runtimeScene.custom?.view
  if (
    runtimeScene.sceneMode !== 'custom' ||
    runtimeScene.custom?.basePreset !== id ||
    !selected ||
    selected === 'preset'
  ) return canonical
  return isObservationView(selected) ? OBSERVATION_VIEWS[selected].index : canonical
}

export interface ScenePresetDefinition {
  id: ScenePresetId
  label: string
  short: string
  description: string
  family: 'framing' | 'observation'
  canonicalView: number
  readonly view: number
  composition: CompositionId
  clockArt: ClockArtName
  look: SceneLook
  motion: SceneMotion
}

function scene(
  id: ScenePresetId,
  label: string,
  short: string,
  description: string,
  family: ScenePresetDefinition['family'],
  canonicalView: number,
  composition: CompositionId,
  clockArt: ClockArtName,
  look: SceneLook = LEGACY_LOOK,
  motion: SceneMotion = LEGACY_MOTION,
): ScenePresetDefinition {
  return {
    id,
    label,
    short,
    description,
    family,
    canonicalView,
    composition,
    clockArt,
    look,
    motion,
    get view() { return effectiveView(id, canonicalView) },
  }
}

export const SCENE_PRESETS: Record<ScenePresetId, ScenePresetDefinition> = {
  // Eight finished scenes exposed to users. Their renderer treatment is fixed
  // here instead of being inherited from Custom's neutral slider defaults.
  signature: scene('signature', 'Signature', 'hero poster', 'Complete hero image: clean ring, restrained environment and a balanced luminous disk.', 'framing', 0, 'cinematic', 'poster', CURATED_LOOK.signature, CURATED_MOTION.signature),
  horizon: scene('horizon', 'Horizon', 'light blade', 'A nearly edge-on luminous blade with a quiet field and long directional energy.', 'framing', 1, 'horizon', 'horizon', CURATED_LOOK.horizon, CURATED_MOTION.horizon),
  terminal: scene('terminal', 'Terminal', 'doppler violence', 'Knife-edge asymmetry, compressed environment and selective redshift treatment.', 'framing', 7, 'terminal', 'blade', CURATED_LOOK.terminal, CURATED_MOTION.terminal),
  centered: scene('centered', 'Eclipse', 'shadow study', 'The disk retreats so the shadow and higher-order photon structure become the composition.', 'framing', 2, 'centered', 'eclipse', CURATED_LOOK.centered, CURATED_MOTION.centered),
  void: scene('void', 'Void', 'gravitational sky', 'Almost no disk: stellar structure and lensing carry the image through deliberate darkness.', 'framing', 5, 'void', 'quiet', CURATED_LOOK.void, CURATED_MOTION.void),
  close: scene('close', 'Close Pass', 'material macro', 'A turbulent, fast-rotating near-field material study with controlled crop and depth.', 'framing', 4, 'close', 'crop', CURATED_LOOK.close, CURATED_MOTION.close),
  wide: scene('wide', 'Wide', 'cosmic landscape', 'A small subject inside a broad stellar environment; scale matters more than glow.', 'framing', 6, 'wide', 'caption', CURATED_LOOK.wide, CURATED_MOTION.wide),
  polar: scene('polar', 'Orbital', 'circular calm', 'Pulled-back polar geometry with low turbulence, almost no streak and quiet circular balance.', 'framing', 8, 'orbital', 'orbit', CURATED_LOOK.polar, CURATED_MOTION.polar),

  // Hidden v7 compatibility definitions. Observation views now live in Custom.
  edge: scene('edge', 'Edge-on', 'thin disk', 'Legacy observation preset.', 'observation', 1, 'cinematic', 'horizon'),
  ring: scene('ring', 'Photon Ring', 'lensed', 'Legacy observation preset.', 'observation', 2, 'centered', 'eclipse'),
  face: scene('face', 'Face-on', 'rotation', 'Legacy observation preset.', 'observation', 3, 'centered', 'orbit'),
  near: scene('near', 'Near', 'material', 'Legacy observation preset.', 'observation', 4, 'close', 'crop'),
  silhouette: scene('silhouette', 'Silhouette', 'dark field', 'Legacy observation preset.', 'observation', 5, 'void', 'quiet'),
  knife: scene('knife', 'Knife-edge', 'doppler', 'Legacy observation preset.', 'observation', 7, 'horizon', 'blade'),
}

/** Only these finished scenes are exposed as presets. */
export const SCENE_PRESET_ORDER: readonly ScenePresetId[] = [
  'signature', 'horizon', 'terminal', 'centered', 'void', 'close', 'wide', 'polar',
]
export const isScenePresetId = (v: unknown): v is ScenePresetId =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(SCENE_PRESETS, v)

const LEGACY_TO_CURATED: Record<ScenePresetId, ScenePresetId> = {
  signature: 'signature',
  horizon: 'horizon',
  terminal: 'terminal',
  centered: 'centered',
  void: 'void',
  close: 'close',
  wide: 'wide',
  polar: 'polar',
  edge: 'horizon',
  ring: 'centered',
  face: 'polar',
  near: 'close',
  silhouette: 'void',
  knife: 'terminal',
}
const LEGACY_VIEW: Record<ScenePresetId, ObservationViewId> = {
  // These six were framing-only presets in v7 and therefore used the old balanced view.
  signature: 'balanced',
  horizon: 'balanced',
  terminal: 'balanced',
  centered: 'balanced',
  void: 'balanced',
  close: 'balanced',
  edge: 'edge',
  ring: 'ring',
  face: 'face',
  near: 'near',
  silhouette: 'silhouette',
  wide: 'wide',
  knife: 'knife',
  polar: 'polar',
}
export const curatedPresetFromLegacy = (v: unknown): ScenePresetId =>
  isScenePresetId(v) ? LEGACY_TO_CURATED[v] : 'signature'
export const viewFromLegacyPreset = (v: unknown): ObservationViewId =>
  isScenePresetId(v) ? LEGACY_VIEW[v] : 'balanced'

export const VIEW_PRESET_BY_INDEX: readonly ScenePresetId[] = [
  'signature', 'horizon', 'centered', 'polar', 'close', 'void', 'wide', 'terminal', 'polar',
]
export function presetFromLegacy(view: number, composition: CompositionId): ScenePresetId {
  const v = Math.min(Math.max(Math.round(view), 0), 8)
  if (v === 0) {
    if (composition === 'cinematic') return 'signature'
    if (composition === 'horizon') return 'horizon'
    if (composition === 'terminal') return 'terminal'
    if (composition === 'centered') return 'centered'
    if (composition === 'void') return 'void'
    if (composition === 'close') return 'close'
    if (composition === 'wide') return 'wide'
    if (composition === 'orbital') return 'polar'
  }
  return VIEW_PRESET_BY_INDEX[v]
}
