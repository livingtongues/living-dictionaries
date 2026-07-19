import type { ActionReturn } from 'svelte/action'

interface Attributes {
  'on:clickoutside'?: (e: CustomEvent<boolean>) => void
  'onclickoutside'?: (e: CustomEvent<boolean>) => void
}

export function clickoutside(node: Node): ActionReturn<undefined, Attributes> {
  const handle_click = (event: MouseEvent) => {
    if (node && !node.contains(event.target as Node) && !event.defaultPrevented) {
      node.dispatchEvent(new CustomEvent('clickoutside'))
    }
  }
  document.addEventListener('click', handle_click, true)
  return {
    destroy() {
      document.removeEventListener('click', handle_click, true)
    },
  }
}
