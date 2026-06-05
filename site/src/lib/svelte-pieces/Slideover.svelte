<script lang="ts">
  import IconMdiClose from '~icons/mdi/close'
  import { onMount } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import { portal } from './portal'
  import { trapFocus } from './trapFocus'

  interface Props {
    z_index?: number
    duration?: number
    side?: 'left' | 'right'
    width_rem?: number
    max_width_percentage?: number
    on_close: () => void
    title?: import('svelte').Snippet
    heading?: import('svelte').Snippet
    children?: import('svelte').Snippet
  }

  const {
    z_index = 60,
    duration = 200,
    side = 'right',
    width_rem = 16,
    max_width_percentage = 70,
    on_close,
    title,
    heading,
    children,
  }: Props = $props()

  let slideover: HTMLElement | undefined = $state()

  onMount(() => {
    const previously_focused
      = typeof document !== 'undefined' && (document.activeElement as HTMLElement)

    return () => {
      if (previously_focused) {
        previously_focused.focus()
      }
    }
  })
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape')
      return on_close()
    if (e.key === 'Tab' && slideover)
      trapFocus(e, slideover)
  }} />

<div
  use:portal
  class={['slideover-root', side === 'right' ? 'side-right' : 'side-left']}
  style="z-index: {z_index};">
  <div class="slideover-backdrop-wrap" transition:fade={{ duration }}>
    <button type="button" class="slideover-backdrop" onclick={on_close} aria-label="Close"></button>
  </div>

  <div
    transition:fly={{ x: side === 'right' ? 200 : -200, duration }}
    class="slideover-card"
    style="width: {width_rem}rem; max-width: {max_width_percentage}vw; padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));"
    role="dialog"
    aria-modal="true"
    aria-labelledby="slideover-headline"
    bind:this={slideover}>
    {#if title}
      <div class="slideover-title-row">
        <h3 class="slideover-title" id="slideover-headline">
          {@render title()}
        </h3>
        <button
          onclick={on_close}
          type="button"
          class="btn-ghost slideover-close"
          aria-label="Close">
          <IconMdiClose style="font-size: 1.125rem" />
        </button>
      </div>
    {/if}

    {@render heading?.()}

    <div class="slideover-body">
      {@render children?.()}
    </div>
  </div>
</div>

<style>
  .slideover-root {
    position: fixed;
    top: 0;
    bottom: 0;
    display: flex;
  }
  .side-right {
    right: 0;
  }
  .side-left {
    left: 0;
  }
  .slideover-backdrop-wrap {
    position: fixed;
    inset: 0;
    transition-property: opacity;
  }
  .slideover-backdrop {
    position: absolute;
    inset: 0;
    background: black;
    opacity: 0.25;
  }
  .slideover-card {
    background: var(--background);
    overflow: hidden;
    box-shadow:
      0 20px 25px -5px rgb(0 0 0 / 0.1),
      0 8px 10px -6px rgb(0 0 0 / 0.1);
    transform: translateZ(0);
    transition: all 0.15s;
    height: 100%;
    display: flex;
    flex-direction: column;
    z-index: 1;
  }
  .slideover-title-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  .slideover-title {
    font-size: 1.125rem;
    font-weight: 500;
    color: var(--color);
    padding: 0.75rem;
    flex: 1;
    min-width: 0;
  }
  .slideover-close {
    padding: 0.75rem;
    flex-shrink: 0;
  }
  .slideover-body {
    flex: 1;
    overflow-y: auto;
  }
</style>
