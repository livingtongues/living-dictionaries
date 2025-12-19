<script lang="ts">
  import Slideover from './Slideover.svelte'

  interface Props {
    zIndex?: number
    duration?: number
    side?: 'left' | 'right'
    widthRem?: number
    maxWidthPercentage?: number
    showWidth: 'sm' | 'md' | 'lg' | 'xl'
    desktopClasses?: string
    mobileClasses?: string
    open?: boolean
    on_close?: () => void
    desktopTitle?: import('svelte').Snippet
    mobileTitle?: import('svelte').Snippet
    desktopHeading?: import('svelte').Snippet
    mobileHeading?: import('svelte').Snippet
    heading?: import('svelte').Snippet
    children?: import('svelte').Snippet
  }

  const {
    zIndex = 60,
    duration = 200,
    side = 'right',
    widthRem = 16,
    maxWidthPercentage = 70,
    showWidth,
    desktopClasses = '',
    mobileClasses = '',
    open = false,
    on_close = undefined,
    desktopTitle,
    mobileTitle,
    desktopHeading,
    mobileHeading,
    heading,
    children,
  }: Props = $props()
</script>

<div
  class:sm:block={showWidth === 'sm'}
  class:md:block={showWidth === 'md'}
  class:lg:block={showWidth === 'lg'}
  class:xl:block={showWidth === 'xl'}
  class="hidden {desktopClasses}">
  {#if desktopTitle}
    <h3 class="text-lg font-medium text-gray-900 p-3 border-b border-gray-300">
      {@render desktopTitle()}
    </h3>
  {/if}
  {@render desktopHeading?.()}
  {@render heading?.()}
  {@render children?.()}
</div>

{#if open}
  <div
    class:lt-sm:block={showWidth === 'sm'}
    class:lt-md:block={showWidth === 'md'}
    class:lt-lg:block={showWidth === 'lg'}
    class:lt-xl:block={showWidth === 'xl'}
    class="hidden {mobileClasses}">
    <Slideover
      {duration}
      {zIndex}
      {side}
      {widthRem}
      {maxWidthPercentage}
      {on_close}>
      {#snippet heading()}
        {#if mobileTitle}
          <div class="flex items-start justify-between border-b border-gray-300">
            <h3 class="text-lg font-medium text-gray-900 p-3" id="modal-headline">
              {@render mobileTitle()}
            </h3>
            <button
              onclick={on_close}
              type="button"
              class="text-gray-400 px-3 py-4 flex hover:text-gray-500 focus:outline-none
    focus:text-gray-500 transition ease-in-out duration-150"
              aria-label="Close">
              <span class="i-fa-solid-times text-lg"></span></button>
          </div>
        {/if}
        {@render mobileHeading?.()}
        {@render heading?.()}
      {/snippet}
      {@render children?.()}
    </Slideover>
  </div>
{/if}
