<script lang="ts">
  import type { IEntry } from '$lib/interfaces';
  export let entries: IEntry[] = [];
  import ColumnTitle from './ColumnTitle.svelte';

  import { columns } from '$lib/stores';
  import Cell from './Cell.svelte';
  import { isManager, isContributor } from '$lib/stores';

  let adjustColumns = false;
  let selectedColumn;

  function getLeftValue(index: number) {
    if (index === 0) {
      return 0;
    } else {
      return $columns[index - 1].width;
    }
  }
</script>

<div
  class="shadow rounded flex-1 mb-1 border border-gray-400 whitespace-nowrap
    overflow-auto relative"
  style="height: calc(100vh - 189px);">
  <table class="relative">
    <tr class="text-left">
      {#each $columns as column, i}
        <th
          on:click={() => {
            selectedColumn = column;
            adjustColumns = true;
          }}
          class="{column.sticky ? 'z-10' : ''} cursor-pointer bg-gray-100 top-0 sticky
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
        {#each $columns as column, i}
          <!-- TODO: retore class:bg-green-100={entry.updatedAt < 2Minutes} -->
          <td
            class="{column.sticky ? 'sticky bg-white' : ''} h-0"
            style="{column.sticky
              ? 'left:' + getLeftValue(i) + 'px; --border-right-width: 3px;'
              : ''} --col-width: {column.width}px;">
            <Cell {column} {entry} canEdit={$isManager || $isContributor} />
          </td>
        {/each}
      </tr>
    {:else}
      <!-- <tr>
        <td colspan="20"><i>No results</i></td>
      </tr> -->
    {/each}
  </table>
</div>

{#if adjustColumns}
  {#await import('$lib/components/table/ColumnAdjustSlideover.svelte') then { default: ColumnAdjustSlideover }}
    <ColumnAdjustSlideover
      {selectedColumn}
      on:close={() => {
        adjustColumns = null;
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
