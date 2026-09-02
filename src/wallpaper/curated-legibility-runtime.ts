const KEY = 'schwarzschild-wallpaper'
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

type Stored = {
  sceneMode?: 'preset' | 'custom'
  scenePreset?: string
  clock?: 'off' | '24' | '12'
}
type Point = { x: number; y: number }
type V2 = [number, number]
type Box = { left: number; top: number; right: number; bottom: number }
type Candidate = Point & { id: string; bias?: number }

const CURATED = new Set(['signature', 'horizon', 'terminal', 'centered', 'void', 'close', 'wide', 'polar'])

function readStored(): Stored {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Stored } catch { return {} }
}

const cssNumber = (style: CSSStyleDeclaration, name: string, fallback: number) => {
  const value = Number.parseFloat(style.getPropertyValue(name))
  return Number.isFinite(value) ? value : fallback
}
const pxVar = (node: HTMLElement, name: string, fallback: number) => {
  const value = Number.parseFloat(node.style.getPropertyValue(name))
  return Number.isFinite(value) ? value : fallback
}

function axisFromDeg(deg: number): V2 {
  const a = deg * Math.PI / 180
  return [Math.cos(a), Math.sin(a)]
}
function rectBox(rect: DOMRect, pad = 0): Box {
  return {
    left: rect.left - pad,
    top: rect.top - pad,
    right: rect.right + pad,
    bottom: rect.bottom + pad,
  }
}
function intersects(a: Box, b: Box) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)
}
function pointBox(p: Point, halfW: number, halfH: number): Box {
  return { left: p.x - halfW, top: p.y - halfH, right: p.x + halfW, bottom: p.y + halfH }
}

function pairRotation() {
  // Blade already rotates the complete pair by --axis-angle in clock-engines.css.
  // All curated art rotations stay neutral so HH/MM remain one readable object.
  return 0
}

function clampDatePoint(p: Point, halfW: number, halfH: number, w: number, h: number, safe: number): Point {
  return {
    x: clamp(p.x, safe + halfW, w - safe - halfW),
    y: clamp(p.y, safe + halfH, h - safe - halfH),
  }
}

function localDateCandidates(
  preferred: Point,
  hour: DOMRect,
  minute: DOMRect,
  gap: number,
): Candidate[] {
  const union = {
    left: Math.min(hour.left, minute.left),
    top: Math.min(hour.top, minute.top),
    right: Math.max(hour.right, minute.right),
    bottom: Math.max(hour.bottom, minute.bottom),
  }
  const midX = (union.left + union.right) * .5
  const midY = (union.top + union.bottom) * .5
  const pairW = union.right - union.left
  const pairH = union.bottom - union.top

  return [
    { id: 'preferred', ...preferred, bias: -18 },
    { id: 'pair-below', x: midX, y: union.bottom + Math.max(gap * 1.55, pairH * .24), bias: 0 },
    { id: 'pair-above', x: midX, y: union.top - Math.max(gap * 1.55, pairH * .24), bias: 3 },
    { id: 'pair-right', x: union.right + Math.max(gap * 1.8, pairW * .08), y: midY, bias: 8 },
    { id: 'pair-left', x: union.left - Math.max(gap * 1.8, pairW * .08), y: midY, bias: 8 },
  ]
}

function environmentPenalty(p: Point, hole: Point, axis: V2, shadowR: number) {
  const dx = p.x - hole.x
  const dy = p.y - hole.y
  const radial = Math.hypot(dx, dy)
  const normalDistance = Math.abs(dx * -axis[1] + dy * axis[0])

  let penalty = 0
  const diskBand = Math.max(shadowR * .65, 38)
  if (normalDistance < diskBand && radial < shadowR * 3.0) {
    penalty += (1 - normalDistance / diskBand) * 24
  }
  const ringRadius = shadowR * 1.16
  const ringBand = Math.max(shadowR * .24, 24)
  const ringDelta = Math.abs(radial - ringRadius)
  if (ringDelta < ringBand) penalty += (1 - ringDelta / ringBand) * 20
  return penalty
}

