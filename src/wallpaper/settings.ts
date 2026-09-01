/** Wallpaper settings, persistence and Wallpaper Engine property bridge. */
import {
  CLOCK_ART_LIBRARY,
  COMPOSITIONS,
  SCENE_PRESETS,
  SCENE_PRESET_ORDER,
  presetFromLegacy,
  type ClockArtName,
  type CompositionId,
  type ScenePresetId,
} from './presets'

export type SceneMode = 'preset' | 'custom'
export type ClockPos = 'bl' | 'bc' | 'br' | 'tl' | 'tr'
export type CustomClockArt = 'auto' | ClockArtName

export interface CustomScene {
  basePreset: ScenePresetId
  /** 0..1, mapped to a 0.72..1.28 multiplier around the preset framing */
  framing: number
  /** 0..1, centred at 0.5 and mapped to additive NDC offsets */
  shiftX: number
  shiftY: number
  /** 0..1, centred at 0.5 and mapped to ±15° */
  roll: number
  tilt: number
  zoom: number
  diskBright: number
  diskSize: number
  turb: number
  spin: number
  stars: number
  glow: number
  streak: number
  expo: number
  drift: number
  parallax: number
  clockArt: CustomClockArt
  /** 0..1; 0.5 leaves the preset's clock art unchanged */
  clockScale: number
  clockNear: number
  clockDepth: number
}

export interface WpSettings {
  sceneMode: SceneMode
  scenePreset: ScenePresetId
  custom: CustomScene
  palette: 'ember' | 'gold' | 'blue' | 'crimson'
  quality: 'auto' | 'eco' | 'max'
  trail: boolean
  clock: 'off' | '24' | '12'
  /** Presets always use adaptive composition; this is only used by Custom. */
  clockAdaptive: boolean
  clockPos: ClockPos
  clockSize: 's' | 'm' | 'l'
  font: 'mono' | 'display' | 'thin'
  bar: boolean
  seconds: boolean
  date: 'off' | 'date' | 'full'
  accent: 'auto' | 'cyan' | 'ember' | 'mono'
}

export const CUSTOM_SCENE_DEFAULTS: CustomScene = {
  basePreset: 'signature',
  framing: 0.5,
  shiftX: 0.5,
  shiftY: 0.5,
  roll: 0.5,
  tilt: 0.5,
  zoom: 0.5,
  diskBright: 0.60,
  diskSize: 0.78,
  turb: 0.70,
  spin: 0.45,
  stars: 0.42,
  glow: 0.62,
  streak: 0.66,
  expo: 0.50,
  drift: 0.46,
  parallax: 0.52,
  clockArt: 'auto',
  clockScale: 0.5,
  clockNear: 0.5,
  clockDepth: 0.5,
}

export const DEFAULTS: WpSettings = {
  sceneMode: 'preset',
  scenePreset: 'signature',
  custom: { ...CUSTOM_SCENE_DEFAULTS },
  palette: 'ember',
  quality: 'auto',
  trail: false,
  clock: '24',
  clockAdaptive: true,
  clockPos: 'bl',
  clockSize: 'm',
  font: 'thin',
  bar: true,
  seconds: false,
  date: 'date',
  accent: 'auto',
}

const KEY = 'schwarzschild-wallpaper'
const VERSION_KEY = 'schwarzschild-wallpaper-version'
const CURRENT_VERSION = 7
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1)
const num = (v: unknown, fallback: number) => Number.isFinite(Number(v)) ? clamp01(Number(v)) : fallback
const near = (a: unknown, b: number, epsilon = 0.015) => typeof a === 'number' && Math.abs(a - b) <= epsilon

const isPreset = (v: unknown): v is ScenePresetId =>
  typeof v === 'string' && (SCENE_PRESET_ORDER as readonly string[]).includes(v)
const isComposition = (v: unknown): v is CompositionId =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(COMPOSITIONS, v)
const isClockArt = (v: unknown): v is CustomClockArt =>
  v === 'auto' || (typeof v === 'string' && Object.prototype.hasOwnProperty.call(CLOCK_ART_LIBRARY, v))

const LEGACY_SCENE_DEFAULTS = {
  tilt: 0.5,
  zoom: 0.5,
  diskBright: 0.60,
  diskSize: 0.78,
  turb: 0.70,
  spin: 0.45,
  stars: 0.42,
  glow: 0.62,
  streak: 0.66,
  expo: 0.50,
  drift: 0.46,
  parallax: 0.52,
} as const

