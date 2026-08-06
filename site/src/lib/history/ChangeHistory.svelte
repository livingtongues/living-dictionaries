<script lang="ts">
  import type { HistoryActor, HistoryApiKey, HistoryChange, HistoryResult, HistoryUser } from './types'
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
  let api_keys = $state<Record<string, HistoryApiKey>>({})
  let cursor = $state<number | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)
  let started = false
  let actor = $state<HistoryActor>('all')

  const ACTOR_TABS: { value: HistoryActor, label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'humans', label: 'People' },
    { value: 'agents', label: 'Agents' },
  ]

  function build_url(before: number | null): string {
    const params = new URLSearchParams()
    if (feed || !owner_type || !owner_id)
      params.set('feed', '1')
    else {
      params.set('owner_type', owner_type)
      params.set('owner_id', owner_id)
    }
    if (actor !== 'all')
      params.set('actor', actor)
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
      const { changes: new_changes, users: new_users, api_keys: new_keys, cursor: next_cursor } = await res.json() as HistoryResult
      changes = before === null ? new_changes : [...changes, ...new_changes]
      users = { ...users, ...new_users }
      api_keys = { ...api_keys, ...new_keys }
      cursor = next_cursor
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      loading = false
    }
  }

  function set_actor(next: HistoryActor) {
    if (next === actor)
      return
    actor = next
    void fetch_page(null)
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
  {#if feed}
    <div class="actor-tabs" role="group" aria-label="Filter by who made the change">
      {#each ACTOR_TABS as tab (tab.value)}
        <button
          type="button"
          class="actor-tab"
          class:active={actor === tab.value}
          onclick={() => set_actor(tab.value)}>{tab.label}</button>
      {/each}
    </div>
  {/if}
  <ChangeTimeline
    {changes}
    {users}
    {api_keys}
    {loading}
    {empty_label}
    has_more={cursor !== null}
    onloadmore={() => fetch_page(cursor)} />
{/if}

<style>
  .history-error {
    color: var(--danger);
    font-size: 14px;
    padding: 12px 4px;
  }
  .actor-tabs {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    margin-bottom: 8px;
    border: 1px solid rgba(127, 127, 127, 0.25);
    border-radius: 9px;
    background: rgba(127, 127, 127, 0.06);
  }
  .actor-tab {
    border: none;
    background: transparent;
    padding: 4px 12px;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-secondary);
    cursor: pointer;
  }
  .actor-tab:hover {
    color: var(--color);
  }
  .actor-tab.active {
    background: var(--surface);
    color: var(--color);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }
</style>
