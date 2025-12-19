<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    onclick?: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) => void
    onx?: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) => void
    href?: string
    target?: '_blank' | ''
    size?: 'sm' | 'lg'
    color?: 'red' | 'orange' | 'green' | 'gray' | string
    active?: boolean
    class?: string
    children?: Snippet
  }

  const {
    onclick = undefined,
    onx = undefined,
    href = undefined,
    target = '',
    size = 'sm',
    color = undefined,
    active = false,
    class: classes = '',
    children,
  }: Props = $props()
</script>

{#if href}
  <a {href} {target} rel="noopener noreferrer" data-sveltekit-prefetch class:active class="{classes} {size} {color}">
    {@render children?.()}
    {#if onx}
      <span class="w-2"></span>
      <button type="button" onclick={(e) => { e.preventDefault(); onx(e) }} class="badge-x" aria-label="Remove">
        <svg class="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
          <path stroke-linecap="round" stroke-width="1.5" d="M1 1l6 6m0-6L1 7" />
        </svg>
      </button>
    {:else if target === '_blank'}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4 ml-1 inline"
        viewBox="0 0 20 20"
        fill="currentColor">
        <path
          d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
        <path
          d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
      </svg>
    {/if}
  </a>
{:else if onclick}
  <button type="button" {onclick} class:active class="{classes} {size} {color}">
    {@render children?.()}
    {#if onx}
      <span class="w-2"></span>
      <button type="button" onclick={(e) => { e.stopPropagation(); onx(e) }} class="badge-x" aria-label="Remove">
        <svg class="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
          <path stroke-linecap="round" stroke-width="1.5" d="M1 1l6 6m0-6L1 7" />
        </svg>
      </button>
    {/if}
  </button>
{:else}
  <div class:active class="{classes} {size} {color}">
    {@render children?.()}
    {#if onx}
      <span class="w-2"></span>
      <button type="button" {onclick} class="badge-x" aria-label="Remove">
        <svg class="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
          <path stroke-linecap="round" stroke-width="1.5" d="M1 1l6 6m0-6L1 7" />
        </svg>
      </button>
    {/if}
  </div>
{/if}

<style>
  a,
  button:not(.badge-x),
  div {
    --at-apply: inline-flex items-center py-1 px-2 rounded-md text-xs font-medium;
    --at-apply: bg-blue-100 text-blue-800;
  }
  .red {
    --at-apply: bg-red-100 text-red-800;
  }
  .orange {
    --at-apply: bg-orange-100 text-orange-800;
  }
  .green {
    --at-apply: bg-green-100 text-green-800;
  }
  .gray {
    --at-apply: bg-gray-100 text-gray-800;
  }
  .badge-x {
    --at-apply: text-blue-400 hover:bg-blue-200 hover:text-blue-500 focus:bg-blue-500;
    --at-apply: flex-shrink-0 h-4 w-4 rounded-full inline-flex items-center justify-center focus:outline-none focus:text-white -mx-1;
  }
  .red .badge-x {
    --at-apply: text-red-400 hover:bg-red-200 hover:text-red-500 focus:bg-red-500 focus:text-white;
  }
  .orange .badge-x {
    --at-apply: text-orange-400 hover:bg-orange-200 hover:text-orange-500 focus:bg-orange-500 focus:text-white;
  }
  .green .badge-x {
    --at-apply: text-green-400 hover:bg-green-200 hover:text-green-500 focus:bg-green-500 focus:text-white;
  }
  .gray .badge-x {
    --at-apply: text-gray-400 hover:bg-gray-200 hover:text-gray-500 focus:bg-gray-500 focus:text-white;
  }
</style>
