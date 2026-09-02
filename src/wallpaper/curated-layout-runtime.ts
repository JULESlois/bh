const KEY = 'schwarzschild-wallpaper'
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

type Stored = {
  sceneMode?: 'preset' | 'custom'
  scenePreset?: string
  clock?: 'off' | '24' | '12'
  bar?: boolean
}
type Point = { x: number; y: number }
type V2 = [number, number]
type Metrics = { w: number; h: number }
type Art = {
  scale: number
  xscale?: number
  rot?: number
  x?: number
  y?: number
  opacity?: number
  blur?: number
}

const CURATED = new Set(['signature', 'horizon', 'terminal', 'centered', 'void', 'close', 'wide', 'polar'])
const ROOT_VARS = [
  '--date-art-x', '--date-art-y', '--date-art-rot', '--meta-art-x', '--meta-art-y', '--meta-art-rot',
  '--blade-width', '--blade-span', '--orbit-r', '--orbit-d', '--orbit-dot-x', '--orbit-dot-y',
  '--seconds-x', '--seconds-y',
]
const GLYPH_VARS = ['--art-scale', '--art-xscale', '--art-rot', '--art-x', '--art-y', '--art-opacity', '--art-blur']

function readStored(): Stored {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Stored } catch { return {} }
}
const px = (style: CSSStyleDeclaration, name: string, fallback: number) => {
  const v = Number.parseFloat(style.getPropertyValue(name))
  return Number.isFinite(v) ? v : fallback
}
const setPx = (node: HTMLElement, name: string, value: number) =>
  node.style.setProperty(name, `${value.toFixed(1)}px`)
const metrics = (el: HTMLElement | null, size: number): Metrics => ({
  w: Math.max(el?.offsetWidth ?? 0, size * 1.05),
  h: Math.max(el?.offsetHeight ?? 0, size * .72),
})

function canonicalAxis(deg: number): V2 {
  const a = deg * Math.PI / 180
  let x = Math.cos(a), y = Math.sin(a)
  if (x < 0 || (Math.abs(x) < .001 && y < 0)) { x = -x; y = -y }
  return [x, y]
}
const normalOf = (axis: V2): V2 => [-axis[1], axis[0]]
const add = (p: Point, v: V2, amount: number): Point => ({ x: p.x + v[0] * amount, y: p.y + v[1] * amount })

function rayLimit(p: Point, v: V2, w: number, h: number, safe: number) {
  const values: number[] = []
  if (v[0] > 1e-5) values.push((w - safe - p.x) / v[0])
  else if (v[0] < -1e-5) values.push((safe - p.x) / v[0])
  if (v[1] > 1e-5) values.push((h - safe - p.y) / v[1])
  else if (v[1] < -1e-5) values.push((safe - p.y) / v[1])
  return Math.max(0, Math.min(...values.filter((n) => Number.isFinite(n) && n >= 0)))
}

function artPoint(
  p: Point, m: Metrics, art: Art, w: number, h: number, safe: number,
  cropX = 0, cropY = 0,
): Point {
  const visualW = m.w * art.scale * (art.xscale ?? 1)
  const visualH = m.h * art.scale
  const halfW = visualW * Math.max(.5 - cropX, .16)
  const halfH = visualH * Math.max(.5 - cropY, .16)
  const loX = safe + halfW, hiX = w - safe - halfW
  const loY = safe + halfH, hiY = h - safe - halfH
  return {
    x: loX <= hiX ? clamp(p.x, loX, hiX) : w * .5,
    y: loY <= hiY ? clamp(p.y, loY, hiY) : h * .5,
  }
}

function applyArt(el: HTMLElement | null, art: Art) {
  if (!el) return
  el.style.setProperty('--art-scale', art.scale.toFixed(3))
  el.style.setProperty('--art-xscale', (art.xscale ?? 1).toFixed(3))
  el.style.setProperty('--art-rot', `${(art.rot ?? 0).toFixed(2)}deg`)
  el.style.setProperty('--art-x', `${(art.x ?? 0).toFixed(2)}em`)
  el.style.setProperty('--art-y', `${(art.y ?? 0).toFixed(2)}em`)
  if (art.opacity !== undefined) el.style.setProperty('--art-opacity', art.opacity.toFixed(3))
  else el.style.removeProperty('--art-opacity')
  if (art.blur !== undefined) el.style.setProperty('--art-blur', `${art.blur.toFixed(2)}px`)
  else el.style.removeProperty('--art-blur')
}

