import type { Action } from 'svelte/action'

export const longpress: Action<HTMLElement, number | undefined, {
  onlongpress?: (event: CustomEvent) => void
  onshortpress?: (event: CustomEvent) => void
}> = (node, duration = 400) => {
  let start // for shortpress
  let shortpress_emitted // so touchend and mouseup events don't both emit on touch devices
  let timer // for longpress
  let scrolled = 0
  const handle_down = () => {
    start = Date.now()
    timer = setTimeout(() => {
      node.dispatchEvent(new CustomEvent('longpress'))
    }, duration)
  }
  const handle_up = () => {
    const shortpress_recently_emitted = shortpress_emitted > Date.now() - duration / 2
    const recently_scrolled = Date.now() - scrolled < duration
    const less_than_duration_has_elapsed = Date.now() - start < duration / 2
    if (!shortpress_recently_emitted && !recently_scrolled && less_than_duration_has_elapsed) {
      node.dispatchEvent(new CustomEvent('shortpress'))
      shortpress_emitted = Date.now()
    }
    clearTimeout(timer)
  }
  const handle_move = () => {
    scrolled = Date.now()
    clearTimeout(timer)
  }
  node.addEventListener('mousedown', handle_down)
  node.addEventListener('mouseup', handle_up)
  node.addEventListener('touchstart', handle_down)
  node.addEventListener('touchend', handle_up)
  node.addEventListener('touchmove', handle_move)
  return {
    update(new_duration) {
      duration = new_duration
    },
    destroy() {
      node.removeEventListener('mousedown', handle_down)
      node.removeEventListener('mouseup', handle_up)
      node.removeEventListener('touchstart', handle_down)
      node.removeEventListener('touchend', handle_up)
      node.removeEventListener('touchmove', handle_move)
    },
  }
}
