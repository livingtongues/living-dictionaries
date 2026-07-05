<script lang="ts">
  import IconMdiAccountSearch from '~icons/mdi/account-search'
  import IconMdiArrowLeft from '~icons/mdi/arrow-left'
  import IconMdiCheckDecagram from '~icons/mdi/check-decagram'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiMagnify from '~icons/mdi/magnify'
  import { api_admin_match_thread_to_user } from '../../../api/admin/match-thread-to-user/_call'
  import { format_date_time, format_relative_time } from '$lib/utils/format-relative-time'
  import { score_record } from '$lib/utils/fuzzy-score'

  let { data } = $props()
  const db = $derived(data.db)

  // ----- Queries -----

  const threads_query = $derived(
    db?.message_threads.query({
      where: 'from_user_id IS NULL',
      order_by: 'last_message_at DESC',
      limit: 9999,
    }),
  )
  const threads = $derived(threads_query?.rows ?? [])
  const threads_loading = $derived(threads_query?.loading ?? true)

  const users_query = $derived(db?.users.query({ limit: 9999 }))
  const aliases_query = $derived(db?.email_aliases.query({ limit: 9999 }))

  const visible_thread_ids = $derived(threads.slice(0, 50).map(thread => thread.id))
  const messages_query = $derived.by(() => {
    if (!db || visible_thread_ids.length === 0) return null
    const placeholders = visible_thread_ids.map(() => '?').join(',')
    return db.messages.query({
      where: `thread_id IN (${placeholders}) AND author_kind = 'customer'`,
      params: visible_thread_ids,
      order_by: 'created_at ASC',
    })
  })

  interface UserCandidate {
    id: string
    name: string | null
    email: string | null
    aliases: string[]
  }

  const aliases_by_user = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const map = new Map<string, string[]>()
    for (const alias of aliases_query?.rows ?? []) {
      const list = map.get(alias.user_id) ?? []
      list.push(alias.email)
      map.set(alias.user_id, list)
    }
    return map
  })

  const users: UserCandidate[] = $derived(
    (users_query?.rows ?? []).map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      aliases: aliases_by_user.get(user.id) ?? [],
    })),
  )

  const snippet_by_thread_id = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const map = new Map<string, string>()
    for (const message of messages_query?.rows ?? []) {
      if (map.has(message.thread_id)) continue
      const body = (message.body_text || '').trim().slice(0, 220)
      map.set(message.thread_id, body)
    }
    return map
  })

  interface PickerState {
    open: boolean
    search: string
    submitting: boolean
    success: string | null
    error: string | null
  }

  const pickers = $state<Record<string, PickerState>>({})

  const DEFAULT_PICKER: PickerState = Object.freeze({ open: false, search: '', submitting: false, success: null, error: null }) as PickerState

  function get_picker(thread_id: string): PickerState {
    return pickers[thread_id] ?? DEFAULT_PICKER
  }

  function ensure_picker(thread_id: string): PickerState {
    if (!pickers[thread_id])
      pickers[thread_id] = { open: false, search: '', submitting: false, success: null, error: null }
    return pickers[thread_id]
  }

  function toggle_picker(thread_id: string, from_email: string, from_name: string | null) {
    const state = ensure_picker(thread_id)
    if (state.open) {
      state.open = false
      return
    }
    state.open = true
    if (!state.search) {
      const seed = (from_name && from_name !== 'Anonymous') ? from_name : from_email.split('@')[0]
      state.search = seed
    }
  }

  async function match(thread_id: string, user_id: string) {
    const state = ensure_picker(thread_id)
    if (state.submitting) return
    state.submitting = true
    state.error = null
    state.success = null
    const { data: result, error } = await api_admin_match_thread_to_user({ thread_id, user_id })
    state.submitting = false
    if (error) {
      state.error = error.message
      return
    }
    state.success = `Matched · alias ${result.alias_inserted ? 'inserted' : 'not needed'} · ${result.messages_backfilled} message(s) backfilled`
    await data.sync?.sync()
  }

  interface Suggestion {
    user: UserCandidate
    score: number
  }

  function suggestions_for(thread_id: string, from_email: string, from_name: string | null): Suggestion[] {
    const state = get_picker(thread_id)
    const raw_query = state.search.trim()
    const queries = [raw_query, from_email, from_name ?? ''].filter(Boolean)

    const out: Suggestion[] = []
    for (const user of users) {
      let best = 0
      for (const query of queries) {
        if (!query) continue
        const score = score_record(query, [
          { value: user.name ?? '', weight: 1 },
          { value: user.email ?? '', weight: 1 },
          ...user.aliases.map(alias => ({ value: alias, weight: 0.9 })),
        ])
        if (score > best) best = score
      }
      if (best > 0) out.push({ user, score: best })
    }

    out.sort((left, right) => right.score - left.score)
    return out.slice(0, 8)
  }
</script>

