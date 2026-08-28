/**
 * Wallpaper settings: persisted to localStorage, and — when running inside
 * Wallpaper Engine — driven by the native property panel through
 * window.wallpaperPropertyListener (project.json declares the properties).
 * Both paths funnel into the same patch callback.
 */

export interface WpSettings {
  /** camera preset: 0 signature · 1 edge-on · 2 ring · 3 face-on · 4 near · 5 silhouette · 6 wide · 7 knife-edge · 8 polar */
  view: number
  /** disk palette — a physical Planck temperature scale */
  palette: 'ember' | 'gold' | 'blue' | 'crimson'
  clock: 'off' | '24' | '12'
  clockPos: 'bl' | 'bc' | 'br' | 'tl' | 'tr'
  clockSize: 's' | 'm' | 'l'
  /** clock typeface */
  font: 'mono' | 'display' | 'thin'
  /** the ":" separator: blinking, solid, or hidden (military 1432) */
  colon: 'blink' | 'on' | 'off'
  /** corner border brackets */
  brackets: boolean
  /** sweeping seconds bar */
  bar: boolean
  seconds: boolean
  /** date line detail */
  date: 'off' | 'date' | 'full'
  accent: 'cyan' | 'ember' | 'mono'
  /** clock floats against the mouse */
  float: boolean
  /** 0..1 — star field richness */
  stars: number
  /** 0..1 */
  parallax: number
  trail: boolean
  /** 0..1 — orbital drift speed */
  drift: number
  quality: 'auto' | 'eco' | 'max'
  /** 0..1 → ±10° inclination offset on the chosen view (0.5 = none) */
  tilt: number
  /** 0..1 → camera distance ×1.35 … ×0.65 (0.5 = preset framing) */
  zoom: number
  /** 0..1 → disk emission gain ×0.4 … ×1.6 (0.5 = canonical) */
  diskBright: number
  /** 0..1 → outer disk radius 14 … 32 M (canonical 28 M ≈ 0.78) */
  diskSize: number
  /** 0..1 — turbulence strength (canonical 0.65) */
  turb: number
  /** 0..1 → disk rotation speed ×0 … ×2.2 (0.45 ≈ real-time pace) */
  spin: number
  /** 0..1 → bloom strength 0 … 1.7 (0.5 = canonical 0.85) */
  glow: number
  /** 0..1 → exposure ×0.6 … ×1.4 (0.5 = neutral) */
  expo: number
}

export const DEFAULTS: WpSettings = {
  view: 0,
  palette: 'ember',
  clock: '24',
  clockPos: 'bl',
  clockSize: 'm',
  font: 'mono',
  colon: 'blink',
  brackets: true,
  bar: true,
  seconds: true,
  date: 'date',
  accent: 'cyan',
  float: false,
  stars: 0.5,
  parallax: 0.5,
  trail: false,
  drift: 0.45,
  quality: 'auto',
  tilt: 0.5,
  zoom: 0.5,
  diskBright: 0.5,
  diskSize: 0.78,
  turb: 0.65,
  spin: 0.45,
  glow: 0.5,
  expo: 0.5,
}

const KEY = 'schwarzschild-wallpaper'

export function load(): WpSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const p = JSON.parse(raw) as Partial<WpSettings> & {
      clockStyle?: 'hud' | 'minimal'
      date?: boolean | WpSettings['date']
    }
    // legacy migrations
    if (typeof p.date === 'boolean') p.date = p.date ? 'date' : 'off'
    if (p.clockStyle === 'minimal') {
      p.brackets = p.brackets ?? false
      p.bar = p.bar ?? false
      p.colon = p.colon ?? 'on'
    }
    delete p.clockStyle
    return { ...DEFAULTS, ...p }
  } catch {
    return { ...DEFAULTS }
  }
}

export function save(s: WpSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
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

/** hook up the Wallpaper Engine property listener; returns a cleanup fn */
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
      if (props.palette?.value !== undefined)
        patch.palette = pick(props.palette.value, ['ember', 'gold', 'blue', 'crimson'] as const)
      if (props.clock?.value !== undefined)
        patch.clock = pick(props.clock.value, ['off', '24', '12'] as const)
      if (props.clockpos?.value !== undefined)
        patch.clockPos = pick(props.clockpos.value, ['bl', 'bc', 'br', 'tl', 'tr'] as const)
      if (props.clocksize?.value !== undefined)
        patch.clockSize = pick(props.clocksize.value, ['s', 'm', 'l'] as const)
      if (props.clockfont?.value !== undefined)
        patch.font = pick(props.clockfont.value, ['mono', 'display', 'thin'] as const)
      if (props.colonmode?.value !== undefined)
        patch.colon = pick(props.colonmode.value, ['blink', 'on', 'off'] as const)
      if (props.brackets?.value !== undefined) patch.brackets = !!props.brackets.value
      if (props.secondsbar?.value !== undefined) patch.bar = !!props.secondsbar.value
      if (props.seconds?.value !== undefined) patch.seconds = !!props.seconds.value
      if (props.showdate?.value !== undefined) {
        const d = props.showdate.value
        patch.date =
          typeof d === 'boolean'
            ? d
              ? 'date'
              : 'off'
            : pick(d, ['off', 'date', 'full'] as const)
      }
      if (props.accent?.value !== undefined)
        patch.accent = pick(props.accent.value, ['cyan', 'ember', 'mono'] as const)
      if (props.clockfloat?.value !== undefined) patch.float = !!props.clockfloat.value
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
        ['exposure', 'expo'],
      ]
      for (const [prop, key] of sliders) {
        if (props[prop]?.value !== undefined) {
          ;(patch as Record<string, unknown>)[key] = Math.min(
            Math.max(Number(props[prop].value) / 100, 0),
            1,
          )
        }
      }
      if (props.trail?.value !== undefined) patch.trail = !!props.trail.value
      if (props.quality?.value !== undefined)
        patch.quality = pick(props.quality.value, ['auto', 'eco', 'max'] as const)
      // drop undefined entries from failed picks
      for (const k of Object.keys(patch) as (keyof WpSettings)[])
        if (patch[k] === undefined) delete patch[k]
      if (Object.keys(patch).length) apply(patch)
    },
  }
  return () => {
    delete w.wallpaperPropertyListener
  }
}