function setPair(node: HTMLElement, hour: Point, minute: Point) {
  setPx(node, '--hour-x', hour.x); setPx(node, '--hour-y', hour.y)
  setPx(node, '--minute-x', minute.x); setPx(node, '--minute-y', minute.y)
}
function setMeta(node: HTMLElement, p: Point, w: number, h: number, safe: number) {
  setPx(node, '--meta-x', clamp(p.x, safe + 32, w - safe - 32))
  setPx(node, '--meta-y', clamp(p.y, safe + 18, h - safe - 18))
}

function resetCurated(node: HTMLElement) {
  delete node.dataset.curated
  delete node.dataset.curatedBlueprint
  delete node.dataset.curatedAspect
  for (const name of ROOT_VARS) node.style.removeProperty(name)
  for (const el of Array.from(node.querySelectorAll<HTMLElement>('.hour,.minute'))) {
    for (const name of GLYPH_VARS) el.style.removeProperty(name)
  }
}

function scoreOpenSpace(p: Point, hole: Point, axis: V2, shadowR: number, w: number, h: number) {
  const dx = p.x - hole.x, dy = p.y - hole.y
  const radial = Math.hypot(dx, dy)
  const normal = Math.abs(dx * -axis[1] + dy * axis[0])
  const diskPenalty = Math.max(shadowR * 1.05 - normal, 0) * 1.8
  const ringPenalty = Math.max(shadowR * 1.42 - radial, 0) * 2.4
  return radial / Math.max(Math.min(w, h), 1) + normal / Math.max(Math.min(w, h), 1) * .72
    - (diskPenalty + ringPenalty) / Math.max(Math.min(w, h), 1)
}

function layoutSignature(ctx: LayoutCtx) {
  const { node, hourEl, minuteEl, hm, mm, hole, axis, normal, shadowR, w, h, safe, portrait } = ctx
  const primaryLeft = hole.x >= w * .52
  const hourArt: Art = portrait
    ? { scale: 1.05, xscale: .88, rot: primaryLeft ? -4 : 4 }
    : { scale: 1.22, xscale: .84, rot: primaryLeft ? -5.5 : 5.5, y: -.05 }
  const minuteArt: Art = portrait
    ? { scale: .78, xscale: 1.02, rot: primaryLeft ? 3 : -3 }
    : { scale: .76, xscale: 1.06, rot: primaryLeft ? 3.5 : -3.5, y: .08 }
  applyArt(hourEl, hourArt); applyArt(minuteEl, minuteArt)

  const rawHour = {
    x: primaryLeft ? safe + hm.w * hourArt.scale * .34 : w - safe - hm.w * hourArt.scale * .34,
    y: portrait ? h * .18 : h * .24,
  }
  const normalSign = normal[1] >= 0 ? 1 : -1
  let rawMinute = add(add(hole, normal, normalSign * shadowR * 1.48), axis, (primaryLeft ? -1 : 1) * shadowR * .28)
  if (portrait) rawMinute = { x: w * (primaryLeft ? .72 : .28), y: Math.max(hole.y + shadowR * 1.42, h * .64) }
  const hour = artPoint(rawHour, hm, hourArt, w, h, safe, portrait ? .02 : .11, .03)
  const minute = artPoint(rawMinute, mm, minuteArt, w, h, safe, .03, .02)
  setPair(node, hour, minute)
  setMeta(node, { x: minute.x, y: minute.y + (minute.y < h * .62 ? mm.h * .72 : -mm.h * .76) }, w, h, safe)
  node.style.setProperty('--date-art-rot', `${(primaryLeft ? 2 : -2).toFixed(1)}deg`)
  node.style.setProperty('--meta-art-x', `${(primaryLeft ? -10 : 10).toFixed(0)}px`)
}

