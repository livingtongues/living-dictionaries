<script lang="ts">
  import { api_chat_channels } from '$api/chat/channels/_call'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiPlus from '~icons/mdi/plus'

  interface Props {
    /** Show the super-admin-only "admin room" flag. */
    can_create_admin_room: boolean
    on_created: (room_id: string) => Promise<void> | void
  }
  let { can_create_admin_room, on_created }: Props = $props()

  let open = $state(false)
  let name = $state('')
  let admin_room = $state(false)
  let busy = $state(false)
  let input_el = $state<HTMLInputElement>()

  async function create() {
    const trimmed = name.trim()
    if (!trimmed || busy)
      return
    busy = true
    const { data, error } = await api_chat_channels({ name: trimmed, admin_room })
    busy = false
    if (error) {
      alert(error.message)
      return
    }
    name = ''
    admin_room = false
    open = false
    if (data)
      await on_created(data.room.id)
  }

  $effect(() => {
    if (open)
      input_el?.focus()
  })
</script>

{#if open}
  <form class="new-channel-form" onsubmit={(event) => { event.preventDefault(); void create() }}>
    <input
      bind:this={input_el}
      bind:value={name}
      type="text"
      placeholder="Channel name"
      maxlength="80" />
    {#if can_create_admin_room}
      <label class="admin-room-label">
        <input type="checkbox" bind:checked={admin_room} />
        Admin room (only super admins can manage)
      </label>
    {/if}
    <div class="form-actions">
      <button type="submit" class="btn btn-primary btn-sm" disabled={!name.trim() || busy}>Create</button>
      <button type="button" class="btn btn-default btn-sm" onclick={() => { open = false; name = '' }} aria-label="Cancel">
        <IconMdiClose />
      </button>
    </div>
  </form>
{:else}
  <button type="button" class="new-channel-btn" onclick={() => { open = true }}>
    <IconMdiPlus class="room-icon" />
    <span>New channel</span>
  </button>
{/if}

<style>
  .new-channel-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    border: none;
    background: transparent;
    border-radius: 0.375rem;
    color: var(--color-secondary);
    font-size: 0.875rem;
    cursor: pointer;
    text-align: left;
  }
  .new-channel-btn:hover {
    background: var(--surface);
    color: var(--color);
  }
  .new-channel-form {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.375rem 0.5rem;
  }
  .new-channel-form input[type='text'] {
    font-size: 0.875rem;
  }
  .admin-room-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--color-secondary);
  }
  .form-actions {
    display: flex;
    gap: 0.375rem;
  }
  .btn-sm {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.6rem;
    font-size: 0.8rem;
  }
</style>
