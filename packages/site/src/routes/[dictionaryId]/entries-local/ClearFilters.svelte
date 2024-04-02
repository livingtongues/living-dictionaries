<script lang="ts">
  import type { QueryParamStore } from 'svelte-pieces';
  import type { QueryParams } from '$lib/search/types';

  export let search_params: QueryParamStore<QueryParams>;
  $: filtered = !!Object.keys($search_params).filter(key => !['page', 'query', 'view'].includes(key)).length;

  function clear_filters() {
    search_params.update(({ page, query, view }) => ({ page, query, view }));
  }
</script>

{#if filtered}
  <button type="button" class="text-xs text-gray-600 p-1" on:click={clear_filters}><i class="far fa-undo fa-sm" /> Clear</button>
{/if}
