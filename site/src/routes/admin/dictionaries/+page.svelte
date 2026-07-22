<script lang="ts">
  import type { RowType } from '$lib/db/client/live/types'
  import IconMdiBookSearchOutline from '~icons/mdi/book-search-outline'
  import IconMdiDownload from '~icons/mdi/download'
  import IconMdiMagnify from '~icons/mdi/magnify'
  import IconMdiMenuDown from '~icons/mdi/menu-down'
  import IconMdiMenuUp from '~icons/mdi/menu-up'
  import { afterNavigate, goto } from '$app/navigation'
  import { page } from '$app/state'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import type { DictionaryBucket } from '$lib/constants'
  import { download_as_csv } from '$lib/utils/csv'
  import { fill_remaining_height } from '$lib/utils/fill-remaining-height'
  import { format_date } from '$lib/utils/format-relative-time'
  import { score_record } from '$lib/utils/fuzzy-score'
  import { read_choice_param, read_positive_int_param, update_query_params } from '$lib/utils/url-search-params'
  import DictionaryRow from './DictionaryRow.svelte'

  let { data } = $props()
  const db = $derived(data.db)

  const FILTERS = ['public', 'unlisted', 'conlang', 'glossary', 'delete', 'secure', 'unclassified'] as const satisfies readonly (DictionaryBucket | 'unclassified')[]
  type Filter = typeof FILTERS[number]
  const SORT_KEYS = ['name', 'public', 'entry_count', 'managers', 'contributors', 'iso_639_3', 'glottocode', 'location', 'created_at', 'updated_at'] as const
  type SortKey = typeof SORT_KEYS[number]
  const SORT_DIRECTIONS = ['asc', 'desc'] as const
  const URL_DEFAULTS = { filter: 'public', q: '', sort: 'name', dir: 'asc', page: 1 } as const

  interface Editor { role_id: string, user_id: string, name: string, email: string | null }

  const dicts_query = $derived(db?.dictionaries.query({ order_by: 'name ASC', limit: 99999 }))
  const roles_query = $derived(db?.dictionary_roles.query({ limit: 99999 }))
  const invites_query = $derived(db?.invites.query({ where: `status IN ('queued', 'sent')`, limit: 99999 }))
  const users_objects = $derived(db?.users.objects ?? {})
  const all_users = $derived(db?.users.rows ?? [])

  const loading = $derived(
    (dicts_query?.loading ?? true) || (roles_query?.loading ?? true) || (invites_query?.loading ?? true),
  )

  const roles_by_dict = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const map = new Map<string, { managers: Editor[], contributors: Editor[] }>()
    for (const role of roles_query?.rows ?? []) {
      const entry = map.get(role.dictionary_id) ?? { managers: [], contributors: [] }
      const user = users_objects[role.user_id]
      const editor: Editor = { role_id: role.id, user_id: role.user_id, name: user?.name || user?.email || role.user_id, email: user?.email ?? null }
      if (role.role === 'manager') entry.managers.push(editor)
      else if (role.role === 'contributor') entry.contributors.push(editor)
      map.set(role.dictionary_id, entry)
    }
    return map
  })

  const invites_by_dict = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const map = new Map<string, { manager: RowType<'invites'>[], contributor: RowType<'invites'>[] }>()
    for (const invite of invites_query?.rows ?? []) {
      const entry = map.get(invite.dictionary_id) ?? { manager: [], contributor: [] }
      if (invite.role === 'manager') entry.manager.push(invite)
      else if (invite.role === 'contributor') entry.contributor.push(invite)
      map.set(invite.dictionary_id, entry)
    }
    return map
  })

  function dict_filter(dict: RowType<'dictionaries'>): Filter {
    return dict.bucket ?? 'unclassified'
  }

  const counts = $derived.by(() => {
    const tally: Record<Filter, number> = { public: 0, unlisted: 0, secure: 0, conlang: 0, glossary: 0, delete: 0, unclassified: 0 }
    for (const dict of dicts_query?.rows ?? [])
      tally[dict_filter(dict)] += 1
    return tally
  })

  const active_filter = $derived(read_choice_param({ search_params: page.url.searchParams, key: 'filter', choices: FILTERS, fallback: 'public' }))

  function navigate_query({ values, replace_state = false }: { values: Record<string, string | number | null>, replace_state?: boolean }) {
    const url = update_query_params({ url: page.url, values, defaults: URL_DEFAULTS })
    void goto(url, { keepFocus: true, noScroll: true, replaceState: replace_state })
  }

  function set_filter(filter: Filter) {
    navigate_query({ values: { filter, page: null } })
  }

  let search = $state(page.url.searchParams.get('q') ?? page.url.searchParams.get('search') ?? '')
  afterNavigate(() => {
    search = page.url.searchParams.get('q') ?? page.url.searchParams.get('search') ?? ''
  })

  const sort_key = $derived(read_choice_param({ search_params: page.url.searchParams, key: 'sort', choices: SORT_KEYS, fallback: 'name' }))
  const sort_direction = $derived(read_choice_param({ search_params: page.url.searchParams, key: 'dir', choices: SORT_DIRECTIONS, fallback: 'asc' }))
  const sort_desc = $derived(sort_direction === 'desc')

  function set_sort(key: SortKey) {
    const next_desc = sort_key === key ? !sort_desc : key !== 'name'
    navigate_query({ values: { sort: key, dir: next_desc ? 'desc' : 'asc', page: null }, replace_state: true })
  }

  function set_search(value: string) {
    search = value
    navigate_query({ values: { q: value, search: null, page: null }, replace_state: true })
  }

  const search_query = $derived(search.trim())
  const search_active = $derived(search_query.length > 0)

  function sort_value(dict: RowType<'dictionaries'>): string | number {
    switch (sort_key) {
      case 'public': return dict.public ? 1 : 0
      case 'entry_count': return dict.entry_count ?? 0
      case 'managers': return roles_by_dict.get(dict.id)?.managers.length ?? 0
      case 'contributors': return roles_by_dict.get(dict.id)?.contributors.length ?? 0
      case 'created_at': return dict.created_at || ''
      case 'updated_at': return dict.updated_at || ''
      case 'name':
      case 'iso_639_3':
      case 'glottocode':
      case 'location':
        return ((dict[sort_key] as string) || 'zz').toLowerCase()
    }
  }

  const filtered = $derived.by(() => {
    const scored: { dict: RowType<'dictionaries'>, score: number }[] = []
    for (const dict of dicts_query?.rows ?? []) {
      if (dict_filter(dict) !== active_filter) continue
      const roles = roles_by_dict.get(dict.id)
      let score = 0
      if (search_active) {
        score = score_record(search_query, [
          { value: dict.name ?? '', weight: 1 },
          { value: dict.id ?? '', weight: 0.6 },
          ...(roles?.managers ?? []).map(manager => ({ value: manager.name, weight: 0.4 })),
        ])
        if (score === 0) continue
      }
      scored.push({ dict, score })
    }

    const dir = sort_desc ? -1 : 1
    scored.sort((a, b) => {
      if (search_active && a.score !== b.score) return b.score - a.score
      const av = sort_value(a.dict)
      const bv = sort_value(b.dict)
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
    return scored.map(s => s.dict)
  })

  const PAGE_SIZE = 100
  const requested_page = $derived(read_positive_int_param({ search_params: page.url.searchParams, key: 'page' }))
  const page_count = $derived(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)))
  const current_page = $derived(Math.min(requested_page, page_count))
  const rendered = $derived(filtered.slice((current_page - 1) * PAGE_SIZE, current_page * PAGE_SIZE))

  async function on_change() {
    await data.sync?.sync()
  }

  function download_csv() {
    const records = filtered.map((dict) => {
      const roles = roles_by_dict.get(dict.id) ?? { managers: [], contributors: [] }
      const invites = invites_by_dict.get(dict.id) ?? { manager: [], contributor: [] }
      return {
        name: dict.name || '',
        dictionary_id: dict.id,
        public: dict.public ? 'yes' : '',
        entries: dict.entry_count ?? 0,
        managers: roles.managers.map(manager => manager.name).join('; '),
        contributors: roles.contributors.map(contributor => contributor.name).join('; '),
        pending_invites: [...invites.manager, ...invites.contributor].map(invite => `${invite.target_email} (${invite.role})`).join('; '),
        iso_639_3: dict.iso_639_3 || '',
        glottocode: dict.glottocode || '',
        location: dict.location || '',
        latitude: dict.coordinates?.points?.[0]?.coordinates.latitude ?? '',
        longitude: dict.coordinates?.points?.[0]?.coordinates.longitude ?? '',
        gloss_languages: (dict.gloss_languages ?? []).join(', '),
        alternate_names: (dict.alternate_names ?? []).join(', '),
        orthographies: (dict.orthographies ?? []).map(orthography => orthography.name).join(', '),
        language_used_by_community: typeof dict.language_used_by_community === 'number' ? (dict.language_used_by_community ? 'yes' : 'no') : '',
        community_permission: dict.community_permission || '',
        author_connection: dict.author_connection || '',
        con_language_description: dict.con_language_description || '',
        created_at: format_date(dict.created_at),
        updated_at: format_date(dict.updated_at),
      }
    })
    download_as_csv(records, `ld-dictionaries-${active_filter}`)
  }

  function autofocus(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 15)
  }

  const pills: { key: Filter, label: string }[] = FILTERS.map(key => ({ key, label: key }))

  interface Col { key?: SortKey, label: string, align?: 'right' }
  const columns: Col[] = [
    { label: '#' },
    { key: 'name', label: 'Name' },
    { key: 'public', label: 'Visibility' },
    { label: 'Bucket' },
    { key: 'entry_count', label: 'Entries', align: 'right' },
    { key: 'managers', label: 'Managers' },
    { key: 'contributors', label: 'Contributors' },
    { key: 'iso_639_3', label: 'ISO 639-3' },
    { key: 'glottocode', label: 'Glottocode' },
    { label: 'Coordinates' },
    { key: 'location', label: 'Location' },
    { label: 'Gloss langs' },
    { label: 'Alternate names' },
    { label: 'Orthographies' },
    { key: 'created_at', label: 'Created', align: 'right' },
    { key: 'updated_at', label: 'Updated', align: 'right' },
    { label: 'Used by community' },
    { label: 'Community permission' },
    { label: 'Author connection' },
    { label: 'Conlang description' },
    { label: 'Delete' },
  ]
