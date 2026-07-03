<script lang="ts">
  import type { ChatUsersResult } from '$api/chat/users/+server'
  import type { RoomSummary } from '$lib/server/chat/chat-db'
  import { api_chat_channels_delete } from '$api/chat/channels/delete/_call'
  import { api_chat_channels_members_add } from '$api/chat/channels/members/add/_call'
  import { api_chat_channels_members_remove } from '$api/chat/channels/members/remove/_call'
  import { api_chat_channels_rename } from '$api/chat/channels/rename/_call'
  import { api_chat_users } from '$api/chat/users/_call'
  import { SYSTEM_USER_ID } from '$lib/chat/constants'
  import { chat_store } from '$lib/chat/chat-store.svelte'
  import IconMdiAccountPlusOutline from '~icons/mdi/account-plus-outline'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiMessageOutline from '~icons/mdi/message-outline'
  import IconMdiPencilOutline from '~icons/mdi/pencil-outline'
  import IconMdiTrashCanOutline from '~icons/mdi/trash-can-outline'

  interface Props {
    room: RoomSummary
    on_dm: (user_id: string) => Promise<void> | void
    /** Membership/name changed — re-pull rooms. */
    on_changed: () => Promise<void> | void
    on_deleted: () => Promise<void> | void
    close: () => void
  }
  let { room, on_dm, on_changed, on_deleted, close }: Props = $props()

  const member_rows = $derived.by(() => {
    const online = new Set(room.online_member_ids)
    return chat_store.ordered_member_ids(room.member_ids).map(id => ({
      id,
      name: chat_store.name_for(id),
      online: online.has(id),
      is_me: id === chat_store.me_user_id,
      is_system: id === SYSTEM_USER_ID,
    }))
  })

  let busy = $state(false)

  // --- add member (search any registered user) ---
  let search = $state('')
  let results = $state<ChatUsersResult[]>([])
  let searching = $state(false)
  let search_timer: ReturnType<typeof setTimeout> | null = null

  function on_search_input() {
    if (search_timer)
      clearTimeout(search_timer)
    search_timer = setTimeout(() => void run_search(), 250)
  }

  async function run_search() {
    const query = search.trim()
    if (query.length < 2) {
      results = []
      return
    }
    searching = true
    const { data } = await api_chat_users({ query })
    searching = false
    if (data)
      results = data.users.filter(user => !room.member_ids.includes(user.user_id))
  }

  async function add_member(user_id: string) {
    busy = true
    const { error } = await api_chat_channels_members_add({ room_id: room.id, user_id })
    busy = false
    if (error) {
      alert(error.message)
      return
    }
    search = ''
    results = []
    await on_changed()
  }

  async function remove_member(member: { id: string, name: string, is_me: boolean }) {
    const question = member.is_me ? 'Leave this channel?' : `Remove ${member.name} from this channel?`
    if (!confirm(question))
      return
    busy = true
    const { error } = await api_chat_channels_members_remove({ room_id: room.id, user_id: member.id })
    busy = false
    if (error) {
      alert(error.message)
      return
    }
    await on_changed()
    if (member.is_me)
      close()
  }

  // --- rename / delete ---
  let renaming = $state(false)
  let draft_name = $state('')

  async function save_rename() {
    const trimmed = draft_name.trim()
    if (!trimmed || trimmed === room.name) {
      renaming = false
      return
    }
    busy = true
    const { error } = await api_chat_channels_rename({ room_id: room.id, name: trimmed })
    busy = false
    if (error) {
      alert(error.message)
      return
    }
    renaming = false
    await on_changed()
  }

  async function delete_channel() {
    if (!confirm(`Delete "${room.name}" and its whole message history? This cannot be undone.`))
      return
    busy = true
    const { error } = await api_chat_channels_delete({ room_id: room.id })
    busy = false
    if (error) {
      alert(error.message)
      return
    }
    await on_deleted()
  }
</script>