<div class="header-row">
  <h1 class="heading">
    Unmatched threads
    {#if !threads_loading}
      <span class="heading-count">· {threads.length}</span>
    {/if}
  </h1>
  <a href="/admin/messages" class="back-link">
    <IconMdiArrowLeft /> All messages
  </a>
</div>

<p class="intro">
  Threads where the sender's email doesn't match any known <code>users.email</code> or <code>email_aliases</code> row. Pick the right user — that stamps <code>from_user_id</code>, backfills any NULL customer-side messages, and adds the sender's email to that user's aliases (so future mail auto-resolves).
</p>

{#if threads_loading}
  <p class="muted">Loading…</p>
{:else if threads.length === 0}
  <div class="empty">
    <IconMdiCheckDecagram style="font-size: 2.25rem; opacity: 0.5; margin-bottom: 0.5rem" />
    <p>All threads are matched to a user.</p>
  </div>
{:else}
  <ul class="thread-list">
    {#each threads as thread (thread.id)}
      {@const picker = get_picker(thread.id)}
      {@const snippet = snippet_by_thread_id.get(thread.id)}
      <li class="thread-card">
        <div class="thread-row">
          <div class="thread-info">
            <a href="/admin/messages/{thread.id}" class="thread-subject">
              {thread.subject || '(no subject)'}
            </a>
            <div class="thread-meta">
              <span class="mono">{thread.from_email}</span>
              {#if thread.from_name && thread.from_name !== 'Anonymous'}<span>· {thread.from_name}</span>{/if}
              <span>· last message <span title={format_date_time(thread.last_message_at)}>{format_relative_time(thread.last_message_at)}</span></span>
            </div>
          </div>
          <button type="button" onclick={() => toggle_picker(thread.id, thread.from_email, thread.from_name)} class="btn btn-outline btn-sm match-btn">
            {#if picker.open}
              <IconMdiClose style="margin-right: 0.25rem" />Cancel
            {:else}
              <IconMdiAccountSearch style="margin-right: 0.25rem" />Match to user
            {/if}
          </button>
        </div>

        {#if snippet}
          <p class="snippet">{snippet}</p>
        {/if}

        {#if picker.success}
          <p class="success-msg">✓ {picker.success}</p>
        {/if}
        {#if picker.error}
          <p class="error-msg">⚠ {picker.error}</p>
        {/if}

        {#if picker.open}
          {@const matches = suggestions_for(thread.id, thread.from_email, thread.from_name)}
          <div class="picker">
            <div class="search-wrap">
              <IconMdiMagnify class="picker-icon" />
              <input type="search" placeholder="Search by name, email, alias…" bind:value={picker.search} class="picker-input" />
            </div>

            {#if matches.length === 0}
              <p class="picker-empty">No user matches that query.</p>
            {:else}
              <ul class="match-list">
                {#each matches as match_row (match_row.user.id)}
                  <li>
                    <button type="button" onclick={() => match(thread.id, match_row.user.id)} disabled={picker.submitting} class="match-row">
                      <div class="match-content">
                        <span class="match-name">{match_row.user.name || '(no name)'}</span>
                        <span class="match-email">{match_row.user.email ?? '(no email)'}</span>
                        {#if match_row.user.aliases.length > 0}
                          <span class="match-aliases" title={match_row.user.aliases.join(', ')}>
                            +{match_row.user.aliases.length} alias{match_row.user.aliases.length === 1 ? '' : 'es'}
                          </span>
                        {/if}
                      </div>
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .header-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 1rem;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .heading {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }
  .heading-count {
    font-size: 0.875rem;
    font-weight: 400;
    color: var(--color-secondary);
  }
  .back-link {
    font-size: 0.875rem;
    color: var(--color-secondary);
    text-decoration: none;
    transition: color 0.15s;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .back-link:hover {
    color: var(--color);
  }
  .intro {
    font-size: 0.875rem;
    color: var(--color-secondary);
    margin-bottom: 1.5rem;
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
  .thread-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .thread-card {
    padding: 1rem;
    border-radius: 0.75rem;
    border: 1px solid var(--border-color);
    background: var(--background);
  }
  .thread-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }
  .thread-info {
    min-width: 0;
    flex: 1;
  }
  .thread-subject {
    font-size: 1rem;
    font-weight: 500;
    color: var(--color);
    text-decoration: none;
    transition: color 0.15s;
  }
  .thread-subject:hover {
    color: var(--primary);
  }
  .thread-meta {
    font-size: 0.75rem;
    color: var(--color-secondary);
    margin-top: 0.125rem;
  }
  .mono {
    font-family: var(--font-mono);
  }
  .match-btn {
    flex-shrink: 0;
  }
  .snippet {
    font-size: 0.75rem;
    color: var(--color-secondary);
    margin-top: 0.5rem;
    margin-bottom: 0;
    white-space: pre-line;
    border-left: 2px solid var(--border-color);
    padding-left: 0.5rem;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .success-msg {
    margin-top: 0.75rem;
    font-size: 0.75rem;
    color: var(--success);
  }
  .error-msg {
    margin-top: 0.75rem;
    font-size: 0.75rem;
    color: var(--warning);
  }
  .picker {
    margin-top: 1rem;
    padding: 0.75rem;
    border-radius: 0.5rem;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .search-wrap {
    position: relative;
  }
  :global(.picker-icon) {
    position: absolute;
    left: 0.625rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-secondary);
  }
  .picker-input {
    width: 100%;
    padding: 0.375rem 0.5rem 0.375rem 2rem;
    border-radius: 0.25rem;
    border: 1px solid var(--border-color);
    background: var(--background);
    font-size: 0.875rem;
    color: var(--color);
  }
  .picker-input:focus {
    outline: none;
    border-color: var(--primary);
  }
  .picker-empty {
    font-size: 0.75rem;
    color: var(--color-secondary);
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
    text-align: center;
  }
  .match-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .match-row {
    width: 100%;
    text-align: left;
    padding: 0.375rem 0.625rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    background: var(--background);
    border: 1px solid var(--border-color);
    transition: background-color 0.15s, border-color 0.15s;
    cursor: pointer;
  }
  .match-row:hover {
    border-color: var(--primary);
    background: color-mix(in srgb, var(--background), var(--primary) 4%);
  }
  .match-row:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .match-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .match-name {
    font-weight: 500;
  }
  .match-email {
    font-size: 0.75rem;
    color: var(--color-secondary);
  }
  .match-aliases {
    font-size: 0.75rem;
    color: var(--color-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
