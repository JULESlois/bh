export type CompositionId = 'cinematic' | 'horizon' | 'terminal' | 'centered' | 'void' | 'close'
export type ScenePresetId =
  | 'signature' | 'horizon' | 'terminal' | 'centered' | 'void' | 'close'
  | 'edge' | 'ring' | 'face' | 'near' | 'silhouette' | 'wide' | 'knife' | 'polar'
export type ClockEngineName = 'monument' | 'eclipse' | 'blade' | 'orbit' | 'depth' | 'quiet' | 'relativistic'
export type ClockArtName = 'poster' | 'horizon' | 'eclipse' | 'orbit' | 'crop' | 'quiet' | 'caption' | 'blade' | 'relativistic'
export type ObservationViewId = 'balanced' | 'edge' | 'ring' | 'face' | 'near' | 'silhouette' | 'wide' | 'knife' | 'polar'
export type CustomViewId = 'preset' | ObservationViewId

export const CAMERA_PRESETS = [
  { dist: 30, incl: 81, fov: 58, expo: 1.0, disk: 1, star: 1 },
  { dist: 27, incl: 86.5, fov: 50, expo: 1.0, disk: 1, star: 1 },
  { dist: 24, incl: 63, fov: 30, expo: 1.15, disk: 1, star: 0.8 },
  { dist: 30, incl: 24, fov: 46, expo: 1.05, disk: 1, star: 0.9 },
  { dist: 16.5, incl: 78, fov: 68, expo: 0.95, disk: 1, star: 0.9 },
  { dist: 34, incl: 55, fov: 46, expo: 1.05, disk: 0.12, star: 1.7 },
  { dist: 47, incl: 71, fov: 62, expo: 0.92, disk: 1, star: 1.1 },
  { dist: 26, incl: 89.6, fov: 44, expo: 1.05, disk: 1, star: 1 },
  { dist: 26, incl: 13, fov: 44, expo: 1.1, disk: 1, star: 0.85 },
] as const

export const VIEW_DIRECTORS = [
  { framing: 1.00, shift: [0.00, 0.00], roll: 0.0, disk: 1.00, star: 1.00, glow: 1.00, streak: 1.00, expo: 1.00, turb: 1.00, diskOut: 1.00, temp: 1.00, motion: 1.00 },
  { framing: 0.96, shift: [0.05, -0.02], roll: -2.0, disk: 1.10, star: 0.82, glow: 1.12, streak: 1.28, expo: 0.98, turb: 0.88, diskOut: 0.94, temp: 1.02, motion: 0.82 },
  { framing: 0.92, shift: [-0.04, 0.03], roll: 1.0, disk: 0.58, star: 0.52, glow: 1.34, streak: 0.34, expo: 0.88, turb: 0.55, diskOut: 0.70, temp: 1.04, motion: 0.34 },
  { framing: 1.02, shift: [0.02, 0.05], roll: 4.5, disk: 0.96, star: 0.78, glow: 0.82, streak: 0.16, expo: 0.98, turb: 1.12, diskOut: 1.08, temp: 0.99, motion: 0.72 },
  { framing: 0.94, shift: [0.12, -0.04], roll: -3.0, disk: 1.14, star: 0.64, glow: 1.10, streak: 0.82, expo: 0.94, turb: 1.10, diskOut: 0.90, temp: 1.02, motion: 0.72 },
  { framing: 1.04, shift: [-0.08, 0.02], roll: 2.0, disk: 0.42, star: 1.42, glow: 0.52, streak: 0.12, expo: 0.86, turb: 0.35, diskOut: 0.82, temp: 0.96, motion: 0.58 },
  { framing: 1.08, shift: [0.03, 0.05], roll: 6.0, disk: 0.86, star: 1.18, glow: 0.76, streak: 0.50, expo: 0.96, turb: 0.90, diskOut: 1.08, temp: 0.99, motion: 1.16 },
  { framing: 0.94, shift: [0.08, -0.04], roll: -1.5, disk: 1.20, star: 0.62, glow: 1.18, streak: 1.46, expo: 0.92, turb: 0.80, diskOut: 0.88, temp: 1.06, motion: 0.46 },
  { framing: 1.00, shift: [-0.02, 0.08], roll: 8.0, disk: 1.02, star: 0.76, glow: 0.78, streak: 0.08, expo: 0.98, turb: 1.18, diskOut: 1.08, temp: 1.00, motion: 0.78 },
] as const