type LegacyStored = Omit<Partial<WpSettings>, 'clockPos' | 'date' | 'custom'> & {
  custom?: Partial<CustomScene>
  view?: number
  composition?: CompositionId
  tilt?: number
  zoom?: number
  diskBright?: number
  diskSize?: number
  turb?: number
  spin?: number
  stars?: number
  glow?: number
  streak?: number
  expo?: number
  drift?: number
  parallax?: number
  clockPos?: ClockPos | 'auto'
  date?: boolean | WpSettings['date']
  clockStyle?: 'hud' | 'minimal'
  colon?: unknown
  brackets?: unknown
  float?: unknown
}

function normalizeCustom(raw: Partial<CustomScene> | undefined): CustomScene {
  const p = raw ?? {}
  return {
    ...CUSTOM_SCENE_DEFAULTS,
    ...p,
    basePreset: isPreset(p.basePreset) ? p.basePreset : CUSTOM_SCENE_DEFAULTS.basePreset,
    framing: num(p.framing, CUSTOM_SCENE_DEFAULTS.framing),
    shiftX: num(p.shiftX, CUSTOM_SCENE_DEFAULTS.shiftX),
    shiftY: num(p.shiftY, CUSTOM_SCENE_DEFAULTS.shiftY),
    roll: num(p.roll, CUSTOM_SCENE_DEFAULTS.roll),
    tilt: num(p.tilt, CUSTOM_SCENE_DEFAULTS.tilt),
    zoom: num(p.zoom, CUSTOM_SCENE_DEFAULTS.zoom),
    diskBright: num(p.diskBright, CUSTOM_SCENE_DEFAULTS.diskBright),
    diskSize: num(p.diskSize, CUSTOM_SCENE_DEFAULTS.diskSize),
    turb: num(p.turb, CUSTOM_SCENE_DEFAULTS.turb),
    spin: num(p.spin, CUSTOM_SCENE_DEFAULTS.spin),
    stars: num(p.stars, CUSTOM_SCENE_DEFAULTS.stars),
    glow: num(p.glow, CUSTOM_SCENE_DEFAULTS.glow),
    streak: num(p.streak, CUSTOM_SCENE_DEFAULTS.streak),
    expo: num(p.expo, CUSTOM_SCENE_DEFAULTS.expo),
    drift: num(p.drift, CUSTOM_SCENE_DEFAULTS.drift),
    parallax: num(p.parallax, CUSTOM_SCENE_DEFAULTS.parallax),
    clockArt: isClockArt(p.clockArt) ? p.clockArt : 'auto',
    clockScale: num(p.clockScale, CUSTOM_SCENE_DEFAULTS.clockScale),
    clockNear: num(p.clockNear, CUSTOM_SCENE_DEFAULTS.clockNear),
    clockDepth: num(p.clockDepth, CUSTOM_SCENE_DEFAULTS.clockDepth),
  }
}

