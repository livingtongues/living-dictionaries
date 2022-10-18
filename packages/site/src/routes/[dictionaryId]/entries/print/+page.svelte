<script lang="ts">
  import { t } from 'svelte-i18n';
  import { getContext } from 'svelte';
  import { configure } from 'instantsearch.js/es/widgets/index.js';
  import type { InstantSearch } from 'instantsearch.js';
  const search: InstantSearch = getContext('search');

  import Hits from '$lib/components/search/Hits.svelte';
  import Pagination from '$lib/components/search/Pagination.svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import { createPersistedStore } from 'svelte-pieces/stores/persisted';
  import { PrintEntry, defaultPrintFields } from '@living-dictionaries/parts';
  import { dictionary, isManager, canEdit } from '$lib/stores';
  import { browser } from '$app/environment';
  import type { IPrintFields } from '@living-dictionaries/types';
  import PrintFieldCheckboxes from './PrintFieldCheckboxes.svelte';

  const hitsPerPage = createPersistedStore<number>('printHitsPerPage', 50);
  $: if (browser) {
    search.addWidgets([
      configure({
        hitsPerPage: $hitsPerPage,
      }),
    ]);
  }

  const preferredPrintFields = createPersistedStore<IPrintFields>(
    'printFields_10.18.2022',
    defaultPrintFields
  );
  const headwordSize = createPersistedStore<number>('printHeadwordSize', 12);
  const fontSize = createPersistedStore<number>('printFontSize', 12);
  const imagePercent = createPersistedStore<number>('printImagePercent', 50);
  const columnCount = createPersistedStore<number>('printColumnCount', 2);
  const showLabels = createPersistedStore<boolean>('printShowLabels', true);
  const showQrCode = createPersistedStore<boolean>('showQrCode', false);
</script>

<svelte:head>
  <title>{$dictionary.name}</title>
</svelte:head>

{#if $dictionary.printAccess || $canEdit}
  <Hits {search} let:entries>
    <div class="print:hidden bg-white md:sticky z-1 md:top-22 py-3">
      <div class="flex flex-wrap mb-1">
        <Button class="mb-1 mr-2" form="filled" type="button" onclick={() => window.print()}>
          <span class="i-fa-print -mt-1" />
          {$t('entry.print', { default: 'Print' })}
        </Button>

        <div class="mb-1 mr-2">
          <label class="font-medium text-gray-700" for="maxEntries">Max Entries</label>
          <input
            class="form-input text-sm w-17"
            id="maxEntries"
            type="number"
            min="1"
            max={$isManager ? 1000 : 300}
            bind:value={$hitsPerPage} />
          <!-- Algolia hard max per page is 1000 -->
        </div>
        <div class="mb-1 mr-2">
          <label class="font-medium text-gray-700" for="columnCount">Columns</label>
          <input
            class="form-input text-sm w-17"
            id="columnCount"
            type="number"
            min="1"
            max="10"
            bind:value={$columnCount} />
        </div>
        <div class="mb-1 mr-2">
          <label class="font-medium text-gray-700" for="headwordSize">Headword size (pt)</label>
          <input
            class="form-input text-sm w-17"
            id="headwordSize"
            type="number"
            min="6"
            max="30"
            bind:value={$headwordSize} />
        </div>
        <div class="mb-1 mr-2">
          <label class="font-medium text-gray-700" for="fontSize">Font size (pt)</label>
          <input
            class="form-input text-sm w-15"
            id="fontSize"
            type="number"
            min="6"
            max="24"
            bind:value={$fontSize} />
        </div>
        <div class="mb-1 mr-2">
          <label class="font-medium text-gray-700" for="imageSize">Images:</label>
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

    <div class="hidden print:block text-lg mb-5">
      {$dictionary.name}
      {$t('misc.LD_singular', { default: 'Living Dictionary' })}
    </div>

    <div class="print-columns" style="--column-count: {$columnCount}">
      {#each entries as entry (entry.id)}
        <PrintEntry
          {t}
          headwordSize={$headwordSize}
          fontSize={$fontSize}
          imagePercent={$imagePercent}
          {entry}
          showQrCode={$showQrCode}
          showLabels={$showLabels}
          selectedFields={$preferredPrintFields}
          dictionaryId={$dictionary.id} />
      {/each}
    </div>

    <div class="mt-5 text-xs" style="direction: ltr;">
      {new Date().getFullYear()}.
      {$dictionary.name}
      <span>{$t('misc.LD_singular', { default: 'Living Dictionary' })}.</span>
      Living Tongues Institute for Endangered Languages. https://livingdictionaries.app/{$dictionary.id}
    </div>
  </Hits>
  <Pagination showAdd={false} {search} />
{:else}
  <p>
    {$t('export.print_availability', {
      default: 'Print view is only available to dictionary managers and contributors',
    })}
  </p>
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
