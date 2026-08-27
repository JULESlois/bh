/**
 * Wallpaper settings: persisted to localStorage, and — when running inside
 * Wallpaper Engine — driven by the native property panel through
 * window.wallpaperPropertyListener (project.json declares the properties).
 * Both paths funnel into the same patch callback.
 */

export interface WpSettings {
  /** camera preset: 0 signature · 1 edge-on · 2 photon ring · 3 wide */
  view: number
  clock: 'off' | '24' | '12'
  date: boolean
  /** 0..1 */
  parallax: number
  trail: boolean
  /** 0..1 — orbital drift speed */
  drift: number
  quality: 'auto' | 'eco' | 'max'
}

export const DEFAULTS: WpSettings = {
  view: 0,
  clock: '24',
  date: true,
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
        if (v >= 0 && v <= 3) patch.view = v
      }
      if (props.clock?.value !== undefined) {
        const c = String(props.clock.value)
        if (c === 'off' || c === '24' || c === '12') patch.clock = c
      }
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