export const VIEW_TRANSITIONS = [
  { duration: 1.35, dip: 0.07, focus: 0.03, starStart: 0.78, starDelay: 0.04, diskStart: 0.88, diskDelay: 0.00, streakStart: 0.55, streakDelay: 0.12, rollKick: 0.8, clockDelay: 0.04 },
  { duration: 1.55, dip: 0.10, focus: 0.05, starStart: 0.68, starDelay: 0.08, diskStart: 0.78, diskDelay: 0.00, streakStart: 0.16, streakDelay: 0.28, rollKick: -1.4, clockDelay: 0.10 },
  { duration: 2.10, dip: 0.20, focus: 0.13, starStart: 0.44, starDelay: 0.20, diskStart: 0.62, diskDelay: 0.08, streakStart: 0.18, streakDelay: 0.34, rollKick: 1.2, clockDelay: 0.22 },
  { duration: 1.70, dip: 0.08, focus: 0.04, starStart: 0.70, starDelay: 0.08, diskStart: 0.76, diskDelay: 0.02, streakStart: 0.18, streakDelay: 0.24, rollKick: 2.0, clockDelay: 0.10 },
  { duration: 1.45, dip: 0.13, focus: 0.08, starStart: 0.58, starDelay: 0.10, diskStart: 0.82, diskDelay: 0.00, streakStart: 0.36, streakDelay: 0.18, rollKick: -1.2, clockDelay: 0.12 },
  { duration: 2.25, dip: 0.16, focus: 0.02, starStart: 0.20, starDelay: 0.18, diskStart: 1.20, diskDelay: 0.00, streakStart: 0.08, streakDelay: 0.42, rollKick: 0.8, clockDelay: 0.30 },
  { duration: 1.85, dip: 0.08, focus: 0.00, starStart: 0.42, starDelay: 0.10, diskStart: 0.72, diskDelay: 0.04, streakStart: 0.28, streakDelay: 0.22, rollKick: 2.8, clockDelay: 0.12 },
  { duration: 1.95, dip: 0.18, focus: 0.09, starStart: 0.52, starDelay: 0.12, diskStart: 0.74, diskDelay: 0.02, streakStart: 0.03, streakDelay: 0.44, rollKick: -2.5, clockDelay: 0.18 },
  { duration: 1.80, dip: 0.08, focus: 0.04, starStart: 0.62, starDelay: 0.08, diskStart: 0.78, diskDelay: 0.02, streakStart: 0.12, streakDelay: 0.30, rollKick: 3.2, clockDelay: 0.14 },
] as const

export const COMPOSITIONS: Record<CompositionId, { shift: readonly [number, number]; dist: number; roll: number }> = {
  cinematic: { shift: [0.58, -0.05], dist: 0.84, roll: -5.5 },
  horizon: { shift: [-0.76, -0.46], dist: 0.68, roll: 3.5 },
  terminal: { shift: [0.64, 0.34], dist: 0.91, roll: -9.0 },
  centered: { shift: [0, 0], dist: 1.0, roll: 0 },
  void: { shift: [0.70, 0.18], dist: 1.48, roll: 7.0 },
  close: { shift: [0.48, -0.12], dist: 0.52, roll: -4.0 },
}

type ClockArt = { name: ClockArtName; engine: ClockEngineName; scale: number; width: number; near: number; yBias: number; depth: number }
export const CLOCK_ART_LIBRARY: Record<ClockArtName, ClockArt> = {
  poster:       { name: 'poster',       engine: 'monument',     scale: 1.08, width: 3.2, near: 0.56, yBias: -0.34, depth: 0.58 },
  horizon:      { name: 'horizon',      engine: 'blade',        scale: 1.00, width: 3.4, near: 0.64, yBias:  0.48, depth: 0.52 },
  eclipse:      { name: 'eclipse',      engine: 'eclipse',      scale: 1.20, width: 3.5, near: 0.96, yBias: -0.10, depth: 0.94 },
  orbit:        { name: 'orbit',        engine: 'orbit',        scale: 1.02, width: 3.1, near: 0.66, yBias: -0.90, depth: 0.58 },
  crop:         { name: 'crop',         engine: 'depth',        scale: 1.12, width: 3.2, near: 0.86, yBias:  0.40, depth: 0.88 },
  quiet:        { name: 'quiet',        engine: 'quiet',        scale: 0.80, width: 3.0, near: 0.12, yBias: -0.10, depth: 0.00 },
  caption:      { name: 'caption',      engine: 'monument',     scale: 0.88, width: 3.0, near: 0.18, yBias:  0.08, depth: 0.00 },
  blade:        { name: 'blade',        engine: 'blade',        scale: 1.10, width: 3.3, near: 0.92, yBias:  0.58, depth: 0.86 },
  relativistic: { name: 'relativistic', engine: 'relativistic', scale: 1.05, width: 3.4, near: 0.90, yBias: -0.12, depth: 0.92 },
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
export const viewIdFromIndex = (view: number): ObservationViewId => OBSERVATION_VIEW_ORDER[Math.min(Math.max(Math.round(view), 0), 8)]

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
  try { runtimeScene = JSON.parse(localStorage.getItem('schwarzschild-wallpaper') || '{}') as RuntimeSceneState } catch { runtimeScene = {} }
}
if (typeof window !== 'undefined') {
  syncRuntimeScene()
  window.addEventListener('schwarzschild-settings-changed', (event) => {
    syncRuntimeScene((event as CustomEvent<RuntimeSceneState>).detail)
  })
}
function effectiveView(id: ScenePresetId, canonical: number) {
  const selected = runtimeScene.custom?.view
  if (runtimeScene.sceneMode !== 'custom' || runtimeScene.custom?.basePreset !== id || !selected || selected === 'preset') return canonical
  return isObservationView(selected) ? OBSERVATION_VIEWS[selected].index : canonical
}

