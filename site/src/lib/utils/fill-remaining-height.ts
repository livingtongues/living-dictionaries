import type { Action } from 'svelte/action'

interface Params {
  /** Pixels to reserve below the element (e.g. a pagination bar + page padding). */
  bottom_gap?: number
  /** Never shrink below this many pixels. */
  min_height?: number
}

/**
 * Caps an element's `max-height` so it fills the viewport from its current top
 * down to `bottom_gap` px above the viewport bottom — turning it into a
 * self-contained scroll region whose sticky header pins to the top of the page.
 */
export const fill_remaining_height: Action<HTMLElement, Params | undefined> = (node, params) => {
  let bottom_gap = params?.bottom_gap ?? 88
  let min_height = params?.min_height ?? 200

  function apply() {
    const { top } = node.getBoundingClientRect()
    const available = Math.max(window.innerHeight - top - bottom_gap, min_height)
    const next = `${Math.round(available)}px`
    if (node.style.maxHeight !== next)
      node.style.maxHeight = next
  }

  apply()
  const raf = requestAnimationFrame(apply)
  window.addEventListener('resize', apply)

  return {
    update(next?: Params) {
      bottom_gap = next?.bottom_gap ?? 88
      min_height = next?.min_height ?? 200
      apply()
    },
    destroy() {
      window.removeEventListener('resize', apply)
      cancelAnimationFrame(raf)
    },
  }
}
