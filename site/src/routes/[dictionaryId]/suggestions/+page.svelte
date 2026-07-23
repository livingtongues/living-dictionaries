<script lang="ts">
  import { SvelteMap, SvelteSet } from 'svelte/reactivity'
  import { page } from '$app/state'
  import type { DictRowType } from '$lib/db/dict-client/dict-live-db.svelte'
  import type { SuggestionOccurrence, SuggestionRow } from '$lib/corpus/aggregate-suggestions'
  import { aggregate_suggestions } from '$lib/corpus/aggregate-suggestions'
  import EntryPickerModal from '$lib/corpus/EntryPickerModal.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { get_headword } from '$lib/orthography/orthographies'
  import IconSvgSpinners3DotsFade from '~icons/svg-spinners/3-dots-fade'
  import IconFaSolidPlus from '~icons/fa-solid/plus'
  import IconMdiLinkVariant from '~icons/mdi/link-variant'
  import IconMdiEyeOff from '~icons/mdi/eye-off'
  import IconMdiRestore from '~icons/mdi/restore'

  const { t, dictionary, writes } = $derived(page.data)
  const dict_db = $derived(page.data.dict_db)

  const loading = $derived(dict_db?.sentences.loading ?? true)

  const facets = $derived.by(() => aggregate_suggestions({
    sentences: dict_db?.sentences.rows ?? [],
    ignored_forms: new Set((dict_db?.ignored_forms.rows ?? []).map(row => row.form)),
  }))

  // id → sentence over the ALREADY-loaded rows (the aggregation source) — the
  // lazy `.id()` row store loads async and left sample snippets blank on first paint.
  const sentence_by_id = $derived.by(() => {
    const map = new SvelteMap<string, DictRowType<'sentences'>>()
    for (const sentence of dict_db?.sentences.rows ?? []) map.set(sentence.id, sentence)
    return map
  })

  type FacetName = 'unmatched' | 'ambiguous' | 'ignored'
  let facet = $state<FacetName>('unmatched')
  const rows = $derived(facets[facet])

  const selected = new SvelteSet<string>()
  function switch_facet(next: FacetName) {
    facet = next
    selected.clear()
  }

  let link_row = $state<SuggestionRow | null>(null)
  let busy = $state(false)

  async function run(action: () => Promise<unknown>) {
    if (busy) return
    busy = true
    try {
      await action()
    } finally {
      busy = false
      link_row = null
    }
  }

  function first_occurrence(row: SuggestionRow): SuggestionOccurrence | undefined {
    return row.occurrences[0]
  }

  function snippet(row: SuggestionRow): { pre: string, hit: string, post: string, href: string } | null {
    const occurrence = first_occurrence(row)
    if (!occurrence) return null
    const sentence = sentence_by_id.get(occurrence.sentence_id)
    const text = sentence?.text?.[occurrence.orthography]
    if (!text) return null
    const window = 40
    const pre_start = Math.max(0, occurrence.start - window)
    return {
      pre: (pre_start > 0 ? '…' : '') + text.slice(pre_start, occurrence.start),
      hit: text.slice(occurrence.start, occurrence.end),
      post: text.slice(occurrence.end, occurrence.end + window) + (occurrence.end + window < text.length ? '…' : ''),
      href: occurrence.text_id
        ? `/${dictionary.url}/text/${occurrence.text_id}#${occurrence.sentence_id}`
        : `/${dictionary.url}/sentence/${occurrence.sentence_id}`,
    }
  }

  function candidate_headword(entry_id: string): string {
    const entry = dict_db?.entries.id(entry_id)
    return get_headword({ lexeme: entry?.lexeme ?? null, orthographies: dictionary.orthographies }).value || '—'
  }

  function create_entry(row: SuggestionRow) {
    const occurrence = first_occurrence(row)
    void run(() => writes.create_entry_from_form({
      lexeme: { [occurrence?.orthography ?? 'default']: row.display_form },
      form: row.key,
    }))
  }

  function link_to_entry(entry_id: string) {
    const row = link_row
    if (!row) return
    void run(() => writes.link_form({ form: row.key, entry_id }))
  }

  function pick_candidate(row: SuggestionRow, entry_id: string) {
    if (!confirm(t('token.link_form_confirm', { values: { form: row.display_form } }))) return
    void run(() => writes.link_form({ form: row.key, entry_id }))
  }

  function ignore_row(row: SuggestionRow) {
    if (!confirm(t('token.ignore_everywhere_confirm', { values: { form: row.display_form } }))) return
    void run(() => writes.ignore_form({ form: row.key }))
  }

  function restore_row(row: SuggestionRow) {
    void run(() => writes.restore_form({ form: row.key }))
  }

  function bulk_ignore() {
    const keys = [...selected]
    if (!keys.length) return
    if (!confirm(t('token.bulk_ignore_confirm', { values: { count: String(keys.length) } }))) return
    void run(async () => {
      for (const key of keys)
        await writes.ignore_form({ form: key })
      selected.clear()
    })
  }

  function toggle_selected(key: string) {
    if (selected.has(key)) selected.delete(key)
    else selected.add(key)
  }

  function occurrence_label(row: SuggestionRow): string {
    if (row.count === 1)
      return t('token.occurrence_count_one')
    return t('token.occurrence_count', { values: { count: String(row.count), sentences: String(row.sentence_count) } })
  }

  const empty_key = $derived(({ unmatched: 'token.no_unmatched', ambiguous: 'token.no_ambiguous', ignored: 'token.no_ignored' } as const)[facet])
