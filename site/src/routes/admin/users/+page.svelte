<script lang="ts">
  import type { RowType } from '$lib/db/client/live/types'
  import IconMdiAccountSearch from '~icons/mdi/account-search'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiDownload from '~icons/mdi/download'
  import IconMdiMagnify from '~icons/mdi/magnify'
  import IconMdiMenuDown from '~icons/mdi/menu-down'
  import IconMdiMenuUp from '~icons/mdi/menu-up'
  import AdminBadge from '$lib/admin/AdminBadge.svelte'
  import DictionaryPickerModal from '$lib/admin/DictionaryPickerModal.svelte'
  import { get_admin_level } from '$lib/admins'
  import { download_as_csv } from '$lib/utils/csv'
  import { format_date } from '$lib/utils/format-relative-time'
  import { score_record } from '$lib/utils/fuzzy-score'
  import { api_admin_user_unsubscribe } from '../../api/admin/users/[id]/unsubscribe/_call'
  import { api_dictionaries_id_roles_post } from '../../api/dictionaries/[id]/roles/_call'

  type DictionaryRole = 'manager' | 'editor' | 'contributor'

  let { data } = $props()
  const db = $derived(data.db)

  type UserFilter = 'all' | 'active_30' | 'unsubscribed' | 'with_roles'
  type SortKey = 'name' | 'email' | 'roles' | 'threads' | 'last_msg' | 'last_visit' | 'joined' | 'unsub'

  const users_query = $derived(db?.users.query({ order_by: 'COALESCE(updated_at, created_at) DESC', limit: 9999 }))
  const aliases_query = $derived(db?.email_aliases.query({ limit: 9999 }))
  const threads_query = $derived(db?.message_threads.query({ where: 'from_user_id IS NOT NULL', order_by: 'last_message_at DESC', limit: 9999 }))
  const roles_query = $derived(db?.dictionary_roles.query({ limit: 9999 }))

  const loading = $derived(
    (users_query?.loading ?? true)
      || (aliases_query?.loading ?? true)
      || (threads_query?.loading ?? true)
      || (roles_query?.loading ?? true),
  )

  const aliases_by_user_id = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const map = new Map<string, string[]>()
    for (const alias of aliases_query?.rows ?? []) {
      const list = map.get(alias.user_id) ?? []
      list.push(alias.email)
      map.set(alias.user_id, list)
    }
    return map
  })

  interface RoleCounts { manager: number, editor: number, contributor: number, total: number }
  const roles_by_user_id = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const map = new Map<string, RoleCounts>()
    for (const role of roles_query?.rows ?? []) {
      const counts = map.get(role.user_id) ?? { manager: 0, editor: 0, contributor: 0, total: 0 }
      counts[role.role] += 1
      counts.total += 1
      map.set(role.user_id, counts)
    }
    return map
  })

  const role_rows_by_user_id = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const map = new Map<string, RowType<'dictionary_roles'>[]>()
    for (const role of roles_query?.rows ?? []) {
      const list = map.get(role.user_id) ?? []
      list.push(role)
      map.set(role.user_id, list)
    }
    return map
  })

  const dictionaries_objects = $derived(db?.dictionaries.objects ?? {})
  const all_dictionaries = $derived(db?.dictionaries.rows ?? [])

  const thread_stats_by_user_id = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const map = new Map<string, { count: number, last_at: string }>()
    for (const thread of threads_query?.rows ?? []) {
      if (!thread.from_user_id)
        continue
      const existing = map.get(thread.from_user_id)
      if (!existing) {
        map.set(thread.from_user_id, { count: 1, last_at: thread.last_message_at })
      } else {
        existing.count += 1
        if (thread.last_message_at > existing.last_at)
          existing.last_at = thread.last_message_at
      }
    }
    return map
  })

  const summary = $derived.by(() => {
    let unsubscribed = 0; let active_30 = 0; let with_roles = 0
    for (const user of users_query?.rows ?? []) {
      if (user.unsubscribed_from_emails) unsubscribed += 1
      if (is_active_last_30_days(user.last_visit_at)) active_30 += 1
      if ((roles_by_user_id.get(user.id)?.total ?? 0) > 0) with_roles += 1
    }
    const total = users_query?.rows.length ?? 0
    return { total, unsubscribed, active_30, with_roles }
  })

  let search = $state('')
  let user_filter = $state<UserFilter>('all')
  let sort_key = $state<SortKey>('last_visit')
  let sort_desc = $state(true)

  function toggle_filter(target: UserFilter) {
    if (target === 'all') user_filter = 'all'
    else user_filter = user_filter === target ? 'all' : target
  }

  function set_sort(key: SortKey) {
    if (sort_key === key) sort_desc = !sort_desc
    else { sort_key = key; sort_desc = true }
  }

  interface FilterPill { key: UserFilter, label: string, count: number }
  const filter_pills = $derived<FilterPill[]>([
    { key: 'all', label: 'all', count: summary.total },
    { key: 'active_30', label: 'active last 30 days', count: summary.active_30 },
    { key: 'with_roles', label: 'with dictionary roles', count: summary.with_roles },
    { key: 'unsubscribed', label: 'unsubscribed', count: summary.unsubscribed },
  ])

  interface UserRow {
    id: string
    name: string | null
    email: string | null
    unsubscribed: boolean
    aliases: string[]
    roles: RoleCounts
    thread_count: number
    last_msg_at: string | null
    last_visit_at: string | null
    joined: string | null
  }

  const search_query = $derived(search.trim())
  const search_active = $derived(search_query.length > 0)

  const rows = $derived.by<UserRow[]>(() => {
    const scored: { row: UserRow, score: number }[] = []
    for (const user of users_query?.rows ?? []) {
      const aliases = aliases_by_user_id.get(user.id) ?? []
      const stats = thread_stats_by_user_id.get(user.id)
      const roles = roles_by_user_id.get(user.id) ?? { manager: 0, editor: 0, contributor: 0, total: 0 }
      const is_unsub = !!user.unsubscribed_from_emails

      if (user_filter === 'unsubscribed' && !is_unsub) continue
      if (user_filter === 'active_30' && !is_active_last_30_days(user.last_visit_at)) continue
      if (user_filter === 'with_roles' && roles.total === 0) continue

      let score = 0
      if (search_active) {
        score = score_record(search_query, [
          { value: user.name ?? '', weight: 1 },
          { value: user.email ?? '', weight: 1 },
          ...aliases.map(alias => ({ value: alias, weight: 0.8 })),
        ])
        if (score === 0) continue
      }

      scored.push({
        row: {
          id: user.id,
          name: user.name,
          email: user.email,
          unsubscribed: is_unsub,
          aliases,
          roles,
          thread_count: stats?.count ?? 0,
          last_msg_at: stats?.last_at ?? null,
          last_visit_at: user.last_visit_at,
          joined: user.created_at,
        },
        score,
      })
    }

    const dir = sort_desc ? -1 : 1
    scored.sort((a, b) => {
      if (search_active && a.score !== b.score)
        return b.score - a.score
      let av: string | number = ''
      let bv: string | number = ''
      switch (sort_key) {
        case 'name': av = (a.row.name || a.row.email || 'zz').toLowerCase(); bv = (b.row.name || b.row.email || 'zz').toLowerCase(); break
        case 'email': av = (a.row.email || 'zz').toLowerCase(); bv = (b.row.email || 'zz').toLowerCase(); break
        case 'roles': av = a.row.roles.total; bv = b.row.roles.total; break
        case 'threads': av = a.row.thread_count; bv = b.row.thread_count; break
        case 'last_msg': av = a.row.last_msg_at || ''; bv = b.row.last_msg_at || ''; break
        case 'last_visit': av = a.row.last_visit_at || ''; bv = b.row.last_visit_at || ''; break
        case 'joined': av = a.row.joined || ''; bv = b.row.joined || ''; break
        case 'unsub': av = a.row.unsubscribed ? 1 : 0; bv = b.row.unsubscribed ? 1 : 0; break
      }
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })

    return scored.map(s => s.row)
  })

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
  function is_active_last_30_days(iso: string | null | undefined): boolean {
    if (!iso) return false
    return Date.now() - new Date(iso).getTime() <= THIRTY_DAYS_MS
  }

  let add_target = $state<{ email: string, exclude_dictionary_ids: Set<string> } | null>(null)
  let add_role_value = $state<DictionaryRole>('manager')

  function start_add_role(user: UserRow, role: DictionaryRole) {
    if (!user.email) {
      alert('This user has no email on file, so a role cannot be added.')
      return
    }
    const existing = role_rows_by_user_id.get(user.id) ?? []
    const exclude = new Set(existing.filter(existing_role => existing_role.role === role).map(existing_role => existing_role.dictionary_id))
    add_role_value = role
    add_target = { email: user.email, exclude_dictionary_ids: exclude }
  }

  async function confirm_add_role(dictionary_id: string) {
    if (!add_target) return
    const { email } = add_target
    const role = add_role_value
    add_target = null
    const { error } = await api_dictionaries_id_roles_post(dictionary_id, { target_email: email, role })
    if (error) {
      alert(`Could not add role: ${error.message}`)
      return
    }
    await data.sync?.sync()
  }

  async function remove_role(role: RowType<'dictionary_roles'>) {
    const dictionary_name = dictionaries_objects[role.dictionary_id]?.name || role.dictionary_id
    if (!confirm(`Remove ${role.role} role on "${dictionary_name}"?`))
      return
    await role._delete()
    await data.sync?.sync()
  }

  async function toggle_unsubscribed(user_id: string) {
    if (!db) return
    // The list renders from `users_query` (a full-table query store), so flip
    // the row that's actually on screen — the per-id `db.users.id()` store
    // isn't subscribed on this page, so its rows would be empty here.
    const live = users_query?.rows.find(row => row.id === user_id)
    if (!live) return
    const next = !live.unsubscribed_from_emails
    const previous = live.unsubscribed_from_emails
    // Optimistic in-memory update; `users` is download-only on admin clients,
    // so persistence goes through the admin endpoint (not live-db `_save()`).
    live.unsubscribed_from_emails = next ? new Date().toISOString() : null
    const { error } = await api_admin_user_unsubscribe(user_id, { unsubscribed: next })
    if (error) {
      live.unsubscribed_from_emails = previous
      alert(`Could not update subscription: ${error.message}`)
      return
    }
    await data.sync?.sync()
  }

  function download_csv() {
    const records = rows.map(row => ({
      name: row.name || '',
      email: row.email || '',
      aliases: row.aliases.join('; '),
      dictionary_roles: row.roles.total,
      managers: row.roles.manager,
      editors: row.roles.editor,
      contributors: row.roles.contributor,
      threads: row.thread_count,
      last_msg: row.last_msg_at ? new Date(row.last_msg_at).toISOString().slice(0, 10) : '',
      last_visit: row.last_visit_at ? new Date(row.last_visit_at).toISOString().slice(0, 10) : '',
      joined: row.joined ? new Date(row.joined).toISOString().slice(0, 10) : '',
      unsubscribed_from_emails: row.unsubscribed ? 'yes' : '',
      user_id: row.id,
    }))
    download_as_csv(records, 'ld-users')
  }

  const MAX_RENDER = 200
  const rendered_rows = $derived(rows.slice(0, MAX_RENDER))

  function autofocus(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 15)
  }

  interface Col { key: SortKey, label: string, align?: 'left' | 'right' | 'center' }
  const columns: Col[] = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'roles', label: 'Dictionary roles' },
    { key: 'threads', label: 'Threads', align: 'right' },
    { key: 'last_msg', label: 'Last msg', align: 'right' },
    { key: 'last_visit', label: 'Last visit', align: 'right' },
    { key: 'joined', label: 'Joined', align: 'right' },
    { key: 'unsub', label: 'Unsub' },
  ]
