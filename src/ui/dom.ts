/**
 * Registry of DOM nodes the render loop writes to directly (60 fps
 * updates bypass React). Components register themselves via ref
 * callbacks; the loop in App.tsx reads and mutates styles/text.
 */
export const domRefs: Record<string, HTMLElement | SVGElement | null> = {}

export function reg(key: string) {
  return (el: HTMLElement | SVGElement | null) => {
    domRefs[key] = el
  }
}