function layoutHorizon(ctx: LayoutCtx) {
  const { node, hourEl, minuteEl, hm, mm, hole, axis, normal, shadowR, w, h, safe, portrait } = ctx
  const minus: V2 = [-axis[0], -axis[1]]
  const plusRoom = rayLimit(hole, axis, w, h, safe)
  const minusRoom = rayLimit(hole, minus, w, h, safe)
  const hourArt: Art = portrait ? { scale: .78, xscale: 1.12, rot: -1 } : { scale: .76, xscale: 1.34, rot: -2.5, y: -.08 }
  const minuteArt: Art = portrait ? { scale: .96, xscale: 1.06, rot: 1 } : { scale: 1.10, xscale: 1.02, rot: 2.0, y: .10 }
  applyArt(hourEl, hourArt); applyArt(minuteEl, minuteArt)
  const dH = Math.max(shadowR * 1.2, Math.min(minusRoom * .72, shadowR * 2.55 + hm.w * .25))
  const dM = Math.max(shadowR * 1.25, Math.min(plusRoom * .76, shadowR * 2.8 + mm.w * .28))
  let rawHour = add(add(hole, minus, dH), normal, shadowR * .42)
  let rawMinute = add(add(hole, axis, dM), normal, -shadowR * .30)
  if (portrait) {
    rawHour = { x: w * .28, y: Math.max(safe + hm.h, hole.y - shadowR * 1.8) }
    rawMinute = { x: w * .66, y: Math.min(h - safe - mm.h, hole.y + shadowR * 1.55) }
  }
  const hour = artPoint(rawHour, hm, hourArt, w, h, safe, .06, .02)
  const minute = artPoint(rawMinute, mm, minuteArt, w, h, safe, .07, .02)
  setPair(node, hour, minute)
  setMeta(node, add(minute, normal, -Math.sign(normal[1] || 1) * Math.max(34, mm.h * .64)), w, h, safe)
  setPx(node, '--blade-width', Math.hypot(minute.x - hour.x, minute.y - hour.y) * .72)
}

function layoutTerminal(ctx: LayoutCtx) {
  const { node, hourEl, minuteEl, hm, mm, hole, axis, normal, shadowR, w, h, safe, portrait } = ctx
  const minus: V2 = [-axis[0], -axis[1]]
  const plusRoom = rayLimit(hole, axis, w, h, safe)
  const minusRoom = rayLimit(hole, minus, w, h, safe)
  const hourArt: Art = portrait ? { scale: .94, xscale: 1.04, rot: 2.5 } : { scale: 1.22, xscale: .96, rot: 4.5, y: -.10 }
  const minuteArt: Art = portrait ? { scale: .74, xscale: 1.20, rot: -2.5 } : { scale: .68, xscale: 1.42, rot: -5.5, y: .16 }
  applyArt(hourEl, hourArt); applyArt(minuteEl, minuteArt)
  const dH = Math.max(shadowR * 1.22, Math.min(minusRoom * .82, shadowR * 3.15 + hm.w * .22))
  const dM = Math.max(shadowR * 1.02, Math.min(plusRoom * .60, shadowR * 2.05 + mm.w * .16))
  let rawHour = add(add(hole, minus, dH), normal, shadowR * .28)
  let rawMinute = add(add(hole, axis, dM), normal, -shadowR * .58)
  if (portrait) {
    rawHour = { x: w * .30, y: h * .22 }
    rawMinute = { x: w * .68, y: Math.min(h * .78, hole.y + shadowR * 1.55) }
  }
  const hour = artPoint(rawHour, hm, hourArt, w, h, safe, portrait ? .02 : .13, .06)
  const minute = artPoint(rawMinute, mm, minuteArt, w, h, safe, portrait ? .02 : .08, .04)
  setPair(node, hour, minute)
  setMeta(node, add(hour, normal, Math.max(30, hm.h * .58)), w, h, safe)
  setPx(node, '--blade-width', Math.hypot(minute.x - hour.x, minute.y - hour.y) * .54)
  node.style.setProperty('--date-art-rot', '-3deg')
}

