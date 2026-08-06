<script lang="ts">
  import { onMount } from 'svelte'
  import { flip } from 'svelte/animate'
  import type { IColumn } from '$lib/types'
  import ColumnTitle from './ColumnTitle.svelte'
  import Slideover from '$lib/components/ui/Slideover.svelte'
  import { page } from '$app/state'
  import IconMdiDrag from '~icons/mdi/drag'
  import IconTeenyiconsThumbtackSolid from '~icons/teenyicons/thumbtack-solid'
  import IconTeenyiconsThumbtackOutline from '~icons/teenyicons/thumbtack-outline'
  import IconStreamlineEyeOff from '~icons/streamline/interface-edit-view-off-disable-eye-eyeball-hide-off-view'
  import IconStreamlineEye from '~icons/streamline/interface-edit-view-eye-eyeball-open-view'

  interface Props {
    selectedColumn?: IColumn | null
    on_close: () => void
  }

  const { selectedColumn = null, on_close }: Props = $props()
  const { preferred_table_columns } = $derived(page.data)

  let selectedColumnElement: HTMLElement = $state()
  let list_element: HTMLElement = $state()
  let drag_index: number | null = $state(null)

  onMount(() => {
    if (selectedColumnElement) {
      selectedColumnElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  })

  // Pointer-based drag-sort (works for touch + mouse). The list mutates live so
  // `animate:flip` shows the reorder as you drag; lexeme stays locked at 0.
  function start_drag(event: PointerEvent, index: number) {
    if (index === 0) return
    event.preventDefault()
    drag_index = index
    const move = (move_event: PointerEvent) => {
      if (drag_index === null || !list_element) return
      const items = [...list_element.querySelectorAll('li')]
      let target = drag_index
      items.forEach((item, item_index) => {
        if (item_index === drag_index) return
        const rect = item.getBoundingClientRect()
        const midpoint = rect.top + rect.height / 2
        if (item_index < drag_index && move_event.clientY < midpoint) target = Math.min(target, item_index)
        if (item_index > drag_index && move_event.clientY > midpoint) target = Math.max(target, item_index)
      })
      target = Math.max(1, target)
      if (target !== drag_index) {
        const columns = preferred_table_columns.value
        const [moved] = columns.splice(drag_index, 1)
        columns.splice(target, 0, moved)
        drag_index = target
      }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      drag_index = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }
</script>

<Slideover {on_close}>
  {#snippet title()}
    <span>{page.data.t('column.adjust_columns')}</span>
  {/snippet}

  <ul bind:this={list_element}>
    {#each preferred_table_columns.value as column, i (column.field)}
      <li
        animate:flip={{ duration: 150 }}
        class:selected={selectedColumn === column}
        class:dragging={drag_index === i}>
        <div class="row">
          {#if i > 0}
            <button
              type="button"
              class="drag-handle"
              aria-label={page.data.t('column.adjust_columns')}
              onpointerdown={event => start_drag(event, i)}>
              <IconMdiDrag />
            </button>
          {:else}
            <div class="drag-handle-spacer"></div>
          {/if}

          <div style="flex: 1 1 0%">
            <div class="title-row">
              <ColumnTitle verbose={true} {column} />
              <div style="margin-right: auto"></div>
              {#if i === 0}
                <button
                  type="button"
                  onclick={() => (column.sticky = !column.sticky)}
                  class="round-button no-shrink">
                  {#if column.sticky}
                    <IconTeenyiconsThumbtackSolid />
                  {:else}
                    <IconTeenyiconsThumbtackOutline />
                  {/if}
                </button>
              {/if}
              <button
                type="button"
                onclick={() => (column.hidden = !column.hidden)}
                class="round-button no-shrink">
                {#if column.hidden}
                  <IconStreamlineEyeOff />
                {:else}
                  <IconStreamlineEye />
                {/if}
              </button>
            </div>
            <!-- Source range input shouldn't be here because we need to show complete sources and they can be very long -->
            {#if column.field !== 'sources'}
              <div class="width-row">
                <input
                  style="flex: 1 1 0%"
                  type="range"
                  bind:value={column.width}
                  min="31"
                  max="400" />
                <span class="width-value">{column.width}px</span>
              </div>
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

<style>
  li ~ li {
    border-top-width: 1px; /* divide-y (the old divid-gray-200 was a typo that generated nothing — color is the reset default) */
  }

  li {
    padding: 0.5rem;
    background-color: var(--background);
  }

  li.selected {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%); /* ≈ gray-200 */
  }

  li:hover {
    background-color: var(--surface); /* ≈ gray-100 */
  }

  li.dragging {
    background-color: color-mix(in srgb, var(--primary) 8%, var(--background));
  }

  .row {
    display: flex;
    align-items: center;
  }

  .drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2.5rem;
    margin-right: 0.5rem;
    border: none;
    background: transparent;
    color: color-mix(in srgb, var(--color) 45%, var(--background));
    cursor: grab;
    touch-action: none;
  }

  .drag-handle:active {
    cursor: grabbing;
    color: var(--color-secondary);
  }

  .drag-handle-spacer {
    width: 2rem;
    margin-right: 0.5rem;
  }

  .title-row {
    display: flex;
    align-items: baseline;
  }

  .width-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .width-value {
    flex-shrink: 0;
    min-width: 3.25rem;
    text-align: end;
    font-size: 0.75rem;
    color: var(--color-secondary);
    font-variant-numeric: tabular-nums;
  }

  .round-button {
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
    color: color-mix(in srgb, var(--color) 45%, var(--background)); /* ≈ gray-400 */
    border-radius: 9999px;
  }

  .round-button:hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%); /* ≈ gray-200 */
    color: var(--color-secondary); /* ≈ gray-500 */
  }

  .round-button:focus {
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
    outline: 2px solid transparent;
    outline-offset: 2px;
  }

  .no-shrink {
    flex-shrink: 0;
  }
</style>
