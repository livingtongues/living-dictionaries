<script lang="ts">
  import { page } from '$app/state'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import { order_entry_and_dictionary_gloss_languages } from '$lib/helpers/glosses'
  import { get_headword } from '$lib/helpers/orthographies'
  import type { DictRowType } from '$lib/db/dict-client/dict-live-db.svelte'
  import type { MultiString } from '$lib/types'
  import IconMdiMagnify from '~icons/mdi/magnify'
  import IconMdiClose from '~icons/mdi/close'

  interface Props {
    section: DictRowType<'grammar_sections'>
    on_close: () => void
  }

  const { section, on_close }: Props = $props()

  const { t, dictionary, search_entries, entries_data } = $derived(page.data)

  // One cached import promise, awaited per editor — so the title inputs + usage
  // toggle paint immediately instead of waiting on the (heavy) tiptap bundle.
  const markdown_editor_promise = import('$lib/markdown/MarkdownEditor.svelte')

  // Local drafts (copied so Cancel discards). MultiString keyed by gloss/analysis language.
  let draft_title = $state<MultiString>({ ...(section.title || {}) })
  let draft_body = $state<MultiString>({ ...(section.body || {}) })
  let draft_usage = $state<MultiString>({ ...(section.usage_conditions || {}) })
  let linked_entry_id = $state<string | null>(section.entry_id ?? null)
  let show_usage = $state(!!Object.values(section.usage_conditions || {}).some(Boolean))
  // Plain flag (not reactive state): a re-entrancy guard only, never read in the template.
  let saving = false

  const languages = $derived(order_entry_and_dictionary_gloss_languages(
    { ...(section.title || {}), ...(section.body || {}) },
    dictionary.gloss_languages,
  ))

  function language_label(bcp: string): string {
    return t({ dynamicKey: `gl.${bcp}`, fallback: bcp })
  }

  // --- entry link picker ---
  let search_text = $state('')
  let result_ids = $state<string[]>([])
  const linked_entry = $derived(linked_entry_id ? $entries_data[linked_entry_id] : undefined)
  const linked_lexeme = $derived(linked_entry
    ? get_headword({ lexeme: linked_entry.main.lexeme, orthographies: dictionary.orthographies }).value
    : '')

  $effect(() => {
    const query = search_text.trim()
    if (!query || linked_entry_id) {
      result_ids = []
      return
    }
    const timer = setTimeout(async () => {
      try {
        const { hits } = await search_entries({ query_params: { page: 1, query }, page_index: 0, entries_per_page: 20, dictionary_id: dictionary.id })
        result_ids = hits.map((hit: { id: string }) => hit.id).slice(0, 6)
      } catch (err) {
        console.error(err)
      }
    }, 150)
    return () => clearTimeout(timer)
  })

  function entry_lexeme(id: string): string {
    const entry = $entries_data[id]
    return entry ? get_headword({ lexeme: entry.main.lexeme, orthographies: dictionary.orthographies }).value : ''
  }

  function clean(value: MultiString): MultiString | null {
    const entries = Object.entries(value).filter(([, text]) => text && text.trim())
    return entries.length ? Object.fromEntries(entries) : null
  }

  async function save() {
    if (saving) return
    saving = true
    try {
      section.title = clean(draft_title)
      section.body = clean(draft_body)
      section.usage_conditions = clean(draft_usage)
      section.entry_id = linked_entry_id
      // A section can't be fully empty — if the user cleared everything, keep a headless body-only placeholder untouched isn't needed here; a blank new section is allowed while editing.
      await section._save()
      on_close()
    } finally {
      // eslint-disable-next-line require-atomic-updates -- re-entrancy guard, no concurrent submit
      saving = false
    }
  }
</script>