function chooseDate(
  dateEl: HTMLElement,
  node: HTMLElement,
  hourRect: DOMRect,
  minuteRect: DOMRect,
  secondsRect: DOMRect | null,
  hole: Point,
  axis: V2,
  shadowR: number,
  engineSize: number,
  w: number,
  h: number,
  safe: number,
) {
  const preferred = {
    x: pxVar(node, '--meta-x', (hourRect.left + minuteRect.right) * .5),
    y: pxVar(node, '--meta-y', Math.max(hourRect.bottom, minuteRect.bottom) + engineSize * .4),
  }
  const rawW = Math.max(dateEl.offsetWidth, 72)
  const rawH = Math.max(dateEl.offsetHeight, 12)
  const halfW = rawW * .5
  const halfH = rawH * .5
  const gap = clamp(engineSize * .16, 10, 24)
  const occupied = [rectBox(hourRect, gap), rectBox(minuteRect, gap)]
  if (secondsRect && secondsRect.width > 0 && secondsRect.height > 0) {
    occupied.push(rectBox(secondsRect, Math.max(6, gap * .5)))
  }

  const unionCenter = {
    x: (Math.min(hourRect.left, minuteRect.left) + Math.max(hourRect.right, minuteRect.right)) * .5,
    y: (Math.min(hourRect.top, minuteRect.top) + Math.max(hourRect.bottom, minuteRect.bottom)) * .5,
  }
  const maxAttachDistance = Math.max(engineSize * 1.65, 118)
  const currentSlot = node.dataset.dateSlot
  let best: { p: Point; score: number; id: string } | null = null

  for (const raw of localDateCandidates(preferred, hourRect, minuteRect, gap)) {
    const p = clampDatePoint(raw, halfW, halfH, w, h, safe)
    if (Math.hypot(p.x - unionCenter.x, p.y - unionCenter.y) > maxAttachDistance) continue
    const box = pointBox(p, halfW, halfH)
    if (occupied.some((o) => intersects(box, o))) continue

    const preferredDistance = Math.hypot(p.x - preferred.x, p.y - preferred.y)
    const slotBonus = raw.id === currentSlot ? -8 : 0
    const score = (raw.bias ?? 0)
      + preferredDistance * .05
      + environmentPenalty(p, hole, axis, shadowR)
      + slotBonus
    if (!best || score < best.score) best = { p, score, id: raw.id }
  }

  if (!best) {
    node.dataset.dateFit = 'hidden'
    delete node.dataset.dateSlot
    return
  }

  node.dataset.dateFit = 'placed'
  node.dataset.dateSlot = best.id
  node.style.setProperty('--date-x', `${best.p.x.toFixed(1)}px`)
  node.style.setProperty('--date-y', `${best.p.y.toFixed(1)}px`)
  node.style.setProperty('--date-art-x', '0px')
  node.style.setProperty('--date-art-y', '0px')
  node.style.setProperty('--date-art-rot', '0deg')
}

function cleanup(node: HTMLElement) {
  delete node.dataset.parallelTime
  delete node.dataset.dateFit
  delete node.dataset.dateSlot
  node.style.removeProperty('--parallel-rot')
  node.style.removeProperty('--date-x')
  node.style.removeProperty('--date-y')
}

let stored = readStored()
let lastRead = 0
let lastSolve = 0
let lastNode: HTMLElement | null = null

function tick(now: number) {
  requestAnimationFrame(tick)
  if (now - lastRead > 120) { stored = readStored(); lastRead = now }
  if (now - lastSolve < 70) return
  lastSolve = now

  const node = document.querySelector<HTMLElement>('.wp-clock')
  if (!node) { lastNode = null; return }
  if (lastNode && lastNode !== node) cleanup(lastNode)
  lastNode = node

  const preset = stored.scenePreset || node.dataset.preset || 'signature'
  if (stored.sceneMode !== 'preset' || stored.clock === 'off' || !CURATED.has(preset) || node.dataset.curated !== 'on') {
    cleanup(node)
    return
  }

  const style = getComputedStyle(node)
  const w = innerWidth
  const h = innerHeight
  const shortEdge = Math.min(w, h)
  const safe = clamp(shortEdge * .035, 18, 54)
  const hole = {
    x: cssNumber(style, '--hole-x', w * .5),
    y: cssNumber(style, '--hole-y', h * .5),
  }
  const axis = axisFromDeg(cssNumber(style, '--axis-angle', 0))
  const shadowR = Math.max(cssNumber(style, '--shadow-r', shortEdge * .12), 24)
  const engineSize = Math.max(cssNumber(style, '--engine-size', shortEdge * .08), 34)

  node.dataset.parallelTime = 'on'
  node.style.setProperty('--parallel-rot', `${pairRotation().toFixed(2)}deg`)

  const hourEl = node.querySelector<HTMLElement>('.hour')
  const minuteEl = node.querySelector<HTMLElement>('.minute')
  const dateEl = node.querySelector<HTMLElement>('.d')
  if (!hourEl || !minuteEl || !dateEl) {
    delete node.dataset.dateFit
    delete node.dataset.dateSlot
    node.style.removeProperty('--date-x')
    node.style.removeProperty('--date-y')
    return
  }

  const hourRect = hourEl.getBoundingClientRect()
  const minuteRect = minuteEl.getBoundingClientRect()
  const secondsEl = node.querySelector<HTMLElement>('.t i')
  const secondsRect = secondsEl && secondsEl.textContent?.trim() ? secondsEl.getBoundingClientRect() : null
  chooseDate(dateEl, node, hourRect, minuteRect, secondsRect, hole, axis, shadowR, engineSize, w, h, safe)
}

requestAnimationFrame(tick)
