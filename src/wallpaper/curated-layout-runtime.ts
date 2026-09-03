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
type OcclusionMode = 'none' | 'axis-slice' | 'ring-cut' | 'shadow-swallow'
type OcclusionSpec = {
  mode: OcclusionMode
  strength: number
  radius?: number
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
const OCCLUSION: Record<string, OcclusionSpec> = {
  signature: { mode: 'none', strength: 0 },
  horizon:   { mode: 'axis-slice', strength: .62 },
  terminal:  { mode: 'axis-slice', strength: .92 },
  centered:  { mode: 'ring-cut', strength: .82, radius: .96 },
  void:      { mode: 'none', strength: 0 },
  close:     { mode: 'shadow-swallow', strength: .82, radius: .86 },
  wide:      { mode: 'none', strength: 0 },
  polar:     { mode: 'ring-cut', strength: .54, radius: .94 },
}
const ROOT_VARS = [
  '--date-art-x', '--date-art-y', '--date-art-rot', '--meta-art-x', '--meta-art-y', '--meta-art-rot',
  '--blade-width', '--blade-span', '--orbit-r', '--orbit-d', '--orbit-dot-x', '--orbit-dot-y',
  '--seconds-x', '--seconds-y',
  '--occ-angle', '--occ-stop', '--occ-band', '--occ-feather',
  '--occ-x', '--occ-y', '--occ-ring-r', '--occ-ring-w', '--occ-ring-feather',
  '--occ-shadow-r', '--occ-shadow-feather',
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

function upperNormal(normal: V2): V2 {
  return normal[1] <= 0 ? normal : [-normal[0], -normal[1]]
}

function pointOnAxisAtX(hole: Point, axis: V2, targetX: number): Point {
  if (Math.abs(axis[0]) < .08) return { x: hole.x, y: hole.y }
  const t = (targetX - hole.x) / axis[0]
  return { x: targetX, y: hole.y + axis[1] * t }
}

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

function configureOcclusion(ctx: LayoutCtx, preset: string) {
  const spec = OCCLUSION[preset] ?? OCCLUSION.signature
  const { node, hole, normal, shadowR, engineSize, w, h } = ctx
  node.dataset.occlusion = spec.mode
  setPx(node, '--occ-x', hole.x)
  setPx(node, '--occ-y', hole.y)

  if (spec.mode === 'none') return

  if (spec.mode === 'axis-slice') {
    const projections = [
      0,
      w * normal[0],
      h * normal[1],
      w * normal[0] + h * normal[1],
    ]
    const minProjection = Math.min(...projections)
    const maxProjection = Math.max(...projections)
    const range = Math.max(maxProjection - minProjection, 1)
    const holeProjection = hole.x * normal[0] + hole.y * normal[1]
    const stop = clamp((holeProjection - minProjection) / range * 100, 0, 100)
    const bandPx = clamp(engineSize * (.075 + spec.strength * .13), 5, 22)
    const featherPx = clamp(bandPx * .48, 2.5, 8)
    let angle = Math.atan2(normal[0], -normal[1]) * 180 / Math.PI
    if (angle < 0) angle += 360

    node.style.setProperty('--occ-angle', `${angle.toFixed(2)}deg`)
    node.style.setProperty('--occ-stop', `${stop.toFixed(3)}%`)
    node.style.setProperty('--occ-band', `${(bandPx / range * 100).toFixed(3)}%`)
    node.style.setProperty('--occ-feather', `${(featherPx / range * 100).toFixed(3)}%`)
    return
  }

  if (spec.mode === 'ring-cut') {
    const ringR = shadowR * (spec.radius ?? .96)
    const ringW = clamp(engineSize * (.05 + spec.strength * .065), 4, 14)
    const feather = clamp(ringW * .50, 2, 6)
    setPx(node, '--occ-ring-r', ringR)
    setPx(node, '--occ-ring-w', ringW)
    setPx(node, '--occ-ring-feather', feather)
    return
  }

  const swallowR = shadowR * (spec.radius ?? .86)
  const swallowFeather = clamp(engineSize * (.08 + spec.strength * .06), 5, 16)
  setPx(node, '--occ-shadow-r', swallowR)
  setPx(node, '--occ-shadow-feather', swallowFeather)
}

function resetCurated(node: HTMLElement) {
  delete node.dataset.curated
  delete node.dataset.curatedBlueprint
  delete node.dataset.curatedAspect
  delete node.dataset.occlusion
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
  let anchor: Point
  if (portrait) {
    anchor = { x: subjectRight ? w * .30 : w * .70, y: hole.y > h * .50 ? h * .30 : h * .70 }
  } else {
    const targetX = subjectRight ? w * .24 : w * .76
    const linePoint = pointOnAxisAtX(hole, axis, targetX)
    anchor = add(linePoint, upperNormal(normal), engineSize * .13)
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
  let anchor: Point
  if (portrait) {
    anchor = { x: subjectRight ? w * .32 : w * .68, y: hole.y > h * .52 ? h * .28 : h * .72 }
  } else {
    const targetX = subjectRight ? w * .30 : w * .70
    const linePoint = pointOnAxisAtX(hole, axis, targetX)
    anchor = add(linePoint, upperNormal(normal), engineSize * .055)
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
    {
      x: hole.x + shadowR * (portrait ? .28 : .43),
      y: hole.y - shadowR * (portrait ? .02 : .04),
    },
    [1, 0],
    { scale: portrait ? .68 : .76, xscale: .96 },
    { scale: portrait ? .68 : .76, xscale: .96 },
    engineSize * .14,
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
  const { hole, shadowR, engineSize, portrait, w } = ctx
  const outward = hole.x >= w * .5 ? -1 : 1
  const cluster = inlineCluster(
    ctx,
    {
      x: hole.x + shadowR * (portrait ? .48 : .62) * outward,
      y: hole.y + shadowR * (portrait ? .04 : .07),
    },
    [1, 0],
    { scale: portrait ? .68 : .74, xscale: .98, opacity: .80, blur: .10 },
    { scale: portrait ? .78 : .86, xscale: .94 },
    engineSize * .16,
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
  const cluster = inlineCluster(
    ctx,
    {
      x: hole.x - shadowR * (portrait ? .34 : .48),
      y: hole.y + shadowR * (portrait ? .10 : .11),
    },
    [1, 0],
    { scale: portrait ? .58 : .64, xscale: .97 },
    { scale: portrait ? .58 : .64, xscale: .97 },
    engineSize * .14,
  )
  setMeta(
    ctx.node,
    { x: cluster.center.x, y: cluster.center.y + Math.max(engineSize * .42, cluster.maxH * .72) },
    ctx.w, ctx.h, ctx.safe,
  )
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

  configureOcclusion(ctx, preset)
}

requestAnimationFrame(tick)
