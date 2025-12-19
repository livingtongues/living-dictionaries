<script lang="ts">
  import type { QueryParamStore } from '$lib/svelte-pieces'
  import type { QueryParams } from '$lib/search/types'

  interface Props {
    search_params: QueryParamStore<QueryParams>;
  }

  let { search_params }: Props = $props();
  let filtered = $derived(!!Object.keys($search_params).filter(key => !['page', 'query', 'view'].includes(key)).length)

  function clear_filters() {
    search_params.update(({ page, query, view }) => ({ page, query, view }))
  }
</script>

{#if filtered}
  <button type="button" class="text-xs text-gray-600 p-1" onclick={clear_filters}><i class="far fa-undo fa-sm"></i> Clear</button>
{/if}
