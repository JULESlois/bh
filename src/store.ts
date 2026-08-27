import { useSyncExternalStore } from 'react'
import type { Hit } from './physics/geodesic'

export interface Annotations {
  shadow: boolean
  photon: boolean
  isco: boolean
  einstein: boolean
}

export interface HitRecord {
  hit: Hit
  x: number // click position, css px
  y: number
  id: number
  /** scrollY at the moment of the click — scrolling away dismisses the callout */
  scrollY: number
}

interface State {
  annotations: Annotations
  massIdx: number
  hitRec: HitRecord | null
  booted: boolean
  glError: string | null
}

const state: State = {
  annotations: { shadow: false, photon: false, isco: false, einstein: false },
  massIdx: 0,
  hitRec: null,
  booted: false,
  glError: null,
}

const listeners = new Set<() => void>()
let version = 0

function emit() {
  version++
  listeners.forEach((l) => l())
}

export const store = {
  get: () => state,
  version: () => version,
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
  toggleAnnotation(key: keyof Annotations) {
    state.annotations = { ...state.annotations, [key]: !state.annotations[key] }
    emit()
  },
  cycleMass() {
    state.massIdx = (state.massIdx + 1) % 3
    emit()
  },
  setHit(rec: HitRecord | null) {
    state.hitRec = rec
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

// annotation marker smoothing targets, read by the render loop
export const markerLevels = { photon: 0, isco: 0 }
