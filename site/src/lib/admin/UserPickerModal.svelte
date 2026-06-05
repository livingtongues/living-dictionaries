<script lang="ts">
  import type { RowType } from '$lib/db/client/live/types'
  import IconMdiEmailPlusOutline from '~icons/mdi/email-plus-outline'
  import IconMdiMagnify from '~icons/mdi/magnify'
  import Modal from '$lib/svelte-pieces/Modal.svelte'
  import { score_record } from '$lib/utils/fuzzy-score'

  interface Props {
    users: RowType<'users'>[]
    /** user ids that already hold this role — excluded from the picker. */
    exclude_user_ids?: string[]
    title?: string
    /** Called with the chosen email — an existing user's, or a typed invite email. */
    on_select_email: (email: string) => void
    on_close: () => void
  }

  let { users, exclude_user_ids = [], title = 'Add a person', on_select_email, on_close }: Props = $props()

  let search = $state('')
  const search_query = $derived(search.trim())
  const exclude_set = $derived(new Set(exclude_user_ids))

  const looks_like_email = $derived.by(() => {
    const query = search_query
    const at = query.indexOf('@')
    return at > 0 && at < query.length - 1 && !/\s/.test(query) && query.includes('.', at)
  })

  const matches = $derived.by(() => {
    const pool = users.filter(user => !exclude_set.has(user.id))
    if (!search_query)
      return pool.slice(0, 50)
    const scored: { user: RowType<'users'>, score: number }[] = []
    for (const user of pool) {
      const score = score_record(search_query, [
        { value: user.name ?? '', weight: 1 },
        { value: user.email ?? '', weight: 1 },
      ])
      if (score > 0)
        scored.push({ user, score })
    }
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, 50).map(s => s.user)
  })

  const exact_email_match = $derived(
    users.some(user => user.email?.toLowerCase() === search_query.toLowerCase()),
  )

  function autofocus(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 15)
  }
</script>

<Modal {on_close}>
  {#snippet heading()}
    {title}
  {/snippet}
  <div class="search-wrap">
    <IconMdiMagnify class="picker-search-icon" />
    <input
      type="search"
      placeholder="Search name or email, or type a new email to invite…"
      bind:value={search}
      use:autofocus
      class="search-input" />
  </div>

  <div class="results">
    {#if looks_like_email && !exact_email_match}
      <button type="button" class="invite-row" onclick={() => on_select_email(search_query)}>
        <IconMdiEmailPlusOutline />
        <span>Invite <strong>{search_query}</strong> by email</span>
      </button>
    {/if}
    {#each matches as user (user.id)}
      <button type="button" class="result-row" onclick={() => on_select_email(user.email ?? '')} disabled={!user.email}>
        <span class="result-name">{user.name || '(no name)'}</span>
        <span class="result-email">{user.email || 'no email'}</span>
      </button>
    {:else}
      {#if !looks_like_email}
        <p class="empty">No users match. Type a full email to invite a new person.</p>
      {/if}
    {/each}
  </div>
</Modal>

<style>
  .search-wrap {
    position: relative;
    margin-bottom: 0.75rem;
  }
  :global(.picker-search-icon) {
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
    justify-content: space-between;
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
  .result-row:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .result-name {
    font-weight: 500;
    font-size: 0.875rem;
  }
  .result-email {
    font-size: 0.75rem;
    color: var(--color-secondary);
  }
  .invite-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    text-align: left;
    padding: 0.5rem 0.625rem;
    border-radius: 0.375rem;
    border: 1px dashed var(--border-color);
    background: transparent;
    color: var(--color);
    cursor: pointer;
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
  }
  .invite-row:hover {
    background: var(--surface);
    border-color: var(--primary);
  }
  .empty {
    color: var(--color-secondary);
    font-size: 0.875rem;
    padding: 0.5rem;
  }
</style>
