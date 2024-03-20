<script lang="ts">
  import { page } from '$app/stores';
  import type { FilterListKeys, QueryParams } from '$lib/search/types';
  import { type QueryParamStore, ShowHide } from 'svelte-pieces';

  // export let count: number; total available
  export let search_params: QueryParamStore<QueryParams>;
  export let search_param_key: FilterListKeys
  export let label: string;
  export let values: Record<string, number>; // keys are item name, numbers are count found

  $: count = Object.values(values).length
  let search_value: string
  $: filtered_values = Object.entries(values).filter(([item]) => search_value ? item.toLowerCase().includes(search_value.toLowerCase()) : true);

  function add_filter(item: string) {
    $search_params[search_param_key] = [...$search_params[search_param_key] || [], item]
  }

  function remove_filter(item: string) {
    $search_params[search_param_key] = $search_params[search_param_key].filter((existing_item: string) => existing_item !== item)
  }

  $: max_show = search_value ? 10 : 5
</script>

{#if count <= max_show}
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
  <ul>
    {#each filtered_values as [item, item_count], index}
      {#if index < max_show || show}
        {@const cleaned_item = item.replace(' ', '')}
        {@const id = `${search_param_key}_${cleaned_item}`}
        {@const checked = $search_params[search_param_key]?.includes(item)}
        <li class="flex my-1 items-center">
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
          <div class="w-2" />
          <label for={id} class="block text-sm text-gray-900">
            {item}
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
