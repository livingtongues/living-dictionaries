<script lang="ts">
  import type { ChatMessageWithAttachments } from '$lib/server/chat/chat-db'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { onMount, tick } from 'svelte'
  import ChatComposer from '$lib/chat/chat-composer.svelte'
  import ChatMessageItem from '$lib/chat/chat-message-item.svelte'
  import { chat_store } from '$lib/chat/chat-store.svelte'
  import NewChannelForm from '$lib/chat/new-channel-form.svelte'
  import RoomMembersPopover from '$lib/chat/room-members-popover.svelte'
  import Header from '$lib/components/shell/Header.svelte'
  import LoginModal from '$lib/components/LoginModal.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { api_chat_delete } from '$api/chat/delete/_call'
  import { api_chat_dm } from '$api/chat/dm/_call'
  import { api_chat_edit } from '$api/chat/edit/_call'
  import { api_chat_messages } from '$api/chat/messages/_call'
  import { api_chat_send } from '$api/chat/send/_call'
  import { api_chat_upload } from '$api/chat/upload/_call'
  import IconMdiAccountPlusOutline from '~icons/mdi/account-plus-outline'
  import IconMdiArrowLeft from '~icons/mdi/arrow-left'
  import IconMdiForumOutline from '~icons/mdi/forum-outline'
  import IconMdiPound from '~icons/mdi/pound'
  import IconMdiShieldLockOutline from '~icons/mdi/shield-lock-outline'

  const auth_user = $derived(page.data.auth_user)

  let active_room_id = $state<string>('')
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
  const startable = $derived(chat_store.directory.filter(member => member.user_id !== chat_store.me_user_id && !existing_dm_user_ids.has(member.user_id)))
  // Presence counts OTHER members only — "1 online" that's just yourself is noise.
  const others_online_count = $derived(active_room ? active_room.online_member_ids.filter(id => id !== chat_store.me_user_id).length : 0)

  // Members popover (opened from the "N members" / "N others online" header on a channel).
  let show_members = $state(false)

  async function open_member_dm(member_id: string) {
    show_members = false
    if (member_id === chat_store.me_user_id)
      return
    await start_dm(member_id)
  }

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
    const { data } = await api_chat_messages({ room_id })
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
    if (!active_room_id)
      return
    const room_id = active_room_id
    const { data } = await api_chat_messages({ room_id, after: cursor() })
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
    show_members = false
    mobile_view = 'thread' // picking a room reveals the thread on mobile
    messages = []
    await goto(`/chat?room=${encodeURIComponent(room_id)}`, { replaceState: true, keepFocus: true, noScroll: true })
    await load_messages(room_id)
    void chat_store.refresh_rooms()
  }

  async function send({ body_html, body_text, files }: { body_html: string, body_text: string, files: File[] }) {
    const room_id = active_room_id
    sending = true
    const { data } = await api_chat_send({ room_id, body_html, body_text, has_attachments: files.length > 0, client_message_id: crypto.randomUUID() })
    if (!data?.message) {
      sending = false
      return
    }
    const uploaded = files.length ? (await api_chat_upload({ message_id: data.message.id, files })).data : null
    const message: ChatMessageWithAttachments = { ...data.message, attachments: uploaded?.attachments ?? [] }
    sending = false
    if (room_id === active_room_id && !messages.some(existing => existing.id === message.id)) {
      messages.push(message)
      await scroll_to_bottom()
      void chat_store.refresh_rooms()
    }
  }

  async function start_dm(user_id: string) {
    const { data } = await api_chat_dm({ user_id })
    if (data?.room_id) {
      await chat_store.refresh_rooms()
      await select_room(data.room_id)
    }
  }

  async function edit_msg({ message_id, body_html, body_text }: { message_id: string, body_html: string, body_text: string }) {
    const { data } = await api_chat_edit({ message_id, body_html, body_text })
    if (data?.message) {
      const index = messages.findIndex(message => message.id === message_id)
      if (index >= 0)
        messages[index] = data.message
    }
  }

  async function delete_msg(message_id: string) {
    const { error } = await api_chat_delete({ message_id })
    if (!error) {
      const index = messages.findIndex(message => message.id === message_id)
      if (index >= 0)
        messages[index] = { ...messages[index], deleted_at: new Date().toISOString(), body_html: '', body_text: '' }
    }
  }

  async function on_channel_created(room_id: string) {
    await chat_store.refresh_rooms()
    await select_room(room_id)
  }

  async function on_room_deleted() {
    show_members = false
    active_room_id = ''
    await chat_store.refresh_rooms()
  }

  // No ?room param → land on the first channel (or first room) once loaded.
  // State-only (no goto) so the URL stays clean until the user picks a room.
  $effect(() => {
    if (!active_room_id && chat_store.loaded && chat_store.rooms.length) {
      const first = channels[0] ?? chat_store.rooms[0]
      if (first) {
        active_room_id = first.id
        chat_store.current_room_id = first.id
        void load_messages(first.id)
      }
    }
  })

  onMount(() => {
    if (!auth_user.is_chat_member)
      return
    const room_param = page.url.searchParams.get('room')
    if (room_param) {
      active_room_id = room_param
      chat_store.current_room_id = room_param
      void load_messages(room_param)
    }
    void chat_store.refresh_rooms()
    chat_store.start_presence() // being on /chat = online (suppresses external pings)
    const timer = setInterval(() => { void poll_messages() }, 5000)
    return () => {
      clearInterval(timer)
      chat_store.stop_presence()
      chat_store.current_room_id = null
    }
  })
