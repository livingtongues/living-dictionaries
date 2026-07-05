<script lang="ts">
  import type { EntryData, IPrintFields, PartnerWithPhoto, Tables } from '$lib/types'
  import { onMount } from 'svelte'
  import { build_citation } from '../contributors/build-citation'
  import PrintEntry from './print/PrintEntry.svelte'
  import PrintFieldCheckboxes from './print/PrintFieldCheckboxes.svelte'
  import { defaultPrintFields } from './print/print-fields'
  import { truncateAuthors } from './print/truncate-authors'
  import Button from '$lib/components/ui/Button.svelte'
  import { createPersistedStore } from '$lib/state/persisted-store'
  import type { QueryParamStore } from '$lib/state/query-param-state.svelte'
  import { page } from '$app/state'
  import type { QueryParams } from '$lib/search/types'
  import { api_dictionaries_partners_get } from '$api/dictionaries/[id]/partners/_call'
  import IconFaPrint from '~icons/fa/print'

  interface Props {
    search_params: QueryParamStore<QueryParams>
    entries?: EntryData[]
    dictionary: Tables<'dictionaries'>
    can_edit?: boolean
  }

  const {
    search_params,
    entries = [],
    dictionary,
    can_edit = false,
  }: Props = $props()

  const print_per_page = 100
  let partners: PartnerWithPhoto[] = $state([])

  onMount(() => {
    api_dictionaries_partners_get(dictionary.id).then(data => partners = data)
    $search_params.page = 1
    $search_params.entries_per_page = print_per_page
    return () => $search_params.entries_per_page = null
  })

  const visitor_max_entries = 300

  const preferredPrintFields = createPersistedStore<IPrintFields>('printFields_11.8.2023', defaultPrintFields)
  const headwordSize = createPersistedStore<number>('printHeadwordSize', 12)
  const fontSize = createPersistedStore<number>('printFontSize', 12)
  const imagePercent = createPersistedStore<number>('printImagePercent', 50)
  const columnCount = createPersistedStore<number>('printColumnCount', 2)
  const showLabels = createPersistedStore<boolean>('printShowLabels', true)
  const showQrCode = createPersistedStore<boolean>('showQrCode', false)
</script>

{#if dictionary.print_access || can_edit}
  <div class="print-toolbar">
    <div class="controls-row">
      <Button class="print-button" form="filled" type="button" onclick={() => window.print()}>
        <IconFaPrint class="icon-inline" style="margin-top: -0.25rem" />
        {page.data.t('entry.print')}
      </Button>

      <div class="control">
        <label for="maxEntries">{page.data.t('print.max_entries')}</label>
        <input
          class="number-input"
          id="maxEntries"
          type="number"
          min="1"
          max={can_edit ? 1000000 : visitor_max_entries}
          bind:value={$search_params.entries_per_page} />
      </div>
      <div class="control">
        <label for="columnCount">{page.data.t('print.columns')}</label>
        <input
          class="number-input"
          id="columnCount"
          type="number"
          min="1"
          max="10"
          bind:value={$columnCount} />
      </div>
      <div class="control">
        <label for="headwordSize">{page.data.t('print.headword_size')} (pt)</label>
        <input
          class="number-input"
          id="headwordSize"
          type="number"
          min="6"
          max="30"
          bind:value={$headwordSize} />
      </div>
      <div class="control">
        <label for="fontSize">{page.data.t('print.font_size')} (pt)</label>
        <input
          class="number-input narrow"
          id="fontSize"
          type="number"
          min="6"
          max="24"
          bind:value={$fontSize} />
      </div>
      <div class="control">
        <label for="imageSize">{page.data.t('misc.images')}:</label>
        <input
          class="number-input"
          id="imageSize"
          type="number"
          min="1"
          max="100"
          bind:value={$imagePercent} /><span class="percent-label">%</span>
      </div>
      <PrintFieldCheckboxes {entries} {preferredPrintFields} {showLabels} {showQrCode} />
    </div>
  </div>

  <div class="print-title">
    {dictionary.name}
    {page.data.t('misc.LD_singular')}
  </div>

  <div class="print-layout">
    <div
      class="print-columns"
      style="--column-count: {$columnCount}">
      {#each entries as entry (entry.id)}
        <PrintEntry
          headwordSize={$headwordSize}
          fontSize={$fontSize}
          imagePercent={$imagePercent}
          {entry}
          showQrCode={$showQrCode}
          showLabels={$showLabels}
          selectedFields={$preferredPrintFields}
          {dictionary} />
      {/each}
    </div>
    <div
      dir="ltr"
      class="citation"
      style="writing-mode: tb; min-width: 0;">
      {build_citation({ t: page.data.t, dictionary, custom_citation: truncateAuthors(dictionary.citation), partners })}
    </div>
  </div>
{:else}
  <p>Print view is only available to dictionary managers and contributors</p>
{/if}

<style>
  .print-toolbar {
    background-color: var(--background);
    z-index: 1;
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
  }

  @media (min-width: 768px) {
    .print-toolbar {
      position: sticky;
      top: 5.5rem;
    }
  }

  .controls-row {
    display: flex;
    flex-wrap: wrap;
    margin-bottom: 0.25rem;
  }

  .controls-row :global(.print-button) {
    margin-bottom: 0.25rem;
    margin-right: 0.5rem;
  }

  .control {
    margin-bottom: 0.25rem;
    margin-right: 0.5rem;
  }

  .control label,
  .percent-label {
    font-weight: 500;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
  }

  .number-input {
    font-size: 0.875rem;
    line-height: 1.25rem;
    width: 4.25rem; /* w-17 */
  }

  .number-input.narrow {
    width: 3.75rem; /* w-15 */
  }

  .print-title {
    display: none;
    font-size: 1.5rem;
    line-height: 2rem;
    margin-bottom: 1.25rem;
  }

  .print-layout {
    display: flex;
    overflow-x: hidden;
  }

  .print-columns {
    /* column-width: var(--column-width); */
    /* column-gap: 2em; << default is 1em */
    column-count: var(--column-count);
    overflow-wrap: break-word;
    padding-right: 1rem;
    max-width: 100%;
    flex-grow: 1;
  }

  .citation {
    font-size: 0.75rem;
    line-height: 1rem;
    right: 0;
    top: 0;
    bottom: 0;
  }

  @media print {
    .print-toolbar {
      display: none;
    }

    .print-title {
      display: block;
    }

    .print-layout {
      display: block;
    }

    .print-columns {
      padding-right: 2.25rem;
    }

    .citation {
      position: fixed;
      text-align: center;
    }
  }
  /* https://medium.com/@Idan_Co/the-ultimate-print-html-template-with-header-footer-568f415f6d2a */
</style>
