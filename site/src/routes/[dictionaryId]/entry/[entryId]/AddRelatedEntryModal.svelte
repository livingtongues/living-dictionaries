<script lang="ts">
  import type { EntryData, MultiString } from '$lib/types'
  import type { TranslationKeys } from '$lib/i18n/types'
  import { page } from '$app/state'
  import Modal from '$lib/svelte-pieces/Modal.svelte'
  import { RELATIONSHIP_TYPES } from '$lib/constants'
  import type { GlobalRelationshipType } from '$lib/constants'
  import IconMdiMagnify from '~icons/mdi/magnify'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiArrowRight from '~icons/mdi/arrow-right'

  interface Props {
    entry_id: string
    entry_lexeme: string
    /** Entries already related to this one — excluded from search results. */
    exclude_ids?: string[]
    on_close: () => void
  }

  const { entry_id, entry_lexeme, exclude_ids = [], on_close }: Props = $props()

  const { t, dict_db, dbOperations, entries_data, search_entries, dictionary } = $derived(page.data)

  const CUSTOM_PREFIX = 'custom:'
  const global_slugs = Object.keys(RELATIONSHIP_TYPES) as GlobalRelationshipType[]

  let search_text = $state('')
  let result_ids = $state<string[]>([])
  let target_id = $state<string | null>(null)
  let selected_type = $state('')
  let note = $state('')
  let saving = $state(false)

  function display_string(value: MultiString | null | undefined): string {
    if (!value) return ''
    return value.default ?? Object.values(value).find(Boolean) ?? ''
  }

  const excluded = $derived(new Set([entry_id, ...exclude_ids]))

  // Debounced Orama search (the index is already warm from the dictionary
  // layout). An empty query returns the alphabetical head of the dictionary —
  // a browsable starting list.
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
  const target = $derived(target_id ? $entries_data[target_id] as EntryData | undefined : undefined)
  const target_lexeme = $derived(display_string(target?.main.lexeme))

  function first_gloss(entry: EntryData): string {
    for (const sense of entry.senses || []) {
      const gloss = Object.values(sense.glosses ?? {}).filter(Boolean).join(', ')
      if (gloss) return gloss
    }
    return ''
  }

  const custom_types = $derived(Object.entries(dict_db?.relationship_types.objects ?? {}) as [string, { name: MultiString, inverse_name: MultiString | null }][])

  const selected_label = $derived.by(() => {
    if (!selected_type) return ''
    if (selected_type.startsWith(CUSTOM_PREFIX)) {
      const custom = custom_types.find(([id]) => id === selected_type.slice(CUSTOM_PREFIX.length))
      return display_string(custom?.[1].name)
    }
    return t(`relationship_type.${selected_type}` as TranslationKeys)
  })

  const selected_description = $derived(
    selected_type && !selected_type.startsWith(CUSTOM_PREFIX)
      ? t(`relationship_type.${selected_type}_description` as TranslationKeys)
      : '',
  )

  function autofocus(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 15)
  }

  async function save() {
    if (!target_id || !selected_type || saving) return
    saving = true
    try {
      await dbOperations.insert_relationship({
        from_entry_id: entry_id,
        to_entry_id: target_id,
        ...(selected_type.startsWith(CUSTOM_PREFIX)
          ? { custom_type_id: selected_type.slice(CUSTOM_PREFIX.length) }
          : { type: selected_type as GlobalRelationshipType }),
        ...(note.trim() ? { note: { default: note.trim() } } : {}),
      })
      on_close()
    } finally {
      saving = false
    }
  }
</script>

<Modal {on_close}>
  {#snippet heading()}
    {t('relationship_type.add')}
  {/snippet}

  {#if !target}
    <div class="search-wrap">
      <IconMdiMagnify class="related-search-icon" />
      <input
        type="search"
        placeholder={t('entry.search_entries')}
        bind:value={search_text}
        use:autofocus
        class="search-input" />
    </div>

    <div class="results">
      {#each results as result (result.id)}
        <button type="button" class="result-row" onclick={() => { target_id = result.id }}>
          <span class="result-lexeme">{display_string(result.main.lexeme) || '—'}</span>
          {#if first_gloss(result)}
            <span class="result-gloss">{first_gloss(result)}</span>
          {/if}
        </button>
      {:else}
        <p class="empty">{t('relationship_type.no_matches')}</p>
      {/each}
    </div>
  {:else}
    <div class="chosen-row">
      <span class="chosen-label">{t('relationship_type.choose_entry')}:</span>
      <span class="chosen-lexeme">{target_lexeme || '—'}</span>
      <button type="button" class="btn-ghost" style="padding: 0.25rem" aria-label={t('misc.remove')} onclick={() => { target_id = null }}>
        <IconMdiClose />
      </button>
    </div>

    <label class="field-label" for="relationship-type-select">{t('relationship_type.relationship')}</label>
    <select id="relationship-type-select" bind:value={selected_type}>
      <option value="" disabled>{t('relationship_type.relationship')}…</option>
      {#each global_slugs as slug (slug)}
        <option value={slug}>{t(`relationship_type.${slug}` as TranslationKeys)}</option>
      {/each}
      {#each custom_types as [id, custom_type] (id)}
        <option value="{CUSTOM_PREFIX}{id}">{display_string(custom_type.name)}</option>
      {/each}
    </select>
    {#if selected_description}
      <p class="type-description">{selected_description}</p>
    {/if}

    {#if selected_type}
      <div class="preview">
        <strong>{entry_lexeme}</strong>
        <span class="preview-label">— {selected_label}</span>
        <IconMdiArrowRight style="color: var(--color-secondary)" />
        <strong>{target_lexeme}</strong>
      </div>
    {/if}

    <label class="field-label" for="relationship-note-input">{t('entry_field.notes')}</label>
    <input id="relationship-note-input" type="text" bind:value={note} />

    <div class="actions">
      <button type="button" class="btn btn-default" onclick={on_close}>{t('misc.cancel')}</button>
      <button type="button" class="btn-primary btn-default" disabled={!selected_type || saving} onclick={save}>
        {t('misc.save')}
      </button>
    </div>
  {/if}
</Modal>

<style>
  .search-wrap {
    position: relative;
    margin-bottom: 0.75rem;
  }

  :global(.related-search-icon) {
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

  .chosen-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .chosen-label {
    color: var(--color-secondary);
    font-size: 0.875rem;
  }

  .chosen-lexeme {
    font-weight: 600;
  }

  .field-label {
    display: block;
    font-size: 0.75rem;
    color: var(--color-secondary);
    margin-bottom: 0.25rem;
  }

  select,
  input {
    width: 100%;
    margin-bottom: 0.75rem;
  }

  .type-description {
    color: var(--color-secondary);
    font-size: 0.8rem;
    margin-top: -0.5rem;
    margin-bottom: 0.75rem;
  }

  .preview {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.375rem;
    background: var(--surface);
    border-radius: 0.5rem;
    padding: 0.625rem 0.75rem;
    margin-bottom: 0.75rem;
    font-size: 0.9rem;
  }

  .preview-label {
    color: var(--color-secondary);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }
</style>
