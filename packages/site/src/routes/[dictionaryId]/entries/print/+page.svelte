<script lang="ts">
  import { getContext } from 'svelte'
  import { configure } from 'instantsearch.js/es/widgets/index.js'
  import { Button, createPersistedStore } from 'svelte-pieces'
  import type { IPrintFields } from '@living-dictionaries/types'
  import type { InstantSearch } from 'instantsearch.js'
  import { build_citation } from '../../contributors/build-citation'
  import { defaultPrintFields } from './printFields'
  import PrintEntry from './PrintEntry.svelte'
  import PrintFieldCheckboxes from './PrintFieldCheckboxes.svelte'
  import { truncateAuthors } from './truncateAuthors'
  import Hits from '$lib/components/search/Hits.svelte'
  import Pagination from '$lib/components/search/Pagination.svelte'
  import { browser } from '$app/environment'
  import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry'
  import { page } from '$app/stores'

  export let data
  $: ({ dictionary, can_edit, is_manager, dbOperations, load_citation, load_partners } = data)

  const search: InstantSearch = getContext('search')
  const managerMaxEntries = 1000
  const defaultMaxEntries = 300

  const hitsPerPage = createPersistedStore<number>('printHitsPerPage', ($is_manager ? managerMaxEntries : defaultMaxEntries))
  $: if (browser) {
    search.addWidgets([
      configure({
        hitsPerPage: $hitsPerPage,
      }),
    ])
  }

  const preferredPrintFields = createPersistedStore<IPrintFields>('printFields_11.8.2023', defaultPrintFields)
  const headwordSize = createPersistedStore<number>('printHeadwordSize', 12)
  const fontSize = createPersistedStore<number>('printFontSize', 12)
  const imagePercent = createPersistedStore<number>('printImagePercent', 50)
  const columnCount = createPersistedStore<number>('printColumnCount', 2)
  const showLabels = createPersistedStore<boolean>('printShowLabels', true)
  const showQrCode = createPersistedStore<boolean>('showQrCode', false)
</script>

{#if $dictionary.printAccess || $can_edit}
  <Hits {search} let:entries>
    <div class="print:hidden bg-white md:sticky z-1 md:top-22 py-3">
      <div class="flex flex-wrap mb-1">
        <Button class="mb-1 mr-2" form="filled" type="button" onclick={() => window.print()}>
          <span class="i-fa-print -mt-1" />
          {$page.data.t('entry.print')}
        </Button>

        <div class="mb-1 mr-2">
          <label class="font-medium text-gray-700" for="maxEntries">{$page.data.t('print.max_entries')}</label>
          <input
            class="form-input text-sm w-17"
            id="maxEntries"
            type="number"
            min="1"
            max={$is_manager ? managerMaxEntries : defaultMaxEntries}
            bind:value={$hitsPerPage} />
          <!-- Algolia hard max per page is 1000 -->
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
        <PrintFieldCheckboxes entries={entries.map(entry => convert_and_expand_entry(entry, $page.data.t))} {preferredPrintFields} {showLabels} {showQrCode} />
      </div>
    </div>

    <div class="hidden print:block text-2xl mb-5">
      {$dictionary.name}
      {$page.data.t('misc.LD_singular')}
    </div>

    <div class="flex overflow-x-hidden">
      <div
        class="print-columns pr-4 print:pr-9 max-w-full flex-grow"
        style="--column-count: {$columnCount}">
        {#each entries as entry (entry.id)}
          <PrintEntry
            headwordSize={$headwordSize}
            fontSize={$fontSize}
            imagePercent={$imagePercent}
            entry={convert_and_expand_entry(entry, $page.data.t)}
            showQrCode={$showQrCode}
            showLabels={$showLabels}
            selectedFields={$preferredPrintFields}
            dictionary={$dictionary} />
        {/each}
      </div>
      {#await Promise.all([load_partners(), load_citation()]) then [partners, citation]}
        <div
          dir="ltr"
          class="text-xs print:fixed print:text-center right-0 top-0 bottom-0"
          style="writing-mode: tb; min-width: 0;">
          {build_citation({ t: $page.data.t, dictionary: $dictionary, custom_citation: truncateAuthors(citation?.citation), partners })}
        </div>
      {/await}
    </div>
  </Hits>
  <Pagination addNewEntry={dbOperations.addNewEntry} showAdd={false} {search} />
{:else}
  <p>Print view is only available to dictionary managers and contributors</p>
{/if}

<!-- <SeoMetaTags
  title={$page.data.t(''})}
  dictionaryName={$dictionary.name}
  description={$page.data.t(''})}
  keywords="Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary, Print a dictionary" /> -->
<style>
  .print-columns {
    /* column-width: var(--column-width); */
    /* column-gap: 2em; << default is 1em */
    column-count: var(--column-count);
    overflow-wrap: break-word;
  }
  /* https://medium.com/@Idan_Co/the-ultimate-print-html-template-with-header-footer-568f415f6d2a */
</style>
