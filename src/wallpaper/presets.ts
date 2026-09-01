export type CompositionId = 'cinematic' | 'horizon' | 'terminal' | 'centered' | 'void' | 'close'
export type ScenePresetId =
  | 'signature'
  | 'horizon'
  | 'terminal'
  | 'centered'
  | 'void'
  | 'close'
  | 'edge'
  | 'ring'
  | 'face'
  | 'near'
  | 'silhouette'
  | 'wide'
  | 'knife'
  | 'polar'
export type ClockArtName = 'poster' | 'horizon' | 'eclipse' | 'orbit' | 'crop' | 'quiet' | 'caption' | 'blade'

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

export const CLOCK_ART_LIBRARY: Record<ClockArtName, { name: ClockArtName; scale: number; width: number; near: number; yBias: number; depth: number }> = {
  poster:  { name: 'poster',  scale: 1.04, width: 3.22, near: 0.56, yBias: -0.34, depth: 0.72 },
  horizon: { name: 'horizon', scale: 0.96, width: 3.38, near: 0.58, yBias:  0.56, depth: 0.58 },
  eclipse: { name: 'eclipse', scale: 1.18, width: 3.48, near: 0.94, yBias: -0.18, depth: 0.90 },
  orbit:   { name: 'orbit',   scale: 1.02, width: 3.12, near: 0.62, yBias: -0.92, depth: 0.66 },
  crop:    { name: 'crop',    scale: 1.08, width: 3.20, near: 0.82, yBias:  0.48, depth: 0.82 },
  quiet:   { name: 'quiet',   scale: 0.82, width: 3.05, near: 0.14, yBias: -0.10, depth: 0.00 },
  caption: { name: 'caption', scale: 0.88, width: 3.08, near: 0.20, yBias:  0.10, depth: 0.00 },
  blade:   { name: 'blade',   scale: 1.08, width: 3.32, near: 0.88, yBias:  0.64, depth: 0.86 },
}

export interface ScenePresetDefinition {
  id: ScenePresetId
  label: string
  short: string
  description: string
  family: 'framing' | 'observation'
  view: number
  composition: CompositionId
  clockArt: ClockArtName
}

export const SCENE_PRESETS: Record<ScenePresetId, ScenePresetDefinition> = {
  signature:  { id: 'signature',  label: 'Signature',  short: 'hero',      description: 'Balanced off-axis hero composition.',             family: 'framing',     view: 0, composition: 'cinematic', clockArt: 'poster' },
  horizon:    { id: 'horizon',    label: 'Horizon',    short: 'low plane', description: 'Low, asymmetric horizon with long negative space.', family: 'framing',     view: 0, composition: 'horizon',   clockArt: 'horizon' },
  terminal:   { id: 'terminal',   label: 'Terminal',   short: 'diagonal',  description: 'Tense diagonal composition with compact framing.',   family: 'framing',     view: 0, composition: 'terminal',  clockArt: 'blade' },
  centered:   { id: 'centered',   label: 'Centered',   short: 'formal',    description: 'Symmetric scientific portrait of the system.',       family: 'framing',     view: 0, composition: 'centered',  clockArt: 'orbit' },
  void:       { id: 'void',       label: 'Void',       short: 'negative',  description: 'Small subject, deep sky and deliberate emptiness.',    family: 'framing',     view: 0, composition: 'void',      clockArt: 'quiet' },
  close:      { id: 'close',      label: 'Close Pass', short: 'crop',      description: 'Aggressive crop with material detail near the frame.', family: 'framing',     view: 0, composition: 'close',     clockArt: 'crop' },
  edge:       { id: 'edge',       label: 'Edge-on',    short: 'thin disk', description: 'A thin luminous disk with long optical energy.',       family: 'observation', view: 1, composition: 'cinematic', clockArt: 'horizon' },
  ring:       { id: 'ring',       label: 'Photon Ring',short: 'lensed',    description: 'Compact higher-order lensed structure takes priority.', family: 'observation', view: 2, composition: 'centered',  clockArt: 'eclipse' },
  face:       { id: 'face',       label: 'Face-on',    short: 'rotation',  description: 'Circular disk structure and differential rotation.',     family: 'observation', view: 3, composition: 'centered',  clockArt: 'orbit' },
  near:       { id: 'near',       label: 'Near',       short: 'material',  description: 'Close material study with dense inner-disk detail.',      family: 'observation', view: 4, composition: 'close',     clockArt: 'crop' },
  silhouette: { id: 'silhouette', label: 'Silhouette', short: 'dark field',description: 'The disk recedes; sky lensing carries the composition.', family: 'observation', view: 5, composition: 'void',      clockArt: 'quiet' },
  wide:       { id: 'wide',       label: 'Wide',       short: 'scale',     description: 'Environmental scale, sky texture and negative space.',    family: 'observation', view: 6, composition: 'void',      clockArt: 'caption' },
  knife:      { id: 'knife',      label: 'Knife-edge', short: 'doppler',   description: 'Razor disk, strong streak and Doppler asymmetry.',        family: 'observation', view: 7, composition: 'horizon',   clockArt: 'blade' },
  polar:      { id: 'polar',      label: 'Polar',      short: 'circular',  description: 'Near-polar geometry with subdued horizontal cues.',       family: 'observation', view: 8, composition: 'centered',  clockArt: 'orbit' },
}

export const SCENE_PRESET_ORDER: readonly ScenePresetId[] = [
  'signature', 'horizon', 'terminal', 'centered', 'void', 'close',
  'edge', 'ring', 'face', 'near', 'silhouette', 'wide', 'knife', 'polar',
]

export const VIEW_PRESET_BY_INDEX: readonly ScenePresetId[] = [
  'signature', 'edge', 'ring', 'face', 'near', 'silhouette', 'wide', 'knife', 'polar',
]

export function presetFromLegacy(view: number, composition: CompositionId): ScenePresetId {
  const v = Math.min(Math.max(Math.round(view), 0), 8)
  if (v === 0) return composition === 'cinematic' ? 'signature' : composition
  return VIEW_PRESET_BY_INDEX[v]
}