function layoutEclipse(ctx: LayoutCtx) {
  const { node, hourEl, minuteEl, hm, mm, hole, shadowR, w, h, safe, portrait } = ctx
  const hourArt: Art = portrait ? { scale: .82, xscale: .95, rot: -4 } : { scale: .88, xscale: .92, rot: -6.5, y: -.04 }
  const minuteArt: Art = portrait ? { scale: .96, xscale: .94, rot: 4 } : { scale: 1.10, xscale: .90, rot: 6, y: .05 }
  applyArt(hourEl, hourArt); applyArt(minuteEl, minuteArt)
  const aH = portrait ? -2.05 : -2.72
  const aM = portrait ? .82 : .42
  const rH = shadowR * 1.08 + hm.w * hourArt.scale * .34
  const rM = shadowR * 1.08 + mm.w * minuteArt.scale * .34
  const hour = artPoint({ x: hole.x + Math.cos(aH) * rH, y: hole.y + Math.sin(aH) * rH }, hm, hourArt, w, h, safe, .02, .02)
  const minute = artPoint({ x: hole.x + Math.cos(aM) * rM, y: hole.y + Math.sin(aM) * rM }, mm, minuteArt, w, h, safe, .02, .02)
  setPair(node, hour, minute)
  setMeta(node, { x: hole.x, y: hole.y }, w, h, safe)
  node.dataset.pair = 'curated'
  node.style.setProperty('--date-art-y', '.15rem')
  node.style.setProperty('--meta-art-y', '-.45rem')
}

function layoutVoid(ctx: LayoutCtx) {
  const { node, hourEl, minuteEl, hm, mm, hole, w, h, safe, portrait } = ctx
  const useLeft = hole.x > w * .5
  const hourArt: Art = { scale: portrait ? .66 : .72, xscale: .94, rot: 0 }
  const minuteArt: Art = { scale: portrait ? .50 : .54, xscale: 1.08, rot: useLeft ? -2 : 2 }
  applyArt(hourEl, hourArt); applyArt(minuteEl, minuteArt)
  const x = useLeft ? safe + hm.w * hourArt.scale * .5 : w - safe - hm.w * hourArt.scale * .5
  const baseY = portrait ? h * .70 : h * .68
  const hour = artPoint({ x, y: baseY }, hm, hourArt, w, h, safe)
  const minute = artPoint({
    x: useLeft ? hour.x + hm.w * .34 : hour.x - hm.w * .34,
    y: hour.y + hm.h * .72,
  }, mm, minuteArt, w, h, safe)
  setPair(node, hour, minute)
  setMeta(node, {
    x: useLeft ? hour.x + hm.w * .15 : hour.x - hm.w * .15,
    y: hour.y - hm.h * .62,
  }, w, h, safe)
  node.style.setProperty('--date-art-rot', useLeft ? '-90deg' : '90deg')
  node.style.setProperty('--date-art-x', useLeft ? '-2.8rem' : '2.8rem')
}

function layoutClose(ctx: LayoutCtx) {
  const { node, hourEl, minuteEl, hm, mm, hole, axis, normal, shadowR, w, h, safe, portrait } = ctx
  const hourArt: Art = portrait
    ? { scale: .68, xscale: 1.05, rot: -3, opacity: .40, blur: .42 }
    : { scale: .58, xscale: 1.16, rot: -5.5, opacity: .34, blur: .58 }
  const minuteArt: Art = portrait
    ? { scale: 1.02, xscale: .96, rot: 3 }
    : { scale: 1.30, xscale: .88, rot: 4.5, y: .05 }
  applyArt(hourEl, hourArt); applyArt(minuteEl, minuteArt)
  const sign = hole.y < h * .52 ? 1 : -1
  let rawHour = add(add(hole, normal, -sign * shadowR * .74), axis, -shadowR * .30)
  let rawMinute = add(add(hole, normal, sign * shadowR * 1.48), axis, shadowR * .62)
  if (portrait) {
    rawHour = { x: w * .34, y: hole.y - shadowR * .72 }
    rawMinute = { x: w * .68, y: hole.y + shadowR * 1.26 }
  }
  const hour = artPoint(rawHour, hm, hourArt, w, h, safe, .02, .02)
  const minute = artPoint(rawMinute, mm, minuteArt, w, h, safe, portrait ? .02 : .10, portrait ? .01 : .05)
  setPair(node, hour, minute)
  setMeta(node, add(minute, normal, sign * Math.max(34, mm.h * .68)), w, h, safe)
}

