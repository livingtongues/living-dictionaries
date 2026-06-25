<script lang="ts">
  import type { ChatMessageWithAttachments } from '$lib/server/chat/chat-db'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { onMount, tick } from 'svelte'
  import ChatComposer from '$lib/admin/chat/chat-composer.svelte'
  import ChatMessageItem from '$lib/admin/chat/chat-message-item.svelte'
  import { chat_store } from '$lib/admin/chat/chat-store.svelte'
  import { ROOM_ALL_ADMINS } from '$lib/admin/chat/rooms'
  import { api_admin_chat_delete } from '$api/admin/chat/delete/_call'
  import { api_admin_chat_dm } from '$api/admin/chat/dm/_call'
  import { api_admin_chat_edit } from '$api/admin/chat/edit/_call'
  import { api_admin_chat_messages } from '$api/admin/chat/messages/_call'
  import { api_admin_chat_send } from '$api/admin/chat/send/_call'
  import { api_admin_chat_upload } from '$api/admin/chat/upload/_call'
  import IconMdiAccountPlusOutline from '~icons/mdi/account-plus-outline'
  import IconMdiArrowLeft from '~icons/mdi/arrow-left'
  import IconMdiPound from '~icons/mdi/pound'

  let active_room_id = $state<string>(ROOM_ALL_ADMINS)
  let messages = $state<ChatMessageWithAttachments[]>([])
  let loading = $state(true)
  let sending = $state(false)
  let thread_el = $state<HTMLDivElement>()
  // On narrow screens we show EITHER the room list or the thread (not both).
  let mobile_view = $state<'rooms' | 'thread'>('thread')

  const active_room = $derived(chat_store.rooms.find(room => room.id === active_room_id) ?? null)
  const channels = $derived(chat_store.rooms.filter(room => room.kind === 'channel'))
  const dms = $derived(chat_store.rooms.filter(room => room.kind === 'dm'))
  const existing_dm_user_ids = $derived(new Set(dms.flatMap(room => room.member_ids).filter(id => id !== chat_store.me_user_id)))
  const startable = $derived(chat_store.admins.filter(admin => admin.user_id && admin.user_id !== chat_store.me_user_id && !existing_dm_user_ids.has(admin.user_id)))
  const online_count = $derived(active_room ? active_room.online_member_ids.length : 0)

  function cursor(): string | null {
    return messages.length ? messages[messages.length - 1].created_at : null
  }

  async function scroll_to_bottom() {
    await tick()
    if (thread_el)
      thread_el.scrollTop = thread_el.scrollHeight
  }

  async function load_messages(room_id: string) {
    loading = true
    const { data } = await api_admin_chat_messages({ room_id })
    loading = false
    if (data && room_id === active_room_id) {
      const { messages: loaded } = data
      messages = loaded
      await scroll_to_bottom()
    }
  }

  async function poll_messages() {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible')
      return
    const room_id = active_room_id
    const { data } = await api_admin_chat_messages({ room_id, after: cursor() })
    if (!data || room_id !== active_room_id || !data.messages.length)
      return
    const near_bottom = thread_el ? (thread_el.scrollHeight - thread_el.scrollTop - thread_el.clientHeight < 80) : true
    const known = new Set(messages.map(message => message.id))
    for (const message of data.messages) {
      if (!known.has(message.id))
        messages.push(message)
    }
    if (near_bottom)
      await scroll_to_bottom()
    void chat_store.refresh_rooms()
  }

  async function select_room(room_id: string) {
    active_room_id = room_id
    chat_store.current_room_id = room_id
    mobile_view = 'thread' // picking a room reveals the thread on mobile
    messages = []
    await goto(`/admin/team?room=${encodeURIComponent(room_id)}`, { replaceState: true, keepFocus: true, noScroll: true })
    await load_messages(room_id)
    void chat_store.refresh_rooms()
  }

  async function send({ body_html, body_text, files }: { body_html: string, body_text: string, files: File[] }) {
    const room_id = active_room_id
    sending = true
    const { data } = await api_admin_chat_send({ room_id, body_html, body_text, has_attachments: files.length > 0, client_message_id: crypto.randomUUID() })
    if (!data?.message) {
      sending = false
      return
    }
    const uploaded = files.length ? (await api_admin_chat_upload({ message_id: data.message.id, files })).data : null
    const message: ChatMessageWithAttachments = { ...data.message, attachments: uploaded?.attachments ?? [] }
    sending = false
    if (room_id === active_room_id && !messages.some(existing => existing.id === message.id)) {
      messages.push(message)
      await scroll_to_bottom()
      void chat_store.refresh_rooms()
    }
  }

  async function start_dm(user_id: string) {
    const { data } = await api_admin_chat_dm({ user_id })
    if (data?.room_id) {
      await chat_store.refresh_rooms()
      await select_room(data.room_id)
    }
  }

  async function edit_msg({ message_id, body_html, body_text }: { message_id: string, body_html: string, body_text: string }) {
    const { data } = await api_admin_chat_edit({ message_id, body_html, body_text })
    if (data?.message) {
      const index = messages.findIndex(message => message.id === message_id)
      if (index >= 0)
        messages[index] = data.message
    }
  }

  async function delete_msg(message_id: string) {
    const { error } = await api_admin_chat_delete({ message_id })
    if (!error) {
      const index = messages.findIndex(message => message.id === message_id)
      if (index >= 0)
        messages[index] = { ...messages[index], deleted_at: new Date().toISOString(), body_html: '', body_text: '' }
    }
  }

  onMount(() => {
    active_room_id = page.url.searchParams.get('room') || ROOM_ALL_ADMINS
    chat_store.current_room_id = active_room_id
    void chat_store.refresh_rooms()
    void load_messages(active_room_id)
    const timer = setInterval(() => { void poll_messages() }, 5000)
    return () => clearInterval(timer)
  })
