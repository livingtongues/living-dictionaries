<script lang="ts">
  import type { ChatMessageWithAttachments, RoomReadPosition } from '$lib/server/chat/chat-db'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { onMount, tick } from 'svelte'
  import ChatComposer from '$lib/chat/chat-composer.svelte'
  import ChatMessageItem from '$lib/chat/chat-message-item.svelte'
  import { chat_store } from '$lib/chat/chat-store.svelte'
  import { MESSAGE_PAGE_LIMIT } from '$lib/chat/constants'
  import NewChannelForm from '$lib/chat/new-channel-form.svelte'
  import ReadBubbles from '$lib/chat/read-bubbles.svelte'
  import { caught_up_others, compute_read_boundaries, first_unread_message_id } from '$lib/chat/read-receipts'
  import UnreadDivider from '$lib/chat/unread-divider.svelte'
  import RoomMembersPopover from '$lib/chat/room-members-popover.svelte'
  import Header from '$lib/components/shell/Header.svelte'
  import LoginModal from '$lib/components/LoginModal.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { format_relative_time } from '$lib/utils/format-relative-time'
  import { api_chat_delete } from '$api/chat/delete/_call'
  import { api_chat_dm } from '$api/chat/dm/_call'
  import { api_chat_edit } from '$api/chat/edit/_call'
  import { api_chat_messages } from '$api/chat/messages/_call'
  import { api_chat_react } from '$api/chat/react/_call'
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
  let read_positions = $state<RoomReadPosition[]>([])
  // Frozen on room open (see first_unread_message_id) — where the "New" divider sits.
  let first_unread_id = $state<string | null>(null)
  let loading = $state(true)
  let sending = $state(false)
  let thread_el = $state<HTMLDivElement>()
  // On narrow screens we show EITHER the room list or the thread (not both).
  let mobile_view = $state<'rooms' | 'thread'>('thread')
  // Discord-style reply: the message the composer is currently attached to.
  let replying_to = $state<ChatMessageWithAttachments | null>(null)
  // Load-older pagination: whether older history may exist above the window.
  let has_more_older = $state(false)
  let loading_older = $state(false)

  const active_room = $derived(chat_store.rooms.find(room => room.id === active_room_id) ?? null)
  const channels = $derived(chat_store.rooms.filter(room => room.kind === 'channel'))
  const dms = $derived(chat_store.rooms.filter(room => room.kind === 'dm'))
  const existing_dm_user_ids = $derived(new Set(dms.flatMap(room => room.member_ids).filter(id => id !== chat_store.me_user_id)))
  const startable = $derived(chat_store.directory.filter(member => member.user_id !== chat_store.me_user_id && !existing_dm_user_ids.has(member.user_id)))
  // Presence counts OTHER members only — "1 online" that's just yourself is noise.
  const others_online_count = $derived(active_room ? active_room.online_member_ids.filter(id => id !== chat_store.me_user_id).length : 0)

  // Read receipts — where each other member's read position parks + who's caught
  // up to the newest message (drives the moving bubbles + the "Seen …" summary).
  const read_boundaries = $derived(compute_read_boundaries({ messages, read_positions, me_user_id: chat_store.me_user_id }))
  const caught_up = $derived(caught_up_others({ messages, read_positions, me_user_id: chat_store.me_user_id }))
  const seen_summary = $derived.by(() => {
    if (!caught_up.length)
      return ''
    if (active_room?.kind === 'dm') {
      const position = read_positions.find(row => row.user_id === caught_up[0])
      const when = format_relative_time(position?.last_read_at)
      return when ? `Seen · ${when}` : 'Seen'
    }
    return `Seen by ${caught_up.map(id => chat_store.name_for(id)).join(', ')}`
  })

  function members_for(user_ids: string[] | undefined) {
    return (user_ids ?? []).map(user_id => ({ user_id, name: chat_store.name_for(user_id) }))
  }

  /** One-line preview text for a message: its plain text, else an attachment label. */
  function reply_snippet(message: ChatMessageWithAttachments): string {
    const text = message.body_text.trim()
    if (text)
      return text.length > 140 ? `${text.slice(0, 140)}…` : text
    const [attachment] = message.attachments
    if (attachment)
      return (attachment.mimetype ?? '').startsWith('image/') ? 'Photo' : attachment.filename
    return ''
  }

  const reply_target = $derived(replying_to
    ? { author_name: chat_store.name_for(replying_to.author_user_id), snippet: reply_snippet(replying_to) }
    : null)

  function start_reply(message: ChatMessageWithAttachments) {
    replying_to = message
  }

  // Members popover (opened from the "N members" / "N others online" header on a channel).
  let show_members = $state(false)

  async function open_member_dm(member_id: string) {
    show_members = false
    if (member_id === chat_store.me_user_id)
      return
    await start_dm(member_id)
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
      const { messages: loaded, read_positions: positions } = data
      messages = loaded
      read_positions = positions
      has_more_older = loaded.length >= MESSAGE_PAGE_LIMIT
      first_unread_id = first_unread_message_id({ messages, read_positions, me_user_id: chat_store.me_user_id })
      await scroll_to_bottom()
    }
  }

  /**
   * Fetch the page of messages OLDER than the current oldest, prepend it, and
   * hold the viewport steady (keep the same message under the reader's eye).
   * Returns how many new messages were added (0 = nothing more, or a race).
   */
  async function load_older(): Promise<number> {
    if (loading_older || !has_more_older || !messages.length)
      return 0
    loading_older = true
    const room_id = active_room_id
    const before = messages[0].created_at
    const prev_height = thread_el?.scrollHeight ?? 0
    const prev_top = thread_el?.scrollTop ?? 0
    const { data } = await api_chat_messages({ room_id, before })
    loading_older = false
    if (!data || room_id !== active_room_id)
      return 0
    has_more_older = data.messages.length >= MESSAGE_PAGE_LIMIT
    const existing_ids = new Set(messages.map(message => message.id))
    const fresh = data.messages.filter(message => !existing_ids.has(message.id))
    if (!fresh.length)
      return 0
    messages = [...fresh, ...messages]
    await tick()
    // Restore scroll so the content the reader was looking at doesn't jump.
    if (thread_el)
      thread_el.scrollTop = prev_top + (thread_el.scrollHeight - prev_height)
    return fresh.length
  }

  /**
   * Scroll to (and briefly flash) the referenced message. If it's above the
   * loaded window, page backwards until it's in view, capped so a reply to a
   * very old message can't spin forever.
   */
  async function jump_to(message_id: string) {
    const MAX_PAGES = 20
    let pages = 0
    while (!messages.some(message => message.id === message_id) && has_more_older && pages < MAX_PAGES) {
      const added = await load_older()
      pages += 1
      if (!added)
        break
    }
    await tick()
    const el = thread_el?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(message_id)}"]`)
    if (!el)
      return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    flash_element(el)
  }

  /** Brief background pulse (inline styles → no scoped-CSS pruning surprises). */
  function flash_element(el: HTMLElement) {
    el.style.transition = 'none'
    el.style.backgroundColor = 'color-mix(in srgb, transparent, var(--primary) 25%)'
    requestAnimationFrame(() => {
      el.style.transition = 'background-color 1.3s ease-out'
      el.style.backgroundColor = ''
    })
    setTimeout(() => { el.style.transition = '' }, 1500)
  }

  /**
   * Reconcile the recent window (not append-only) so reactions/edits/deletes and
   * read positions all stay live. `incoming` is the authoritative newest page.
   * We keep (a) older history loaded above the window via "Load older" — the poll
   * only refetches the newest page, so without this it'd be wiped — and (b) any
   * optimistic just-sent message the server hasn't returned yet.
   */
  function reconcile_messages(incoming: ChatMessageWithAttachments[]) {
    if (!incoming.length)
      return
    const incoming_ids = new Set(incoming.map(message => message.id))
    const oldest_incoming = incoming[0].created_at
    const last_incoming = incoming[incoming.length - 1].created_at
    const older = messages.filter(message => message.created_at < oldest_incoming && !incoming_ids.has(message.id))
    const pending = messages.filter(message => !incoming_ids.has(message.id) && message.created_at >= last_incoming)
    messages = [...older, ...incoming, ...pending]
  }

  async function poll_messages() {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible')
      return
    if (!active_room_id)
      return
    const room_id = active_room_id
    const { data } = await api_chat_messages({ room_id })
    if (!data || room_id !== active_room_id)
      return
    const near_bottom = thread_el ? (thread_el.scrollHeight - thread_el.scrollTop - thread_el.clientHeight < 80) : true
    const { messages: incoming, read_positions: positions } = data
    const had_new = incoming.length ? incoming[incoming.length - 1].id !== messages[messages.length - 1]?.id : false
    reconcile_messages(incoming)
    read_positions = positions
    if (near_bottom && had_new)
      await scroll_to_bottom()
    void chat_store.refresh_rooms()
  }

  async function react({ message_id, emoji }: { message_id: string, emoji: string }) {
    const { data } = await api_chat_react({ message_id, emoji })
    if (!data)
      return
    const index = messages.findIndex(message => message.id === message_id)
    if (index >= 0)
      messages[index] = { ...messages[index], reactions: data.reactions }
  }

  async function select_room(room_id: string) {
    active_room_id = room_id
    chat_store.current_room_id = room_id
    show_members = false
    mobile_view = 'thread' // picking a room reveals the thread on mobile
    messages = []
    read_positions = []
    first_unread_id = null
    replying_to = null
    has_more_older = false
    await goto(`/chat?room=${encodeURIComponent(room_id)}`, { replaceState: true, keepFocus: true, noScroll: true })
    await load_messages(room_id)
    void chat_store.refresh_rooms()
  }

  async function send({ body_html, body_text, files }: { body_html: string, body_text: string, files: File[] }) {
    const room_id = active_room_id
    const reply = replying_to
    replying_to = null
    sending = true
    const { data } = await api_chat_send({ room_id, body_html, body_text, has_attachments: files.length > 0, client_message_id: crypto.randomUUID(), reply_to_message_id: reply?.id ?? null })
    if (!data?.message) {
      sending = false
      return
    }
    const uploaded = files.length ? (await api_chat_upload({ message_id: data.message.id, files })).data : null
    // Synthesize the reply preview optimistically; the next poll replaces it with
    // the server's live-resolved version.
    const reply_to = reply
      ? { message_id: reply.id, author_user_id: reply.author_user_id, snippet: reply_snippet(reply), deleted: !!reply.deleted_at, attachment: null }
      : null
    const message: ChatMessageWithAttachments = { ...data.message, attachments: uploaded?.attachments ?? [], reactions: [], reply_to }
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
          {#if has_more_older}
            <div class="load-older">
              <button type="button" class="load-older-btn" onclick={load_older} disabled={loading_older}>
                {loading_older ? 'Loading…' : 'Load older messages'}
              </button>
            </div>
          {/if}
          {#each messages as message, index (message.id)}
            {#if message.id === first_unread_id}
              <UnreadDivider />
            {/if}
            <ChatMessageItem
              {message}
              author_name={chat_store.name_for(message.author_user_id)}
              reply_author_name={message.reply_to ? chat_store.name_for(message.reply_to.author_user_id) : ''}
              is_own={message.author_user_id === chat_store.me_user_id}
              me_user_id={chat_store.me_user_id}
              on_edit={edit_msg}
              on_delete={delete_msg}
              on_react={react}
              on_reply={start_reply}
              on_jump={jump_to} />
            {#if read_boundaries.get(message.id)}
              <ReadBubbles members={members_for(read_boundaries.get(message.id))} />
            {/if}
            {#if index === messages.length - 1 && seen_summary}
              <div class="seen-summary">{seen_summary}</div>
            {/if}
          {/each}
        {/if}
      </div>

      <div class="composer-wrap">
        <ChatComposer {sending} {reply_target} on_cancel_reply={() => { replying_to = null }} on_send={send} placeholder="Write your message…" />
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
  .load-older {
    display: flex;
    justify-content: center;
    padding: 0.25rem 0 0.5rem;
  }
  .load-older-btn {
    border: 1px solid var(--border-color);
    background: var(--surface);
    color: var(--color-secondary);
    border-radius: 999px;
    padding: 0.25rem 0.9rem;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .load-older-btn:hover:not(:disabled) {
    color: var(--color);
    border-color: var(--primary);
  }
  .load-older-btn:disabled {
    cursor: default;
    opacity: 0.7;
  }
  .seen-summary {
    align-self: flex-end;
    font-size: 0.7rem;
    color: var(--color-secondary);
    padding: 0.1rem 0.5rem 0.2rem 0;
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
