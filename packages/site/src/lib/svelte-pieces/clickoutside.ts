import type { ActionReturn } from 'svelte/action'

interface Attributes {
  'onclickoutside'?: () => void
}

export function clickoutside(node: HTMLElement, callback?: () => void): ActionReturn<(() => void) | undefined, Attributes> {
  const handleClick = (event: MouseEvent) => {
    if (node && !node.contains(event.target as Node) && !event.defaultPrevented) {
      if (callback) {
        callback()
      } else {
        const handler = node.onclickoutside as (() => void) | undefined
        handler?.()
      }
    }
  }

  document.addEventListener('click', handleClick, true)

  return {
    update(new_callback) {
      callback = new_callback
    },
    destroy() {
      document.removeEventListener('click', handleClick, true)
    },
  }
}

declare global {
  interface HTMLElement {
    onclickoutside?: () => void
  }
}
