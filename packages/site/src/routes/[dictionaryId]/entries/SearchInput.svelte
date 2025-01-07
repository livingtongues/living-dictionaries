<script lang="ts">
  import type { QueryParamStore } from 'svelte-pieces'
  import { page } from '$app/stores'
  import type { QueryParams } from '$lib/search/types'

  export let on_show_filter_menu: () => void
  export let search_params: QueryParamStore<QueryParams>
  export let index_ready = false
</script>

<div class="flex flex-grow rounded-md shadow-sm">
  <div class="relative flex-grow focus-within:z-10">
    <div
      class="absolute inset-y-0 left-0 pl-3 flex items-center
        pointer-events-none">
      {#if index_ready}
        <span class="i-carbon-search text-gray-500" />
      {:else}
        <span class="i-svg-spinners-3-dots-fade align--4px" />
      {/if}
    </div>
    <input
      type="search"
      bind:value={$search_params.query}
      on:input={() => $search_params.page = 1}
      placeholder={$page.data.t('entry.search_entries')}
      class="form-input text-sm w-full pl-10 pr-3 py-2 rounded-none ltr:!rounded-l-md rtl:!rounded-r-md md:!rounded-r-md md:!rounded-l-md" />
  </div>
  <button
    type="button"
    on:click={on_show_filter_menu}
    class="-ml-px relative flex items-center px-3 py-2 ltr:rounded-r-md rtl:rounded-l-md border
      border-gray-300 text-sm leading-5 bg-gray-50 text-gray-900
      focus:border-blue-300
      focus:z-10 transition ease-in-out duration-150 md:hidden">
    <span class="i-material-symbols-filter-alt text-gray-400" />
    <span class="ml-2 hidden sm:inline">
      {$page.data.t('entry.filters')}
    </span>
  </button>
</div>
