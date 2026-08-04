<script lang="ts">
  import type { EntryData, IColumn, Tables } from '$lib/types'
  import ColumnTitle from './ColumnTitle.svelte'
  import Cell from './Cell.svelte'
  import { set_up_columns } from './set-up-columns'
  import { SENSE_FIELDS } from './sense-fields'
  import { apply_reorder, MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH, resolve_gap_index } from './column-drag'
  import { get_entry_selection } from './entry-selection.svelte'
  import BulkActionBar from './BulkActionBar.svelte'
  import { default_columns } from '$lib/utils/default-columns'
  import { minutes_ago_in_ms } from '$lib/utils/time'
  import { page } from '$app/state'
  import { browser } from '$app/environment'
  import Popover from '$lib/components/ui/Popover.svelte'
  import type { GuardedWrites } from '$lib/db/dict-client/guarded-writes'
  import IconFaSolidPlus from '~icons/fa-solid/plus'
  import IconStreamlineEyeOff from '~icons/streamline/interface-edit-view-off-disable-eye-eyeball-hide-off-view'
  import IconTeenyiconsThumbtackSolid from '~icons/teenyicons/thumbtack-solid'
  import IconTeenyiconsThumbtackOutline from '~icons/teenyicons/thumbtack-outline'
  import IconMdiArrowExpandHorizontal from '~icons/mdi/arrow-expand-horizontal'
  import IconMdiTableCog from '~icons/mdi/table-cog'

  interface Props {
    entries?: EntryData[]
    can_edit?: boolean
    dictionary: Tables<'dictionaries'>
    preferred_table_columns: IColumn[]
    writes: GuardedWrites
  }

  const {
    entries = [],
    can_edit = false,
    dictionary,
    preferred_table_columns,
    writes,
  }: Props = $props()

  const columns = $derived(set_up_columns(preferred_table_columns, dictionary))
  let selectedColumn: IColumn = $state()
  let show_adjust = $state(false)

  // Bulk-selection basket (editors only) — survives searching/paging, feeds BulkActionBar.
  // Plain const (NOT $derived): creating the per-dict instance mutates the module map, which
  // is forbidden inside a derived — and the table remounts per dictionary anyway.
  const selection = get_entry_selection(dictionary.id)
  const { entries_data } = $derived(page.data)
  const displayed_entries = $derived.by(() => {
    if (!selection.view_selected) return entries
    const data = $entries_data || {}
    return [...selection.ids].map(id => data[id]).filter(Boolean)
  })
  const all_visible_selected = $derived(displayed_entries.length > 0 && displayed_entries.every(entry => selection.has(entry.id)))

  function toggle_all() {
    if (all_visible_selected) {
      for (const entry of displayed_entries) selection.remove(entry.id)
    } else {
      for (const entry of displayed_entries) selection.ids.add(entry.id)
    }
  }

  const SELECT_COL_WIDTH = 32
  const select_offset = $derived(can_edit ? SELECT_COL_WIDTH : 0)

  function getLeftValue(index: number) {
    if (index === 0) return select_offset
    return select_offset + columns[index - 1].width
  }

  // The sense-number badge renders once per sense row, on the first sense-scoped column.
  const first_sense_col_index = $derived(columns.findIndex(column => SENSE_FIELDS.has(column.field)))

  // ————— Desktop header interactions: drag border = resize, drag body = reorder, click = menu.
  // Coarse pointers keep the tap → Adjust Columns slideover.
  const fine_pointer = browser && window.matchMedia('(pointer: fine)').matches
  const DRAG_THRESHOLD_PX = 4

  let resizing = $state(false)
  let dragging_field: IColumn['field'] | null = $state(null)
  let drop_gap: number | null = $state(null)
  let menu_column: IColumn | null = $state(null)
  let menu_index = $state(0)
  let menu_anchor: HTMLElement | null = $state(null)

  function base_col(field: IColumn['field']) {
    return preferred_table_columns.find(column => column.field === field)
  }

  function reset_width(field: IColumn['field']) {
    const base = base_col(field)
    const default_column = default_columns.find(column => column.field === field)
    if (base && default_column) base.width = default_column.width
  }

  function start_resize(event: PointerEvent, column: IColumn) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const base = base_col(column.field)
    if (!base) return
    resizing = true
    const start_x = event.clientX
    const start_width = base.width
    const move = (move_event: PointerEvent) => {
      base.width = Math.round(Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, start_width + move_event.clientX - start_x)))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      resizing = false
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }

  function header_pointer_down(event: PointerEvent, column: IColumn, index: number) {
    if (!fine_pointer || event.button !== 0) return
    const start_x = event.clientX
    const th = event.currentTarget as HTMLElement
    const header_row = th.parentElement
    let active = false
    const move = (move_event: PointerEvent) => {
      if (!active) {
        if (Math.abs(move_event.clientX - start_x) < DRAG_THRESHOLD_PX) return
        if (column.field === 'lexeme') return // locked first
        active = true
        dragging_field = column.field
      }
      const header_cells = [...header_row.children].map(cell => cell.getBoundingClientRect())
      drop_gap = resolve_gap_index({ client_x: move_event.clientX, header_cells })
    }
    const up = (up_event: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      if (active && drop_gap !== null) {
        apply_reorder({ preferred: preferred_table_columns, expanded: columns, dragged_field: column.field, gap_index: drop_gap })
      } else if (Math.abs(up_event.clientX - start_x) < DRAG_THRESHOLD_PX) {
        menu_column = column
        menu_index = index
        menu_anchor = th
      }
      dragging_field = null
      drop_gap = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }
</script>

<div class="table-outer">
  <button
    type="button"
    class="columns-button"
    title={page.data.t('column.adjust_columns')}
    aria-label={page.data.t('column.adjust_columns')}
    onclick={() => show_adjust = true}>
    <IconMdiTableCog style="font-size: 1rem" />
  </button>
  <div
    class="table-wrap"
    class:no-select={resizing || !!dragging_field}
    style="max-height: calc(100vh - 189px);">
    <table>
      <thead>
        <tr>
          {#if can_edit}
            <th class="sticky-col select-col" style="left: 0; --col-width: {SELECT_COL_WIDTH}px;">
              <input
                type="checkbox"
                checked={all_visible_selected}
                onchange={toggle_all} />
            </th>
          {/if}
          {#each columns as column, i (i)}
            <th
              onclick={() => {
                if (!fine_pointer) selectedColumn = column
              }}
              onpointerdown={event => header_pointer_down(event, column, i)}
              class:sticky-col={column.sticky}
              class:dragging={dragging_field === column.field}
              class:drop-before={drop_gap === i}
              class:drop-after={drop_gap === columns.length && i === columns.length - 1}
              style="{column.sticky
                ? `left:${getLeftValue(i)}px; --border-right-width: 3px;`
                : ''} --col-width: {column.width}px;">
              <ColumnTitle {column} />
              {#if fine_pointer}
                <div
                  class="resize-handle"
                  onpointerdown={event => start_resize(event, column)}
                  ondblclick={() => reset_width(column.field)}>
                </div>
              {/if}
            </th>
          {/each}
        </tr>
      </thead>
      {#each displayed_entries as entry, entry_index (entry.id)}
        {@const updated_within_last_5_minutes = can_edit && new Date(entry.updated_at).getTime() > minutes_ago_in_ms(5)}
        {@const senses = entry.senses?.length ? entry.senses : [null]}
        {@const next_entry = displayed_entries[entry_index + 1]}
        {@const next_entry_row = next_entry ? { entry: next_entry, sense: next_entry.senses?.[0] || null } : null}
        <tbody class:recently-updated={updated_within_last_5_minutes}>
          {#each senses as sense, sense_index (sense?.id || entry.id)}
            {@const next_sense_row = sense_index + 1 < senses.length ? { entry, sense: senses[sense_index + 1] } : next_entry_row}
            <tr>
              {#if can_edit && sense_index === 0}
                <td
                  rowspan={senses.length}
                  class="entry-cell sticky-cell select-cell"
                  style="left: 0; --col-width: {SELECT_COL_WIDTH}px;">
                  <input
                    type="checkbox"
                    checked={selection.has(entry.id)}
                    onchange={() => selection.toggle(entry.id)} />
                </td>
              {/if}
              {#each columns as column, i (i)}
                {@const sense_scoped = SENSE_FIELDS.has(column.field)}
                {#if sense_scoped || sense_index === 0}
                  <td
                    rowspan={sense_scoped ? 1 : senses.length}
                    class:entry-cell={!sense_scoped}
                    class:sticky-cell={column.sticky}
                    style="{column.sticky
                      ? `left:${getLeftValue(i)}px; --border-right-width: 3px;`
                      : ''} --col-width: {column.field === 'sources' && entry.main.sources ? 'auto' : `${column.width}px`};">
                    {#if sense_scoped && senses.length > 1 && i === first_sense_col_index}
                      <span class="sense-num">{sense_index + 1}</span>
                    {/if}
                    <Cell
                      {column}
                      {entry}
                      {sense}
                      next_row={sense_scoped ? next_sense_row : next_entry_row}
                      {can_edit}
                      {writes} />
                    {#if can_edit && column.field === 'lexeme'}
                      <button
                        type="button"
                        class="add-sense empty-affordance"
                        title={page.data.t('sense.add')}
                        onclick={async () => await writes.insert_sense(entry.id)}>
                        <IconFaSolidPlus style="font-size: 0.625rem" />
                      </button>
                    {/if}
                  </td>
                {/if}
              {/each}
            </tr>
          {/each}
        </tbody>
      {/each}
    </table>
  </div>
</div>

{#if menu_column}
  {@const menu_base = base_col(menu_column.field)}
  <Popover anchor={menu_anchor} on_close={() => menu_column = null} max_width="14rem">
    <div class="column-menu">
      <button
        type="button"
        class="menu-item"
        onclick={() => {
          if (menu_base) menu_base.hidden = true
          menu_column = null
        }}>
        <IconStreamlineEyeOff />
        {page.data.t('column.hide')}
      </button>
      {#if menu_index === 0}
        <button
          type="button"
          class="menu-item"
          onclick={() => {
            if (menu_base) menu_base.sticky = !menu_base.sticky
            menu_column = null
          }}>
          {#if menu_base?.sticky}
            <IconTeenyiconsThumbtackSolid />
            {page.data.t('column.unpin')}
          {:else}
            <IconTeenyiconsThumbtackOutline />
            {page.data.t('column.pin')}
          {/if}
        </button>
      {/if}
      <button
        type="button"
        class="menu-item"
        onclick={() => {
          reset_width(menu_column.field)
          menu_column = null
        }}>
        <IconMdiArrowExpandHorizontal />
        {page.data.t('column.reset_width')}
      </button>
      <button
        type="button"
        class="menu-item"
        onclick={() => {
          selectedColumn = menu_column
          menu_column = null
        }}>
        <IconMdiTableCog />
        {page.data.t('column.all_columns')}
      </button>
    </div>
  </Popover>
{/if}

{#if can_edit}
  <BulkActionBar {selection} {writes} />
{/if}

{#if selectedColumn || show_adjust}
  {#await import('./ColumnAdjustSlideover.svelte') then { default: ColumnAdjustSlideover }}
    <ColumnAdjustSlideover
      {selectedColumn}
      on_close={() => {
        selectedColumn = null
        show_adjust = false
      }} />
  {/await}
{/if}

<style>
  .table-outer {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  /* Coarse-pointer entry point to Adjust Columns (headers also open it on tap, but that's
     undiscoverable). Hidden on pointer devices — they get the per-column header menu. */
  .columns-button {
    display: none;
    position: absolute;
    top: 0.3125rem;
    right: 0.3125rem;
    z-index: 40;
    width: 1.75rem;
    height: 1.75rem;
    align-items: center;
    justify-content: center;
    border: 1px solid color-mix(in srgb, var(--background), var(--color) 25%);
    border-radius: 9999px;
    background: var(--surface);
    color: var(--color-secondary);
    cursor: pointer;
  }

  @media (hover: none) {
    .columns-button {
      display: inline-flex;
    }
  }

  .table-wrap.no-select {
    user-select: none;
  }

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

  thead tr {
    text-align: left;
  }

  /* z-index ladder: cells (isolated) < sticky column < header < header corner.
     `isolation: isolate` on plain cells guarantees no cell content (thumbs, badges,
     future checkboxes) can ever paint above the sticky chrome while scrolling. */
  th {
    border-bottom-width: 3px;
    padding: 0.125em 0.25em;
    cursor: pointer;
    background-color: var(--surface); /* ≈ gray-100 */
    top: 0;
    position: sticky;
    z-index: 20;
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
    z-index: 30;
  }

  th.dragging {
    opacity: 0.45;
  }

  th.drop-before {
    box-shadow: inset 3px 0 0 var(--primary);
  }

  th.drop-after {
    box-shadow: inset -3px 0 0 var(--primary);
  }

  .resize-handle {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 8px;
    cursor: col-resize;
    z-index: 1;
    touch-action: none;
  }

  .resize-handle:hover {
    background: color-mix(in srgb, var(--primary) 35%, transparent);
  }

  .column-menu {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .column-menu .menu-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0.625rem;
    border: none;
    background: transparent;
    color: var(--color);
    font-size: 0.875rem;
    text-align: start;
    border-radius: 0.5rem;
    cursor: pointer;
  }

  .column-menu .menu-item:hover {
    background: color-mix(in srgb, var(--color) 7%, transparent);
  }

  .sticky-cell {
    position: sticky;
    background-color: var(--background);
    z-index: 10;
  }

  td {
    position: relative;
    height: 3rem;
    padding: 0;
    border-bottom: 1px dashed color-mix(in srgb, var(--background), var(--color) 20%);
  }

  td:not(.sticky-cell) {
    isolation: isolate;
  }

  /* Entry-level (rowspan) cells and the last sense row close the entry with a solid line;
     dashed lines remain only as inner sense dividers. */
  td.entry-cell,
  tbody tr:last-child td {
    border-bottom-style: solid;
  }

  tbody.recently-updated td {
    background-color: color-mix(in srgb, var(--background), var(--success) 22%) !important; /* ≈ green-100 (still loses to hover below) */
  }

  td,
  th {
    border-right: var(--border-right-width) solid color-mix(in srgb, var(--background), var(--color) 20%);
    overflow: hidden;
    width: var(--col-width);
    min-width: var(--col-width);
    max-width: var(--col-width);
  }

  tbody:hover td {
    background-color: color-mix(in srgb, var(--background), var(--color) 5%) !important;
  }

  th.select-col,
  td.select-cell {
    text-align: center;
    vertical-align: middle;
  }

  th.select-col input,
  td.select-cell input {
    display: inline-block;
    vertical-align: middle;
    cursor: pointer;
  }

  .sense-num {
    position: absolute;
    top: 1px;
    left: 1px;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 0.875rem;
    height: 0.875rem;
    padding: 0 0.1875rem;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--background) 80%, var(--color));
    color: var(--color-secondary);
    font-size: 0.625rem;
    font-weight: 600;
    pointer-events: none;
  }

  .add-sense {
    position: absolute;
    bottom: 0.125rem;
    right: 0.125rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.125rem;
    height: 1.125rem;
    border: none;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--color) 8%, transparent);
    color: var(--color-secondary);
    cursor: pointer;
  }

  .add-sense:hover {
    background: color-mix(in srgb, var(--color) 16%, transparent);
  }

  /* Media/add affordances in empty cells only surface on entry hover (pointer devices) —
     without this every empty cell renders an icon and the grid reads as noise. */
  @media (hover: hover) {
    tbody :global(.empty-affordance) {
      opacity: 0;
      transition: opacity var(--transition-time, 150ms);
    }

    tbody:hover :global(.empty-affordance) {
      opacity: 1;
    }
  }
</style>
