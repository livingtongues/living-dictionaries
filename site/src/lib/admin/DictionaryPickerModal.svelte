<script lang="ts">
  import type { RowType } from '$lib/db/client/live/types'
  import IconMdiMagnify from '~icons/mdi/magnify'
  import Modal from '$lib/svelte-pieces/Modal.svelte'
  import { score_record } from '$lib/utils/fuzzy-score'

  interface Props {
    dictionaries: RowType<'dictionaries'>[]
    on_select: (dictionary_id: string) => void
    on_close: () => void
  }

  let { dictionaries, on_select, on_close }: Props = $props()

  let search = $state('')
  const search_query = $derived(search.trim())

  const matches = $derived.by(() => {
    if (!search_query)
      return dictionaries.slice(0, 50)
    const scored: { dict: RowType<'dictionaries'>, score: number }[] = []
    for (const dict of dictionaries) {
      const score = score_record(search_query, [
        { value: dict.name ?? '', weight: 1 },
        { value: dict.id ?? '', weight: 0.6 },
      ])
      if (score > 0)
        scored.push({ dict, score })
    }
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, 50).map(s => s.dict)
  })

  function autofocus(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 15)
  }
</script>

<Modal {on_close}>
  {#snippet heading()}
    Add a dictionary role
  {/snippet}
  <div class="search-wrap">
    <IconMdiMagnify class="picker-search-icon" />
    <input
      type="search"
      placeholder="Search dictionaries…"
      bind:value={search}
      use:autofocus
      class="search-input" />
  </div>

  <div class="results">
    {#each matches as dict (dict.id)}
      <button type="button" class="result-row" onclick={() => on_select(dict.id)}>
        <span class="result-name">{dict.name || '(no name)'}</span>
        <span class="result-id">{dict.id}</span>
      </button>
    {:else}
      <p class="empty">No dictionaries match.</p>
    {/each}
  </div>
</Modal>

<style>
  .search-wrap {
    position: relative;
    margin-bottom: 0.75rem;
  }
  :global(.picker-search-icon) {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-secondary);
  }
  .search-input {
    width: 100%;
    padding: 0.5rem 0.75rem 0.5rem 2.25rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border-color);
    background: var(--background);
    font-size: 0.875rem;
    color: var(--color);
  }
  .search-input:focus {
    outline: none;
    border-color: var(--primary);
  }
  .results {
    max-height: 50vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  .result-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    text-align: left;
    padding: 0.5rem 0.625rem;
    border-radius: 0.375rem;
    border: 0;
    background: transparent;
    color: var(--color);
    cursor: pointer;
  }
  .result-row:hover {
    background: var(--surface);
  }
  .result-name {
    font-weight: 500;
    font-size: 0.875rem;
  }
  .result-id {
    font-size: 0.75rem;
    color: var(--color-secondary);
    font-family: var(--font-mono);
  }
  .empty {
    color: var(--color-secondary);
    font-size: 0.875rem;
    padding: 0.5rem;
  }
</style>