function migrateLegacy(p: LegacyStored): WpSettings {
  const view = Math.min(Math.max(Math.round(Number(p.view ?? 0)), 0), 8)
  const composition: CompositionId = isComposition(p.composition) ? p.composition : 'cinematic'
  const basePreset = presetFromLegacy(view, composition)
  const baseDef = SCENE_PRESETS[basePreset]
  const baseComp = COMPOSITIONS[baseDef.composition]
  const oldComp = COMPOSITIONS[composition]

  const framingRatio = oldComp.dist / baseComp.dist
  const custom: CustomScene = {
    ...CUSTOM_SCENE_DEFAULTS,
    basePreset,
    framing: clamp01((framingRatio - 0.72) / 0.56),
    shiftX: clamp01(0.5 + (oldComp.shift[0] - baseComp.shift[0]) / 0.70),
    shiftY: clamp01(0.5 + (oldComp.shift[1] - baseComp.shift[1]) / 0.60),
    roll: clamp01(0.5 + (oldComp.roll - baseComp.roll) / 30),
    tilt: num(p.tilt, LEGACY_SCENE_DEFAULTS.tilt),
    zoom: num(p.zoom, LEGACY_SCENE_DEFAULTS.zoom),
    diskBright: num(p.diskBright, LEGACY_SCENE_DEFAULTS.diskBright),
    diskSize: num(p.diskSize, LEGACY_SCENE_DEFAULTS.diskSize),
    turb: num(p.turb, LEGACY_SCENE_DEFAULTS.turb),
    spin: num(p.spin, LEGACY_SCENE_DEFAULTS.spin),
    stars: num(p.stars, LEGACY_SCENE_DEFAULTS.stars),
    glow: num(p.glow, LEGACY_SCENE_DEFAULTS.glow),
    streak: num(p.streak, LEGACY_SCENE_DEFAULTS.streak),
    expo: num(p.expo, LEGACY_SCENE_DEFAULTS.expo),
    drift: num(p.drift, LEGACY_SCENE_DEFAULTS.drift),
    parallax: num(p.parallax, LEGACY_SCENE_DEFAULTS.parallax),
  }

  const sceneTuned =
    composition !== baseDef.composition ||
    !near(p.tilt ?? LEGACY_SCENE_DEFAULTS.tilt, LEGACY_SCENE_DEFAULTS.tilt) ||
    !near(p.zoom ?? LEGACY_SCENE_DEFAULTS.zoom, LEGACY_SCENE_DEFAULTS.zoom) ||
    !near(p.diskBright ?? LEGACY_SCENE_DEFAULTS.diskBright, LEGACY_SCENE_DEFAULTS.diskBright) ||
    !near(p.diskSize ?? LEGACY_SCENE_DEFAULTS.diskSize, LEGACY_SCENE_DEFAULTS.diskSize) ||
    !near(p.turb ?? LEGACY_SCENE_DEFAULTS.turb, LEGACY_SCENE_DEFAULTS.turb) ||
    !near(p.spin ?? LEGACY_SCENE_DEFAULTS.spin, LEGACY_SCENE_DEFAULTS.spin) ||
    !near(p.stars ?? LEGACY_SCENE_DEFAULTS.stars, LEGACY_SCENE_DEFAULTS.stars) ||
    !near(p.glow ?? LEGACY_SCENE_DEFAULTS.glow, LEGACY_SCENE_DEFAULTS.glow) ||
    !near(p.streak ?? LEGACY_SCENE_DEFAULTS.streak, LEGACY_SCENE_DEFAULTS.streak) ||
    !near(p.expo ?? LEGACY_SCENE_DEFAULTS.expo, LEGACY_SCENE_DEFAULTS.expo) ||
    !near(p.drift ?? LEGACY_SCENE_DEFAULTS.drift, LEGACY_SCENE_DEFAULTS.drift) ||
    !near(p.parallax ?? LEGACY_SCENE_DEFAULTS.parallax, LEGACY_SCENE_DEFAULTS.parallax)

  return {
    ...DEFAULTS,
    sceneMode: sceneTuned ? 'custom' : 'preset',
    scenePreset: basePreset,
    custom,
    palette: p.palette ?? DEFAULTS.palette,
    quality: p.quality ?? DEFAULTS.quality,
    trail: p.trail ?? DEFAULTS.trail,
    clock: p.clock ?? DEFAULTS.clock,
    clockAdaptive: p.clockAdaptive ?? DEFAULTS.clockAdaptive,
    clockPos: p.clockPos === 'auto' || !p.clockPos ? DEFAULTS.clockPos : p.clockPos,
    clockSize: p.clockSize ?? DEFAULTS.clockSize,
    font: p.font ?? DEFAULTS.font,
    bar: p.bar ?? DEFAULTS.bar,
    seconds: p.seconds ?? DEFAULTS.seconds,
    date: typeof p.date === 'boolean' ? (p.date ? 'date' : 'off') : p.date ?? DEFAULTS.date,
    accent: p.accent ?? DEFAULTS.accent,
  }
}

export function load(): WpSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS, custom: { ...CUSTOM_SCENE_DEFAULTS } }
    const version = Number(localStorage.getItem(VERSION_KEY) || 0)
    const p = JSON.parse(raw) as LegacyStored

    if (version < 7 || !p.sceneMode) return migrateLegacy(p)

    return {
      ...DEFAULTS,
      ...p,
      sceneMode: p.sceneMode === 'custom' ? 'custom' : 'preset',
      scenePreset: isPreset(p.scenePreset) ? p.scenePreset : DEFAULTS.scenePreset,
      custom: normalizeCustom(p.custom),
      clockPos: p.clockPos === 'auto' || !p.clockPos ? DEFAULTS.clockPos : p.clockPos,
      date: typeof p.date === 'boolean' ? (p.date ? 'date' : 'off') : p.date ?? DEFAULTS.date,
    } as WpSettings
  } catch {
    return { ...DEFAULTS, custom: { ...CUSTOM_SCENE_DEFAULTS } }
  }
}

export function save(s: WpSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
    localStorage.setItem(VERSION_KEY, String(CURRENT_VERSION))
  } catch {
    /* storage unavailable — session-only settings */
  }
}

export type WpPatch = Partial<Omit<WpSettings, 'custom'>> & { custom?: Partial<CustomScene> }

