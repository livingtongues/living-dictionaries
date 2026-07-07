<script lang="ts">
  import type { EntryData, IColumn, Tables } from '$lib/types'
  import ColumnTitle from './ColumnTitle.svelte'
  import Cell from './Cell.svelte'
  import { setUpColumns } from './set-up-columns'
  import { minutes_ago_in_ms } from '$lib/utils/time'
  import { browser } from '$app/environment'
  import type { DbOperations } from '$lib/db-operations'

  interface Props {
    entries?: EntryData[]
    can_edit?: boolean
    dictionary: Tables<'dictionaries'>
    preferred_table_columns: IColumn[]
    db_operations: DbOperations
  }

  const {
    entries = [],
    can_edit = false,
    dictionary,
    preferred_table_columns,
    db_operations,
  }: Props = $props()

  const columns = $derived(setUpColumns(preferred_table_columns, dictionary))
  let selectedColumn: IColumn = $state()

  function getLeftValue(index: number) {
    if (index === 0) return 0
    return columns[index - 1].width
  }

  const isFirefox = browser && /Firefox/i.test(navigator.userAgent)
</script>

<div
  class="table-wrap"
  style="height: calc(100vh - 189px);">
  <table><tbody>
    <tr class="header-row">
      {#each columns as column, i (i)}
        <th
          onclick={() => {
            selectedColumn = column
          }}
          class:sticky-col={column.sticky}
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
        {#each columns as column, i (i)}
          <td
            class:recently-updated={updated_within_last_5_minutes}
            class:sticky-cell={column.sticky}
            class:zero-height={!isFirefox}
            style="{column.sticky
              ? `left:${getLeftValue(i)}px; --border-right-width: 3px;`
              : ''} --col-width: {entry.main.sources ? 'auto' : `${column.width}px`};">
            <Cell
              {column}
              {entry}
              {can_edit}
              {db_operations} />
          </td>
        {/each}
      </tr>
    {/each}
  </tbody></table>
</div>

{#if selectedColumn}
  {#await import('./ColumnAdjustSlideover.svelte') then { default: ColumnAdjustSlideover }}
    <ColumnAdjustSlideover
      {selectedColumn}
      on_close={() => {
        selectedColumn = null
      }} />
  {/await}
{/if}

<style>
  .table-wrap {
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1); /* shadow */
    border-radius: 0.25rem;
    flex: 1 1 0%;
    margin-bottom: 0.25rem;
    border: 1px solid color-mix(in srgb, var(--background), var(--color) 38%); /* ≈ gray-400 */
    white-space: nowrap;
    overflow: auto;
    position: relative;
  }

  table {
    --col-width: 100px;
    --border-right-width: 1px;
    border-collapse: separate; /* Don't collapse to keep sticky borders in place on scroll */
    border-spacing: 0;
    position: relative;
  }

  .header-row {
    text-align: left;
  }

  th {
    border-bottom-width: 3px;
    padding: 0.125em 0.25em;
    cursor: pointer;
    background-color: var(--surface); /* ≈ gray-100 */
    top: 0;
    position: sticky;
    z-index: 1;
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 600;
  }

  th:hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%); /* ≈ gray-200 */
  }

  th:active {
    background-color: color-mix(in srgb, var(--background), var(--color) 18%); /* ≈ gray-300 */
  }

  th.sticky-col {
    z-index: 10;
  }

  .sticky-cell {
    position: sticky;
    background-color: var(--background);
    z-index: 1;
  }

  .zero-height {
    height: 0;
  }

  td.recently-updated {
    background-color: color-mix(in srgb, var(--background), var(--success) 22%) !important; /* ≈ green-100 in light (still loses to .row-hover:hover td below, same as uno) */
  }

  td {
    border-bottom: 1px solid color-mix(in srgb, var(--background), var(--color) 20%);
    padding: 0;
  }

  td,
  th {
    border-right: var(--border-right-width) solid color-mix(in srgb, var(--background), var(--color) 20%);
    overflow: hidden;
    width: var(--col-width);
    min-width: var(--col-width);
    max-width: var(--col-width);
  }

  .row-hover:hover td {
    background-color: color-mix(in srgb, var(--background), var(--color) 5%) !important;
  }
</style>
