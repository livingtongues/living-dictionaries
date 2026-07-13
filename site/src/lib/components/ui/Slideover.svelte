<script> import { onMount } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import IconFaSolidTimes from '~icons/fa-solid/times'
  import { portal } from '$lib/utils/portal'
  import { trap_focus } from '$lib/utils/trap-focus'

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
    if (e.key === 'Tab') trap_focus(e, slideover)
  }} />

<div
  use:portal
  class="wrapper"
  class:right={side === 'right'}
  class:left={side === 'left'}
  style="z-index: {zIndex};">
  <div class="backdrop" transition:fade={{ duration }}>
    <button type="button" onclick={close} aria-label="Close"></button>
  </div>

  <div
    transition:fly={{ x: side === 'right' ? 200 : -200, duration }}
    class="panel"
    style="width: {widthRem}rem; max-width: {maxWidthPercentage}vw;"
    role="dialog"
    aria-modal="true"
    aria-labelledby="slideover-headline"
    bind:this={slideover}>
    {#if title}
      <div class="title-bar">
        <h3 class="title" id="slideover-headline">
          {@render title()}
        </h3>
        <button
          onclick={close}
          type="button"
          class="close-button"
          aria-label="Close">
          <IconFaSolidTimes style="font-size: 1.125rem" /></button>
      </div>
    {/if}

    {@render heading?.()}

    <div class="content">
      {@render children?.()}
    </div>
  </div>
</div>

<!-- Design Inspiration: https://bt-voice-memos.appspot.com/create -->
<!-- About blog: https://aerotwist.com/blog/voice-memos/ -->

<style>
  .wrapper {
    position: fixed;
    top: 0;
    bottom: 0;
    display: flex;
  }

  .wrapper.right {
    right: 0;
  }

  .wrapper.left {
    left: 0;
  }

  .backdrop {
    position: fixed;
    inset: 0;
  }

  .backdrop button {
    position: absolute;
    inset: 0;
    background-color: rgb(0 0 0);
    opacity: 0.25;
  }

  .panel {
    z-index: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background-color: var(--background);
    box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
  }

  .title-bar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    border-bottom: 1px solid color-mix(in srgb, var(--color) 18%, transparent);
  }

  .title {
    padding: 0.75rem;
    font-size: 1.125rem;
    line-height: 1.75rem;
    color: var(--color);
    font-weight: 500;
  }

  .close-button {
    display: flex;
    padding: 1rem 0.75rem;
    color: color-mix(in srgb, var(--color) 50%, transparent);
    transition: color 150ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .close-button:hover,
  .close-button:focus {
    color: var(--color-secondary);
  }

  .close-button:focus {
    outline: 2px solid transparent;
    outline-offset: 2px;
  }

  .content {
    flex: 1;
    overflow-y: auto;
  }
</style>
