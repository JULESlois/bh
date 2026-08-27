/**
 * Wallpaper settings: persisted to localStorage, and — when running inside
 * Wallpaper Engine — driven by the native property panel through
 * window.wallpaperPropertyListener (project.json declares the properties).
 * Both paths funnel into the same patch callback.
 */

export interface WpSettings {
  /** camera preset: 0 signature · 1 edge-on · 2 ring · 3 face-on · 4 near · 5 silhouette · 6 wide */
  view: number
  /** disk palette — a physical Planck temperature scale */
  palette: 'ember' | 'gold' | 'blue' | 'crimson'
  clock: 'off' | '24' | '12'
  clockStyle: 'hud' | 'minimal'
  clockPos: 'bl' | 'bc' | 'br' | 'tl' | 'tr'
  clockSize: 's' | 'm' | 'l'
  seconds: boolean
  date: boolean
  accent: 'cyan' | 'ember' | 'mono'
  /** 0..1 — star field richness */
  stars: number
  /** 0..1 */
  parallax: number
  trail: boolean
  /** 0..1 — orbital drift speed */
  drift: number
  quality: 'auto' | 'eco' | 'max'
}

export const DEFAULTS: WpSettings = {
  view: 0,
  palette: 'ember',
  clock: '24',
  clockStyle: 'hud',
  clockPos: 'bl',
  clockSize: 'm',
  seconds: true,
  date: true,
  accent: 'cyan',
  stars: 0.5,
  parallax: 0.5,
  trail: false,
  drift: 0.45,
  quality: 'auto',
}

const KEY = 'schwarzschild-wallpaper'

export function load(): WpSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<WpSettings>) }
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
      if (props.palette?.value !== undefined) {
        const v = String(props.palette.value)
        if (v === 'ember' || v === 'gold' || v === 'blue' || v === 'crimson')
          patch.palette = v
      }
      if (props.clock?.value !== undefined) {
        const c = String(props.clock.value)
        if (c === 'off' || c === '24' || c === '12') patch.clock = c
      }
      if (props.clockstyle?.value !== undefined) {
        const v = String(props.clockstyle.value)
        if (v === 'hud' || v === 'minimal') patch.clockStyle = v
      }
      if (props.clockpos?.value !== undefined) {
        const v = String(props.clockpos.value)
        if (['bl', 'bc', 'br', 'tl', 'tr'].includes(v)) patch.clockPos = v as WpSettings['clockPos']
      }
      if (props.clocksize?.value !== undefined) {
        const v = String(props.clocksize.value)
        if (v === 's' || v === 'm' || v === 'l') patch.clockSize = v
      }
      if (props.seconds?.value !== undefined) patch.seconds = !!props.seconds.value
      if (props.accent?.value !== undefined) {
        const v = String(props.accent.value)
        if (v === 'cyan' || v === 'ember' || v === 'mono') patch.accent = v
      }
      if (props.stars?.value !== undefined)
        patch.stars = Math.min(Math.max(Number(props.stars.value) / 100, 0), 1)
      if (props.showdate?.value !== undefined) patch.date = !!props.showdate.value
      if (props.parallax?.value !== undefined)
        patch.parallax = Math.min(Math.max(Number(props.parallax.value) / 100, 0), 1)
      if (props.trail?.value !== undefined) patch.trail = !!props.trail.value
      if (props.drift?.value !== undefined)
        patch.drift = Math.min(Math.max(Number(props.drift.value) / 100, 0), 1)
      if (props.quality?.value !== undefined) {
        const q = String(props.quality.value)
        if (q === 'auto' || q === 'eco' || q === 'max') patch.quality = q
      }
      if (Object.keys(patch).length) apply(patch)
    },
  }
  return () => {
    delete w.wallpaperPropertyListener
  }
}
