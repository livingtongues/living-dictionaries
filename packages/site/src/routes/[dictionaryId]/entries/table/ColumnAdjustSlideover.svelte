<script lang="ts">
  import { onMount } from 'svelte'
  import { flip } from 'svelte/animate'
  import { fade } from 'svelte/transition'
  import { Slideover } from '$lib/svelte-pieces'
  import type { IColumn } from '@living-dictionaries/types'
  import ColumnTitle from './ColumnTitle.svelte'
  import { page } from '$app/state'

  interface Props {
    selectedColumn: IColumn;
    on_close: () => void;
  }

  let { selectedColumn, on_close }: Props = $props();
  let { preferred_table_columns } = $derived(page.data)

  let selectedColumnElement: HTMLElement = $state()
  let widthToDisplay: string = $state()
  let widthDisplayTimeout

  onMount(() => {
    if (selectedColumnElement) {
      selectedColumnElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  })

  function showWidth(e) {
    const { target } = e
    widthToDisplay = target.value
    clearTimeout(widthDisplayTimeout)
    widthDisplayTimeout = setTimeout(() => {
      widthToDisplay = null
    }, 2000)
  }

  function move(i: number, direction: 'up' | 'down') {
    const columnBeingMoved = $preferred_table_columns.splice(i, 1)
    $preferred_table_columns.splice(direction === 'up' ? i - 1 : i + 1, 0, ...columnBeingMoved)
    $preferred_table_columns = $preferred_table_columns // trigger Svelte reactivity;
  }
</script>

<Slideover {on_close}>
  {#snippet title()}{page.data.t('column.adjust_columns')}{/snippet}

  <ul class="divide-y divid-gray-200">
    {#each $preferred_table_columns as column, i (column.field)}
      <li
        animate:flip
        class="p-2 bg-white hover:bg-gray-100"
        class:bg-gray-200={selectedColumn === column}>
        <div class="flex items-center">
          <div class="flex flex-col mr-2">
            {#if i > 1}
              <button
                type="button"
                onclick={() => move(i, 'up')}
                class="w-8 h-8 flex items-center justify-center hover:bg-gray-200 transition ease-in-out duration-150 text-gray-400 hover:text-gray-500 focus:text-gray-700 rounded-full focus:outline-none">
                <span class="i-fa6-solid-chevron-up"></span>
              </button>
            {/if}
            {#if i > 0 && i !== $preferred_table_columns.length - 1}
              <button
                type="button"
                onclick={() => move(i, 'down')}
                class="w-8 h-8 flex items-center justify-center hover:bg-gray-200 transition ease-in-out duration-150 text-gray-400 hover:text-gray-500 focus:text-gray-700 rounded-full focus:outline-none">
                <span class="i-fa6-solid-chevron-down"></span>
              </button>
            {/if}
          </div>

          <div class="flex-1">
            <div class="flex items-baseline">
              <ColumnTitle verbose={true} {column} />
              <div class="mr-auto"></div>
              {#if i === 0}
                <button
                  type="button"
                  onclick={() => (column.sticky = !column.sticky)}
                  class="w-8 h-8 flex-shrink-0 flex items-center justify-center hover:bg-gray-200 transition ease-in-out duration-150 text-gray-400 hover:text-gray-500 focus:text-gray-700 rounded-full focus:outline-none">
                  {#if column.sticky}
                    <span class="i-teenyicons-thumbtack-solid"></span>
                  {:else}
                    <span class="i-teenyicons-thumbtack-outline"></span>
                  {/if}
                </button>
              {/if}
              <button
                type="button"
                onclick={() => (column.hidden = !column.hidden)}
                class="w-8 h-8 flex-shrink-0 flex items-center justify-center hover:bg-gray-200 transition ease-in-out duration-150 text-gray-400 hover:text-gray-500 focus:text-gray-700 rounded-full focus:outline-none">
                {#if column.hidden}
                  <span class="i-streamline-interface-edit-view-off-disable-eye-eyeball-hide-off-view"></span>
                {:else}
                  <span class="i-streamline-interface-edit-view-eye-eyeball-open-view"></span>
                {/if}
              </button>
            </div>
            <!-- Source range input shouldn't be here because we need to show complete sources and they can be very long -->
            {#if column.field !== 'sources'}
              <input
                class="w-full"
                type="range"
                oninput={showWidth}
                bind:value={column.width}
                min="31"
                max="400" />
            {/if}
          </div>
        </div>
        {#if selectedColumn === column}
          <div bind:this={selectedColumnElement}></div>
        {/if}
      </li>
    {/each}
  </ul>
</Slideover>

{#if widthToDisplay}
  <div
    transition:fade
    class="fixed inset-x-0 top-0 flex flex-col items-center p-1 pointer-events-none z-60">
    <div class="bg-black bg-opacity-75 text-white mt-2 p-3 rounded max-w-sm">
      {page.data.t('column.width')}:
      {widthToDisplay}
    </div>
  </div>
{/if}

<!-- in:fly={{ delay: 0, duration: 300, x: 0, y: 50, opacity: 0.1, easing: backOut }}
out:fade={{ duration: 500, opacity: 0 }} -->