function layoutWide(ctx: LayoutCtx) {
  const { node, hourEl, minuteEl, hm, mm, hole, axis, shadowR, w, h, safe, portrait } = ctx
  const hourArt: Art = portrait ? { scale: .76, xscale: .92, rot: -2 } : { scale: .88, xscale: .82, rot: -3.5 }
  const minuteArt: Art = portrait ? { scale: .88, xscale: .96, rot: 2 } : { scale: 1.08, xscale: .88, rot: 3 }
  applyArt(hourEl, hourArt); applyArt(minuteEl, minuteArt)
  if (portrait) {
    const hour = artPoint({ x: w * .28, y: h * .20 }, hm, hourArt, w, h, safe)
    const minute = artPoint({ x: w * .70, y: h * .78 }, mm, minuteArt, w, h, safe)
    setPair(node, hour, minute)
    setMeta(node, { x: hour.x, y: hour.y + hm.h * .8 }, w, h, safe)
    return
  }
  const left = [
    { x: safe + hm.w * hourArt.scale * .36, y: h * .25 },
    { x: safe + hm.w * hourArt.scale * .36, y: h * .72 },
  ].sort((a, b) => scoreOpenSpace(b, hole, axis, shadowR, w, h) - scoreOpenSpace(a, hole, axis, shadowR, w, h))[0]
  const right = [
    { x: w - safe - mm.w * minuteArt.scale * .34, y: h * .28 },
    { x: w - safe - mm.w * minuteArt.scale * .34, y: h * .70 },
  ].sort((a, b) => scoreOpenSpace(b, hole, axis, shadowR, w, h) - scoreOpenSpace(a, hole, axis, shadowR, w, h))[0]
  const hour = artPoint(left, hm, hourArt, w, h, safe, .13, .02)
  const minute = artPoint(right, mm, minuteArt, w, h, safe, .14, .02)
  setPair(node, hour, minute)
  setMeta(node, { x: hour.x, y: hour.y + (hour.y < h * .5 ? hm.h * .82 : -hm.h * .82) }, w, h, safe)
}

function layoutOrbital(ctx: LayoutCtx) {
  const { node, hourEl, minuteEl, hm, mm, hole, shadowR, w, h, safe, portrait } = ctx
  const hourArt: Art = portrait ? { scale: .74, xscale: .96, rot: -6 } : { scale: .80, xscale: .94, rot: -7 }
  const minuteArt: Art = portrait ? { scale: .90, xscale: .96, rot: 4 } : { scale: 1.02, xscale: .92, rot: 5 }
  applyArt(hourEl, hourArt); applyArt(minuteEl, minuteArt)
  const room = Math.min(hole.x - safe, w - safe - hole.x, hole.y - safe, h - safe - hole.y)
  const interior = shadowR > Math.max(hm.w * .48, mm.w * .46, 62) && room > shadowR * .82
  node.dataset.orbitLayout = interior ? 'curated-interior' : 'curated-exterior'
  const rH = interior ? shadowR * .40 : shadowR * 1.28 + hm.w * .25
  const rM = interior ? shadowR * .56 : shadowR * 1.30 + mm.w * .25
  const aH = portrait ? -2.18 : -2.42
  const aM = portrait ? .60 : .46
  const hour = artPoint({ x: hole.x + Math.cos(aH) * rH, y: hole.y + Math.sin(aH) * rH }, hm, hourArt, w, h, safe, .01, .01)
  const minute = artPoint({ x: hole.x + Math.cos(aM) * rM, y: hole.y + Math.sin(aM) * rM }, mm, minuteArt, w, h, safe, .01, .01)
  setPair(node, hour, minute)
  const orbitR = clamp(interior ? shadowR * .73 : shadowR * 1.05, 48, Math.min(w, h) * .23)
  setPx(node, '--orbit-r', orbitR); setPx(node, '--orbit-d', orbitR * 2)
  setMeta(node, { x: hole.x - orbitR * .08, y: hole.y + orbitR * .58 }, w, h, safe)
  const d = new Date(), phase = (d.getSeconds() + d.getMilliseconds() / 1000) / 60
  const a = -Math.PI * .82 + phase * Math.PI * 1.22
  setPx(node, '--orbit-dot-x', hole.x + Math.cos(a) * orbitR)
  setPx(node, '--orbit-dot-y', hole.y + Math.sin(a) * orbitR)
}

