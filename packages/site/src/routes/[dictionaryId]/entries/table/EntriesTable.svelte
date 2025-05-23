<script lang="ts">
  import type { EntryData, IColumn, Tables } from '@living-dictionaries/types'
  import ColumnTitle from './ColumnTitle.svelte'
  import Cell from './Cell.svelte'
  import { setUpColumns } from './setUpColumns'
  import { minutes_ago_in_ms } from '$lib/helpers/time'
  import { browser } from '$app/environment'
  import type { DbOperations } from '$lib/dbOperations'

  export let entries: EntryData[] = []
  export let can_edit = false
  export let dictionary: Tables<'dictionaries'>
  export let preferred_table_columns: IColumn[]
  export let dbOperations: DbOperations

  $: columns = setUpColumns(preferred_table_columns, dictionary)
  let selectedColumn: IColumn

  function getLeftValue(index: number) {
    if (index === 0) return 0
    return columns[index - 1].width
  }

  const isFirefox = browser && /Firefox/i.test(navigator.userAgent)
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
            selectedColumn = column
          }}
          class:z-10={column.sticky}
          class="cursor-pointer bg-gray-100 top-0 sticky z-1
            hover:bg-gray-200 active:bg-gray-300 text-xs font-semibold"
          style="{column.sticky
            ? `left:${getLeftValue(i)}px; --border-right-width: 3px;`
            : ''} --col-width: {column.width}px;">
          <ColumnTitle {column} />
        </th>
      {/each}
    </tr>
    {#each entries as entry (entry.id)}
      {@const updated_within_last_5_minutes = can_edit && new Date(entry.updated_at).getTime() > minutes_ago_in_ms(5)}
      <tr class="row-hover">
        {#each columns as column, i}
          <td
            class:bg-green-100!={updated_within_last_5_minutes}
            class="{column.sticky ? 'sticky bg-white z-1' : ''} {isFirefox ? '' : 'h-0'}"
            style="{column.sticky
              ? `left:${getLeftValue(i)}px; --border-right-width: 3px;`
              : ''} --col-width: {entry.main.sources ? 'auto' : `${column.width}px`};">
            <Cell
              {column}
              {entry}
              {can_edit}
              {dbOperations} />
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
        selectedColumn = null
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