</script>

<svelte:head><title>Team · Admin</title></svelte:head>

<div class={['team', mobile_view === 'rooms' ? 'show-rooms' : 'show-thread']}>
  <aside class="sidebar">
    <div class="group">
      <div class="group-label">Channels</div>
      {#each channels as room (room.id)}
        <button type="button" class={['room-btn', { active: room.id === active_room_id }]} onclick={() => select_room(room.id)}>
          <IconMdiPound class="room-icon" />
          <span class="room-name">{chat_store.room_title(room)}</span>
          {#if room.unread > 0}<span class="badge">{room.unread}</span>{/if}
        </button>
      {/each}
    </div>

    {#if dms.length}
      <div class="group">
        <div class="group-label">Direct messages</div>
        {#each dms as room (room.id)}
          {@const other = room.member_ids.find(id => id !== chat_store.me_user_id)}
          <button type="button" class={['room-btn', { active: room.id === active_room_id }]} onclick={() => select_room(room.id)}>
            <span class={['dot', { online: !!other && room.online_member_ids.includes(other) }]}></span>
            <span class="room-name">{chat_store.room_title(room)}</span>
            {#if room.unread > 0}<span class="badge">{room.unread}</span>{/if}
          </button>
        {/each}
      </div>
    {/if}

    {#if startable.length}
      <div class="group">
        <div class="group-label">Start a conversation</div>
        {#each startable as admin (admin.email)}
          <button type="button" class="room-btn" onclick={() => admin.user_id && start_dm(admin.user_id)}>
            <span class={['dot', { online: admin.online }]}></span>
            <span class="room-name">{admin.name}</span>
            <IconMdiAccountPlusOutline class="add-icon" />
          </button>
        {/each}
      </div>
    {/if}
  </aside>

  <section class="main">
    <header class="thread-head">
      <button type="button" class="rooms-back" onclick={() => { mobile_view = 'rooms' }} aria-label="Back to rooms">
        <IconMdiArrowLeft /> Rooms
      </button>
      <span class="thread-title">
        {#if active_room}{chat_store.room_title(active_room)}{:else}Team chat{/if}
      </span>
      {#if active_room?.kind === 'channel'}
        <span class="thread-sub">{active_room.member_ids.length} members · {online_count} online</span>
      {/if}
    </header>

    <div class="thread" bind:this={thread_el}>
      {#if loading}
        <p class="empty">Loading…</p>
      {:else if !messages.length}
        <p class="empty">No messages yet. Say hello 👋</p>
      {:else}
        {#each messages as message (message.id)}
          <ChatMessageItem
            {message}
            author_name={chat_store.name_for(message.author_user_id)}
            is_own={message.author_user_id === chat_store.me_user_id}
            on_edit={edit_msg}
            on_delete={delete_msg} />
        {/each}
      {/if}
    </div>

    <div class="composer-wrap">
      <ChatComposer {sending} on_send={send} placeholder="Write your message…" />
    </div>
  </section>
</div>

<style>
  /* LD's admin layout uses normal page-scroll (.page-main isn't a flex column),
     so the chat pane takes an explicit height: viewport − header (3.5rem) −
     page-main padding (0.75rem top + 1.5rem bottom). */
  .team {
    height: calc(100vh - 3.5rem - 0.75rem - 1.5rem);
    min-height: 480px;
    display: grid;
    grid-template-columns: 230px 1fr;
    gap: 1rem;
  }
  .sidebar {
    overflow-y: auto;
    border-right: 1px solid var(--border-color);
    padding-right: 0.75rem;
  }
  /* The "← Rooms" back button is mobile-only (desktop shows both panes). */
  .rooms-back {
    display: none;
    align-items: center;
    gap: 0.25rem;
    border: none;
    background: transparent;
    color: var(--primary);
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    padding: 0;
    margin-right: 0.5rem;
  }
  @media (max-width: 640px) {
    .team {
      grid-template-columns: 1fr;
      gap: 0;
    }
    .sidebar {
      border-right: none;
      padding-right: 0;
    }
    /* Show one pane at a time on mobile, driven by mobile_view. */
    .team.show-thread .sidebar { display: none; }
    .team.show-rooms .main { display: none; }
    .rooms-back { display: inline-flex; }
  }
  .group {
    margin-bottom: 1.25rem;
  }
  .group-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-secondary);
    margin-bottom: 0.375rem;
    padding: 0 0.5rem;
  }
  .room-btn {
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
  .room-btn:hover {
    background: var(--surface);
    color: var(--color);
  }
  .room-btn.active {
    background: color-mix(in srgb, var(--primary), transparent 88%);
    color: var(--primary);
    font-weight: 600;
  }
  :global(.room-icon) {
    font-size: 1rem;
    flex-shrink: 0;
  }
  :global(.add-icon) {
    margin-left: auto;
    font-size: 1rem;
    opacity: 0.6;
  }
  .room-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .badge {
    margin-left: auto;
    background: var(--primary);
    color: #fff;
    font-size: 0.7rem;
    font-weight: 700;
    min-width: 1.1rem;
    height: 1.1rem;
    padding: 0 0.3rem;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
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
  .main {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .thread-head {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  .thread-title {
    font-size: 1.1rem;
    font-weight: 700;
  }
  .thread-sub {
    font-size: 0.8rem;
    color: var(--color-secondary);
  }
  .thread {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0.5rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .empty {
    color: var(--color-secondary);
    font-size: 0.9rem;
    margin: auto;
  }
  .composer-wrap {
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-color);
  }
</style>
