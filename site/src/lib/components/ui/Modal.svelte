<script lang="ts">
  import IconMdiClose from '~icons/mdi/close'
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import { portal } from '$lib/utils/portal'
  import { trap_focus } from '$lib/utils/trap-focus'

  interface Props {
    class?: string
    noscroll?: boolean
    zIndex?: number
    duration?: number
    on_close: () => void
    show_x?: boolean
    heading?: import('svelte').Snippet
    children?: import('svelte').Snippet
  }

  const {
    class: classes = '',
    noscroll = false,
    zIndex: z_index = 60,
    duration = 200,
    on_close,
    show_x = true,
    heading,
    children,
  }: Props = $props()

  let modal: HTMLElement = $state()

  onMount(() => {
    const previously_focused = typeof document !== 'undefined' && (document.activeElement as HTMLElement)
    if (noscroll)
      document.body.style.overflow = 'hidden'

    return () => {
      if (previously_focused) {
        previously_focused.focus()
        document.body.style.overflow = 'auto'
      }
    }
  })
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape')
      return on_close()
    if (e.key === 'Tab')
      trap_focus(e, modal)
  }} />

<div
  use:portal
  class="modal-root"
  style="z-index: {z_index};">
  <div class="modal-backdrop-wrap" transition:fade={{ duration }}>
    <button type="button" class="modal-backdrop" aria-label="Close modal" onclick={on_close}></button>
  </div>

  <div
    transition:fade={{ duration }}
    class={['modal-card', classes]}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-headline"
    bind:this={modal}>
    <div class="modal-body">
      {#if heading || show_x}
        <div class="modal-heading-row">
          <h3 class="modal-heading" id="modal-headline">
            {@render heading?.()}
          </h3>
          {#if show_x}
            <button
              onclick={on_close}
              type="button"
              class="btn-ghost modal-close"
              aria-label="Close">
              <IconMdiClose />
            </button>
          {/if}
        </div>
      {/if}
      <div class:modal-content-spacing={show_x}>
        {@render children?.()}
      </div>
    </div>
  </div>
</div>

<style>
  .modal-root {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .modal-backdrop-wrap {
    position: fixed;
    inset: 0;
    transition-property: opacity;
  }
  .modal-backdrop {
    position: absolute;
    inset: 0;
    background: black;
    opacity: 0.5;
  }
  .modal-card {
    background: var(--background);
    overflow: hidden;
    box-shadow:
      0 20px 25px -5px rgb(0 0 0 / 0.1),
      0 8px 10px -6px rgb(0 0 0 / 0.1);
    transform: translateZ(0);
    transition: all 0.15s;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    z-index: 1;
  }
  .modal-body {
    padding: 1rem;
    overflow-y: auto;
    flex: 1;
  }
  .modal-heading-row {
    display: flex;
  }
  .modal-heading {
    font-size: 1.125rem; /* text-lg */
    line-height: 1.5rem; /* leading-6 (overrides text-lg's line-height) */
    font-weight: 500;
    color: var(--color);
    flex-grow: 1;
  }
  .modal-close {
    padding: 0.75rem;
    margin: -0.75rem;
  }
  .modal-content-spacing {
    margin-top: 0.5rem;
  }
  @media (min-width: 640px) {
    .modal-root {
      padding: 1rem;
    }
    .modal-card {
      border-radius: 0.5rem;
      max-width: 32rem; /* sm:max-w-lg */
      height: auto;
      max-height: 100%;
    }
    .modal-body {
      padding: 1.5rem;
    }
  }

  /* Footer slot — author marks a child element with class="modal-footer" to get
     the standard bottom-bar treatment: edge-to-edge background, right-aligned
     button row. Uses :global() so the consumer's element matches even though
     this <style> is scoped. */
  :global(.modal-footer) {
    margin: -1rem;
    margin-top: 1rem;
    padding: 0.75rem 1rem;
    background: var(--surface);
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  @media (min-width: 640px) {
    :global(.modal-footer) {
      margin: -1.5rem;
      margin-top: 1.5rem;
      padding: 0.75rem 1.5rem;
    }
  }
</style>
