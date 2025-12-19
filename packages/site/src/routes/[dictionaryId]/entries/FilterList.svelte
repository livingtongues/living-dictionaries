<script lang="ts">
  import { type QueryParamStore, ShowHide } from '$lib/svelte-pieces'
  import { slide } from 'svelte/transition'
  import { page } from '$app/state'
  import { restore_spaces_periods_from_underscores } from '$lib/search/augment-entry-for-search'
  import type { FilterListKeys, QueryParams } from '$lib/search/types'

  interface Props {
    search_params: QueryParamStore<QueryParams>;
    search_param_key: FilterListKeys;
    label: string;
    values: Record<string, number>; // keys are item key, numbers are count found
    keys_to_values?: Record<string, string>;
  }

  let {
    search_params,
    search_param_key,
    label,
    values,
    keys_to_values = undefined
  }: Props = $props();

  let search_value: string = $state()

  function add_filter(item: string) {
    $search_params[search_param_key] = [...$search_params[search_param_key] || [], item]
  }

  function remove_filter(item: string) {
    $search_params[search_param_key] = $search_params[search_param_key].filter((existing_item: string) => existing_item !== item)
  }

  function make_item_readable(_item: string, _keys_to_values: Record<string, string>) {
    const item = restore_spaces_periods_from_underscores(_item)
    return _keys_to_values?.[item] || item
  }
  let count = $derived(Object.values(values).length)
  let filtered_values = $derived(Object.entries(values).filter(([item]) => search_value ? make_item_readable(item, keys_to_values).toLowerCase().includes(search_value.toLowerCase()) : true))
  let max_show = $derived(search_value ? 10 : 5)
</script>

{#if !search_value && count <= max_show}
  <h4 class="text-sm font-semibold uppercase text-gray-700">{label}</h4>
{:else}
  <div
    class="mb-2 relative rounded-md
      shadow-sm">
    <input
      type="search"
      placeholder="{page.data.t('about.search')} {label}"
      class="form-input block w-full text-sm md:text-xs md:leading-5 transition py-1 px-3"
      bind:value={search_value} />
  </div>
{/if}

<ShowHide  >
  {#snippet children({ show, toggle })}
    <ul transition:slide>
      {#each filtered_values as [item, item_count], index (item)}
        {#if index < max_show || show}
          {@const cleaned_item = item.replace(' ', '')}
          {@const id = `${search_param_key}_${cleaned_item}`}
          {@const checked = $search_params[search_param_key]?.includes(item)}
          <li class="flex my-1 items-center" transition:slide>
            <input
              {id}
              type="checkbox"
              {checked}
              onchange={() => {
                if (checked)
                  remove_filter(item)
                else
                  add_filter(item)
              }} />
            <div class="w-2 shrink-0"></div>
            <label for={id} class="block text-sm text-gray-900 max-w-85%" style="overflow-wrap: break-word;">
              {make_item_readable(item, keys_to_values)}
              <span class="text-xs text-gray-600"> ({item_count}) </span>
            </label>
          </li>
        {/if}
      {/each}
    </ul>

    {#if Object.keys(filtered_values).length > max_show}
      <button type="button" class="p-1 mb-1 ml-1 text-xs text-gray-600" onclick={toggle}>
        {#if show}
          <span class="i-fa6-solid-chevron-up"></span>
          {page.data.t('entry.show_less')}
        {:else}
          <span class="i-fa6-solid-chevron-down -mt-1"></span>
          {page.data.t('entry.show_more')}
        {/if}
      </button>
    {/if}
  {/snippet}
</ShowHide>

<div class="mb-3"></div>