</script>

<div class="filter-row">
  <h1 class="page-title">Dictionaries</h1>
  <div class="filter-pills">
    {#each pills as pill (pill.key)}
      {#if !['secure', 'unclassified'].includes(pill.key) || counts[pill.key] > 0}
        <button type="button" onclick={() => set_filter(pill.key)} class={['filter-pill', pill.key, { active: active_filter === pill.key }]}>
          {pill.label}
          <span class={['filter-count', { active: active_filter === pill.key }]}>{counts[pill.key].toLocaleString()}</span>
        </button>
      {/if}
    {/each}
  </div>
  <button type="button" onclick={download_csv} disabled={filtered.length === 0} class="btn btn-default csv-btn">
    <IconMdiDownload style="margin-right: 0.25rem" />
    Download {filtered.length.toLocaleString()} as CSV
  </button>
</div>

<div class="search-wrap">
  <IconMdiMagnify class="search-icon" />
  <input type="search" placeholder="Search name, id, manager…" value={search} oninput={event => set_search(event.currentTarget.value)} {@attach autofocus} class="search-input" />
</div>

{#if loading}
  <p class="muted">Loading dictionaries…</p>
{:else if filtered.length === 0}
  <div class="empty">
    <IconMdiBookSearchOutline style="font-size: 2.25rem; opacity: 0.5; margin-bottom: 0.5rem" />
    <p>No {active_filter} dictionaries match this search.</p>
  </div>
{:else}
  <div class="table-wrap" use:fill_remaining_height>
    <table class="dicts-table">
      <thead>
        <tr>
          {#each columns as col (col.label)}
            <th class={['th', col.align === 'right' ? 'align-right' : '']}>
              {#if col.key}
                <button type="button" onclick={() => set_sort(col.key)} class={['sort-btn', { 'sort-reverse': col.align === 'right' }]}>
                  {col.label}
                  {#if sort_key === col.key}
                    {#if sort_desc}
                      <IconMdiMenuDown style="font-size: 1rem; color: var(--primary); flex-shrink: 0" />
                    {:else}
                      <IconMdiMenuUp style="font-size: 1rem; color: var(--primary); flex-shrink: 0" />
                    {/if}
                  {/if}
                </button>
              {:else}
                {col.label}
              {/if}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rendered as dict, index (dict.id)}
          {@const roles = roles_by_dict.get(dict.id) ?? { managers: [], contributors: [] }}
          {@const invites = invites_by_dict.get(dict.id) ?? { manager: [], contributor: [] }}
          <tr class="dict-row">
            <DictionaryRow
              index={(current_page - 1) * PAGE_SIZE + index}
              dictionary={dict}
              managers={roles.managers}
              contributors={roles.contributors}
              manager_invites={invites.manager}
              contributor_invites={invites.contributor}
              users={all_users}
              {on_change} />
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <Pagination page={current_page} page_size={PAGE_SIZE} total={filtered.length} noun="dictionaries" on_change={page_number => navigate_query({ values: { page: page_number } })} />
{/if}

<style>
  .filter-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: 0.75rem;
    row-gap: 0.5rem;
    margin-bottom: 1rem;
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
  .filter-pill.active.delete {
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
  .csv-btn {
    margin-left: auto;
  }
  .csv-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
  .table-wrap {
    overflow: auto;
    border-radius: 0.5rem;
    border: 1px solid var(--border-color);
  }
  .dicts-table {
    font-size: 0.875rem;
    border-collapse: collapse;
  }
  .dicts-table thead {
    background: var(--surface);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .th {
    padding: 0.5rem 0.5rem;
    text-align: left;
    font-weight: 600;
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-secondary);
    border-bottom: 1px solid var(--border-color);
    white-space: nowrap;
  }
  .align-right {
    text-align: right;
  }
  .sort-btn {
    background: transparent;
    border: 0;
    padding: 0;
    margin: 0;
    color: inherit;
    font: inherit;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .sort-btn:hover {
    color: var(--color);
  }
  .sort-btn.sort-reverse {
    flex-direction: row-reverse;
  }
  .dict-row {
    border-bottom: 1px solid var(--border-color);
  }
  .dict-row:hover {
    background: color-mix(in srgb, var(--surface), transparent 50%);
  }
</style>
