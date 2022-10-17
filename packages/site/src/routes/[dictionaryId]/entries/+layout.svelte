<script lang="ts">
  import { _ } from 'svelte-i18n';
  import InstantSearch from '$lib/components/search/InstantSearch.svelte';
  import SearchBox from '$lib/components/search/SearchBox.svelte';
  import Stats from '$lib/components/search/Stats.svelte';
  import EntryFilters from './_EntryFilters.svelte';
  import { admin } from '$lib/stores';
  // import { dictionary, canEdit } from '$lib/stores';

  import { page } from '$app/stores';
  import { browser } from '$app/environment';

  let showMobileFilters = false;
</script>

{#if browser}
  <InstantSearch dictionaryId={$page.params.dictionaryId} let:search>
    <div class="relative pb-3 flex-grow">
      <div
        class="flex mb-1 items-center sticky top-0 md:top-12 pt-2 md:pt-0 pb-1
            bg-white z-20 print:hidden">
        <SearchBox {search} on:showFilterMenu={() => (showMobileFilters = true)} />

        <div class="h-1 w-1" />
        <div
          class="flex md:p-1 border bg-gray-200 rounded-md text-gray-600
              font-medium text-xl md:text-sm">
          <a
            data-sveltekit-prefetch
            href={'/' + $page.params.dictionaryId + '/entries/list'}
            class="{$page.url.pathname.includes('list') ? 'bg-white shadow' : 'hover:bg-gray-100'}
                px-2 py-1 rounded">
            <i class="far fa-list" />
            <span class="hidden md:inline">
              {$_('entry.list', { default: 'List' })}
            </span>
          </a>
          <div class="hidden md:block w-1" />
          <a
            data-sveltekit-prefetch
            href={'/' + $page.params.dictionaryId + '/entries/table'}
            class="{$page.url.pathname.includes('table') ? 'bg-white shadow' : 'hover:bg-gray-100'}
            px-2 py-1 rounded">
            <i class="fal fa-table" />
            <span class="hidden md:inline">
              {$_('entry.table', { default: 'Table' })}
            </span>
          </a>
          <div class="hidden md:block w-1" />
          <a
            data-sveltekit-prefetch
            href={'/' + $page.params.dictionaryId + '/entries/gallery'}
            class="{$page.url.pathname.includes('gallery') ? 'bg-white shadow' : 'hover:bg-gray-100'}
                px-2 py-1 rounded">
            <i class="fal fa-image" />
            <span class="hidden md:inline">
              {$_('entry.gallery', { default: 'Gallery' })}
            </span>
          </a>
          {#if $admin}
          <!-- {#if $dictionary.printAccess || $canEdit} -->
            <a
              data-sveltekit-prefetch
              href={'/' + $page.params.dictionaryId + '/entries/print'}
              class="{$page.url.pathname.includes('print') ? 'bg-white shadow' : 'hover:bg-gray-100'}
                  px-2 py-1 rounded">
              <span class="i-fa-print" style="margin-top: -4px;" />
              <span class="hidden md:inline">
                {$_('entry.print', { default: 'Print' })}
              </span>
            </a>
          {/if}
        </div>
      </div>

      <div class="flex">
        <div class="flex-grow w-0 relative">
          <div class="flex justify-between print:hidden">
            <div class="italic text-xs text-gray-500 mb-1">
              <Stats {search} />
            </div>
            <!-- <SortBy {search} /> -->
          </div>
          <slot />
        </div>
        <div class="hidden md:block w-3 flex-shrink-0 print:hidden" />
        <EntryFilters {search} bind:showMobileFilters />
      </div>
    </div>
  </InstantSearch>
{/if}