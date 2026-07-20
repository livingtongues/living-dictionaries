<script lang="ts">
  import IconUndo from '~icons/fa-solid/undo'
  import type { QueryParamState } from '$lib/state/query-param-state.svelte'
  import type { QueryParams } from '$lib/search/types'

  interface Props {
    search_params: QueryParamState<QueryParams>
  }

  const { search_params }: Props = $props()
  const filtered = $derived(!!Object.keys(search_params.value).filter(key => !['page', 'query', 'view', 'scope'].includes(key)).length)

  function clear_filters() {
    // update receives the parsed URL param — null when no `?q=` is set.
    search_params.update((params) => {
      const { page, query, view, scope } = params ?? {}
      return { page, query, view, scope }
    })
  }
</script>

{#if filtered}
  <button type="button" onclick={clear_filters}><IconUndo style="font-size: 0.875em" /> Clear</button>
{/if}

<style>
  button {
    font-size: 0.75rem;
    line-height: 1rem;
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
    padding: 0.25rem;
  }
</style>
