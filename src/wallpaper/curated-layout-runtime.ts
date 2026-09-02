const KEY = 'schwarzschild-wallpaper'
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

type Stored = {
  sceneMode?: 'preset' | 'custom'
  scenePreset?: string
  clock?: 'off' | '24' | '12'
}
type Point = { x: number; y: number }
type V2 = [number, number]
type Metrics = { w: number; h: number }
type Art = {
  scale: number
  xscale?: number
  opacity?: number
  blur?: number
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
  const value = Number.parseFloat(style.getPropertyValue(name))
  return Number.isFinite(value) ? value : fallback
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
const dot = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1]
const sub = (a: Point, b: Point): V2 => [a.x - b.x, a.y - b.y]
const add = (p: Point, v: V2, amount: number): Point => ({ x: p.x + v[0] * amount, y: p.y + v[1] * amount })

function applyArt(el: HTMLElement | null, art: Art) {
  if (!el) return
  el.style.setProperty('--art-scale', art.scale.toFixed(3))
  el.style.setProperty('--art-xscale', (art.xscale ?? 1).toFixed(3))
  el.style.setProperty('--art-rot', '0deg')
  el.style.setProperty('--art-x', '0em')
  el.style.setProperty('--art-y', '0em')
  if (art.opacity !== undefined) el.style.setProperty('--art-opacity', art.opacity.toFixed(3))
  else el.style.removeProperty('--art-opacity')
  if (art.blur !== undefined) el.style.setProperty('--art-blur', `${art.blur.toFixed(2)}px`)
  else el.style.removeProperty('--art-blur')
}

const visualW = (m: Metrics, art: Art) => m.w * art.scale * (art.xscale ?? 1)
const visualH = (m: Metrics, art: Art) => m.h * art.scale