</script>

<div class="filter-row">
  <div class="filter-pills">
    {#each filter_pills as filter (filter.key)}
      <button
        type="button"
        onclick={() => toggle_filter(filter.key)}
        class={['filter-pill', { active: user_filter === filter.key }]}>
        {filter.label}
        <span class={['filter-count', { active: user_filter === filter.key }]}>
          {filter.count.toLocaleString()}
        </span>
      </button>
    {/each}
  </div>

  <button type="button" onclick={download_csv} disabled={rows.length === 0} class="btn btn-default csv-btn">
    <IconMdiDownload style="margin-right: 0.25rem" />
    Download {rows.length.toLocaleString()} as CSV
  </button>
</div>

<div class="search-wrap">
  <IconMdiMagnify class="search-icon" />
  <input
    type="search"
    placeholder="Search name, email, alias…"
    bind:value={search}
    use:autofocus
    class="search-input" />
</div>

{#if loading}
  <p class="muted">Loading users…</p>
{:else if rows.length === 0}
  <div class="empty">
    <IconMdiAccountSearch style="font-size: 2.25rem; opacity: 0.5; margin-bottom: 0.5rem" />
    <p>No users match this filter.</p>
  </div>
{:else}
  <div class="results-count">
    Showing {rendered_rows.length.toLocaleString()} of {rows.length.toLocaleString()}{#if search_active} · sorted by relevance{/if}{#if rows.length > MAX_RENDER} · refine search or filter to see more{/if}
  </div>

  <div class="table-wrap">
    <table class="users-table">
      <thead>
        <tr>
          {#each columns as col (col.key)}
            <th class={['th', col.align === 'right' ? 'align-right' : col.align === 'center' ? 'align-center' : '']}>
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
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rendered_rows as row (row.id)}
          {@const row_admin_level = get_admin_level(row.email)}
          {@const user_roles = role_rows_by_user_id.get(row.id) ?? []}
          <tr class="user-row">
            <td class="td td-name">
              <div class="name-row">
                <a href="/admin/users/{row.id}" class="name-link">
                  {row.name || '(no name)'}
                </a>
                {#if row_admin_level !== null}
                  <AdminBadge level={row_admin_level} />
                {/if}
              </div>
            </td>
            <td class="td td-email">
              <div class="ellipsis" title={row.email ?? ''}>{row.email || ''}</div>
              {#each row.aliases as alias (alias)}
                <div class="alias-line" title={alias}>{alias}</div>
              {/each}
            </td>
            <td class="td td-roles">
              <div class="roles-cell">
                {#each user_roles as role (role.id)}
                  <span
                    class={['role-badge', `role-${role.role}`]}
                    title="{role.role} · {dictionaries_objects[role.dictionary_id]?.name || role.dictionary_id}">
                    <a href="/{role.dictionary_id}" target="_blank" rel="noreferrer" class="role-badge-link">
                      {dictionaries_objects[role.dictionary_id]?.name || role.dictionary_id}
                    </a>
                    <button
                      type="button"
                      title="Remove role"
                      aria-label="Remove role"
                      onclick={() => remove_role(role)}
                      class="role-badge-remove">
                      <IconMdiClose />
                    </button>
                  </span>
                {/each}
                <select
                  aria-label="Add dictionary role"
                  value=""
                  onchange={(event) => {
                    start_add_role(row, event.currentTarget.value as DictionaryRole)
                    event.currentTarget.value = ''
                  }}
                  class="add-role-select">
                  <option value="" disabled selected>+ role…</option>
                  <option value="manager">+ manager</option>
                  <option value="editor">+ editor</option>
                  <option value="contributor">+ contributor</option>
                </select>
              </div>
            </td>
            <td class="td align-right nowrap">
              {#if row.thread_count > 0}
                {row.thread_count}
              {:else}
                <span class="dim">—</span>
              {/if}
            </td>
            <td class="td align-right nowrap meta-small">
              {format_date(row.last_msg_at)}
            </td>
            <td class="td align-right nowrap meta-small">
              {format_date(row.last_visit_at)}
            </td>
            <td class="td align-right nowrap meta-small">
              {format_date(row.joined)}
            </td>
            <td class="td nowrap">
              <button
                type="button"
                onclick={() => toggle_unsubscribed(row.id)}
                title={row.unsubscribed ? 'Click to re-subscribe' : 'Mark unsubscribed from emails'}
                class={['unsub-btn', { unsubscribed: row.unsubscribed }]}>
                {row.unsubscribed ? 'unsubscribed' : 'subscribe'}
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

{#if add_target}
  {@const excluded = add_target.exclude_dictionary_ids}
  <DictionaryPickerModal
    dictionaries={all_dictionaries.filter(dictionary => !excluded.has(dictionary.id))}
    on_select={confirm_add_role}
    on_close={() => add_target = null} />
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
  .filter-pills {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
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
    transition: background-color 0.15s, color 0.15s, border-color 0.15s;
  }
  .filter-pill:hover {
    background: var(--surface);
  }
  .filter-pill.active {
    background: var(--primary);
    color: var(--on-primary);
    border-color: transparent;
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
  .results-count {
    font-size: 0.75rem;
    color: var(--color-secondary);
    margin-bottom: 0.5rem;
  }
  .table-wrap {
    overflow-x: auto;
    border-radius: 0.5rem;
    border: 1px solid var(--border-color);
  }
  .users-table {
    width: 100%;
    font-size: 0.875rem;
    border-collapse: collapse;
  }
  .users-table thead {
    background: var(--surface);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .th {
    padding: 0.5rem 0.75rem;
    text-align: left;
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-secondary);
    border-bottom: 1px solid var(--border-color);
  }
  .align-right {
    text-align: right;
  }
  .align-center {
    text-align: center;
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
    transition: color 0.15s;
  }
  .sort-btn:hover {
    color: var(--color);
  }
  .sort-btn.sort-reverse {
    flex-direction: row-reverse;
  }

  .user-row {
    border-bottom: 1px solid var(--border-color);
    transition: background-color 0.15s;
  }
  .user-row:hover {
    background: var(--surface);
  }
  .td {
    padding: 0.5rem 0.75rem;
  }
  .nowrap {
    white-space: nowrap;
  }
  .td-name {
    max-width: 14rem;
  }
  .td-email {
    max-width: 18rem;
  }
  .name-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    min-width: 0;
  }
  .name-link {
    font-weight: 500;
    color: var(--color);
    text-decoration: none;
    transition: color 0.15s;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .name-link:hover {
    color: var(--primary);
  }
  .ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .alias-line {
    font-size: 0.75rem;
    color: var(--color-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta-small {
    font-size: 0.75rem;
    color: var(--color-secondary);
  }
  .dim {
    color: var(--color-secondary);
  }

  .td-roles {
    min-width: 12rem;
    max-width: 20rem;
  }
  .roles-cell {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
  }
  .role-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
    max-width: 9rem;
    padding: 0.0625rem 0.25rem 0.0625rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 500;
  }
  .role-badge-link {
    color: inherit;
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .role-badge-link:hover {
    text-decoration: underline;
  }
  .role-badge-remove {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    color: inherit;
    opacity: 0.55;
    background: transparent;
    border: 0;
    padding: 0;
    cursor: pointer;
    font-size: 0.75rem;
  }
  .role-badge-remove:hover {
    opacity: 1;
  }
  .role-manager {
    background: color-mix(in srgb, var(--primary), transparent 86%);
    color: var(--primary);
  }
  .role-editor {
    background: color-mix(in srgb, var(--warning), transparent 86%);
    color: var(--warning);
  }
  .role-contributor {
    background: color-mix(in srgb, var(--success), transparent 86%);
    color: var(--success);
  }
  .add-role-select {
    font-size: 0.6875rem;
    padding: 0.0625rem 0.25rem;
    border-radius: 9999px;
    border: 1px dashed var(--border-color);
    background: transparent;
    color: var(--color-secondary);
    cursor: pointer;
  }

  .unsub-btn {
    font-size: 0.75rem;
    color: var(--color-secondary);
    background: transparent;
    border: 0;
    cursor: pointer;
    padding: 0;
  }
  .unsub-btn:hover {
    text-decoration: underline;
  }
  .unsub-btn.unsubscribed {
    color: var(--warning);
  }
</style>
