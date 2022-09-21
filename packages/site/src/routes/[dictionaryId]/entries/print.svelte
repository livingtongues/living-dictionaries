<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { getContext } from 'svelte';
  import { configure } from 'instantsearch.js/es/widgets/index.js';
  import { preferredSettings } from '$lib/stores';
  import type { InstantSearch } from 'instantsearch.js';
  const search: InstantSearch = getContext('search');

  import Hits from '$lib/components/search/Hits.svelte';
  import Pagination from '$lib/components/search/Pagination.svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import { HTMLTemplate, dictionaryFields } from '@living-dictionaries/parts';
  import { dictionary, isManager } from '$lib/stores';
  import { browser } from '$app/env';

  let hitsPerPage = 50;
  $: if (browser) {
    search.addWidgets([
      configure({
        hitsPerPage,
      }),
    ]);
  }

  let headwordSize = 12;
  let fontSize = 12;
  let imagePercent = 50;
  let columnCount = 2;

  const selectedFields = $preferredSettings?.selectedFields ? $preferredSettings?.selectedFields :  {
    lo: true,
    lo2: true,
    lo3: true,
    lo4: true,
    lo5: true,
    ph: true,
    ps: true,
    gl: true,
    xv: true,
    xs: true,
    sr: false,
    sd: false,
    mr: false,
    in: false,
    nc: false,
    pl: false,
    va: false,
    di: false,
    nt: false,
    sf: false,
    vfs: false,
    pf: true,
    qrCode: false,
    id: false,
    hideLabels: false,
  };
</script>

<svelte:head>
  <title>{$dictionary.name}</title>
</svelte:head>

<Hits {search} let:entries>
  <div class="print:hidden bg-white md:sticky z-1 md:top-22 py-3">
    <div class="flex flex-wrap mb-1">
      <Button class="mb-1 mr-2" form="filled" type="button" onclick={() => window.print()}>
        <span class="i-fa-print -mt-1" /> Print
      </Button>

      <div class="mb-1 mr-2">
        <label class="font-medium text-gray-700" for="maxEntries">Max Entries</label>
        <input
          class="form-input text-sm w-17"
          id="maxEntries"
          type="number"
          min="1"
          max={$isManager ? 1000 : 300}
          bind:value={hitsPerPage} />
        <!-- Algolia hard max per page is 1000 -->
      </div>
      <div class="mb-1 mr-2">
        <label class="font-medium text-gray-700" for="columnCount">Column count</label>
        <input
          class="form-input text-sm w-17"
          id="columnCount"
          type="number"
          min="1"
          max="10"
          bind:value={columnCount} />
      </div>
      <div class="mb-1 mr-2">
        <label class="font-medium text-gray-700" for="headwordSize">Headword size (pt)</label>
        <input
          class="form-input text-sm w-17"
          id="headwordSize"
          type="number"
          min="6"
          max="30"
          bind:value={headwordSize} />
      </div>
      <div class="mb-1 mr-2">
        <label class="font-medium text-gray-700" for="fontSize">Font size (pt)</label>
        <input
          class="form-input text-sm w-15"
          id="fontSize"
          type="number"
          min="6"
          max="24"
          bind:value={fontSize} />
      </div>
      <div class="mb-1 mr-2">
        <label class="font-medium text-gray-700" for="imageSize">Images:</label>
        <input
          class="form-input text-sm w-17"
          id="imageSize"
          type="number"
          min="1"
          max="100"
          bind:value={imagePercent} /><span class="font-medium text-gray-700">%</span>
      </div>
      {#each Object.entries(selectedFields) as field}
        {#if entries.find((entry) => entry[field[0]]) || field[0] === 'qrCode' || field[0] === 'hideLabels'}
          <div class="flex items-center mr-3 mb-1">
            <input id={field[0]} type="checkbox" bind:checked={selectedFields[field[0]]} />
            <label class="ml-1 text-sm text-gray-700" for={field[0]}
              >{$_(`entry.${[field[0]]}`, {default: dictionaryFields[field[0]]})}</label>
          </div>
        {/if}
      {/each}
    </div>
  </div>

  <div class="hidden print:block text-lg mb-5">
    {$dictionary.name}
    {$_('misc.LD_singular', { default: 'Living Dictionary' })}
  </div>

  <div
    class="print-columns"
    style="--column-count: {columnCount}">
    {#each entries as entry (entry.id)}
      <HTMLTemplate
        {headwordSize}
        {fontSize}
        {imagePercent}
        {entry}
        {selectedFields}
        dictionaryId={$dictionary.id} />
    {/each}
  </div>

  <div class="mt-5 text-xs" style="direction: ltr;">
    {new Date().getFullYear()}.
    {$dictionary.name}
    <span>{$_('misc.LD_singular', { default: 'Living Dictionary' })}.</span>
    Living Tongues Institute for Endangered Languages. https://livingdictionaries.app/{$dictionary.id}
  </div>
</Hits>
<Pagination {search} />

<style>
  .print-columns {
    /* column-width: var(--column-width); */
    /* column-gap: 2em; << default is 1em */
    column-count: var(--column-count);
  }
  /* https://medium.com/@Idan_Co/the-ultimate-print-html-template-with-header-footer-568f415f6d2a */
</style>
