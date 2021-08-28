<script lang="ts">
  import { _ } from 'svelte-i18n';

  import Slideover from '$lib/components/ui/Slideover.svelte';
  import { preferredColumns } from '$lib/stores';
  import type { IColumn } from '$lib/interfaces';

  export let selectedColumn: IColumn;
  let selectedColumnElement: HTMLElement;
  onMount(() => {
    if (selectedColumnElement) {
      selectedColumnElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  });

  import ColumnTitle from './ColumnTitle.svelte';

  import { fade } from 'svelte/transition';
  let widthToDisplay;
  let widthDisplayTimeout;
  function showWidth(e) {
    const target: EventTarget & HTMLInputElement = e.target;
    widthToDisplay = target.value;
    // widthToDisplay = (<HTMLInputElement>e.target).value;
    clearTimeout(widthDisplayTimeout);
    widthDisplayTimeout = setTimeout(() => {
      widthToDisplay = null;
    }, 2000);
  }

  function move(i: number, direction: 'up' | 'down') {
    const columnBeingMoved = $preferredColumns.splice(i, 1);
    $preferredColumns.splice(direction === 'up' ? i - 1 : i + 1, 0, ...columnBeingMoved);
    $preferredColumns = $preferredColumns; // trigger Svelte reactivity;
  }
  import { flip } from 'svelte/animate';
  import { onMount } from 'svelte';
</script>

<Slideover on:close>
  <span slot="heading">{$_('column.adjust_columns', { default: 'Adjust Columns' })}</span>

  <ul class="divide-y divid-gray-200">
    {#each $preferredColumns as column, i (column.field)}
      <li
        animate:flip
        class="p-2 bg-white hover:bg-gray-100"
        class:bg-gray-200={selectedColumn === column}>
        <div class="flex items-center">
          <div class="flex flex-col mr-2">
            {#if i > 1}
              <button
                type="button"
                on:click={() => move(i, 'up')}
                class="w-8 h-8 flex items-center justify-center hover:bg-gray-200 transition ease-in-out duration-150 text-gray-400 hover:text-gray-500 focus:text-gray-700 rounded-full focus:outline-none">
                <i class="far fa-chevron-up" />
              </button>
            {/if}
            {#if i > 0 && i !== $preferredColumns.length - 1}
              <button
                type="button"
                on:click={() => move(i, 'down')}
                class="w-8 h-8 flex items-center justify-center hover:bg-gray-200 transition ease-in-out duration-150 text-gray-400 hover:text-gray-500 focus:text-gray-700 rounded-full focus:outline-none">
                <i class="far fa-chevron-down" />
              </button>
            {/if}
          </div>

          <div class="flex-1">
            <div class="flex items-baseline">
              <ColumnTitle verbose={true} {column} />
              <div class="mr-auto" />
              {#if i === 0}
                <button
                  type="button"
                  on:click={() => (column.sticky = !column.sticky)}
                  class="w-8 h-8 flex-shrink-0 flex items-center justify-center hover:bg-gray-200 transition ease-in-out duration-150 text-gray-400 hover:text-gray-500 focus:text-gray-700 rounded-full focus:outline-none">
                  {#if column.sticky}
                    <i class="fas fa-thumbtack" />
                  {:else}<i class="far fa-thumbtack" />{/if}
                </button>
              {/if}
              <button
                type="button"
                on:click={() => (column.hidden = !column.hidden)}
                class="w-8 h-8 flex-shrink-0 flex items-center justify-center hover:bg-gray-200 transition ease-in-out duration-150 text-gray-400 hover:text-gray-500 focus:text-gray-700 rounded-full focus:outline-none">
                {#if column.hidden}
                  <i class="far fa-eye-slash" />
                {:else}<i class="far fa-eye" />{/if}
              </button>
            </div>

            <input
              class="w-full"
              type="range"
              on:input={showWidth}
              bind:value={column.width}
              min="31"
              max="400" />
          </div>
        </div>
        {#if selectedColumn === column}
          <div bind:this={selectedColumnElement} />
        {/if}
      </li>
    {/each}
  </ul>
</Slideover>

{#if widthToDisplay}
  <div
    transition:fade
    class="fixed inset-x-0 top-0 flex flex-col items-center p-1 pointer-events-none"
    style="z-index: 60;">
    <div class="bg-black bg-opacity-75 text-white mt-2 p-3 rounded max-w-sm">
      {$_('column.width', { default: 'Width' })}:
      {widthToDisplay}
    </div>
  </div>
{/if}

<!-- in:fly={{ delay: 0, duration: 300, x: 0, y: 50, opacity: 0.1, easing: backOut }}
out:fade={{ duration: 500, opacity: 0 }} -->
