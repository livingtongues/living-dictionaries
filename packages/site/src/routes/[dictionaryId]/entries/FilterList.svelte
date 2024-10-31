<script lang="ts">
  import { type QueryParamStore, ShowHide } from 'svelte-pieces'
  import { slide } from 'svelte/transition'
  import { page } from '$app/stores'
  import { restore_spaces_periods_from_underscores } from '$lib/search/augment-entry-for-search'
  import type { FilterListKeys, QueryParams } from '$lib/search/types'

  export let search_params: QueryParamStore<QueryParams>
  export let search_param_key: FilterListKeys
  export let label: string
  export let values: Record<string, number> // keys are item key, numbers are count found
  export let keys_to_values: Record<string, string>

  $: count = Object.values(values).length
  let search_value: string
  $: filtered_values = Object.entries(values).filter(([item]) => search_value ? make_item_readable(item, keys_to_values).toLowerCase().includes(search_value.toLowerCase()) : true)
  $: max_show = search_value ? 10 : 5

  function add_filter(item: string) {
    $search_params[search_param_key] = [...$search_params[search_param_key] || [], item]
  }

  function remove_filter(item: string) {
    $search_params[search_param_key] = $search_params[search_param_key].filter((existing_item: string) => existing_item !== item)
  }

  function make_item_readable(_item: string, keys_to_values: Record<string, string>) {
    const item = restore_spaces_periods_from_underscores(_item)
    return keys_to_values?.[item] || item
  }
</script>

{#if !search_value && count <= max_show}
  <h4 class="text-sm font-semibold uppercase text-gray-700">{label}</h4>
{:else}
  <div
    class="mb-2 relative rounded-md
      shadow-sm">
    <input
      type="search"
      placeholder="{$page.data.t('about.search')} {label}"
      class="form-input block w-full text-sm md:text-xs md:leading-5 transition py-1 px-3"
      bind:value={search_value} />
  </div>
{/if}

<ShowHide let:show let:toggle>
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
            on:change={() => {
              if (checked)
                remove_filter(item)
              else
                add_filter(item)
            }} />
          <div class="w-2 shrink-0" />
          <label for={id} class="block text-sm text-gray-900 max-w-85%" style="overflow-wrap: break-word;">
            {make_item_readable(item, keys_to_values)}
            <span class="text-xs text-gray-600"> ({item_count}) </span>
          </label>
        </li>
      {/if}
    {/each}
  </ul>

  {#if Object.keys(filtered_values).length > max_show}
    <button type="button" class="p-1 mb-1 ml-1 text-xs text-gray-600" on:click={toggle}>
      {#if show}
        <span class="i-fa6-solid-chevron-up" />
        {$page.data.t('entry.show_less')}
      {:else}
        <span class="i-fa6-solid-chevron-down -mt-1" />
        {$page.data.t('entry.show_more')}
      {/if}
    </button>
  {/if}
</ShowHide>

<div class="mb-3" />
