/**
 * Wallpaper settings: persisted to localStorage, and — when running inside
 * Wallpaper Engine — driven by the native property panel through
 * window.wallpaperPropertyListener (project.json declares the properties).
 */

export type Composition = 'cinematic' | 'horizon' | 'terminal' | 'centered' | 'void' | 'close'
export type ClockPos = 'bl' | 'bc' | 'br' | 'tl' | 'tr'

export interface WpSettings {
  view: number
  composition: Composition
  palette: 'ember' | 'gold' | 'blue' | 'crimson'
  clock: 'off' | '24' | '12'
  /** adaptive ignores the manual corner + size settings and reacts to the live composition */
  clockAdaptive: boolean
  clockPos: ClockPos
  clockSize: 's' | 'm' | 'l'
  font: 'mono' | 'display' | 'thin'
  bar: boolean
  seconds: boolean
  date: 'off' | 'date' | 'full'
  accent: 'auto' | 'cyan' | 'ember' | 'mono'
  stars: number
  parallax: number
  trail: boolean
  drift: number
  quality: 'auto' | 'eco' | 'max'
  tilt: number
  zoom: number
  diskBright: number
  diskSize: number
  turb: number
  spin: number
  glow: number
  streak: number
  expo: number
}

export const DEFAULTS: WpSettings = {
  view: 0,
  composition: 'cinematic',
  palette: 'ember',
  clock: '24',
  clockAdaptive: true,
  clockPos: 'bl',
  clockSize: 'm',
  font: 'thin',
  bar: true,
  seconds: false,
  date: 'date',
  accent: 'auto',
  stars: 0.42,
  parallax: 0.52,
  trail: false,
  drift: 0.46,
  quality: 'auto',
  tilt: 0.5,
  zoom: 0.5,
  diskBright: 0.60,
  diskSize: 0.78,
  turb: 0.70,
  spin: 0.45,
  glow: 0.62,
  streak: 0.66,
  expo: 0.50,
}

const KEY = 'schwarzschild-wallpaper'
const VERSION_KEY = 'schwarzschild-wallpaper-version'
const CURRENT_VERSION = 6

const near = (v: unknown, target: number, epsilon = 0.015) =>
  typeof v === 'number' && Math.abs(v - target) <= epsilon

type StoredSettings = Partial<Omit<WpSettings, 'clockPos' | 'date'>> & {
  clockPos?: ClockPos | 'auto'
  date?: boolean | WpSettings['date']
  clockStyle?: 'hud' | 'minimal'
  colon?: unknown
  brackets?: unknown
  float?: unknown
}

export function load(): WpSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const version = Number(localStorage.getItem(VERSION_KEY) || 0)
    const p = JSON.parse(raw) as StoredSettings

    if (typeof p.date === 'boolean') p.date = p.date ? 'date' : 'off'
    if (p.clockPos === 'auto') p.clockPos = 'bl'

    if (version < 4) {
      p.clockAdaptive = true
      p.bar = true
      p.seconds = false
      p.accent = 'auto'
      p.composition = p.composition ?? 'cinematic'
      p.streak = Math.max(Number(p.streak ?? 0), 0.58)
      p.glow = Math.max(Number(p.glow ?? 0), 0.54)
    }

    if (version < 5) {
      if (p.diskBright === undefined || near(p.diskBright, 0.56)) p.diskBright = 0.60
      if (p.turb === undefined || near(p.turb, 0.68)) p.turb = 0.70
      if (p.glow === undefined || near(p.glow, 0.58)) p.glow = 0.62
      if (p.streak === undefined || near(p.streak, 0.62)) p.streak = 0.66
      if (p.expo === undefined || near(p.expo, 0.52)) p.expo = 0.50
      if (p.stars === undefined || near(p.stars, 0.44)) p.stars = 0.42
    }

    // v6 removes the old HUD-era clock controls. The clock now always uses
    // whitespace between digit groups; brackets and mouse-float are gone.
    delete p.clockStyle
    delete p.colon
    delete p.brackets
    delete p.float

    return { ...DEFAULTS, ...p } as WpSettings
  } catch {
    return { ...DEFAULTS }
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

interface WeProp {
  value?: unknown
}

const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined => {
  const s = String(v)
  return (allowed as readonly string[]).includes(s) ? (s as T) : undefined
}

export function bindWallpaperEngine(apply: (patch: Partial<WpSettings>) => void): () => void {
  const w = window as unknown as {
    wallpaperPropertyListener?: {
      applyUserProperties?: (props: Record<string, WeProp>) => void
    }
  }

  w.wallpaperPropertyListener = {
    applyUserProperties(props) {
      const patch: Partial<WpSettings> = {}
      if (props.view?.value !== undefined) {
        const v = Number(props.view.value)
        if (v >= 0 && v <= 8) patch.view = v
      }
      if (props.composition?.value !== undefined)
        patch.composition = pick(props.composition.value, ['cinematic', 'horizon', 'terminal', 'centered', 'void', 'close'] as const)
      if (props.palette?.value !== undefined)
        patch.palette = pick(props.palette.value, ['ember', 'gold', 'blue', 'crimson'] as const)
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

      const sliders: [string, keyof WpSettings][] = [
        ['stars', 'stars'],
        ['parallax', 'parallax'],
        ['drift', 'drift'],
        ['tilt', 'tilt'],
        ['zoom', 'zoom'],
        ['diskbright', 'diskBright'],
        ['disksize', 'diskSize'],
        ['turbulence', 'turb'],
        ['spin', 'spin'],
        ['glow', 'glow'],
        ['streak', 'streak'],
        ['exposure', 'expo'],
      ]
      for (const [prop, key] of sliders) {
        if (props[prop]?.value !== undefined) {
          ;(patch as Record<string, unknown>)[key] = Math.min(Math.max(Number(props[prop].value) / 100, 0), 1)
        }
      }
      if (props.trail?.value !== undefined) patch.trail = !!props.trail.value
      if (props.quality?.value !== undefined)
        patch.quality = pick(props.quality.value, ['auto', 'eco', 'max'] as const)

      for (const k of Object.keys(patch) as (keyof WpSettings)[])
        if (patch[k] === undefined) delete patch[k]
      if (Object.keys(patch).length) apply(patch)
    },
  }

  return () => {
    delete w.wallpaperPropertyListener
  }
}
