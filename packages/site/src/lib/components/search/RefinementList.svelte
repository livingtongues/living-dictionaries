<script lang="ts">
  import { _, locale } from 'svelte-i18n';

  import type { InstantSearch } from 'instantsearch.js';
  import { connectRefinementList } from 'instantsearch.js/es/connectors';
  import type { RefinementListItem } from 'instantsearch.js/es/connectors/refinement-list/connectRefinementList';
  import { onMount } from 'svelte';

  export let search: InstantSearch,
    attribute: 'ps' | 'sdn' | 'di' | 'sf.speakerName',
    label = '';

  let value = '';
  let maxInitialItems = 5;

  interface IRefinementItem extends RefinementListItem {
    translatedLabel?: string;
  }

  let items: IRefinementItem[] = [];
  let filteredItems: IRefinementItem[] = [];
  let refine: (arg0: any) => any;
  let searchForItems: (query: string) => void;
  let isShowingMore = false;
  let canToggleShowMore: boolean;
  let toggleShowMore: () => void;

  onMount(async () => {
    const customRefinementList = connectRefinementList((params) => {
      ({ items, refine, searchForItems, isShowingMore, canToggleShowMore, toggleShowMore } =
        params);
      if (!params.isFromSearch && value) {
        value = ''; // not sure why this was in instantsearch docs
      }
    });

    search.addWidgets([
      customRefinementList({
        attribute,
        limit: attribute === 'sf.speakerName' ? maxInitialItems : 70,
        showMore: attribute === 'sf.speakerName',
        showMoreLimit: 20,
      }),
    ]);
  });

  $: if (items.length && $locale) {
    translateItems();
  }
  function translateItems() {
    items = items.map((item) => {
      if (attribute === 'ps') {
        if (item.value) {
          item.translatedLabel = $_('ps.' + item.label, {
            default: item.label,
          });
        }
        return item;
      } else if (attribute === 'sdn') {
        return {
          ...item,
          translatedLabel: $_('sd.' + item.label, { default: item.label }),
        };
      }
      return item;
    });
  }

  $: filteredItems = items;
  function filterList() {
    if (attribute === 'ps' || attribute === 'sdn') {
      if (value.length) {
        filteredItems = items.filter((item) =>
          JSON.stringify(item).toLowerCase().includes(value.toLowerCase())
        );
      } else {
        filteredItems = items;
      }
    } else {
      searchForItems(value);
    }
  }
  function showMore() {
    if (attribute === 'ps' || attribute === 'sdn') {
      isShowingMore = !isShowingMore;
    } else {
      toggleShowMore();
    }
  }
</script>

{#if items.length > 0 && items.length <= maxInitialItems && !value}
  <h4 class="text-xs font-semibold uppercase text-gray-700">{label}</h4>
{/if}

<div
  class:hidden={!(items.length > maxInitialItems || value)}
  class="mt-1 mb-2 relative rounded-md
    shadow-sm">
  <input
    type="search"
    placeholder="{$_('about.search', { default: 'Search' })} {label}"
    class="form-input block w-full text-sm md:text-xs md:leading-5 transition py-1 px-3"
    bind:value
    on:input={filterList} />
</div>

<ul>
  {#each filteredItems as item, i (item)}
    {#if i < maxInitialItems || isShowingMore}
      <li>
        <div class="flex my-1">
          <input
            id="{attribute.replace('.', '')}_{i}"
            type="checkbox"
            checked={item.isRefined}
            on:click={refine(item.value)} />
          <div class="w-2" />
          <label for="{attribute.replace('.', '')}_{i}" class="block text-sm text-gray-900">
            {item.translatedLabel || item.label}
            <span class="text-xs text-gray-600"> ({item.count}) </span>
          </label>
        </div>
      </li>
    {/if}
  {/each}
</ul>

{#if canToggleShowMore || filteredItems.length > maxInitialItems}
  <button type="button" class="p-1 mb-1 ml-1 text-xs text-gray-600" on:click={showMore}>
    {#if isShowingMore}
      <span class="i-fa6-solid-chevron-up" />
      {$_('entry.show_less', { default: 'Show less' })}
    {:else}
      <span class="i-fa6-solid-chevron-down -mt-1" />
      {$_('entry.show_more', { default: 'Show more' })}
    {/if}
  </button>
{/if}

<div class="mb-3" />
