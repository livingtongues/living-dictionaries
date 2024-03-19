<script lang="ts">
  import type { QueryParamStore } from 'svelte-pieces';
  import type { SearchParams } from './+layout';

  export let search_params: QueryParamStore<SearchParams>;
  $: filtered = !!Object.keys($search_params).filter(k => k !== 'page' && k !== 'query').length;

  function clear_filters() {
    search_params.update(({ page, query }) => ({ page, query }));
  }
</script>

{#if filtered}
  <button type="button" class="text-xs text-gray-600 p-1" on:click={clear_filters}><i class="far fa-undo fa-sm" /> Clear</button>
{/if}