export interface ScenePresetDefinition {
  id: ScenePresetId
  label: string
  short: string
  description: string
  family: 'framing' | 'observation'
  readonly view: number
  composition: CompositionId
  clockArt: ClockArtName
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
): ScenePresetDefinition {
  return {
    id, label, short, description, family, composition, clockArt,
    get view() { return effectiveView(id, canonicalView) },
  }
}

export const SCENE_PRESETS: Record<ScenePresetId, ScenePresetDefinition> = {
  // Curated presets. Their canonical observation view is part of the artwork.
  signature: scene('signature', 'Signature', 'hero', 'Balanced off-axis hero composition.', 'framing', 0, 'cinematic', 'poster'),
  horizon: scene('horizon', 'Horizon', 'low plane', 'Edge-on disk, low horizon and long negative space.', 'framing', 1, 'horizon', 'horizon'),
  terminal: scene('terminal', 'Terminal', 'diagonal', 'Knife-edge disk in a tense diagonal composition.', 'framing', 7, 'terminal', 'blade'),
  centered: scene('centered', 'Eclipse', 'lensed', 'Photon-ring study with a formal centered shadow.', 'framing', 2, 'centered', 'eclipse'),
  void: scene('void', 'Void', 'negative', 'Silhouette view with deep sky and deliberate emptiness.', 'framing', 5, 'void', 'quiet'),
  close: scene('close', 'Close Pass', 'material', 'Near-disk material study with aggressive depth.', 'framing', 4, 'close', 'crop'),
  wide: scene('wide', 'Wide', 'scale', 'Environmental scale, sky texture and negative space.', 'framing', 6, 'void', 'caption'),
  polar: scene('polar', 'Orbital', 'circular', 'Near-polar geometry built around orbital typography.', 'framing', 8, 'centered', 'orbit'),

  // Hidden v7 compatibility definitions. Observation views now live in Custom.
  edge: scene('edge', 'Edge-on', 'thin disk', 'Legacy observation preset.', 'observation', 1, 'cinematic', 'horizon'),
  ring: scene('ring', 'Photon Ring', 'lensed', 'Legacy observation preset.', 'observation', 2, 'centered', 'eclipse'),
  face: scene('face', 'Face-on', 'rotation', 'Legacy observation preset.', 'observation', 3, 'centered', 'orbit'),
  near: scene('near', 'Near', 'material', 'Legacy observation preset.', 'observation', 4, 'close', 'crop'),
  silhouette: scene('silhouette', 'Silhouette', 'dark field', 'Legacy observation preset.', 'observation', 5, 'void', 'quiet'),
  knife: scene('knife', 'Knife-edge', 'doppler', 'Legacy observation preset.', 'observation', 7, 'horizon', 'blade'),
}

/** Only these finished scenes are exposed as presets. */
export const SCENE_PRESET_ORDER: readonly ScenePresetId[] = ['signature','horizon','terminal','centered','void','close','wide','polar']
export const isScenePresetId = (v: unknown): v is ScenePresetId =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(SCENE_PRESETS, v)

const LEGACY_TO_CURATED: Record<ScenePresetId, ScenePresetId> = {
  signature: 'signature', horizon: 'horizon', terminal: 'terminal', centered: 'centered', void: 'void', close: 'close', wide: 'wide', polar: 'polar',
  edge: 'horizon', ring: 'centered', face: 'polar', near: 'close', silhouette: 'void', knife: 'terminal',
}
const LEGACY_VIEW: Record<ScenePresetId, ObservationViewId> = {
  signature: 'balanced', horizon: 'balanced', terminal: 'balanced', centered: 'balanced', void: 'balanced', close: 'balanced',
  edge: 'edge', ring: 'ring', face: 'face', near: 'near', silhouette: 'silhouette', wide: 'wide', knife: 'knife', polar: 'polar',
}
export const curatedPresetFromLegacy = (v: unknown): ScenePresetId =>
  isScenePresetId(v) ? LEGACY_TO_CURATED[v] : 'signature'
export const viewFromLegacyPreset = (v: unknown): ObservationViewId =>
  isScenePresetId(v) ? LEGACY_VIEW[v] : 'balanced'

export const VIEW_PRESET_BY_INDEX: readonly ScenePresetId[] = ['signature','horizon','centered','polar','close','void','wide','terminal','polar']
export function presetFromLegacy(view: number, composition: CompositionId): ScenePresetId {
  const v = Math.min(Math.max(Math.round(view), 0), 8)
  if (v === 0) {
    if (composition === 'cinematic') return 'signature'
    if (composition === 'horizon') return 'horizon'
    if (composition === 'terminal') return 'terminal'
    if (composition === 'centered') return 'centered'
    if (composition === 'void') return 'void'
    if (composition === 'close') return 'close'
  }
  return VIEW_PRESET_BY_INDEX[v]
}
