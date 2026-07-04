<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import { portal } from '../portal'
  import { trapFocus } from '../trapFocus'

  /**
   * @type {{
   *   noscroll?: boolean
   *   zIndex?: number
   *   duration?: number
   *   on_close?: () => void
   *   show_x?: boolean
   *   class?: string
   *   heading?: import('svelte').Snippet
   *   children?: import('svelte').Snippet
   * }}
   */
  const {
    noscroll = false,
    zIndex = 60,
    duration = 200,
    on_close = undefined,
    show_x = true,
    class: className = '',
    heading,
    children,
  } = $props()

  const dispatch = createEventDispatcher()
  const close = () => dispatch('close') && on_close?.()
  /** @type {HTMLElement} */
  let modal = $state()

  onMount(() => {
    const previouslyFocused = /** @type {HTMLElement | null} */ (
      typeof document !== 'undefined' ? document.activeElement : null
    )
    noscroll && (document.body.style.overflow = 'hidden')
    return () => {
      if (previouslyFocused) {
        previouslyFocused.focus()
        document.body.style.overflow = 'auto'
      }
    }
  })
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') return close()
    if (e.key === 'Tab') trapFocus(e, modal)
  }} />

<div
  use:portal
  class="sp-vlbt3t"
  style="z-index: {zIndex};">
  <div class="sp-17uj64" transition:fade={{ duration }}>
    <button type="button" class="sp-8i1hz2" onclick={close} aria-label="Close modal"></button>
  </div>

  <div
    transition:fade={{ duration }}
    class="sp-xmcy3r {className}"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-headline"
    bind:this={modal}>
    <div class="sp-bzlm4s">
      {#if show_x}
        <div class="sp-57r4ta">
          <h3 class="sp-2swy48" id="modal-headline">
            {@render heading?.()}
          </h3>
          <button
            onclick={close}
            type="button"
            class="sp-na2zxh"
            aria-label="Close">
            <span class="sp-ioj5k1"></span>
          </button>
        </div>
      {/if}
      <div class:sp-kqcnwh={show_x}>
        {@render children?.()}
      </div>
    </div>
  </div>
</div>

<style>:global(.sp-ioj5k1){--un-icon:url("data:image/svg+xml;utf8,%3Csvg viewBox='0 0 352 512' display='inline-block' vertical-align='middle' width='1em' height='1em' xmlns='http://www.w3.org/2000/svg' %3E%3Cpath fill='currentColor' d='m242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28L75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256L9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.2 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.2 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48z'/%3E%3C/svg%3E");-webkit-mask:var(--un-icon) no-repeat;mask:var(--un-icon) no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%;background-color:currentColor;color:inherit;display:inline-block;vertical-align:middle;width:1em;height:1em;}:global(.sp-17uj64){position:fixed;inset:0;transition-property:opacity;transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transition-duration:150ms;}:global(.sp-8i1hz2){position:absolute;inset:0;--un-bg-opacity:1;background-color:rgb(0 0 0 / var(--un-bg-opacity));opacity:0.5;}:global(.sp-vlbt3t){position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:1rem;}:global(.sp-xmcy3r){z-index:1;width:100%;max-height:100%;display:flex;flex-direction:column;transform:translateX(var(--un-translate-x)) translateY(var(--un-translate-y)) translateZ(var(--un-translate-z)) rotate(var(--un-rotate)) rotateX(var(--un-rotate-x)) rotateY(var(--un-rotate-y)) rotateZ(var(--un-rotate-z)) skewX(var(--un-skew-x)) skewY(var(--un-skew-y)) scaleX(var(--un-scale-x)) scaleY(var(--un-scale-y)) scaleZ(var(--un-scale-z));overflow:hidden;border-radius:0.5rem;background-color:var(--background);--un-shadow:var(--un-shadow-inset) 0 20px 25px -5px var(--un-shadow-color, rgb(0 0 0 / 0.1)),var(--un-shadow-inset) 0 8px 10px -6px var(--un-shadow-color, rgb(0 0 0 / 0.1));box-shadow:var(--un-ring-offset-shadow), var(--un-ring-shadow), var(--un-shadow);transition-property:all;transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transition-duration:150ms;}:global(.sp-na2zxh){margin:-1rem;height:3rem;width:3rem;display:flex;align-items:center;justify-content:center;border-radius:0.25rem;color:color-mix(in srgb, var(--color) 50%, transparent);}:global(.sp-kqcnwh){margin-top:0.5rem;}:global(.sp-57r4ta){display:flex;}:global(.sp-bzlm4s){flex:1 1 0%;overflow-y:auto;padding:1rem;}:global(.sp-2swy48){flex-grow:1;font-size:1.125rem;line-height:1.75rem;color:var(--color);font-weight:500;line-height:1.5rem;}:global(.sp-na2zxh:hover){color:var(--color-secondary);}:global(.sp-na2zxh:focus){color:var(--color-secondary);outline:2px solid transparent;outline-offset:2px;--un-ring-width:2px;--un-ring-offset-shadow:var(--un-ring-inset) 0 0 0 var(--un-ring-offset-width) var(--un-ring-offset-color);--un-ring-shadow:var(--un-ring-inset) 0 0 0 calc(var(--un-ring-width) + var(--un-ring-offset-width)) var(--un-ring-color);box-shadow:var(--un-ring-offset-shadow), var(--un-ring-shadow), var(--un-shadow);}@media (min-width: 640px){:global(.sp-xmcy3r){max-width:32rem;}:global(.sp-bzlm4s){padding:1.5rem;}}
  /* allows us to use portal and keep the footer inside the form element */
  :global(.modal-footer) {
    margin:-1rem;margin-top:1rem;display:flex;flex-wrap:wrap;justify-content:flex-end;background-color:var(--surface);padding-left:1rem;padding-right:1rem;padding-top:0.75rem;padding-bottom:0.75rem;
  }@media (min-width: 640px){:global(.modal-footer){margin:-1.5rem;margin-top:1.5rem;padding-left:1.5rem;padding-right:1.5rem;}}

  :global(.modal-footer > :not([hidden]) ~ :not([hidden])) {
    --tw-space-x-reverse: 0;
    margin-right: calc(0.25rem * var(--tw-space-x-reverse));
    margin-left: calc(0.25rem * calc(1 - var(--tw-space-x-reverse)));
  }
</style>
