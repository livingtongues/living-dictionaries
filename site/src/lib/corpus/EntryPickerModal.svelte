<script lang="ts">
  import type { EntryData, MultiString } from '$lib/types'
  import { page } from '$app/state'
  import Modal from '$lib/components/ui/Modal.svelte'
  import IconMdiMagnify from '~icons/mdi/magnify'

  interface Props {
    /** Seed the search box (e.g. the tapped token's form). */
    initial_query?: string
    exclude_ids?: string[]
    on_pick: (entry_id: string) => void
    on_close: () => void
    /** Above the token Popover (70) when opened from it. */
    zIndex?: number
  }

  const { initial_query = '', exclude_ids = [], on_pick, on_close, zIndex = 80 }: Props = $props()

  const { t, entries_data, search_entries, dictionary } = $derived(page.data)

  let search_text = $state(initial_query)
  let result_ids = $state<string[]>([])

  const excluded = $derived(new Set(exclude_ids))

  // Debounced Orama search (index warm from the dictionary layout); empty query
  // returns the alphabetical head as a browsable starting list.
  $effect(() => {
    const query = search_text.trim()
    const timer = setTimeout(async () => {
      try {
        const { hits } = await search_entries({ query_params: { page: 1, query }, page_index: 0, entries_per_page: 20, dictionary_id: dictionary.id })
        result_ids = hits.map((hit: { id: string }) => hit.id).filter((id: string) => !excluded.has(id)).slice(0, 8)
      } catch (err) {
        console.error(err)
      }
    }, 150)
    return () => clearTimeout(timer)
  })

  const results = $derived(result_ids.map(id => $entries_data[id]).filter(Boolean) as EntryData[])

  function display_string(value: MultiString | null | undefined): string {
    if (!value) return ''
    return value.default ?? Object.values(value).find(Boolean) ?? ''
  }

  function first_gloss(entry: EntryData): string {
    for (const sense of entry.senses || []) {
      const gloss = Object.values(sense.glosses ?? {}).filter(Boolean).join(', ')
      if (gloss) return gloss
    }
    return ''
  }

  function autofocus(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 15)
  }
</script>

<Modal {on_close} {zIndex}>
  {#snippet heading()}
    {t('token.link_entry')}
  {/snippet}

  <div class="search-wrap">
    <IconMdiMagnify class="picker-search-icon" />
    <input
      type="search"
      placeholder={t('entry.search_entries')}
      bind:value={search_text}
      use:autofocus
      class="search-input" />
  </div>

  <div class="results">
    {#each results as result (result.id)}
      <button type="button" class="result-row" onclick={() => on_pick(result.id)}>
        <span class="result-lexeme">{display_string(result.main.lexeme) || '—'}</span>
        {#if first_gloss(result)}
          <span class="result-gloss">{first_gloss(result)}</span>
        {/if}
      </button>
    {:else}
      <p class="empty">{t('relationship_type.no_matches')}</p>
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

  .result-lexeme {
    font-weight: 500;
    font-size: 0.875rem;
  }

  .result-gloss {
    font-size: 0.75rem;
    color: var(--color-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty {
    color: var(--color-secondary);
    font-size: 0.875rem;
    padding: 0.5rem;
  }
</style>
