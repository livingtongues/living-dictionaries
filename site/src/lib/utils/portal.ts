/**
 * Move the element to a different parent (defaults to <body>) so its stacking
 * context isn't trapped by a parent's `transform` / `filter` / `overflow:hidden` /
 * `z-index` containing block — critical for modals, popovers, toasts.
 *
 * Usage: `<div use:portal>` or `<div use:portal={'#some-target'}>`.
 * Add `hidden` if SSR rendered (and toggle node.hidden in destroy if needed).
 *
 * Originally adapted from https://github.com/romkor/svelte-portal
 */
export function portal(node: HTMLElement, target = 'body'): { destroy: () => void } | undefined {
  const target_div = document.querySelector(target)
  if (!target_div)
    return

  const portal_el = document.createElement('div')
  target_div.appendChild(portal_el)
  portal_el.appendChild(node)

  return {
    destroy() {
      portal_el.parentElement?.removeChild(portal_el)
    },
  }
}