export function mergeSettings(base: WpSettings, patch: WpPatch): WpSettings {
  return {
    ...base,
    ...patch,
    custom: patch.custom ? { ...base.custom, ...patch.custom } : base.custom,
  }
}

interface WeProp { value?: unknown }
const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined => {
  const s = String(v)
  return (allowed as readonly string[]).includes(s) ? (s as T) : undefined
}

export function bindWallpaperEngine(apply: (patch: WpPatch) => void): () => void {
  const w = window as unknown as {
    wallpaperPropertyListener?: { applyUserProperties?: (props: Record<string, WeProp>) => void }
  }

  w.wallpaperPropertyListener = {
    applyUserProperties(props) {
      const patch: WpPatch = {}
      const custom: Partial<CustomScene> = {}

      if (props.scenemode?.value !== undefined)
        patch.sceneMode = pick(props.scenemode.value, ['preset', 'custom'] as const)
      if (props.scenepreset?.value !== undefined) {
        const v = String(props.scenepreset.value)
        if (isPreset(v)) patch.scenePreset = v
      }
      if (props.custombase?.value !== undefined) {
        const v = String(props.custombase.value)
        if (isPreset(v)) custom.basePreset = v
      }

      // Backward-compatible interpretation of the removed v6 properties.
      if (props.view?.value !== undefined || props.composition?.value !== undefined) {
        const view = Number(props.view?.value ?? 0)
        const comp = isComposition(props.composition?.value) ? props.composition!.value as CompositionId : 'cinematic'
        patch.scenePreset = presetFromLegacy(view, comp)
      }

      if (props.palette?.value !== undefined)
        patch.palette = pick(props.palette.value, ['ember', 'gold', 'blue', 'crimson'] as const)
      if (props.quality?.value !== undefined)
        patch.quality = pick(props.quality.value, ['auto', 'eco', 'max'] as const)
      if (props.trail?.value !== undefined) patch.trail = !!props.trail.value

      if (props.clock?.value !== undefined)
        patch.clock = pick(props.clock.value, ['off', '24', '12'] as const)
      if (props.clockadaptive?.value !== undefined) patch.clockAdaptive = !!props.clockadaptive.value
      if (props.clockpos?.value !== undefined)
        patch.clockPos = pick(props.clockpos.value, ['bl', 'bc', 'br', 'tl', 'tr'] as const)
      if (props.clocksize?.value !== undefined)
        patch.clockSize = pick(props.clocksize.value, ['s', 'm', 'l'] as const)
      if (props.clockfont?.value !== undefined)
        patch.font = pick(props.clockfont.value, ['mono', 'display', 'thin'] as const)
      if (props.secondsbar?.value !== undefined) patch.bar = !!props.secondsbar.value
      if (props.seconds?.value !== undefined) patch.seconds = !!props.seconds.value
      if (props.showdate?.value !== undefined) {
        const d = props.showdate.value
        patch.date = typeof d === 'boolean' ? (d ? 'date' : 'off') : pick(d, ['off', 'date', 'full'] as const)
      }
      if (props.accent?.value !== undefined)
        patch.accent = pick(props.accent.value, ['auto', 'cyan', 'ember', 'mono'] as const)

      const sliders: [string, keyof CustomScene][] = [
        ['customframing', 'framing'],
        ['customshiftx', 'shiftX'],
        ['customshifty', 'shiftY'],
        ['customroll', 'roll'],
        ['customtilt', 'tilt'],
        ['customzoom', 'zoom'],
        ['customdiskbright', 'diskBright'],
        ['customdisksize', 'diskSize'],
        ['customturbulence', 'turb'],
        ['customspin', 'spin'],
        ['customstars', 'stars'],
        ['customglow', 'glow'],
        ['customstreak', 'streak'],
        ['customexposure', 'expo'],
        ['customdrift', 'drift'],
        ['customparallax', 'parallax'],
        ['customclockscale', 'clockScale'],
        ['customclocknear', 'clockNear'],
        ['customclockdepth', 'clockDepth'],
      ]
      for (const [prop, key] of sliders) {
        if (props[prop]?.value !== undefined) {
          ;(custom as Record<string, unknown>)[key] = clamp01(Number(props[prop].value) / 100)
        }
      }
      if (props.customclockart?.value !== undefined) {
        const art = String(props.customclockart.value)
        if (isClockArt(art)) custom.clockArt = art
      }

      if (Object.keys(custom).length) patch.custom = custom
      for (const k of Object.keys(patch) as (keyof WpPatch)[]) if (patch[k] === undefined) delete patch[k]
      if (Object.keys(patch).length) apply(patch)
    },
  }

  return () => { delete w.wallpaperPropertyListener }
}
