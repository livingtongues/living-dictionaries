<script lang="ts">
  import { page } from '$app/state'
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import { portal } from './portal'
  import { trapFocus } from './trapFocus'

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
    const previouslyFocused = typeof document !== 'undefined' && (document.activeElement as HTMLElement)
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
    if (e.key === 'Escape')
      return on_close()
    if (e.key === 'Tab')
      trapFocus(e, modal)
  }} />

<div
  use:portal
  class="fixed inset-0 sm:p-4 flex items-center justify-center"
  style="z-index: {z_index};">
  <div class="fixed inset-0 transition-opacity" transition:fade={{ duration }}>
    <button type="button" class="absolute inset-0 bg-black opacity-50" onclick={on_close}></button>
  </div>

  <div
    transition:fade={{ duration }}
    class="{classes} bg-white sm:rounded-lg overflow-hidden shadow-xl transform
      transition-all sm:max-w-lg w-full lt-sm:h-full sm:max-h-full flex flex-col z-1"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-headline"
    bind:this={modal}>
    <div class="p-4 sm:p-6 overflow-y-auto flex-1" class:lt-sm:pt-54px={page.data.platform !== 'web'}>
      {#if heading}
        <div class="flex">
          <h3 class="text-lg leading-6 font-medium text-gray-900 flex-grow" id="modal-headline">
            {@render heading()}
          </h3>
          <button
            onclick={on_close}
            type="button"
            class="h-12 w-12 -m-4 flex justify-center items-center text-gray-400 hover:text-gray-700 focus:outline-none
              focus:text-gray-700 focus:ring-2 rounded"
            aria-label="Close">
            <span class="i-fa-solid-times"></span>
          </button>
        </div>
      {/if}
      <div class:mt-2={show_x}>
        {@render children?.()}
      </div>
    </div>
  </div>
</div>

<style>
  /* allows us to use portal and keep the footer inside the form element */
  :global(.modal-footer) {
    @apply -m-4 sm:-m-6 mt-4 sm:mt-6 px-4 py-3 sm:px-6 bg-gray-50 flex flex-wrap justify-end;
  }

  :global(.modal-footer > :not([hidden]) ~ :not([hidden])) {
    --tw-space-x-reverse: 0;
    margin-right: calc(0.25rem * var(--tw-space-x-reverse));
    margin-left: calc(0.25rem * calc(1 - var(--tw-space-x-reverse)));
  }
</style>
