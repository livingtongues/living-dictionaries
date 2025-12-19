<script lang="ts">
  import { page } from '$app/state'
  import { onMount } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import { portal } from './portal'
  import { trapFocus } from './trapFocus'

  interface Props {
    zIndex?: number
    duration?: number
    side?: 'left' | 'right'
    widthRem?: number
    maxWidthPercentage?: number
    on_close: () => void
    title?: import('svelte').Snippet
    heading?: import('svelte').Snippet
    children?: import('svelte').Snippet
  }

  const {
    zIndex = 60,
    duration = 200,
    side = 'right',
    widthRem = 16,
    maxWidthPercentage = 70,
    on_close,
    title,
    heading,
    children,
  }: Props = $props()

  let slideover: HTMLElement = $state()

  onMount(() => {
    const previouslyFocused
      = typeof document !== 'undefined' && (document.activeElement as HTMLElement)

    return () => {
      if (previouslyFocused) {
        previouslyFocused.focus()
      }
    }
  })
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape')
      return on_close()
    if (e.key === 'Tab')
      trapFocus(e, slideover)
  }} />

<div
  use:portal
  class:right-0={side === 'right'}
  class:left-0={side === 'left'}
  class:pt-54px={page.data.platform !== 'web'}
  class="fixed inset-y-0 flex"
  style="z-index: {zIndex};">
  <div class="fixed inset-0 transition-opacity" transition:fade={{ duration }}>
    <button type="button" class="absolute inset-0 bg-black opacity-25" onclick={on_close}></button>
  </div>

  <div
    transition:fly={{ x: side === 'right' ? 200 : -200, duration }}
    class="bg-white overflow-hidden shadow-xl transform
      transition-all w-64 h-full flex flex-col z-1"
    style="width: {widthRem}rem; max-width: {maxWidthPercentage}vw;"
    role="dialog"
    aria-modal="true"
    aria-labelledby="slideover-headline"
    bind:this={slideover}>
    {#if title}
      <div class="flex items-start justify-between border-b border-gray-300">
        {#if title}
          <h3 class="text-lg font-medium text-gray-900 p-3" id="slideover-headline">
            {@render title()}
          </h3>
        {/if}
        <button
          onclick={on_close}
          type="button"
          class="text-gray-400 px-3 py-4 flex hover:text-gray-500 focus:outline-none
            focus:text-gray-500 transition ease-in-out duration-150"
          aria-label="Close">
          <span class="i-fa-solid-times text-lg"></span>
        </button>
      </div>
    {/if}

    {@render heading?.()}

    <div class="flex-1 overflow-y-auto">
      {@render children?.()}
    </div>
  </div>
</div>

<!-- Modal classes: https://tailwindui.com/components/application-ui/overlays/modals -->
<!-- Design Inspiration: https://bt-voice-memos.appspot.com/create -->
<!-- About blog: https://aerotwist.com/blog/voice-memos/ -->
