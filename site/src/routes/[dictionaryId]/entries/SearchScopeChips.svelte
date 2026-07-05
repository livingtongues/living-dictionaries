<script lang="ts">
  import type { QueryParamStore } from '$lib/state/query-param-state.svelte'
  import type { QueryParams, SearchScope } from '$lib/search/types'
  import { page } from '$app/state'
  import IconFa6SolidUserShield from '~icons/fa6-solid/user-shield'

  interface Props {
    search_params: QueryParamStore<QueryParams>
  }

  const { search_params }: Props = $props()

  const scopes = $derived([
    { value: null, label: page.data.t('dictionary.words') },
    { value: 'sentences', label: page.data.t('sentence.sentences') },
    { value: 'texts', label: page.data.t('dictionary.texts') },
  ] as { value: SearchScope | null, label: string }[])

  function set_scope(scope: SearchScope | null) {
    // Facets are per-scope — drop them on switch so stale entry filters don't
    // linger in the URL while browsing sentences (and vice versa). NOTE: update
    // receives the parsed URL param, which is NULL when no `?q=` is set.
    search_params.update((params) => {
      const { query, view } = params ?? {}
      return { page: 1, query, view, ...scope ? { scope } : {} }
    })
  }
</script>

<div class="scope-chips" role="tablist">
  {#each scopes as { value, label } (value)}
    <button
      type="button"
      role="tab"
      aria-selected={($search_params.scope ?? null) === value}
      class="chip"
      class:active={($search_params.scope ?? null) === value}
      onclick={() => set_scope(value)}>
      {label}
    </button>
  {/each}
  <!-- Admin-3 preview marker while the corpus scopes are iterated on (same
       shield convention as the dict-home side-menu link). -->
  <IconFa6SolidUserShield class="icon-inline" style="font-size: 0.6875rem; opacity: 0.45; align-self: center" />
</div>

<style>
  .scope-chips {
    display: flex;
    gap: 0.375rem;
    margin-bottom: 0.25rem;
  }

  .chip {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: color-mix(in srgb, var(--color) 75%, var(--background));
    transition: background-color var(--transition-time, 150ms), color var(--transition-time, 150ms);
  }

  .chip:hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%);
  }

  .chip.active {
    background-color: var(--primary);
    color: var(--on-primary);
  }
</style>
