<script lang="ts">
  import type { LiveDb } from '$lib/db/client/live/live-db.svelte'
  import type { Snippet } from 'svelte'
  import IconMdiCheck from '~icons/mdi/check'
  import IconMdiInboxArrowDown from '~icons/mdi/inbox-arrow-down'
  import IconMdiMagnify from '~icons/mdi/magnify'
  import IconMdiMenuDown from '~icons/mdi/menu-down'
  import IconMdiMenuUp from '~icons/mdi/menu-up'
  import IconMdiTrashCanOutline from '~icons/mdi/trash-can-outline'
  import { ADMINS } from '$lib/admins'
  import { format_relative_time } from '$lib/utils/format-relative-time'
  import AssigneeDropdown from './AssigneeDropdown.svelte'

  interface ThreadRow {
    id: string
    subject: string | null
    from_email: string
    from_name: string | null
    to_email: string | null
    last_message_at: string
    replied_at: string | null
    resolved_at: string | null
    assigned_to_user_id: string | null
    _delete: () => Promise<void>
  }

  interface Props {
    db: LiveDb | null | undefined
    threads: ThreadRow[]
    loading: boolean
    current_user_id: string | undefined
    /** Sync triggerer to call after a successful assign. */
    on_assigned?: () => void | Promise<void>
    /** Display the resolved_at column instead of replied/last-activity emphasis. */
    show_resolved_at?: boolean
    /** Rendered on the right side of the pills row — typically a link to the inverse view (resolved/unresolved). */
    header_trailing?: Snippet
  }
  let { db, threads, loading, current_user_id, on_assigned, show_resolved_at = false, header_trailing }: Props = $props()

  // Single batched query for all admin users — replaces N per-admin queries that
  // were causing race-y empty results on first load.
  const admin_users_query = $derived.by(() => {
    if (!db) return null
    const placeholders = ADMINS.map(() => '?').join(',')
    return db.users.query({
      where: `email IN (${placeholders})`,
      params: ADMINS.map(a => a.email),
    })
  })

  const admin_user_id_by_email = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const map = new Map<string, string>()
    for (const row of admin_users_query?.rows ?? []) {
      if (row.email) map.set(row.email, row.id)
    }
    return map
  })

  const admin_name_by_user_id = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const map = new Map<string, string>()
    for (const admin of ADMINS) {
      const user_id = admin_user_id_by_email.get(admin.email)
      if (user_id) map.set(user_id, admin.name)
    }
    return map
  })

  // ----- Filtering + sorting -----
  type AssignmentFilter = 'all' | 'mine' | 'unassigned' | string
  type SortKey = 'last_message_at' | 'from' | 'subject' | 'to_email' | 'assigned' | 'resolved_at'

  let assignment_filter = $state<AssignmentFilter>('all')
  // show_resolved_at is route-driven and stable for the component's lifetime — the initial-value
  // capture is intentional. Routes never toggle this prop in place.
  // svelte-ignore state_referenced_locally
  let sort_key = $state<SortKey>(show_resolved_at ? 'resolved_at' : 'last_message_at')
  let sort_desc = $state(true)
  let search = $state('')

  function toggle_filter(target: AssignmentFilter) {
    assignment_filter = assignment_filter === target ? 'all' : target
  }
  function set_sort(key: SortKey) {
    if (sort_key === key) sort_desc = !sort_desc
    else { sort_key = key; sort_desc = true }
  }

  const summary = $derived.by(() => {
    let mine = 0
    let unassigned = 0
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const by_admin = new Map<string, number>()
    for (const t of threads) {
      if (!t.assigned_to_user_id) unassigned += 1
      else if (t.assigned_to_user_id === current_user_id) mine += 1
      if (t.assigned_to_user_id) {
        by_admin.set(t.assigned_to_user_id, (by_admin.get(t.assigned_to_user_id) ?? 0) + 1)
      }
    }
    return { total: threads.length, mine, unassigned, by_admin }
  })

  const filtered_rows = $derived.by(() => {
    const search_lc = search.trim().toLowerCase()
    const out = threads.filter((t) => {
      if (assignment_filter === 'mine' && t.assigned_to_user_id !== current_user_id) return false
      if (assignment_filter === 'unassigned' && t.assigned_to_user_id !== null) return false
      if (assignment_filter !== 'all' && assignment_filter !== 'mine' && assignment_filter !== 'unassigned') {
        if (t.assigned_to_user_id !== assignment_filter) return false
      }
      if (search_lc) {
        const haystack = [
          t.from_name?.toLowerCase() ?? '',
          t.from_email?.toLowerCase() ?? '',
          t.subject?.toLowerCase() ?? '',
          t.to_email?.toLowerCase() ?? '',
        ].join(' ')
        if (!haystack.includes(search_lc)) return false
      }
      return true
    })

    const dir = sort_desc ? -1 : 1
    out.sort((a, b) => {
      let av = ''
      let bv = ''
      switch (sort_key) {
        case 'last_message_at': av = a.last_message_at || ''; bv = b.last_message_at || ''; break
        case 'resolved_at': av = a.resolved_at || ''; bv = b.resolved_at || ''; break
        case 'from': av = (a.from_name || a.from_email || '').toLowerCase(); bv = (b.from_name || b.from_email || '').toLowerCase(); break
        case 'subject': av = (a.subject || '').toLowerCase(); bv = (b.subject || '').toLowerCase(); break
        case 'to_email': av = (a.to_email || '').toLowerCase(); bv = (b.to_email || '').toLowerCase(); break
        case 'assigned': av = admin_name_by_user_id.get(a.assigned_to_user_id || '') || 'zzz_unassigned'; bv = admin_name_by_user_id.get(b.assigned_to_user_id || '') || 'zzz_unassigned'; break
      }
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
    return out
  })

  interface FilterPill { key: AssignmentFilter, label: string, count: number }
  const filter_pills = $derived<FilterPill[]>([
    { key: 'all', label: 'all', count: summary.total },
    { key: 'mine', label: 'mine', count: summary.mine },
    { key: 'unassigned', label: 'unassigned', count: summary.unassigned },
    ...ADMINS
      .filter(admin => admin_user_id_by_email.get(admin.email) && admin_user_id_by_email.get(admin.email) !== current_user_id)
      .map<FilterPill>((admin) => {
        const user_id = admin_user_id_by_email.get(admin.email)
        return { key: user_id || admin.email, label: admin.name, count: user_id ? (summary.by_admin.get(user_id) ?? 0) : 0 }
      }),
  ])

  async function delete_thread(thread: ThreadRow) {
    const label = thread.subject || thread.from_name || thread.from_email
    if (!confirm(`Delete this thread?\n\n"${label}"\n\nThis cannot be undone.`))
      return
    await thread._delete()
  }

  interface Col { key: SortKey, label: string }
  const columns = $derived<Col[]>([
    { key: 'from', label: 'From' },
    { key: 'subject', label: 'Subject' },
    { key: 'to_email', label: 'To' },
    { key: 'assigned', label: 'Assigned' },
    show_resolved_at
      ? { key: 'resolved_at', label: 'Resolved' }
      : { key: 'last_message_at', label: 'Last activity' },
  ])
</script>

<div class="filter-row">
  <div class="filter-pills">
    {#each filter_pills as filter (filter.key)}
      <button
        type="button"
        onclick={() => toggle_filter(filter.key)}
        class={['filter-pill', { active: assignment_filter === filter.key }]}>
        {filter.label}
        <span class={['filter-count', { active: assignment_filter === filter.key }]}>
          {filter.count.toLocaleString()}
        </span>
      </button>
    {/each}
  </div>
  {#if header_trailing}
    <div class="header-trailing">{@render header_trailing()}</div>
  {/if}
</div>

<div class="search-wrap">
  <IconMdiMagnify class="search-icon" />
  <input
    type="search"
    placeholder="Search from, subject, to-alias…"
    bind:value={search}
    class="search-input" />
</div>

{#if loading}
  <p class="loading">Loading…</p>
{:else if filtered_rows.length === 0}
  <div class="empty">
    <IconMdiInboxArrowDown style="font-size: 2.25rem; opacity: 0.5; margin-bottom: 0.5rem" />
    <p>Nothing matches this filter.</p>
  </div>
{:else}
  <div class="results-count">Showing {filtered_rows.length.toLocaleString()}</div>
  <div class="table-wrap">
    <table class="threads-table">
      <thead>
        <tr>
          {#each columns as col (col.key)}
            <th class="th">
              <button type="button" onclick={() => set_sort(col.key)} class="sort-btn">
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
          <th class="th-action"></th>
        </tr>
      </thead>
      <tbody>
        {#each filtered_rows as thread (thread.id)}
          <tr class="thread-row">
            <td class="td td-from">
              <a href="/admin/messages/{thread.id}" class="td-link">
                <div class="td-from-name">{thread.from_name || thread.from_email}</div>
                {#if thread.from_name && thread.from_email !== thread.from_name}
                  <div class="td-from-email">{thread.from_email}</div>
                {/if}
              </a>
            </td>
            <td class="td td-subject">
              <a href="/admin/messages/{thread.id}" class="td-link">
                <div class="subject-row">
                  {#if thread.subject}
                    <span class="ellipsis">{thread.subject}</span>
                  {:else}
                    <em class="no-subject">(no subject)</em>
                  {/if}
                  {#if thread.replied_at && !show_resolved_at}
                    <span class="replied-chip">
                      <IconMdiCheck />replied
                    </span>
                  {/if}
                </div>
              </a>
            </td>
            <td class="td td-to">
              {thread.to_email ?? ''}
            </td>
            <td class="td td-assigned">
              <AssigneeDropdown
                {db}
                thread_id={thread.id}
                assigned_to_user_id={thread.assigned_to_user_id}
                {admin_user_id_by_email}
                size="sm"
                onassigned={async () => { await on_assigned?.() }} />
            </td>
            <td class="td td-time">
              {show_resolved_at
                ? format_relative_time(thread.resolved_at || thread.last_message_at)
                : format_relative_time(thread.last_message_at)}
            </td>
            <td class="td td-action">
              <button
                type="button"
                aria-label="Delete thread"
                title="Delete thread"
                class="btn-ghost delete-btn"
                onclick={() => delete_thread(thread)}>
                <IconMdiTrashCanOutline />
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .filter-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: 0.75rem;
    row-gap: 0.5rem;
    margin-bottom: 0.75rem;
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
  .header-trailing {
    margin-left: auto;
    font-size: 0.875rem;
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

  .loading {
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
  .threads-table {
    width: 100%;
    font-size: 0.875rem;
    border-collapse: collapse;
  }
  .threads-table thead {
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
  .th-action {
    padding: 0.5rem;
    border-bottom: 1px solid var(--border-color);
    width: 2rem;
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

  .thread-row {
    border-bottom: 1px solid var(--border-color);
    transition: background-color 0.15s;
  }
  .thread-row:hover {
    background: var(--surface);
  }
  .td {
    padding: 0.5rem 0.75rem;
  }
  .td-from {
    max-width: 16rem;
  }
  .td-subject {
    max-width: 24rem;
  }
  .td-to {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
    white-space: nowrap;
    font-size: 0.75rem;
    color: var(--color-secondary);
    font-family: var(--font-mono);
  }
  .td-assigned {
    padding: 0.25rem 0.5rem;
    white-space: nowrap;
  }
  .td-time {
    white-space: nowrap;
    font-size: 0.75rem;
    color: var(--color-secondary);
  }
  .td-action {
    padding: 0.25rem 0.5rem;
    width: 2rem;
  }
  .td-link {
    display: block;
    color: var(--color);
    text-decoration: none;
    transition: color 0.15s;
    min-width: 0;
  }
  .td-link:hover {
    color: var(--primary);
  }
  .td-from-name {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .td-from-email {
    font-size: 0.75rem;
    color: var(--color-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .subject-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .no-subject {
    color: var(--color-secondary);
  }
  .replied-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.375rem;
    border-radius: 9999px;
    font-size: 10px;
    background: var(--background);
    color: var(--success);
    flex-shrink: 0;
  }

  .delete-btn {
    padding: 0.25rem;
    color: var(--color-secondary);
    opacity: 0;
    transition: opacity 0.15s, color 0.15s;
  }
  .delete-btn:hover {
    color: var(--danger);
  }
  .thread-row:hover .delete-btn,
  .delete-btn:focus {
    opacity: 1;
  }
</style>