<button type="button" class="members-backdrop" aria-label="Close members" onclick={close}></button>
<div class="members-pop" role="menu">
  {#each member_rows as member (member.id)}
    <div class={['member-row', { 'is-me': member.is_me }]}>
      <span class={['dot', { online: member.online }]}></span>
      {#if member.is_me || member.is_system}
        <span class="member-name">{member.name}</span>
        {#if member.is_me}<span class="you-tag">(you)</span>{/if}
      {:else}
        <button type="button" class="member-dm" role="menuitem" title="Message {member.name}" onclick={() => on_dm(member.id)}>
          <span class="member-name">{member.name}</span>
          <IconMdiMessageOutline class="dm-icon" />
        </button>
      {/if}
      {#if room.can_manage && !member.is_system}
        <button type="button" class="member-remove" title={member.is_me ? 'Leave channel' : 'Remove from channel'} aria-label={member.is_me ? 'Leave channel' : `Remove ${member.name}`} disabled={busy} onclick={() => remove_member(member)}>
          <IconMdiClose />
        </button>
      {/if}
    </div>
  {/each}

  {#if room.can_manage}
    <div class="manage">
      <div class="add-member">
        <IconMdiAccountPlusOutline class="add-member-icon" />
        <input
          type="text"
          placeholder="Add person by name or email…"
          bind:value={search}
          oninput={on_search_input} />
      </div>
      {#if searching}
        <p class="search-note">Searching…</p>
      {:else if search.trim().length >= 2 && !results.length}
        <p class="search-note">No matching users.</p>
      {:else}
        {#each results as result (result.user_id)}
          <button type="button" class="search-result" disabled={busy} onclick={() => add_member(result.user_id)}>
            <span class="member-name">{result.name || result.email}</span>
            {#if result.name && result.email}<span class="result-email">{result.email}</span>{/if}
          </button>
        {/each}
      {/if}

      <div class="channel-actions">
        {#if renaming}
          <form class="rename-form" onsubmit={(event) => { event.preventDefault(); void save_rename() }}>
            <input type="text" bind:value={draft_name} maxlength="80" />
            <button type="submit" class="btn btn-primary btn-xs" disabled={busy}>Save</button>
            <button type="button" class="btn btn-default btn-xs" onclick={() => { renaming = false }}>Cancel</button>
          </form>
        {:else}
          <button type="button" class="channel-action" onclick={() => { renaming = true; draft_name = room.name ?? '' }}>
            <IconMdiPencilOutline /> Rename
          </button>
          <button type="button" class="channel-action danger" disabled={busy} onclick={delete_channel}>
            <IconMdiTrashCanOutline /> Delete channel
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .members-backdrop {
    position: fixed;
    inset: 0;
    z-index: 20;
    border: none;
    background: transparent;
    cursor: default;
  }
  .members-pop {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 21;
    margin-top: 0.375rem;
    min-width: 250px;
    max-width: 320px;
    padding: 0.25rem;
    background: var(--background);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
  .member-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: var(--color);
    text-align: left;
  }
  .member-row.is-me {
    color: var(--color-secondary);
  }
  .member-dm {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    border: none;
    background: transparent;
    padding: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
    text-align: left;
  }
  .member-dm:hover {
    color: var(--primary);
  }
  .member-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .you-tag {
    font-size: 0.75rem;
    color: var(--color-secondary);
  }
  :global(.dm-icon) {
    font-size: 1rem;
    opacity: 0.5;
    flex-shrink: 0;
  }
  .member-remove {
    border: none;
    background: transparent;
    color: var(--color-secondary);
    cursor: pointer;
    padding: 0.1rem;
    border-radius: 0.25rem;
    display: inline-flex;
    flex-shrink: 0;
  }
  .member-remove:hover {
    color: var(--danger, #dc2626);
    background: var(--surface);
  }
  .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--border-color);
    flex-shrink: 0;
  }
  .dot.online {
    background: var(--success, #16a34a);
  }
  .manage {
    border-top: 1px solid var(--border-color);
    margin-top: 0.25rem;
    padding-top: 0.375rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .add-member {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0 0.25rem;
  }
  :global(.add-member-icon) {
    font-size: 1rem;
    color: var(--color-secondary);
    flex-shrink: 0;
  }
  .add-member input {
    flex: 1;
    font-size: 0.8rem;
    min-width: 0;
  }
  .search-note {
    font-size: 0.75rem;
    color: var(--color-secondary);
    padding: 0.125rem 0.5rem;
    margin: 0;
  }
  .search-result {
    width: 100%;
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    padding: 0.3rem 0.5rem;
    border: none;
    background: transparent;
    border-radius: 0.375rem;
    font-size: 0.85rem;
    color: var(--color);
    cursor: pointer;
    text-align: left;
  }
  .search-result:hover {
    background: color-mix(in srgb, var(--primary), transparent 88%);
    color: var(--primary);
  }
  .result-email {
    font-size: 0.7rem;
    color: var(--color-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .channel-actions {
    display: flex;
    gap: 0.25rem;
    padding: 0.125rem 0.25rem;
  }
  .channel-action {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    border: none;
    background: transparent;
    color: var(--color-secondary);
    font-size: 0.75rem;
    cursor: pointer;
    padding: 0.25rem 0.375rem;
    border-radius: 0.375rem;
  }
  .channel-action:hover {
    color: var(--color);
    background: var(--surface);
  }
  .channel-action.danger:hover {
    color: var(--danger, #dc2626);
  }
  .rename-form {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
  }
  .rename-form input {
    flex: 1;
    font-size: 0.8rem;
    min-width: 0;
  }
  .btn-xs {
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
  }
</style>