type LayoutCtx = {
  node: HTMLElement
  hourEl: HTMLElement | null
  minuteEl: HTMLElement | null
  hm: Metrics
  mm: Metrics
  hole: Point
  axis: V2
  normal: V2
  shadowR: number
  engineSize: number
  w: number
  h: number
  safe: number
  portrait: boolean
}

let stored = readStored()
let lastRead = 0
let lastNode: HTMLElement | null = null

function tick(now: number) {
  requestAnimationFrame(tick)
  if (now - lastRead > 120) { stored = readStored(); lastRead = now }
  const node = document.querySelector<HTMLElement>('.wp-clock')
  if (!node) { lastNode = null; return }
  if (stored.sceneMode !== 'preset' || stored.clock === 'off') {
    if (node.dataset.curated === 'on') resetCurated(node)
    lastNode = node
    return
  }
  const preset = stored.scenePreset || node.dataset.preset || 'signature'
  if (!CURATED.has(preset)) {
    if (node.dataset.curated === 'on') resetCurated(node)
    return
  }
  if (lastNode && lastNode !== node && lastNode.dataset.curated === 'on') resetCurated(lastNode)
  lastNode = node

  const style = getComputedStyle(node)
  const w = innerWidth, h = innerHeight, shortEdge = Math.min(w, h)
  const safe = clamp(shortEdge * .028, 14, 46)
  const hole = { x: px(style, '--hole-x', w * .5), y: px(style, '--hole-y', h * .5) }
  const shadowR = Math.max(px(style, '--shadow-r', shortEdge * .12), 24)
  const engineSize = Math.max(px(style, '--engine-size', shortEdge * .08), 34)
  const axis = canonicalAxis(px(style, '--axis-angle', 0))
  const normal = normalOf(axis)
  const hourEl = node.querySelector<HTMLElement>('.hour')
  const minuteEl = node.querySelector<HTMLElement>('.minute')
  const hm = metrics(hourEl, engineSize), mm = metrics(minuteEl, engineSize)
  const aspect = w / Math.max(h, 1)
  const portrait = aspect < .96

  node.dataset.curated = 'on'
  node.dataset.curatedAspect = portrait ? 'portrait' : aspect >= 2.05 ? 'ultra' : aspect >= 1.55 ? 'wide' : 'classic'
  const ctx: LayoutCtx = { node, hourEl, minuteEl, hm, mm, hole, axis, normal, shadowR, engineSize, w, h, safe, portrait }

  if (preset === 'signature') { node.dataset.curatedBlueprint = 'poster-bracket'; layoutSignature(ctx) }
  else if (preset === 'horizon') { node.dataset.curatedBlueprint = 'horizon-tension'; layoutHorizon(ctx) }
  else if (preset === 'terminal') { node.dataset.curatedBlueprint = 'diagonal-doppler'; layoutTerminal(ctx) }
  else if (preset === 'centered') { node.dataset.curatedBlueprint = 'shadow-punctuation'; layoutEclipse(ctx) }
  else if (preset === 'void') { node.dataset.curatedBlueprint = 'void-index'; layoutVoid(ctx) }
  else if (preset === 'close') { node.dataset.curatedBlueprint = 'parallax-crop'; layoutClose(ctx) }
  else if (preset === 'wide') { node.dataset.curatedBlueprint = 'panorama-split'; layoutWide(ctx) }
  else { node.dataset.curatedBlueprint = 'orbital-constellation'; layoutOrbital(ctx) }
}

requestAnimationFrame(tick)
