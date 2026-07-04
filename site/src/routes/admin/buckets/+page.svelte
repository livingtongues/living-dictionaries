<script lang="ts">
  import type { RowType } from '$lib/db/client/live/types'
  import type { DictionaryBucket } from '$lib/constants'
  import IconMdiAlert from '~icons/mdi/alert-outline'
  import IconMdiBookSearchOutline from '~icons/mdi/book-search-outline'
  import IconMdiMagnify from '~icons/mdi/magnify'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { DICTIONARY_BUCKETS } from '$lib/constants'
  import { format_date } from '$lib/utils/format-relative-time'
  import { score_record } from '$lib/utils/fuzzy-score'

  let { data } = $props()
  const db = $derived(data.db)

  type Filter = DictionaryBucket | 'unclassified' | 'mismatch'

  const dicts_query = $derived(db?.dictionaries.query({ order_by: 'entry_count DESC', limit: 99999 }))
  const roles_query = $derived(db?.dictionary_roles.query({ limit: 99999 }))
  const loading = $derived((dicts_query?.loading ?? true) || (roles_query?.loading ?? true))

  const member_counts = $derived.by(() => {
    const counts: Record<string, number> = {}
    for (const role of roles_query?.rows ?? [])
      counts[role.dictionary_id] = (counts[role.dictionary_id] || 0) + 1
    return counts
  })

  /** bucket says public but the dict isn't listed (or vice versa) — needs a human. */
  function is_mismatch(dict: RowType<'dictionaries'>): boolean {
    if (dict.bucket === 'public' && dict.public !== 1) return true
    if (dict.public === 1 && dict.bucket && dict.bucket !== 'public') return true
    return false
  }

  const counts = $derived.by(() => {
    const tally: Record<Filter, number> = { public: 0, unlisted: 0, secure: 0, conlang: 0, glossary: 0, delete: 0, unclassified: 0, mismatch: 0 }
    for (const dict of dicts_query?.rows ?? []) {
      tally[dict.bucket ?? 'unclassified'] += 1
      if (is_mismatch(dict)) tally.mismatch += 1
    }
    return tally
  })

  let active_filter = $state<Filter>((page.url.searchParams.get('bucket') as Filter) ?? 'unclassified')
  function set_filter(filter: Filter) {
    active_filter = filter
    try {
      void goto(`?bucket=${filter}`, { keepFocus: true, noScroll: true, replaceState: true })
    } catch {
    // svelte-look story harness has no router
    }
  }

  let search = $state('')
  const search_query = $derived(search.trim())
  const search_active = $derived(search_query.length > 0)

  const filtered = $derived.by(() => {
    const scored: { dict: RowType<'dictionaries'>, score: number }[] = []
    for (const dict of dicts_query?.rows ?? []) {
      const in_filter = active_filter === 'mismatch'
        ? is_mismatch(dict)
        : (dict.bucket ?? 'unclassified') === active_filter
      if (!in_filter) continue
      let score = 0
      if (search_active) {
        score = score_record(search_query, [
          { value: dict.name ?? '', weight: 1 },
          { value: dict.id ?? '', weight: 0.6 },
          { value: dict.con_language_description ?? '', weight: 0.3 },
        ])
        if (score === 0) continue
      }
      scored.push({ dict, score })
    }
    if (search_active) scored.sort((a, b) => b.score - a.score)
    return scored.map(entry => entry.dict)
  })

  const MAX_RENDER = 150
  const rendered = $derived(filtered.slice(0, MAX_RENDER))

  async function set_bucket(dict: RowType<'dictionaries'>, bucket: DictionaryBucket) {
    if (dict.bucket === bucket) return
    await db?.dictionaries.update({ id: dict.id, bucket })
    await data.sync?.sync()
  }

  function snippet_of(dict: RowType<'dictionaries'>): string {
    const text = [dict.con_language_description, dict.author_connection].filter(Boolean).join(' · ')
    return text.replace(/\s+/g, ' ').trim()
  }

  const filter_pills: { key: Filter, label: string }[] = [
    { key: 'unclassified', label: 'unclassified' },
    { key: 'delete', label: 'delete' },
    { key: 'conlang', label: 'conlang' },
    { key: 'glossary', label: 'glossary' },
    { key: 'unlisted', label: 'unlisted' },
    { key: 'public', label: 'public' },
    { key: 'secure', label: 'secure' },
    { key: 'mismatch', label: 'mismatch' },
  ]
</script>

