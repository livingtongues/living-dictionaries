import type { ActionReturn } from 'svelte/action'

interface Attributes {
  'on:clickoutside'?: (e: CustomEvent<boolean>) => void
  'onclickoutside'?: (e: CustomEvent<boolean>) => void
}

export function clickoutside(node: Node): ActionReturn<undefined, Attributes> {
  const handleClick = (event: MouseEvent) => {
    if (node && !node.contains(event.target as Node) && !event.defaultPrevented) {
      node.dispatchEvent(new CustomEvent('clickoutside'))
    }
  }
  document.addEventListener('click', handleClick, true)
  return {
    destroy() {
      document.removeEventListener('click', handleClick, true)
    },
  }
}
