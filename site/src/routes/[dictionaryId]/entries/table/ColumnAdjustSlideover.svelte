<script lang="ts">
  import { onMount } from 'svelte'
  import { flip } from 'svelte/animate'
  import { fade } from 'svelte/transition'
  import type { IColumn } from '$lib/types'
  import ColumnTitle from './ColumnTitle.svelte'
  import { Slideover } from '$lib/svelte-pieces'
  import { page } from '$app/state'
  import IconFa6SolidChevronUp from '~icons/fa6-solid/chevron-up'
  import IconFa6SolidChevronDown from '~icons/fa6-solid/chevron-down'
  import IconTeenyiconsThumbtackSolid from '~icons/teenyicons/thumbtack-solid'
  import IconTeenyiconsThumbtackOutline from '~icons/teenyicons/thumbtack-outline'
  import IconStreamlineEyeOff from '~icons/streamline/interface-edit-view-off-disable-eye-eyeball-hide-off-view'
  import IconStreamlineEye from '~icons/streamline/interface-edit-view-eye-eyeball-open-view'

  interface Props {
    selectedColumn: IColumn
  }

  const { selectedColumn }: Props = $props()
  const { preferred_table_columns } = $derived(page.data)

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

<Slideover on:close>
  {#snippet title()}
    <span>{page.data.t('column.adjust_columns')}</span>
  {/snippet}

  <ul>
    {#each $preferred_table_columns as column, i (column.field)}
      <li
        animate:flip
        class:selected={selectedColumn === column}>
        <div class="row">
          <div class="move-col">
            {#if i > 1}
              <button
                type="button"
                onclick={() => move(i, 'up')}
                class="round-button">
                <IconFa6SolidChevronUp class="icon-inline" />
              </button>
            {/if}
            {#if i > 0 && i !== $preferred_table_columns.length - 1}
              <button
                type="button"
                onclick={() => move(i, 'down')}
                class="round-button">
                <IconFa6SolidChevronDown class="icon-inline" />
              </button>
            {/if}
          </div>

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
                    <IconTeenyiconsThumbtackSolid class="icon-inline" />
                  {:else}
                    <IconTeenyiconsThumbtackOutline class="icon-inline" />
                  {/if}
                </button>
              {/if}
              <button
                type="button"
                onclick={() => (column.hidden = !column.hidden)}
                class="round-button no-shrink">
                {#if column.hidden}
                  <IconStreamlineEyeOff class="icon-inline" />
                {:else}
                  <IconStreamlineEye class="icon-inline" />
                {/if}
              </button>
            </div>
            <!-- Source range input shouldn't be here because we need to show complete sources and they can be very long -->
            {#if column.field !== 'sources'}
              <input
                style="width: 100%"
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
    class="width-toast">
    <div class="width-bubble">
      {page.data.t('column.width')}:
      {widthToDisplay}
    </div>
  </div>
{/if}

<!-- in:fly={{ delay: 0, duration: 300, x: 0, y: 50, opacity: 0.1, easing: backOut }}
out:fade={{ duration: 500, opacity: 0 }} -->

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

  .row {
    display: flex;
    align-items: center;
  }

  .move-col {
    display: flex;
    flex-direction: column;
    margin-right: 0.5rem;
  }

  .title-row {
    display: flex;
    align-items: baseline;
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

  .width-toast {
    position: fixed;
    left: 0;
    right: 0;
    top: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.25rem;
    pointer-events: none;
    z-index: 60;
  }

  .width-bubble {
    background-color: rgb(0 0 0 / 0.75);
    color: #fff;
    margin-top: 0.5rem;
    padding: 0.75rem;
    border-radius: 0.25rem;
    max-width: 24rem;
  }
</style>
