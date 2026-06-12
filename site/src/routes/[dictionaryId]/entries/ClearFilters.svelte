<script lang="ts">
  import type { QueryParamStore } from '$lib/svelte-pieces'
  import type { QueryParams } from '$lib/search/types'

  interface Props {
    search_params: QueryParamStore<QueryParams>
  }

  const { search_params }: Props = $props()
  const filtered = $derived(!!Object.keys($search_params).filter(key => !['page', 'query', 'view'].includes(key)).length)

  function clear_filters() {
    search_params.update(({ page, query, view }) => ({ page, query, view }))
  }
</script>

{#if filtered}
  <button type="button" onclick={clear_filters}><i class="far fa-undo fa-sm"></i> Clear</button>
{/if}

<style>
  button {
    font-size: 0.75rem;
    line-height: 1rem;
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
    padding: 0.25rem;
  }
</style>
