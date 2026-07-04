<script> import { onMount } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import { portal } from '$lib/utils/portal'
  import { trapFocus } from '$lib/utils/trap-focus'

  const {
    zIndex = 60,
    duration = 200,
    side = 'right',
    widthRem = 16,
    maxWidthPercentage = 70,
    title = undefined,
    heading = undefined,
    on_close = undefined,
    children = undefined,
  } = $props()
  const close = () => on_close?.()
  let slideover = $state()
  onMount(() => {
    const previouslyFocused = typeof document !== 'undefined' && document.activeElement
    return () => {
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus()
      }
    }
  })
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') return close()
    if (e.key === 'Tab') trapFocus(e, slideover)
  }} />

<div
  use:portal
  class:sp-o6uv9u={side === 'right'}
  class:sp-an5m11={side === 'left'}
  class="sp-fip344"
  style="z-index: {zIndex};">
  <div class="sp-8qzqby" transition:fade={{ duration }}>
    <button type="button" class="sp-j2ssgo" onclick={close} aria-label="Close"></button>
  </div>

  <div
    transition:fly={{ x: side === 'right' ? 200 : -200, duration }}
    class="sp-kpe6sy"
    style="width: {widthRem}rem; max-width: {maxWidthPercentage}vw;"
    role="dialog"
    aria-modal="true"
    aria-labelledby="slideover-headline"
    bind:this={slideover}>
    {#if title}
      <div class="sp-rlcy6p">
        <h3 class="sp-47qeee" id="slideover-headline">
          {@render title()}
        </h3>
        <button
          onclick={close}
          type="button"
          class="sp-8nzu0g"
          aria-label="Close">
          <span class="sp-bdhoou"></span></button>
      </div>
    {/if}

    {@render heading?.()}

    <div class="sp-4lu7m2">
      {@render children?.()}
    </div>
  </div>
</div>

<!-- Modal classes: https://tailwindui.com/components/application-ui/overlays/modals -->
<!-- Design Inspiration: https://bt-voice-memos.appspot.com/create -->
<!-- About blog: https://aerotwist.com/blog/voice-memos/ -->

<style>:global(.sp-bdhoou){--un-icon:url("data:image/svg+xml;utf8,%3Csvg viewBox='0 0 352 512' display='inline-block' vertical-align='middle' width='1em' height='1em' xmlns='http://www.w3.org/2000/svg' %3E%3Cpath fill='currentColor' d='m242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28L75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256L9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.2 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.2 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48z'/%3E%3C/svg%3E");-webkit-mask:var(--un-icon) no-repeat;mask:var(--un-icon) no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%;background-color:currentColor;color:inherit;display:inline-block;vertical-align:middle;width:1em;height:1em;font-size:1.125rem;line-height:1.75rem;}:global(.sp-8qzqby){position:fixed;inset:0;transition-property:opacity;transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transition-duration:150ms;}:global(.sp-fip344){position:fixed;top:0;bottom:0;display:flex;}:global(.sp-j2ssgo){position:absolute;inset:0;--un-bg-opacity:1;background-color:rgb(0 0 0 / var(--un-bg-opacity));opacity:0.25;}:global(.sp-an5m11){left:0;}:global(.sp-o6uv9u){right:0;}:global(.sp-kpe6sy){z-index:1;width:16rem;height:100%;display:flex;flex-direction:column;transform:translateX(var(--un-translate-x)) translateY(var(--un-translate-y)) translateZ(var(--un-translate-z)) rotate(var(--un-rotate)) rotateX(var(--un-rotate-x)) rotateY(var(--un-rotate-y)) rotateZ(var(--un-rotate-z)) skewX(var(--un-skew-x)) skewY(var(--un-skew-y)) scaleX(var(--un-scale-x)) scaleY(var(--un-scale-y)) scaleZ(var(--un-scale-z));overflow:hidden;background-color:var(--background);--un-shadow:var(--un-shadow-inset) 0 20px 25px -5px var(--un-shadow-color, rgb(0 0 0 / 0.1)),var(--un-shadow-inset) 0 8px 10px -6px var(--un-shadow-color, rgb(0 0 0 / 0.1));box-shadow:var(--un-ring-offset-shadow), var(--un-ring-shadow), var(--un-shadow);transition-property:all;transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transition-duration:150ms;}:global(.sp-8nzu0g){display:flex;padding-left:0.75rem;padding-right:0.75rem;padding-top:1rem;padding-bottom:1rem;color:color-mix(in srgb, var(--color) 50%, transparent);transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,backdrop-filter;transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transition-duration:150ms;}:global(.sp-rlcy6p){display:flex;align-items:flex-start;justify-content:space-between;border-bottom-width:1px;border-color:color-mix(in srgb, var(--color) 18%, transparent);}:global(.sp-4lu7m2){flex:1 1 0%;overflow-y:auto;}:global(.sp-47qeee){padding:0.75rem;font-size:1.125rem;line-height:1.75rem;color:var(--color);font-weight:500;}:global(.sp-8nzu0g:hover){color:var(--color-secondary);}:global(.sp-8nzu0g:focus){color:var(--color-secondary);outline:2px solid transparent;outline-offset:2px;}</style>