</script>

<SeoMetaTags title={t('token.suggestions')} dictionaryName={dictionary.name} description={t('token.suggestions_intro')} />

<div class="suggestions-page">
  <div class="heading-row">
    <h2>{t('token.suggestions')}</h2>
  </div>
  <p class="intro">{t('token.suggestions_intro')}</p>

  <div class="facet-row" role="tablist">
    {#each [['unmatched', 'token.facet_unmatched'], ['ambiguous', 'token.facet_ambiguous'], ['ignored', 'token.facet_ignored']] as const as [name, label_key] (name)}
      <button
        type="button"
        role="tab"
        aria-selected={facet === name}
        class="facet-chip"
        class:active={facet === name}
        onclick={() => switch_facet(name)}>
        {t(label_key)}
        <span class="chip-count">{facets[name].length}</span>
      </button>
    {/each}
  </div>

  {#if selected.size && facet !== 'ignored'}
    <div class="bulk-bar">
      <button type="button" class="btn-danger btn-default" disabled={busy} onclick={bulk_ignore}>
        <IconMdiEyeOff style="margin-top: -0.125rem" />
        {t('token.bulk_ignore', { values: { count: String(selected.size) } })}
      </button>
      <button type="button" class="btn-ghost btn-default" onclick={() => selected.clear()}>✕</button>
    </div>
  {/if}

  {#if rows.length}
    <ul class="rows">
      {#each rows as row (row.key)}
        {@const sample = snippet(row)}
        <li class="row">
          {#if facet !== 'ignored'}
            <input
              type="checkbox"
              class="row-check"
              checked={selected.has(row.key)}
              onchange={() => toggle_selected(row.key)} />
          {/if}
          <div class="row-main">
            <div class="row-head">
              <span class="form">{row.display_form}</span>
              <span class="count">{occurrence_label(row)}</span>
              {#if facet === 'ignored' && row.everywhere}
                <span class="everywhere-badge">{t('token.ignored_everywhere')}</span>
              {/if}
            </div>
            {#if sample}
              <a class="sample" href={sample.href}>
                {sample.pre}<mark>{sample.hit}</mark>{sample.post}
              </a>
            {/if}
            {#if facet === 'ambiguous' && row.candidates?.length}
              <div class="candidates">
                {#each row.candidates as candidate_id (candidate_id)}
                  <button type="button" class="candidate" disabled={busy} onclick={() => pick_candidate(row, candidate_id)}>
                    {candidate_headword(candidate_id)}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
          <div class="row-actions">
            {#if facet === 'ignored'}
              <button type="button" class="btn-ghost btn-sm" disabled={busy} onclick={() => restore_row(row)}>
                <IconMdiRestore style="margin-top: -0.125rem" />
                {t('token.restore')}
              </button>
            {:else}
              {#if facet === 'unmatched'}
                <button type="button" class="btn-primary btn-sm" disabled={busy} onclick={() => create_entry(row)}>
                  <IconFaSolidPlus style="margin-top: -0.125rem" />
                  {t('token.create_entry', { values: { form: row.display_form } })}
                </button>
              {/if}
              <button type="button" class="btn-ghost btn-sm" disabled={busy} onclick={() => link_row = row}>
                <IconMdiLinkVariant style="margin-top: -0.125rem" />
                {t('token.link_entry')}
              </button>
              <button type="button" class="btn-ghost btn-sm" disabled={busy} onclick={() => ignore_row(row)}>
                <IconMdiEyeOff style="margin-top: -0.125rem" />
                {t('token.ignore')}
              </button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {:else if loading}
    <div class="state-note"><IconSvgSpinners3DotsFade /></div>
  {:else}
    <div class="state-note">{t(empty_key)}</div>
  {/if}
</div>

{#if link_row}
  <EntryPickerModal
    initial_query={link_row.display_form}
    on_pick={link_to_entry}
    on_close={() => link_row = null} />
{/if}

<style>
  .suggestions-page {
    padding-top: 0.5rem;
    max-width: 56rem;
  }

  .heading-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.25rem;
  }

  h2 {
    font-size: 1.375rem;
    font-weight: 600;
  }

  .intro {
    color: var(--color-secondary);
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  .facet-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-bottom: 1rem;
  }

  .facet-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border-radius: 999px;
    border: 1px solid var(--border-color);
    background: var(--background);
    color: var(--color);
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .facet-chip:hover {
    border-color: var(--primary);
  }

  .facet-chip.active {
    background: color-mix(in srgb, var(--primary) 14%, var(--background));
    border-color: var(--primary);
    color: var(--primary);
  }

  .chip-count {
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0 0.375rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color) 10%, transparent);
  }

  .bulk-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .rows {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
  }

  .row {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem 0.25rem;
    border-bottom: 1px solid var(--border-color);
  }

  .row-check {
    margin-top: 0.375rem;
  }

  .row-main {
    flex: 1;
    min-width: 0;
  }

  .row-head {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .form {
    font-size: 1.0625rem;
    font-weight: 600;
  }

  .count {
    font-size: 0.75rem;
    color: var(--color-secondary);
  }

  .everywhere-badge {
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.0625rem 0.4375rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color) 10%, transparent);
    color: var(--color-secondary);
  }

  .sample {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.8125rem;
    color: var(--color-secondary);
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sample:hover {
    color: var(--color);
  }

  .sample mark {
    background: color-mix(in srgb, var(--primary) 22%, transparent);
    color: inherit;
    border-radius: 3px;
    padding: 0 2px;
  }

  .candidates {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.375rem;
  }

  .candidate {
    padding: 0.1875rem 0.5625rem;
    border-radius: 999px;
    border: 1px solid var(--border-color);
    background: var(--background);
    color: var(--primary);
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .candidate:hover {
    border-color: var(--primary);
    background: color-mix(in srgb, var(--primary) 10%, var(--background));
  }

  .row-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  .state-note {
    padding: 2rem 0;
    color: var(--color-secondary);
    font-size: 0.9375rem;
  }

  @media (max-width: 640px) {
    .row {
      flex-wrap: wrap;
    }

    .row-actions {
      width: 100%;
      justify-content: flex-start;
    }
  }
</style>
