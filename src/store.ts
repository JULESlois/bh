import { useSyncExternalStore } from 'react'
import type { Hit } from './physics/geodesic'

/**
 * One unified focus model: clicking the render (a ray measurement) and
 * clicking a physics term both open the same callout — a polyline from
 * the click point to a chamfered instrument card. A term focus also
 * drives its overlay on the render (marker rings, the b_c circle).
 * Any new focus, a scroll, or a click on the card dismisses it.
 */

export type TermKey = 'shadow' | 'photon' | 'isco' | 'einstein' | 'mass'

export type Focus =
  | { type: 'ray'; hit: Hit; n: number; x: number; y: number; id: number; scrollY: number }
  | { type: 'term'; key: TermKey; x: number; y: number; id: number; scrollY: number; massIdx: number }

interface State {
  focus: Focus | null
  massIdx: number
  booted: boolean
  glError: string | null
}

const state: State = {
  focus: null,
  massIdx: 0,
  booted: false,
  glError: null,
}

const listeners = new Set<() => void>()
let version = 0
let focusSeq = 0
let raySeq = 0

function emit() {
  version++
  listeners.forEach((l) => l())
}

export const store = {
  get: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
  openRay(hit: Hit, x: number, y: number) {
    state.focus = { type: 'ray', hit, n: ++raySeq, x, y, id: ++focusSeq, scrollY: window.scrollY }
    emit()
  },
  openTerm(key: TermKey, x: number, y: number) {
    state.focus = { type: 'term', key, x, y, id: ++focusSeq, scrollY: window.scrollY, massIdx: state.massIdx }
    emit()
  },
  dismiss() {
    if (state.focus) {
      state.focus = null
      emit()
    }
  },
  cycleMass() {
    state.massIdx = (state.massIdx + 1) % 3
    emit()
  },
  setBooted() {
    if (!state.booted) {
      state.booted = true
      emit()
    }
  },
  setGlError(msg: string) {
    state.glError = msg
    emit()
  },
}

/** subscribe a component to the store; returns current state (re-renders on any change) */
export function useStore(): State {
  useSyncExternalStore(
    store.subscribe,
    () => version,
    () => version,
  )
  return state
}

// annotation marker smoothing levels, written by the render loop
export const markerLevels = { photon: 0, isco: 0 }
