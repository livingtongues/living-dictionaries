<script lang="ts">
  import { getContext } from 'svelte';
  import type { InstantSearch } from 'instantsearch.js';
  const search: InstantSearch = getContext('search');

  import Hits from '$lib/components/search/Hits.svelte';
  import Pagination from '$lib/components/search/Pagination.svelte';
  import { HTMLTemplate, dictionaryFields } from '@living-dictionaries/parts';
  import type { ISpeaker } from '@living-dictionaries/types';
  import { dictionary, isManager } from '$lib/stores';

  import { configure } from 'instantsearch.js/es/widgets/index.js';
  import { onMount } from 'svelte';
  onMount(() => {
    search.addWidgets([
      configure({
        hitsPerPage: 300,
      }),
    ]);
  });
  let speakers:ISpeaker[];


  let columnWidth = 250;
  $: columnWidthEm = columnWidth / 16;

  let headwordSize = 5;
  let fontSize = 1;
  let imageSize = 100;

  const selectedFields = {
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
    id: false,
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
    hideLabels: false
  };
</script>

<svelte:head>
  <title>{$dictionary.name}</title>
</svelte:head>

<button 
  class="print:hidden fixed z-2 right-2 md:right-60 px-6 py-2 bg-blue-500 font-medium text-sm hover:bg-blue-600 outline-none text-gray-100 rounded" 
  type="button" 
  on:click={() => window.print()}>
  <span class="i-fa-file-pdf-o" /> Print
</button>
<Hits {search} let:entries>
  <div class="print:hidden bg-light-100 fixed z-1 md:top-22 top-8 p-4 rounded-lg dynamic-width">
    <input type="range" min="150" max="800" bind:value={columnWidth} />
    <div
      class="bg-red-50 p-1 border-red-400 border-t border-l border-r overflow-hidden"
      style="width: {columnWidthEm}em">
      Minimum column width: {columnWidth}px
    </div>
    <div class="my-2">
      <div class="mb-3">
        <label class="font-medium text-gray-700" for="headwordSize">Headword size</label>
        <input class="form-input w-17" id="headwordSize" type="number" min="1" max="10" bind:value={headwordSize} />
      </div>
      <div class="mb-3">
        <label class="font-medium text-gray-700" for="fontSize">Font size</label>
        <input class="form-input w-17" id="fontSize" type="number" min="0.1" step="0.1" bind:value={fontSize} />
      </div>
      <div class="mb-3">
        <label class="font-medium text-gray-700" for="imageSize">Image Size</label>
        <input class="form-input w-17" id="imageSize" type="number" min="1" max="100" bind:value={imageSize} /><span class="font-medium text-gray-700">%</span>
      </div>
      <div>
        {#each Object.entries(selectedFields) as field}
          {#if entries.find((entry) => entry[field[0]]) || field[0] === 'qrCode' || field[0] === 'hideLabels'}
            <span title={field[0] === 'qrCode' ? 'QR codes might take a bit longer to appear' : ''}>
              {' • '}
              <input id={field[0]} type="checkbox" bind:checked={selectedFields[field[0]]} />  
              <label class="text-sm font-medium text-gray-700" for={field[0]}>{dictionaryFields[field[0]]}</label>
            </span>
          {/if}
        {/each}
      </div>
    </div>
    <hr />
  </div>
  <!-- Wait for Jacob's feedback, because this is not an optimal solution -->
  <div class="print:hidden mt-80 px-2" style="column-count:{Math.floor(708/columnWidth)}; column-gap: 50px; word-break: break-word;">
    {#each entries as entry (entry.id)}
      <HTMLTemplate {headwordSize} {fontSize} {imageSize} {entry} {selectedFields} {speakers} dictionaryId={$dictionary.id} />
    {/each}
  </div>
  <div class="hidden print:block print-columns max-w-[50%] print:max-w-[100%]" style="--column-width: {columnWidthEm}em;">
    {#each entries as entry (entry.id)}
      <HTMLTemplate {headwordSize} {fontSize} {imageSize} {entry} {selectedFields} {speakers} dictionaryId={$dictionary.id} />
    {/each}
  </div>
</Hits>
<Pagination {search} />

<style global>
  .dynamic-width {
    width: calc(100% - 445px);
  }
  @media screen and (max-width: 768px) {
    .dynamic-width {
      width: 100%;
    }
  }
  @media print {
    .print-columns {
      column-width: var(--column-width);
      /* column-gap: 2em; << default is 1em */
      /* column-count: 2; << hard-coded columns method, not using */
    }
  }
</style>
