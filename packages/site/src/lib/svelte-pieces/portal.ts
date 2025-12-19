/**
 * Usage: `<div use:portal>` or `<div use:portal={'#direction'}>`, add `hidden` if SSR rendered (requires updating action with node.hidden = false and true)
 */
export function portal(node: HTMLElement, target = 'body') {
  const target_div = document.querySelector(target)
  if (!target_div)
    return

  const portal = document.createElement('div')
  target_div.appendChild(portal)
  portal.appendChild(node)

  return {
    destroy() {
      portal.parentElement.removeChild(portal)
    },
  }
}
// from https://github.com/romkor/svelte-portal
