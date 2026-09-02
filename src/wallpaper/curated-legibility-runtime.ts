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

function pairRotation(preset: string, holeX: number, w: number) {
  if (preset === 'signature') return holeX >= w * .5 ? -1.25 : 1.25
  if (preset === 'terminal') return 1.5
  if (preset === 'close') return holeX >= w * .5 ? -.75 : .75
  return 0
}

function clampDatePoint(p: Point, halfW: number, halfH: number, w: number, h: number, safe: number): Point {
  return {
    x: clamp(p.x, safe + halfW, w - safe - halfW),
    y: clamp(p.y, safe + halfH, h - safe - halfH),
  }
}

function dateCandidates(
  preset: string,
  preferred: Point,
  hour: DOMRect,
  minute: DOMRect,
  hole: Point,
  shadowR: number,
  w: number,
  h: number,
  safe: number,
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
  const edgeX = Math.max(safe + 84, Math.min(w - safe - 84, hole.x < w * .5 ? w - safe - 92 : safe + 92))
  const edgeY = clamp(hole.y < h * .5 ? h - safe - 30 : safe + 30, safe + 24, h - safe - 24)

  const candidates: Candidate[] = [
    { id: 'preferred', ...preferred, bias: 0 },
    { id: 'minute-below', x: minute.left + minute.width * .5, y: minute.bottom + gap * 1.55, bias: 8 },
    { id: 'minute-above', x: minute.left + minute.width * .5, y: minute.top - gap * 1.55, bias: 10 },
    { id: 'hour-below', x: hour.left + hour.width * .5, y: hour.bottom + gap * 1.55, bias: 12 },
    { id: 'hour-above', x: hour.left + hour.width * .5, y: hour.top - gap * 1.55, bias: 14 },
    { id: 'pair-below', x: midX, y: union.bottom + Math.max(gap * 1.8, pairH * .18), bias: 16 },
    { id: 'pair-above', x: midX, y: union.top - Math.max(gap * 1.8, pairH * .18), bias: 18 },
    { id: 'pair-left', x: union.left - Math.max(gap * 2, pairW * .10), y: midY, bias: 20 },
    { id: 'pair-right', x: union.right + Math.max(gap * 2, pairW * .10), y: midY, bias: 20 },
    { id: 'shadow-center', x: hole.x, y: hole.y, bias: preset === 'centered' ? -10 : 24 },
    { id: 'shadow-lower', x: hole.x, y: hole.y + shadowR * .62, bias: preset === 'polar' ? 4 : 24 },
    { id: 'shadow-upper', x: hole.x, y: hole.y - shadowR * .62, bias: 26 },
    { id: 'opposite-edge', x: edgeX, y: edgeY, bias: 28 },
    { id: 'bottom-left', x: safe + 96, y: h - safe - 28, bias: 32 },
    { id: 'bottom-right', x: w - safe - 96, y: h - safe - 28, bias: 32 },
    { id: 'top-left', x: safe + 96, y: safe + 28, bias: 34 },
    { id: 'top-right', x: w - safe - 96, y: safe + 28, bias: 34 },
  ]

  if (preset === 'void') {
    candidates.unshift(
      { id: 'void-preferred', x: preferred.x, y: preferred.y, bias: -4 },
      { id: 'void-opposite', x: hole.x < w * .5 ? w - safe - 92 : safe + 92, y: h * .60, bias: 2 },
    )
  }
  if (preset === 'wide') {
    candidates.unshift(
      { id: 'wide-preferred', x: preferred.x, y: preferred.y, bias: -3 },
      { id: 'wide-caption', x: hour.left + hour.width * .5, y: hour.bottom + gap * 1.75, bias: 1 },
    )
  }
  return candidates
}

function environmentPenalty(
  preset: string,
  p: Point,
  hole: Point,
  axis: V2,
  shadowR: number,
) {
  const dx = p.x - hole.x
  const dy = p.y - hole.y
  const radial = Math.hypot(dx, dy)
  const normalDistance = Math.abs(dx * -axis[1] + dy * axis[0])

  // The center of the shadow is intentionally useful negative space for Eclipse.
  if (radial < shadowR * .70) return preset === 'centered' ? -28 : 2

  let penalty = 0
  const diskBand = Math.max(shadowR * .72, 44)
  if (normalDistance < diskBand && radial < shadowR * 3.35) {
    penalty += (1 - normalDistance / diskBand) * 38
  }

  // Avoid the visually dense photon-ring / inner-disk band even when there is no
  // literal DOM collision. This is where small metadata loses contrast first.
  const ringRadius = shadowR * 1.18
  const ringBand = Math.max(shadowR * .30, 28)
  const ringDelta = Math.abs(radial - ringRadius)
  if (ringDelta < ringBand) penalty += (1 - ringDelta / ringBand) * 30

  // Close Pass is intentionally dense, but the date should still seek the quieter side.
  if (preset === 'close') penalty *= .72
  return penalty
}

function chooseDate(
  preset: string,
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
    x: pxVar(node, '--meta-x', hole.x),
    y: pxVar(node, '--meta-y', hole.y + shadowR * 1.35),
  }
  const angle = cssNumber(getComputedStyle(node), '--date-art-rot', 0) * Math.PI / 180
  const rawW = Math.max(dateEl.offsetWidth, 72)
  const rawH = Math.max(dateEl.offsetHeight, 12)
  const halfW = (Math.abs(Math.cos(angle)) * rawW + Math.abs(Math.sin(angle)) * rawH) * .5
  const halfH = (Math.abs(Math.sin(angle)) * rawW + Math.abs(Math.cos(angle)) * rawH) * .5
  const gap = clamp(engineSize * .18, 12, 28)
  const occupied = [rectBox(hourRect, gap), rectBox(minuteRect, gap)]
  if (secondsRect && secondsRect.width > 0 && secondsRect.height > 0) occupied.push(rectBox(secondsRect, Math.max(7, gap * .55)))

  const candidates = dateCandidates(preset, preferred, hourRect, minuteRect, hole, shadowR, w, h, safe, gap)
  const currentSlot = node.dataset.dateSlot
  let best: { p: Point; score: number; id: string } | null = null

  for (const raw of candidates) {
    const p = clampDatePoint(raw, halfW, halfH, w, h, safe)
    const box = pointBox(p, halfW, halfH)
    if (occupied.some((o) => intersects(box, o))) continue

    const distPreferred = Math.hypot(p.x - preferred.x, p.y - preferred.y)
    const slotBonus = raw.id === currentSlot ? -13 : 0
    const score = (raw.bias ?? 0)
      + distPreferred * .035
      + environmentPenalty(preset, p, hole, axis, shadowR)
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
  // All positioning is solved in pixels here; stale art offsets would invalidate collision checks.
  node.style.setProperty('--date-art-x', '0px')
  node.style.setProperty('--date-art-y', '0px')
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
  node.style.setProperty('--parallel-rot', `${pairRotation(preset, hole.x, w).toFixed(2)}deg`)

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

  // Query after applying the shared angle so collision checks use the actual visible glyph boxes.
  const hourRect = hourEl.getBoundingClientRect()
  const minuteRect = minuteEl.getBoundingClientRect()
  const secondsEl = node.querySelector<HTMLElement>('.t i')
  const secondsRect = secondsEl && secondsEl.textContent?.trim() ? secondsEl.getBoundingClientRect() : null
  chooseDate(preset, dateEl, node, hourRect, minuteRect, secondsRect, hole, axis, shadowR, engineSize, w, h, safe)
}

requestAnimationFrame(tick)
