<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ExpandedEntry, IColumn } from '@living-dictionaries/types';
  import ColumnTitle from './ColumnTitle.svelte';
  import Cell from './Cell.svelte';
  import { minutesAgo } from '$lib/helpers/time';

  export let columns: IColumn[];
  export let entries: ExpandedEntry[] = [];
  export let canEdit = false;
  export let dictionaryId: string;

  let selectedColumn: IColumn;

  function getLeftValue(index: number) {
    if (index === 0) return 0;
    return columns[index - 1].width;
  }

  const dispatch = createEventDispatcher<{
    deleteImage: { entryId: string };
    valueupdate: { field: string; newValue: string | string[]; entryId: string };
  }>();

  const isFirefox = /Firefox/i.test(navigator.userAgent);
</script>

<div
  class="shadow rounded flex-1 mb-1 border border-gray-400 whitespace-nowrap
    overflow-auto relative"
  style="height: calc(100vh - 189px);">
  <table class="relative">
    <tr class="text-left">
      {#each columns as column, i}
        <th
          on:click={() => {
            selectedColumn = column;
          }}
          class:z-10={column.sticky}
          class="cursor-pointer bg-gray-100 top-0 sticky
            hover:bg-gray-200 active:bg-gray-300 text-xs font-semibold"
          style="{column.sticky
            ? 'left:' + getLeftValue(i) + 'px; --border-right-width: 3px;'
            : ''} --col-width: {column.width}px;">
          <ColumnTitle {column} />
        </th>
      {/each}
    </tr>
    {#each entries as entry (entry.id)}
      <tr class="row-hover">
        {#each columns as column, i}
          <td
            class:bg-green-100={canEdit && entry.ua?.toMillis?.() > minutesAgo(5)}
            class="{column.sticky ? 'sticky bg-white z-1' : ''} {isFirefox ? '' : 'h-0'}"
            style="{column.sticky
              ? 'left:' + getLeftValue(i) + 'px; --border-right-width: 3px;'
              : ''} --col-width: {entry.sources ? 'auto' : `${column.width}px`};">
            <Cell {column} {entry} {canEdit} {dictionaryId} on:deleteImage={() => dispatch('deleteImage', { entryId: entry.id})} on:valueupdate={({detail: {field, newValue}}) => dispatch('valueupdate', { field, newValue, entryId: entry.id })} />
          </td>
        {/each}
      </tr>
    {/each}
  </table>
</div>

{#if selectedColumn}
  {#await import('./ColumnAdjustSlideover.svelte') then { default: ColumnAdjustSlideover }}
    <ColumnAdjustSlideover
      {selectedColumn}
      on:close={() => {
        selectedColumn = null;
      }} />
  {/await}
{/if}

<style>
  table {
    --col-width: 100px;
    --border-right-width: 1px;
    border-collapse: separate; /* Don't collapse to keep sticky borders in place on scroll */
    border-spacing: 0;
  }

  th {
    border-bottom-width: 3px;
    padding: 0.125em 0.25em;
  }

  td {
    border-bottom: 1px solid #ccc;
    padding: 0;
  }

  td,
  th {
    border-right: var(--border-right-width) solid #ccc;
    overflow: hidden;
    width: var(--col-width);
    min-width: var(--col-width);
    max-width: var(--col-width);
  }

  .row-hover:hover td {
    background-color: rgba(244, 245, 247, 1) !important;
  }
</style>