function setPair(node: HTMLElement, hour: Point, minute: Point) {
  setPx(node, '--hour-x', hour.x); setPx(node, '--hour-y', hour.y)
  setPx(node, '--minute-x', minute.x); setPx(node, '--minute-y', minute.y)
}
function setMeta(node: HTMLElement, p: Point, w: number, h: number, safe: number) {
  setPx(node, '--meta-x', clamp(p.x, safe + 42, w - safe - 42))
  setPx(node, '--meta-y', clamp(p.y, safe + 18, h - safe - 18))
  node.style.setProperty('--date-art-x', '0px')
  node.style.setProperty('--date-art-y', '0px')
  node.style.setProperty('--date-art-rot', '0deg')
  node.style.setProperty('--meta-art-x', '0px')
  node.style.setProperty('--meta-art-y', '0px')
  node.style.setProperty('--meta-art-rot', '0deg')
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

/**
 * HH/MM are treated as one typographic object. The cluster is clamped as a
 * whole before the two glyph groups are positioned, so safe-area correction
 * cannot pull the hour and minute apart into unrelated screen-space labels.
 */
function inlineCluster(
  ctx: LayoutCtx,
  anchor: Point,
  direction: V2,
  hourArt: Art,
  minuteArt: Art,
  gap: number,
) {
  const { node, hourEl, minuteEl, hm, mm, w, h, safe } = ctx
  applyArt(hourEl, hourArt)
  applyArt(minuteEl, minuteArt)

  const hw = visualW(hm, hourArt)
  const mw = visualW(mm, minuteArt)
  const maxH = Math.max(visualH(hm, hourArt), visualH(mm, minuteArt))
  const total = hw + gap + mw
  const dirLen = Math.hypot(direction[0], direction[1]) || 1
  const dir: V2 = [direction[0] / dirLen, direction[1] / dirLen]
  const normal: V2 = [-dir[1], dir[0]]

  const halfX = Math.abs(dir[0]) * total * .5 + Math.abs(normal[0]) * maxH * .5
  const halfY = Math.abs(dir[1]) * total * .5 + Math.abs(normal[1]) * maxH * .5
  const center = {
    x: clamp(anchor.x, safe + halfX, w - safe - halfX),
    y: clamp(anchor.y, safe + halfY, h - safe - halfY),
  }

  const hourOffset = -(total * .5 - hw * .5)
  const minuteOffset = total * .5 - mw * .5
  const hour = add(center, dir, hourOffset)
  const minute = add(center, dir, minuteOffset)
  setPair(node, hour, minute)

  return { center, dir, normal, total, maxH, hour, minute }
}

function attachedMeta(
  ctx: LayoutCtx,
  cluster: ReturnType<typeof inlineCluster>,
  preferredNormal?: V2,
  distance = 0,
) {
  const { node, hole, engineSize, w, h, safe } = ctx
  const n = preferredNormal ?? cluster.normal
  let sign = Math.sign(dot(sub(cluster.center, hole), n))
  if (!sign) sign = 1
  const offset = distance || Math.max(28, cluster.maxH * .72, engineSize * .36)
  setMeta(node, add(cluster.center, n, sign * offset), w, h, safe)
}

function layoutSignature(ctx: LayoutCtx) {
  const { hole, w, h, engineSize, portrait } = ctx
  const subjectRight = hole.x >= w * .5
  const anchor = {
    x: subjectRight ? w * (portrait ? .38 : .20) : w * (portrait ? .62 : .80),
    y: hole.y > h * .52 ? h * .28 : h * (portrait ? .68 : .30),
  }
  const cluster = inlineCluster(
    ctx,
    anchor,
    [1, 0],
    { scale: portrait ? .88 : 1.02, xscale: .91 },
    { scale: portrait ? .76 : .82, xscale: .96 },
    engineSize * .18,
  )
  attachedMeta(ctx, cluster, [0, 1], engineSize * .42)
}

function layoutHorizon(ctx: LayoutCtx) {
  const { hole, axis, normal, w, h, engineSize, portrait } = ctx
  const subjectRight = hole.x >= w * .5
  const anchor = {
    x: subjectRight ? w * .25 : w * .73,
    y: hole.y > h * .50 ? h * .30 : h * .70,
  }
  const cluster = inlineCluster(
    ctx,
    anchor,
    portrait ? [1, 0] : axis,
    { scale: portrait ? .72 : .78, xscale: 1.10 },
    { scale: portrait ? .76 : .82, xscale: 1.02 },
    engineSize * .16,
  )
  attachedMeta(ctx, cluster, portrait ? [0, 1] : normal, engineSize * .44)
  setPx(ctx.node, '--blade-width', Math.max(cluster.total * 1.08, engineSize * 3.2))
}

function layoutTerminal(ctx: LayoutCtx) {
  const { hole, axis, normal, w, h, engineSize, portrait } = ctx
  const subjectRight = hole.x >= w * .5
  const anchor = {
    x: subjectRight ? w * .29 : w * .71,
    y: hole.y > h * .52 ? h * .26 : h * .72,
  }
  const cluster = inlineCluster(
    ctx,
    anchor,
    portrait ? [1, 0] : axis,
    { scale: portrait ? .76 : .88, xscale: 1.05 },
    { scale: portrait ? .66 : .72, xscale: 1.14, opacity: .78 },
    engineSize * .13,
  )
  attachedMeta(ctx, cluster, portrait ? [0, 1] : normal, engineSize * .42)
  setPx(ctx.node, '--blade-width', Math.max(cluster.total * .92, engineSize * 2.8))
}

function layoutEclipse(ctx: LayoutCtx) {
  const { hole, shadowR, engineSize, portrait } = ctx
  const cluster = inlineCluster(
    ctx,
    { x: hole.x, y: hole.y - shadowR * (portrait ? .05 : .07) },
    [1, 0],
    { scale: portrait ? .64 : .70, xscale: .96 },
    { scale: portrait ? .64 : .70, xscale: .96 },
    engineSize * .16,
  )
  setMeta(
    ctx.node,
    { x: cluster.center.x, y: cluster.center.y + Math.max(engineSize * .48, cluster.maxH * .82) },
    ctx.w, ctx.h, ctx.safe,
  )
  ctx.node.dataset.pair = 'curated'
}

function layoutVoid(ctx: LayoutCtx) {
  const { hole, w, h, engineSize, portrait } = ctx
  const useLeft = hole.x > w * .5
  const anchor = {
    x: useLeft ? w * (portrait ? .34 : .16) : w * (portrait ? .66 : .84),
    y: portrait ? h * .68 : h * .63,
  }
  const cluster = inlineCluster(
    ctx,
    anchor,
    [1, 0],
    { scale: portrait ? .48 : .50, xscale: .96, opacity: .82 },
    { scale: portrait ? .48 : .50, xscale: .96, opacity: .58 },
    engineSize * .14,
  )
  attachedMeta(ctx, cluster, [0, -1], engineSize * .34)
}

function layoutClose(ctx: LayoutCtx) {
  const { hole, shadowR, engineSize, portrait } = ctx
  const cluster = inlineCluster(
    ctx,
    { x: hole.x - shadowR * .04, y: hole.y + shadowR * (portrait ? .10 : .07) },
    [1, 0],
    { scale: portrait ? .66 : .72, xscale: .98, opacity: .82, blur: .12 },
    { scale: portrait ? .76 : .82, xscale: .94 },
    engineSize * .18,
  )
  setMeta(
    ctx.node,
    { x: cluster.center.x, y: cluster.center.y + Math.max(engineSize * .46, cluster.maxH * .76) },
    ctx.w, ctx.h, ctx.safe,
  )
}

function layoutWide(ctx: LayoutCtx) {
  const { hole, w, h, engineSize, portrait } = ctx
  const useLeft = hole.x > w * .5
  const anchor = {
    x: useLeft ? w * (portrait ? .36 : .18) : w * (portrait ? .64 : .82),
    y: portrait ? h * .30 : h * .47,
  }
  const cluster = inlineCluster(
    ctx,
    anchor,
    [1, 0],
    { scale: portrait ? .52 : .58, xscale: .96 },
    { scale: portrait ? .52 : .58, xscale: .96 },
    engineSize * .15,
  )
  attachedMeta(ctx, cluster, [0, 1], engineSize * .34)
}

function layoutOrbital(ctx: LayoutCtx) {
  const { hole, shadowR, engineSize, portrait } = ctx
  // Keep the type in the dark core, but deliberately offset the complete line
  // away from the geometric centre so the scene reads as a poster, not a watch face.
  const cluster = inlineCluster(
    ctx,
    {
      x: hole.x - shadowR * (portrait ? .08 : .15),
      y: hole.y + shadowR * (portrait ? .18 : .20),
    },
    [1, 0],
    { scale: portrait ? .56 : .60, xscale: .97 },
    { scale: portrait ? .56 : .60, xscale: .97 },
    engineSize * .15,
  )
  setMeta(
    ctx.node,
    { x: cluster.center.x, y: cluster.center.y + Math.max(engineSize * .42, cluster.maxH * .72) },
    ctx.w, ctx.h, ctx.safe,
  )
  // The physical accretion ring already provides circular structure. Extra UI
  // orbit geometry is intentionally suppressed by curated-layout.css.
  setPx(ctx.node, '--orbit-r', Math.max(shadowR * .72, 42))
  setPx(ctx.node, '--orbit-d', Math.max(shadowR * 1.44, 84))
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
  const safe = clamp(shortEdge * .034, 18, 54)
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

  if (preset === 'signature') { node.dataset.curatedBlueprint = 'hero-cluster'; layoutSignature(ctx) }
  else if (preset === 'horizon') { node.dataset.curatedBlueprint = 'axis-caption'; layoutHorizon(ctx) }
  else if (preset === 'terminal') { node.dataset.curatedBlueprint = 'doppler-caption'; layoutTerminal(ctx) }
  else if (preset === 'centered') { node.dataset.curatedBlueprint = 'shadow-title'; layoutEclipse(ctx) }
  else if (preset === 'void') { node.dataset.curatedBlueprint = 'void-caption'; layoutVoid(ctx) }
  else if (preset === 'close') { node.dataset.curatedBlueprint = 'shadow-overlay'; layoutClose(ctx) }
  else if (preset === 'wide') { node.dataset.curatedBlueprint = 'landscape-caption'; layoutWide(ctx) }
  else { node.dataset.curatedBlueprint = 'tangent-title'; layoutOrbital(ctx) }
}

requestAnimationFrame(tick)