<div class="filter-row">
  <h1 class="page-title">Buckets</h1>
  <div class="filter-pills">
    {#each filter_pills as pill (pill.key)}
      {#if pill.key !== 'secure' || counts.secure > 0}
        <button type="button" onclick={() => set_filter(pill.key)} class={['filter-pill', pill.key, { active: active_filter === pill.key }]}>
          {pill.label}
          <span class={['filter-count', { active: active_filter === pill.key }]}>{counts[pill.key].toLocaleString()}</span>
        </button>
      {/if}
    {/each}
  </div>
</div>

<p class="explainer">
  Who we serve (<b>public</b> / <b>unlisted</b> / <b>secure</b>) vs what we tolerate (<b>conlang</b> / <b>glossary</b> — media storage will be disabled) vs <b>delete</b> (queued for teardown — nothing is deleted from this page). New dictionaries land in <b>unclassified</b>.
</p>

<div class="search-wrap">
  <IconMdiMagnify class="search-icon" />
  <input type="search" placeholder="Search name, id, description…" bind:value={search} class="search-input" />
</div>

{#if loading}
  <p class="muted">Loading dictionaries…</p>
{:else if filtered.length === 0}
  <div class="empty">
    <IconMdiBookSearchOutline style="font-size: 2.25rem; opacity: 0.5; margin-bottom: 0.5rem" />
    <p>No {active_filter} dictionaries{#if search_active} match this search{/if}.</p>
  </div>
{:else}
  <div class="results-count">
    Showing {rendered.length.toLocaleString()} of {filtered.length.toLocaleString()} · sorted by {search_active ? 'relevance' : 'entry count'}{#if filtered.length > MAX_RENDER} · refine search to see more{/if}
  </div>

  <div class="rows">
    {#each rendered as dict (dict.id)}
      {@const snippet = snippet_of(dict)}
      <div class="dict-card">
        <div class="dict-main">
          <div class="dict-title">
            <a href="/{dict.url || dict.id}" target="_blank" class="dict-name">{dict.name}</a>
            <span class="dict-id">{dict.id}</span>
            {#if is_mismatch(dict)}
              <span class="mismatch-badge" title="bucket and public flag disagree — bucket says {dict.bucket} but public = {dict.public ? 'yes' : 'no'}">
                <IconMdiAlert style="font-size: 0.875rem" />
                {dict.public === 1 ? 'listed publicly' : 'not listed'}
              </span>
            {/if}
          </div>
          <div class="dict-facts">
            <span><b>{(dict.entry_count ?? 0).toLocaleString()}</b> entries</span>
            {#if member_counts[dict.id]}<span>{member_counts[dict.id]} member{member_counts[dict.id] === 1 ? '' : 's'}</span>{/if}
            {#if dict.iso_639_3}<span class="signal" title="ISO 639-3 code — real-language signal">{dict.iso_639_3}</span>{/if}
            {#if dict.glottocode}<span class="signal" title="Glottocode — real-language signal">{dict.glottocode}</span>{/if}
            {#if dict.location}<span>{dict.location}</span>{/if}
            <span title="created {dict.created_at}">created {format_date(dict.created_at)}</span>
            <span title="updated {dict.updated_at}">updated {format_date(dict.updated_at)}</span>
          </div>
          {#if snippet}
            <div class="dict-snippet" title={snippet}>{snippet}</div>
          {/if}
        </div>
        <div class="bucket-buttons">
          {#each DICTIONARY_BUCKETS as bucket (bucket)}
            <button
              type="button"
              class={['bucket-btn', bucket, { active: dict.bucket === bucket }]}
              onclick={() => set_bucket(dict, bucket)}>
              {bucket}
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .filter-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: 0.75rem;
    row-gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
  }
  .filter-pills {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
  }
  .filter-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    border: 1px solid var(--border-color);
    background: transparent;
    color: var(--color);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
  }
  .filter-pill:hover {
    background: var(--surface);
  }
  .filter-pill.active {
    background: var(--primary);
    color: var(--on-primary);
    border-color: transparent;
  }
  .filter-pill.active.delete, .filter-pill.active.mismatch {
    background: var(--danger);
  }
  .filter-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.4rem;
    height: 1.25rem;
    padding: 0 0.375rem;
    border-radius: 9999px;
    font-size: 10px;
    font-weight: 600;
    background: var(--surface);
    color: var(--color-secondary);
  }
  .filter-count.active {
    background: rgb(255 255 255 / 0.25);
    color: inherit;
  }
  .explainer {
    font-size: 0.8125rem;
    color: var(--color-secondary);
    margin: 0 0 0.75rem;
    max-width: 60rem;
  }
  .search-wrap {
    position: relative;
    margin-bottom: 0.75rem;
  }
  :global(.search-icon) {
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
  .muted {
    color: var(--color-secondary);
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-top: 4rem;
    padding-bottom: 4rem;
    color: var(--color-secondary);
  }
  .results-count {
    font-size: 0.75rem;
    color: var(--color-secondary);
    margin-bottom: 0.5rem;
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .dict-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.625rem 0.875rem;
    background: var(--surface);
    border-radius: 0.75rem;
  }
  .dict-main {
    flex: 1;
    min-width: 0;
  }
  .dict-title {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem;
  }
  .dict-name {
    font-weight: 600;
    color: var(--color);
    text-decoration: none;
  }
  .dict-name:hover {
    color: var(--primary);
  }
  .dict-id {
    font-size: 0.75rem;
    color: var(--color-secondary);
    font-family: var(--font-mono);
  }
  .mismatch-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--danger);
  }
  .dict-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.875rem;
    font-size: 0.75rem;
    color: var(--color-secondary);
    margin-top: 0.125rem;
  }
  .signal {
    color: var(--success);
    font-weight: 600;
  }
  .dict-snippet {
    font-size: 0.75rem;
    color: var(--color-secondary);
    margin-top: 0.25rem;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .bucket-buttons {
    display: grid;
    grid-template-columns: repeat(3, auto);
    gap: 0.25rem;
    flex-shrink: 0;
  }
  .bucket-btn {
    padding: 0.2rem 0.5rem;
    border-radius: 9999px;
    border: 1px solid var(--border-color);
    background: transparent;
    color: var(--color-secondary);
    font-size: 0.6875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background var(--transition-time), color var(--transition-time);
  }
  .bucket-btn:hover {
    background: color-mix(in srgb, var(--color) 8%, transparent);
    color: var(--color);
  }
  .bucket-btn.active {
    border-color: transparent;
    font-weight: 700;
    color: var(--on-primary);
  }
  .bucket-btn.active.public { background: var(--success); }
  .bucket-btn.active.unlisted { background: var(--primary); }
  .bucket-btn.active.secure { background: color-mix(in srgb, var(--primary) 55%, var(--success)); }
  .bucket-btn.active.conlang { background: var(--warning); }
  .bucket-btn.active.glossary { background: color-mix(in srgb, var(--warning) 55%, var(--danger)); }
  .bucket-btn.active.delete { background: var(--danger); }
</style>