</script>

<svelte:head><title>Chat · Living Dictionaries</title></svelte:head>

<svelte:window onkeydown={(event) => { if (event.key === 'Escape') show_members = false }} />

<Header>Chat</Header>

{#if !auth_user.user}
  <div class="gate-screen">
    <IconMdiForumOutline style="font-size: 2rem; color: var(--primary)" />
    <h1 class="gate-title">Chat</h1>
    <p class="gate-text">Please sign in to continue.</p>
    <ShowHide>
      {#snippet children({ show, toggle })}
        <button type="button" class="btn-primary btn-default" onclick={toggle}>Sign in</button>
        {#if show}
          <LoginModal on_close={toggle} />
        {/if}
      {/snippet}
    </ShowHide>
  </div>
{:else if !auth_user.is_chat_member}
  <div class="gate-screen">
    <IconMdiShieldLockOutline style="font-size: 2rem; color: var(--color-secondary)" />
    <h1 class="gate-title">Chat is invite-only</h1>
    <p class="gate-text">You're not in any channels yet — an admin can add you.</p>
  </div>
{:else}
  <div class={['chat-page', mobile_view === 'rooms' ? 'show-rooms' : 'show-thread']}>
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
        {#if chat_store.me_admin_level >= 2}
          <NewChannelForm can_create_admin_room={chat_store.me_admin_level >= 3} on_created={on_channel_created} />
        {/if}
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
          {#each startable as member (member.user_id)}
            <button type="button" class="room-btn" onclick={() => start_dm(member.user_id)}>
              <span class={['dot', { online: member.online }]}></span>
              <span class="room-name">{member.name || member.email}</span>
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
          {#if active_room}{chat_store.room_title(active_room)}{:else}Chat{/if}
        </span>
        {#if active_room?.kind === 'channel'}
          <span class="members-wrap">
            <button type="button" class="members-btn" aria-haspopup="menu" aria-expanded={show_members} onclick={() => { show_members = !show_members }}>
              {active_room.member_ids.length} members
            </button>{#if others_online_count > 0}<button type="button" class="online-btn" aria-haspopup="menu" aria-expanded={show_members} onclick={() => { show_members = !show_members }}>
              · {others_online_count} other{others_online_count === 1 ? '' : 's'} online
            </button>{/if}
            {#if show_members}
              <RoomMembersPopover
                room={active_room}
                on_dm={open_member_dm}
                on_changed={() => chat_store.refresh_rooms()}
                on_deleted={on_room_deleted}
                close={() => { show_members = false }} />
            {/if}
          </span>
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
{/if}

<style>
  /* The site header is a 3rem sticky bar; the chat pane fills the rest of the
     viewport with its own internal scrolling. */
  .chat-page {
    height: calc(100vh - 3rem - 1rem);
    min-height: 480px;
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 1rem;
    padding: 0.5rem 1rem 0;
  }
  .sidebar {
    overflow-y: auto;
    border-right: 1px solid var(--border-color);
    padding-right: 0.75rem;
    /* Grid item — without this a long room/DM name's min-content can widen the
       track and force a page-wide horizontal scroll on mobile. */
    min-width: 0;
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
    .chat-page {
      grid-template-columns: 1fr;
      gap: 0;
    }
    .sidebar {
      border-right: none;
      padding-right: 0;
    }
    /* Show one pane at a time on mobile, driven by mobile_view. */
    .chat-page.show-thread .sidebar { display: none; }
    .chat-page.show-rooms .main { display: none; }
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
    /* Grid item — a message with a long unbreakable token/URL (or the composer)
       has a large min-content; without this the `1fr` track grows past the
       viewport and the whole page scrolls sideways on mobile. */
    min-width: 0;
  }
  .thread-head {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color);
    min-width: 0;
  }
  .thread-title {
    font-size: 1.1rem;
    font-weight: 700;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .members-wrap {
    position: relative;
    display: inline-flex;
    align-items: baseline;
  }
  .members-btn,
  .online-btn {
    border: none;
    background: transparent;
    padding: 0;
    font: inherit;
    font-size: 0.8rem;
    color: var(--color-secondary);
    cursor: pointer;
  }
  .members-btn {
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 2px;
  }
  .online-btn {
    margin-left: 0.3rem;
    white-space: nowrap;
  }
  .members-btn:hover,
  .online-btn:hover {
    color: var(--color);
  }
  .thread {
    flex: 1;
    min-height: 0;
    min-width: 0;
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
  .gate-screen {
    min-height: calc(100vh - 3rem);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    text-align: center;
  }
  .gate-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
  }
  .gate-text {
    color: var(--color-secondary);
    margin: 0 0 0.5rem;
  }
</style>
