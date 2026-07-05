<script lang="ts">
  import type { QueryParamStore } from '$lib/state/query-param-state.svelte'
  import { page } from '$app/state'
  import type { QueryParams } from '$lib/search/types'
  import IconCarbonSearch from '~icons/carbon/search'
  import IconSvgSpinners3DotsFade from '~icons/svg-spinners/3-dots-fade'
  import IconMaterialSymbolsFilterAlt from '~icons/material-symbols/filter-alt'

  interface Props {
    on_show_filter_menu: () => void
    search_params: QueryParamStore<QueryParams>
    index_ready?: boolean
    placeholder?: string
  }

  const { on_show_filter_menu, search_params, index_ready = false, placeholder = undefined }: Props = $props()
</script>

<div class="search-wrap">
  <div class="input-wrap">
    <div class="search-icon">
      {#if index_ready}
        <IconCarbonSearch class="icon-inline" style="color: var(--color-secondary)" />
      {:else}
        <IconSvgSpinners3DotsFade class="icon-inline" style="vertical-align: -4px" />
      {/if}
    </div>
    <input
      type="search"
      bind:value={$search_params.query}
      oninput={() => {
        if ($search_params.page && $search_params.page > 1) {
          $search_params.page = 1
        }
      }}
      placeholder={placeholder ?? page.data.t('entry.search_entries')} />
  </div>
  <button
    type="button"
    onclick={on_show_filter_menu}
    class="filter-button">
    <IconMaterialSymbolsFilterAlt class="icon-inline" style="color: color-mix(in srgb, var(--color) 45%, var(--background))" />
    <span class="filter-label">
      {page.data.t('entry.filters')}
    </span>
  </button>
</div>

<style>
  .search-wrap {
    display: flex;
    flex-grow: 1;
    border-radius: 0.375rem;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); /* shadow-sm */
  }

  .input-wrap {
    position: relative;
    flex-grow: 1;
  }

  .input-wrap:focus-within {
    z-index: 10;
  }

  .search-icon {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    padding-left: 0.75rem;
    display: flex;
    align-items: center;
    pointer-events: none;
  }

  .input-wrap input {
    font-size: 0.875rem;
    line-height: 1.25rem;
    width: 100%;
    padding: 0.5rem 0.75rem 0.5rem 2.5rem;
    border-radius: 0;
  }

  :global([dir='ltr']) .input-wrap input {
    border-top-left-radius: 0.375rem;
    border-bottom-left-radius: 0.375rem;
  }

  :global([dir='rtl']) .input-wrap input {
    border-top-right-radius: 0.375rem;
    border-bottom-right-radius: 0.375rem;
  }

  @media (min-width: 768px) {
    .input-wrap input {
      border-radius: 0.375rem;
    }
  }

  .filter-button {
    margin-left: -1px;
    position: relative;
    display: flex;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border: 1px solid color-mix(in srgb, var(--background), var(--color) 18%); /* ≈ gray-300 */
    font-size: 0.875rem;
    line-height: 1.25rem;
    background-color: color-mix(in srgb, var(--background), var(--color) 2%); /* ≈ gray-50 */
    color: var(--color); /* ≈ gray-900 */
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
  }

  :global([dir='ltr']) .filter-button {
    border-top-right-radius: 0.375rem;
    border-bottom-right-radius: 0.375rem;
  }

  :global([dir='rtl']) .filter-button {
    border-top-left-radius: 0.375rem;
    border-bottom-left-radius: 0.375rem;
  }

  .filter-button:focus {
    border-color: rgb(147 197 253); /* blue-300 */
    z-index: 10;
  }

  @media (min-width: 768px) {
    .filter-button {
      display: none;
    }
  }

  .filter-label {
    margin-left: 0.5rem;
    display: none;
  }

  @media (min-width: 640px) {
    .filter-label {
      display: inline;
    }
  }
</style>
