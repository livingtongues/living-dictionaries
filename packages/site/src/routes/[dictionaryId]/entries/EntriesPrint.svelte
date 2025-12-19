<script lang="ts">
  import { Button, type QueryParamStore, createPersistedStore } from 'svelte-pieces'
  import type { EntryData, IPrintFields, PartnerWithPhoto, Tables } from '@living-dictionaries/types'
  import { onMount } from 'svelte'
  import { build_citation } from '../contributors/build-citation'
  import PrintEntry from './print/PrintEntry.svelte'
  import PrintFieldCheckboxes from './print/PrintFieldCheckboxes.svelte'
  import { defaultPrintFields } from './print/printFields'
  import { truncateAuthors } from './print/truncateAuthors'
  import { page } from '$app/stores'
  import type { QueryParams } from '$lib/search/types'

  interface Props {
    search_params: QueryParamStore<QueryParams>;
    entries?: EntryData[];
    dictionary: Tables<'dictionaries'>;
    can_edit?: boolean;
  }

  let {
    search_params,
    entries = [],
    dictionary,
    can_edit = false
  }: Props = $props();

  const print_per_page = 100
  let partners: PartnerWithPhoto[] = $state([])
  let { dictionary_info } = $derived($page.data)

  onMount(() => {
    $page.data.load_partners().then(data => partners = data)
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
  <div class="print:hidden bg-white md:sticky z-1 md:top-22 py-3">
    <div class="flex flex-wrap mb-1">
      <Button class="mb-1 mr-2" form="filled" type="button" onclick={() => window.print()}>
        <span class="i-fa-print -mt-1"></span>
        {$page.data.t('entry.print')}
      </Button>

      <div class="mb-1 mr-2">
        <label class="font-medium text-gray-700" for="maxEntries">{$page.data.t('print.max_entries')}</label>
        <input
          class="form-input text-sm w-17"
          id="maxEntries"
          type="number"
          min="1"
          max={can_edit ? 1000000 : visitor_max_entries}
          bind:value={$search_params.entries_per_page} />
      </div>
      <div class="mb-1 mr-2">
        <label class="font-medium text-gray-700" for="columnCount">{$page.data.t('print.columns')}</label>
        <input
          class="form-input text-sm w-17"
          id="columnCount"
          type="number"
          min="1"
          max="10"
          bind:value={$columnCount} />
      </div>
      <div class="mb-1 mr-2">
        <label class="font-medium text-gray-700" for="headwordSize">{$page.data.t('print.headword_size')} (pt)</label>
        <input
          class="form-input text-sm w-17"
          id="headwordSize"
          type="number"
          min="6"
          max="30"
          bind:value={$headwordSize} />
      </div>
      <div class="mb-1 mr-2">
        <label class="font-medium text-gray-700" for="fontSize">{$page.data.t('print.font_size')} (pt)</label>
        <input
          class="form-input text-sm w-15"
          id="fontSize"
          type="number"
          min="6"
          max="24"
          bind:value={$fontSize} />
      </div>
      <div class="mb-1 mr-2">
        <label class="font-medium text-gray-700" for="imageSize">{$page.data.t('misc.images')}:</label>
        <input
          class="form-input text-sm w-17"
          id="imageSize"
          type="number"
          min="1"
          max="100"
          bind:value={$imagePercent} /><span class="font-medium text-gray-700">%</span>
      </div>
      <PrintFieldCheckboxes {entries} {preferredPrintFields} {showLabels} {showQrCode} />
    </div>
  </div>

  <div class="hidden print:block text-2xl mb-5">
    {dictionary.name}
    {$page.data.t('misc.LD_singular')}
  </div>

  <div class="flex print:block overflow-x-hidden">
    <div
      class="print-columns pr-4 print:pr-9 max-w-full flex-grow"
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
      class="text-xs print:fixed print:text-center right-0 top-0 bottom-0"
      style="writing-mode: tb; min-width: 0;">
      {build_citation({ t: $page.data.t, dictionary, custom_citation: truncateAuthors($dictionary_info.citation), partners })}
    </div>
  </div>
{:else}
  <p>Print view is only available to dictionary managers and contributors</p>
{/if}

<style>
  .print-columns {
    /* column-width: var(--column-width); */
    /* column-gap: 2em; << default is 1em */
    column-count: var(--column-count);
    overflow-wrap: break-word;
  }
  /* https://medium.com/@Idan_Co/the-ultimate-print-html-template-with-header-footer-568f415f6d2a */
</style>
