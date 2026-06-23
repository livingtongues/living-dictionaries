<script lang="ts">
  import type { HistoryChange, HistoryResult, HistoryUser } from './types'
  import ChangeTimeline from './ChangeTimeline.svelte'

  interface Props {
    dictionary_id: string
    /** Owner-scoped timeline. Omit both + pass feed for the dictionary-wide feed. */
    owner_type?: 'entry' | 'text' | 'sentence'
    owner_id?: string
    feed?: boolean
    empty_label?: string
  }

  const { dictionary_id, owner_type, owner_id, feed = false, empty_label }: Props = $props()

  let changes = $state<HistoryChange[]>([])
  let users = $state<Record<string, HistoryUser>>({})
  let cursor = $state<number | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)
  let started = false

  function build_url(before: number | null): string {
    const params = new URLSearchParams()
    if (feed || !owner_type || !owner_id)
      params.set('feed', '1')
    else {
      params.set('owner_type', owner_type)
      params.set('owner_id', owner_id)
    }
    if (before !== null)
      params.set('before', String(before))
    return `/api/dictionary/${dictionary_id}/history?${params}`
  }

  async function fetch_page(before: number | null) {
    loading = true
    error = null
    try {
      const res = await fetch(build_url(before))
      if (!res.ok)
        throw new Error(`history request failed (${res.status})`)
      const { changes: new_changes, users: new_users, cursor: next_cursor } = await res.json() as HistoryResult
      changes = before === null ? new_changes : [...changes, ...new_changes]
      users = { ...users, ...new_users }
      cursor = next_cursor
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      loading = false
    }
  }

  // Initial load (once per mount).
  $effect(() => {
    if (started)
      return
    started = true
    void fetch_page(null)
  })
</script>

{#if error}
  <p class="history-error">Could not load history: {error}</p>
{:else}
  <ChangeTimeline
    {changes}
    {users}
    {loading}
    {empty_label}
    has_more={cursor !== null}
    onloadmore={() => fetch_page(cursor)} />
{/if}

<style>
  .history-error {
    color: #dc2626;
    font-size: 14px;
    padding: 12px 4px;
  }
</style>
