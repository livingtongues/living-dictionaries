<script lang="ts">
  import { slide } from 'svelte/transition'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import type { QueryParamStore } from '$lib/state/query-param-state.svelte'
  import { page } from '$app/state'
  import { restore_spaces_periods_from_underscores } from '$lib/search/augment-entry-for-search'
  import type { FilterListKeys, QueryParams } from '$lib/search/types'
  import IconFa6SolidChevronUp from '~icons/fa6-solid/chevron-up'
  import IconFa6SolidChevronDown from '~icons/fa6-solid/chevron-down'

  interface Props {
    search_params: QueryParamStore<QueryParams>
    search_param_key: FilterListKeys
    label: string
    values: Record<string, number> // keys are item key, numbers are count found
    keys_to_values?: Record<string, string>
  }

  const {
    search_params,
    search_param_key,
    label,
    values,
    keys_to_values = undefined,
  }: Props = $props()

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
  const count = $derived(Object.values(values).length)
  const filtered_values = $derived(Object.entries(values).filter(([item]) => search_value ? make_item_readable(item, keys_to_values).toLowerCase().includes(search_value.toLowerCase()) : true))
  const max_show = $derived(search_value ? 10 : 5)
</script>

{#if !search_value && count <= max_show}
  <h4>{label}</h4>
{:else}
  <div class="search-wrap">
    <input
      type="search"
      placeholder="{page.data.t('about.search')} {label}"
      bind:value={search_value} />
  </div>
{/if}

<ShowHide>
  {#snippet children({ show, toggle })}
    <ul transition:slide>
      {#each filtered_values as [item, item_count], index (item)}
        {#if index < max_show || show}
          {@const cleaned_item = item.replace(' ', '')}
          {@const id = `${search_param_key}_${cleaned_item}`}
          {@const checked = $search_params[search_param_key]?.includes(item)}
          <li transition:slide>
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
            <div style="width: 0.5rem; flex-shrink: 0"></div>
            <label for={id} style="overflow-wrap: break-word;">
              {make_item_readable(item, keys_to_values)}
              <span class="item-count"> ({item_count}) </span>
            </label>
          </li>
        {/if}
      {/each}
    </ul>

    {#if Object.keys(filtered_values).length > max_show}
      <button type="button" class="show-more" onclick={toggle}>
        {#if show}
          <IconFa6SolidChevronUp />
          {page.data.t('entry.show_less')}
        {:else}
          <IconFa6SolidChevronDown style="margin-top: -0.25rem" />
          {page.data.t('entry.show_more')}
        {/if}
      </button>
    {/if}
  {/snippet}
</ShowHide>

<div style="margin-bottom: 0.75rem"></div>

<style>
  h4 {
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 600;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
  }

  .search-wrap {
    margin-bottom: 0.5rem;
    position: relative;
    border-radius: 0.375rem;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); /* shadow-sm */
  }

  .search-wrap input {
    display: block;
    width: 100%;
    font-size: 0.875rem;
    line-height: 1.25rem;
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
    padding: 0.25rem 0.75rem;
  }

  @media (min-width: 768px) {
    .search-wrap input {
      font-size: 0.75rem;
      line-height: 1.25rem;
    }
  }

  li {
    display: flex;
    margin-top: 0.25rem;
    margin-bottom: 0.25rem;
    align-items: center;
  }

  label {
    display: block;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: var(--color); /* ≈ gray-900 */
    max-width: 85%;
  }

  .item-count {
    font-size: 0.75rem;
    line-height: 1rem;
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
  }

  .show-more {
    padding: 0.25rem;
    margin-bottom: 0.25rem;
    margin-left: 0.25rem;
    font-size: 0.75rem;
    line-height: 1rem;
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
  }
</style>