<div class="section-editor">
  <!-- Entry link -->
  <div class="entry-link">
    <span class="field-label">{t('grammar.documents_entry')}</span>
    {#if linked_entry_id}
      <div class="linked">
        <strong>{linked_lexeme || linked_entry_id}</strong>
        <button type="button" class="btn-ghost unlink" aria-label={t('misc.remove')} onclick={() => { linked_entry_id = null }}>
          <IconMdiClose />
        </button>
      </div>
    {:else}
      <div class="search-wrap">
        <IconMdiMagnify class="section-search-icon" />
        <input type="search" class="search-input" placeholder={t('entry.search_entries')} bind:value={search_text} />
      </div>
      {#if result_ids.length}
        <div class="results">
          {#each result_ids as id (id)}
            <button type="button" class="result-row" onclick={() => { linked_entry_id = id; search_text = '' }}>
              {entry_lexeme(id) || '—'}
            </button>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  {#each languages as bcp (bcp)}
    <fieldset class="lang-group">
      <legend>{language_label(bcp)}</legend>
      <input
        type="text"
        class="title-input"
        placeholder={t('grammar.section_title')}
        bind:value={draft_title[bcp]} />
      {#await markdown_editor_promise then { default: MarkdownEditor }}
        <MarkdownEditor bind:value={draft_body[bcp]} placeholder={t('grammar.section_body')} />
      {/await}
    </fieldset>
  {/each}

  <div class="usage">
    {#if show_usage}
      <span class="field-label">{t('grammar.usage_conditions')}</span>
      {#each languages as bcp (bcp)}
        <div class="usage-lang">
          <span class="usage-lang-label">{language_label(bcp)}</span>
          {#await markdown_editor_promise then { default: MarkdownEditor }}
            <MarkdownEditor bind:value={draft_usage[bcp]} preset="minimal" placeholder={t('grammar.usage_conditions_hint')} />
          {/await}
        </div>
      {/each}
    {:else}
      <button type="button" class="btn-ghost add-usage" onclick={() => { show_usage = true }}>
        + {t('grammar.usage_conditions')}
      </button>
    {/if}
  </div>

  <div class="actions">
    <button type="button" class="btn btn-default" onclick={on_close}>{t('misc.cancel')}</button>
    <HeadlessButton class="btn-primary btn-default" onclick={save}>{t('misc.save')}</HeadlessButton>
  </div>
</div>

<style>
  .section-editor {
    border: 1px solid var(--primary);
    border-radius: 0.5rem;
    padding: 0.875rem;
    margin: 0.5rem 0;
    background: color-mix(in srgb, var(--primary) 4%, var(--background));
  }

  .field-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-secondary);
    margin-bottom: 0.375rem;
  }

  .entry-link {
    margin-bottom: 1rem;
  }

  .linked {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .unlink {
    padding: 0.125rem;
    color: var(--color-secondary);
  }

  .search-wrap {
    position: relative;
    max-width: 22rem;
  }

  :global(.section-search-icon) {
    position: absolute;
    left: 0.625rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-secondary);
  }

  .search-input {
    width: 100%;
    padding: 0.4rem 0.75rem 0.4rem 2rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border-color);
    background: var(--background);
    color: var(--color);
    font-size: 0.875rem;
  }

  .results {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    margin-top: 0.375rem;
    max-width: 22rem;
  }

  .result-row {
    text-align: left;
    padding: 0.375rem 0.5rem;
    border-radius: 0.375rem;
    border: 0;
    background: transparent;
    color: var(--color);
    cursor: pointer;
    font-size: 0.875rem;
  }

  .result-row:hover {
    background: var(--surface);
  }

  .lang-group {
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .lang-group legend {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-secondary);
    padding: 0 0.375rem;
  }

  .title-input {
    width: 100%;
    padding: 0.4rem 0.625rem;
    border-radius: 0.375rem;
    border: 1px solid var(--border-color);
    background: var(--background);
    color: var(--color);
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .usage {
    margin-bottom: 0.75rem;
  }

  .usage-lang {
    margin-bottom: 0.5rem;
  }

  .usage-lang-label {
    display: block;
    font-size: 0.7rem;
    color: var(--color-secondary);
    margin-bottom: 0.25rem;
  }

  .add-usage {
    font-size: 0.8125rem;
    color: var(--primary);
    padding: 0.25rem 0;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
</style>
