const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
const px = (style: CSSStyleDeclaration, name: string, fallback: number) => {
  const v = Number.parseFloat(style.getPropertyValue(name))
  return Number.isFinite(v) ? v : fallback
}
const setPx = (node: HTMLElement, name: string, value: number) =>
  node.style.setProperty(name, `${value.toFixed(1)}px`)

type Metrics = { w: number; h: number }
type Point = { x: number; y: number }

const metrics = (el: HTMLElement | null, size: number): Metrics => ({
  w: Math.max(el?.offsetWidth ?? 0, size * 1.05),
  h: Math.max(el?.offsetHeight ?? 0, size * .72),
})

function safePoint(p: Point, m: Metrics, w: number, h: number, safe: number): Point {
  const hx = Math.min(m.w * .5, Math.max((w - safe * 2) * .5, 0))
  const hy = Math.min(m.h * .5, Math.max((h - safe * 2) * .5, 0))
  return {
    x: clamp(p.x, safe + hx, w - safe - hx),
    y: clamp(p.y, safe + hy, h - safe - hy),
  }
}

function setPair(node: HTMLElement, hour: Point, minute: Point) {
  setPx(node, '--hour-x', hour.x)
  setPx(node, '--hour-y', hour.y)
  setPx(node, '--minute-x', minute.x)
  setPx(node, '--minute-y', minute.y)
}

function tick() {
  requestAnimationFrame(tick)
  const node = document.querySelector<HTMLElement>(".wp-clock[data-engine='orbit']")
  if (!node) return

  const style = getComputedStyle(node)
  const w = innerWidth
  const h = innerHeight
  const shortEdge = Math.min(w, h)
  const safe = clamp(shortEdge * .035, 18, 54)
  const holeX = px(style, '--hole-x', w * .5)
  const holeY = px(style, '--hole-y', h * .5)
  const shadowR = Math.max(px(style, '--shadow-r', shortEdge * .12), 1)
  const engineSize = Math.max(px(style, '--engine-size', shortEdge * .075), 34)
  const hourEl = node.querySelector<HTMLElement>('.hour')
  const minuteEl = node.querySelector<HTMLElement>('.minute')
  const hm = metrics(hourEl, engineSize)
  const mm = metrics(minuteEl, engineSize)
  const preset = node.dataset.preset || 'face'

  const room = Math.max(
    38,
    Math.min(holeX - safe, w - safe - holeX, holeY - safe, h - safe - holeY),
  )
  const maxGlyph = Math.max(hm.w, mm.w)
  const interior = shadowR >= Math.max(engineSize * 1.55, maxGlyph * .72) && room >= shadowR * .84

  if (interior) {
    node.dataset.orbitLayout = 'interior'
    const orbitR = clamp(Math.min(shadowR * .79, room * .88), engineSize * 1.08, shadowR * .86)
    const anchorR = orbitR * .49
    const flip = preset === 'polar' ? -1 : 1
    const hourAngle = flip > 0 ? -2.48 : 2.48
    const minuteAngle = hourAngle + Math.PI
    const hour = safePoint({
      x: holeX + Math.cos(hourAngle) * anchorR,
      y: holeY + Math.sin(hourAngle) * anchorR,
    }, hm, w, h, safe)
    const minute = safePoint({
      x: holeX + Math.cos(minuteAngle) * anchorR,
      y: holeY + Math.sin(minuteAngle) * anchorR,
    }, mm, w, h, safe)
    setPair(node, hour, minute)

    setPx(node, '--orbit-r', orbitR)
    setPx(node, '--orbit-d', orbitR * 2)
    setPx(node, '--meta-x', clamp(holeX - orbitR * .08, safe + 72, w - safe - 72))
    setPx(node, '--meta-y', clamp(holeY + orbitR * .62, safe + 24, h - safe - 24))
    setPx(node, '--seconds-x', clamp(minute.x + mm.w * .58, safe + 20, w - safe - 20))
    setPx(node, '--seconds-y', clamp(minute.y - mm.h * .34, safe + 16, h - safe - 16))

    const d = new Date()
    const phase = (d.getSeconds() + d.getMilliseconds() / 1000) / 60
    const a = -.92 * Math.PI + phase * 1.52 * Math.PI
    setPx(node, '--orbit-dot-x', holeX + Math.cos(a) * orbitR)
    setPx(node, '--orbit-dot-y', holeY + Math.sin(a) * orbitR)
    return
  }

  // Small-shadow / off-axis fallback: split the groups around the subject instead
  // of placing both on one top baseline. The original safe solver still defines
  // the black-hole geometry; this layer only chooses two legible editorial anchors.
  node.dataset.orbitLayout = 'exterior'
  const orbitR = clamp(Math.min(shadowR * 1.26, room * .76), engineSize * 1.12, shortEdge * .24)
  const flip = preset === 'polar' ? -1 : 1
  const hourAngle = flip > 0 ? -2.62 : 2.62
  const minuteAngle = flip > 0 ? -.42 : .42
  const hour = safePoint({
    x: holeX + Math.cos(hourAngle) * orbitR,
    y: holeY + Math.sin(hourAngle) * orbitR,
  }, hm, w, h, safe)
  const minute = safePoint({
    x: holeX + Math.cos(minuteAngle) * orbitR,
    y: holeY + Math.sin(minuteAngle) * orbitR,
  }, mm, w, h, safe)
  setPair(node, hour, minute)
  setPx(node, '--orbit-r', orbitR)
  setPx(node, '--orbit-d', orbitR * 2)
  setPx(node, '--meta-x', clamp(holeX, safe + 72, w - safe - 72))
  setPx(node, '--meta-y', clamp(holeY + orbitR + engineSize * .72, safe + 24, h - safe - 24))
  setPx(node, '--seconds-x', clamp(minute.x + mm.w * .58, safe + 20, w - safe - 20))
  setPx(node, '--seconds-y', clamp(minute.y - mm.h * .34, safe + 16, h - safe - 16))

  const d = new Date()
  const phase = (d.getSeconds() + d.getMilliseconds() / 1000) / 60
  const a = -.86 * Math.PI + phase * 1.42 * Math.PI
  setPx(node, '--orbit-dot-x', holeX + Math.cos(a) * orbitR)
  setPx(node, '--orbit-dot-y', holeY + Math.sin(a) * orbitR)
}

requestAnimationFrame(tick)
