<script lang="ts">
  import InstantSearch from '$lib/components/search/InstantSearch.svelte';
  import SearchBox from '$lib/components/search/SearchBox.svelte';
  import Stats from '$lib/components/search/Stats.svelte';
  import EntryFilters from './EntryFilters.svelte';
  import { dictionary_deprecated as dictionary, canEdit, admin, algoliaQueryParams } from '$lib/stores';
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';
  import { page, navigating } from '$app/stores';
  import { browser } from '$app/environment';
  import { lastEntriesUrl } from '$lib/stores/lastEntriesUrl';

  let showMobileFilters = false;

  $: if ($algoliaQueryParams) {
    const { href, origin } = window.location
    $lastEntriesUrl = href.replace(origin, '')
  } else if (browser && $navigating?.from?.url) {
    const { origin } = window.location
    const { href } = $navigating.from.url
    $lastEntriesUrl = href.replace(origin, '')
  }
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
            href={'/' + $page.params.dictionaryId + '/entries/list'}
            class="{$page.url.pathname.includes('list') ? 'bg-white shadow' : 'hover:bg-gray-100'}
              px-2 py-1 rounded">
            <i class="far fa-list" />
            <span class="hidden md:inline">
              {$page.data.t('entry.list')}
            </span>
          </a>
          <div class="hidden md:block w-1" />
          <a
            href={'/' + $page.params.dictionaryId + '/entries/table'}
            class="{$page.url.pathname.includes('table') ? 'bg-white shadow' : 'hover:bg-gray-100'}
              px-2 py-1 rounded">
            <i class="fal fa-table" />
            <span class="hidden md:inline">
              {$page.data.t('entry.table')}
            </span>
          </a>
          <div class="hidden md:block w-1" />
          <a
            href={'/' + $page.params.dictionaryId + '/entries/gallery'}
            class="{$page.url.pathname.includes('gallery')
              ? 'bg-white shadow'
              : 'hover:bg-gray-100'}
              px-2 py-1 rounded">
            <i class="fal fa-image" />
            <span class="hidden md:inline">
              {$page.data.t('entry.gallery')}
            </span>
          </a>
          {#if $dictionary.printAccess || $canEdit}
            <a
              href={'/' + $page.params.dictionaryId + '/entries/print'}
              class="{$page.url.pathname.includes('print')
                ? 'bg-white shadow'
                : 'hover:bg-gray-100'}
                px-2 py-1 rounded">
              <span class="i-fa-print" style="margin-top: -4px;" />
              <span class="hidden md:inline">
                {$page.data.t('entry.print')}
              </span>
            </a>
          {/if}
        </div>
      </div>

      <div class="flex">
        <div class="flex-grow w-0 relative">
          <Stats {search} />
          <slot />
        </div>
        <div class="hidden md:block w-3 flex-shrink-0 print:hidden" />
        <EntryFilters {search} bind:showMobileFilters />
      </div>
    </div>
  </InstantSearch>
{/if}

<!-- Workaround while we fix meta tags to correctly work in list, table, gallery and print pages -->
<SeoMetaTags
  admin={$admin > 0}
  title="Entries"
  dictionaryName={$dictionary.name}
  gcsPath={$dictionary.featuredImage?.specifiable_image_url}
  lng={$dictionary.coordinates?.longitude}
  lat={$dictionary.coordinates?.latitude}
  description="The entries in this Living Dictionary are displayed in a comprehensive list that visitors can easily browse by using the page tabs at the bottom of the screen, or search by using the powerful search bar located at the top of the page."
  keywords="Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" />
