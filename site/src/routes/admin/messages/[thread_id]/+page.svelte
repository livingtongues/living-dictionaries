<script lang="ts">
  import IconMdiAccountCircle from '~icons/mdi/account-circle'
  import IconMdiAlertCircle from '~icons/mdi/alert-circle'
  import IconMdiArrowLeft from '~icons/mdi/arrow-left'
  import IconMdiCheck from '~icons/mdi/check'
  import IconMdiCheckCircle from '~icons/mdi/check-circle'
  import IconMdiClockOutline from '~icons/mdi/clock-outline'
  import IconMdiOpenInNew from '~icons/mdi/open-in-new'
  import IconMdiPaperclip from '~icons/mdi/paperclip'
  import IconMdiReply from '~icons/mdi/reply'
  import IconMdiTrashCanOutline from '~icons/mdi/trash-can-outline'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import AssigneeDropdown from '$lib/admin/AssigneeDropdown.svelte'
  import CopyButton from '$lib/components/ui/CopyButton.svelte'
  import { use_admin_back } from '$lib/utils/admin-back.svelte'
  import { format_bytes } from '$lib/utils/format-bytes'
  import { format_date_time, format_relative_time } from '$lib/utils/format-relative-time'
  import HtmlBodyIframe from './html-body-iframe.svelte'
  import ReplyComposer from './reply-composer.svelte'
  import TriagePanel from './triage-panel.svelte'

  let { data } = $props()
  let draft_html = $state('')
  const db = $derived(data.db)
  const thread_id = $derived(page.params.thread_id)
  const current_user_id = $derived(data.auth_user.user?.id)

  const back = use_admin_back({
    fallback: { label: 'Back to inbox', url: '/admin/messages' },
    compute: (path) => {
      if (path.startsWith('/admin/users/') && path !== '/admin/users/')
        return { label: 'Back to user', url: path }
      if (path === '/admin/messages/resolved')
        return { label: 'Back to resolved', url: '/admin/messages/resolved' }
      return null
    },
  })

  const thread = $derived(db?.message_threads.id(thread_id))
  const messages_query = $derived(
    db?.messages.query({
      where: 'thread_id = ?',
      params: [thread_id],
      order_by: 'created_at ASC',
    }),
  )
  const messages = $derived(messages_query?.rows ?? [])

  const attachments_query = $derived(
    db?.message_attachments.query({
      where: 'message_id IN (SELECT id FROM messages WHERE thread_id = ?)',
      params: [thread_id],
      order_by: 'created_at ASC',
    }),
  )
  const attachments_by_message = $derived.by(() => {
    const map: Record<string, { id: string, filename: string, mimetype: string, size_bytes: number, disposition: string }[]> = {}
    for (const att of attachments_query?.rows ?? []) {
      if (!map[att.message_id])
        map[att.message_id] = []
      map[att.message_id].push(att)
    }
    return map
  })

  // Mark thread read on first view if unread.
  let marked_read = $state(false)
  $effect(() => {
    if (!thread || marked_read)
      return
    marked_read = true
    if (!thread.read_at) {
      thread.read_at = new Date().toISOString()
      void thread._save()
    }
  })

  async function toggle_replied() {
    if (!thread || !current_user_id)
      return
    if (thread.replied_at) {
      thread.replied_at = null
      thread.replied_by_user_id = null
    } else {
      thread.replied_at = new Date().toISOString()
      thread.replied_by_user_id = current_user_id
    }
    await thread._save()
  }

  async function toggle_resolved() {
    if (!thread || !current_user_id)
      return
    if (thread.resolved_at) {
      thread.resolved_at = null
      thread.resolved_by_user_id = null
    } else {
      thread.resolved_at = new Date().toISOString()
      thread.resolved_by_user_id = current_user_id
    }
    await thread._save()
  }

  async function delete_thread() {
    if (!thread)
      return
    const label = thread.subject || thread.from_name || thread.from_email
    if (!confirm(`Delete this thread?\n\n"${label}"\n\nThis cannot be undone.`))
      return
    await thread._delete()
    await goto('/admin/messages')
  }

  async function delete_failed_message(message: { id: string, delivery_status: string | null, _delete: () => Promise<void> }) {
    if (message.delivery_status !== 'failed')
      return
    if (!confirm('Delete this failed message? The customer never received it. This cannot be undone.'))
      return
    await message._delete()
  }

  function author_label(message: { author_kind: string, author_user_id: string | null }): string {
    if (message.author_kind === 'agent')
      return 'Agent'
    if (message.author_kind === 'admin') {
      const user = message.author_user_id ? db?.users.id(message.author_user_id) : null
      return user?.name || user?.email || 'Admin'
    }
    return thread?.from_name || thread?.from_email || 'Customer'
  }

  function author_user_id(message: { author_kind: string, author_user_id: string | null }): string | null {
    if (message.author_kind === 'agent')
      return null
    if (message.author_kind === 'admin')
      return message.author_user_id
    return thread?.from_user_id ?? null
  }
</script>

<a href={back.target.url} onclick={back.on_click} class="back-link">
  <IconMdiArrowLeft />
  {back.target.label}
</a>

{#if !thread}
  <p class="muted">Loading thread…</p>
{:else}
  <header class="thread-header">
    <h1 class="thread-title">{thread.subject || '(no subject)'}</h1>

    <div class="thread-meta">
      <span>from</span>
      {#if thread.from_user_id}
        {#if thread.from_name}
          <a href="/admin/users/{thread.from_user_id}" class="user-link strong">
            {thread.from_name}
          </a>
        {/if}
        <a href="/admin/users/{thread.from_user_id}" class="user-link">{thread.from_email}</a>
        <CopyButton value={thread.from_email} label="Copy email" />
      {:else}
        {#if thread.from_name}
          <strong class="strong-name">{thread.from_name}</strong>
        {/if}
        <span>{thread.from_email}</span>
        <CopyButton value={thread.from_email} label="Copy email" />
      {/if}
      {#if thread.to_email}
        <span class="bullet">·</span>
        <span class="to-line">to <span class="mono small">{thread.to_email}</span></span>
        <CopyButton value={thread.to_email} label="Copy email" />
      {/if}
      {#if thread.url}
        <span class="bullet">·</span>
        <a href={thread.url} rel="noreferrer" target="_blank" class="url-link">
          <IconMdiOpenInNew style="font-size: 0.75rem" />{thread.url}
        </a>
      {/if}
    </div>

    <div class="action-row">
      <AssigneeDropdown
        db={db}
        thread_id={thread.id}
        assigned_to_user_id={thread.assigned_to_user_id}
        onassigned={async () => { await data.sync?.sync() }} />
      <button type="button" class={thread.replied_at ? 'btn btn-default' : 'btn-outline btn-default'} onclick={toggle_replied}>
        {#if thread.replied_at}
          <IconMdiCheckCircle style="margin-right: 0.25rem; color: var(--success)" />Replied
        {:else}
          <IconMdiReply style="margin-right: 0.25rem" />Mark replied
        {/if}
      </button>
      <button type="button" class={thread.resolved_at ? 'btn btn-default' : 'btn-outline btn-default'} onclick={toggle_resolved}>
        {#if thread.resolved_at}
          <IconMdiCheckCircle style="margin-right: 0.25rem; color: var(--success)" />Resolved
        {:else}
          <IconMdiCheck style="margin-right: 0.25rem" />Mark resolved
        {/if}
      </button>
      <button type="button" class="btn-outline btn-default delete-btn" onclick={delete_thread}>
        <IconMdiTrashCanOutline style="margin-right: 0.25rem" />Delete
      </button>
    </div>

    {#if thread.replied_at || thread.resolved_at}
      <div class="status-meta">
        {#if thread.replied_at}
          <div>
            Replied <span title={format_date_time(thread.replied_at)}>{format_relative_time(thread.replied_at)}</span>{#if thread.replied_by_user_id}
              by {db?.users.id(thread.replied_by_user_id)?.name || db?.users.id(thread.replied_by_user_id)?.email || '(unknown)'}{/if}.
          </div>
        {/if}
        {#if thread.resolved_at}
          <div>
            Resolved <span title={format_date_time(thread.resolved_at)}>{format_relative_time(thread.resolved_at)}</span>{#if thread.resolved_by_user_id}
              by {db?.users.id(thread.resolved_by_user_id)?.name || db?.users.id(thread.resolved_by_user_id)?.email || '(unknown)'}{/if}.
          </div>
        {/if}
      </div>
    {/if}
  </header>

  <TriagePanel thread={thread} onusedraft={(html) => { draft_html = html }} />

  <ol class="message-list">
    {#each messages as message (message.id)}
      <li class="message-card">
        <div class="message-header">
          <IconMdiAccountCircle />
          {#if author_user_id(message)}
            <a href="/admin/users/{author_user_id(message)}" class="author-link">
              {author_label(message)}
            </a>
          {:else}
            <strong class="strong-name">{author_label(message)}</strong>
          {/if}
          <span>·</span>
          <span title={format_date_time(message.created_at)}>{format_relative_time(message.created_at)}</span>
          {#if message.author_kind === 'admin' && message.delivery_status}
            <span>·</span>
            {#if message.delivery_status === 'pending'}
              <span class="status muted-inline"><IconMdiClockOutline />sending…</span>
            {:else if message.delivery_status === 'sent'}
              <span class="status success"><IconMdiCheck />sent</span>
            {:else if message.delivery_status === 'failed'}
              <span class="status danger" title={message.delivery_error ?? undefined}><IconMdiAlertCircle />failed</span>
              <button
                type="button"
                aria-label="Delete this failed message"
                title="Delete this failed message (doesn't affect the rest of the thread)"
                class="btn-ghost btn-sm delete-failed-btn"
                onclick={() => delete_failed_message(message)}>
                <IconMdiTrashCanOutline />
              </button>
            {/if}
          {/if}
        </div>
        {#if message.cc || message.bcc}
          <div class="recipients-line">
            {#if message.cc}
              <span><span class="rcpt-label">cc</span> {message.cc}</span>
            {/if}
            {#if message.bcc}
              <span><span class="rcpt-label">bcc</span> {message.bcc}</span>
            {/if}
          </div>
        {/if}
        {#if message.body_text?.trim()}
          <div class="message-body">{message.body_text}</div>
        {:else if message.body_html}
          <HtmlBodyIframe html={message.body_html} />
        {:else}
          <div class="empty-body">(empty message)</div>
        {/if}

        {#if attachments_by_message[message.id]?.length}
          <ul class="att-list">
            {#each attachments_by_message[message.id] as att (att.id)}
              <li class="att-item">
                <IconMdiPaperclip />
                {att.filename}
                <span class="att-size">({format_bytes(att.size_bytes)})</span>
              </li>
            {/each}
          </ul>
        {/if}
      </li>
    {/each}
  </ol>

  {#if !thread.resolved_at}
    <ReplyComposer {thread_id} {db} sync={data.sync} bind:body_html={draft_html} />
  {/if}
{/if}

<style>
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.875rem;
    color: var(--color-secondary);
    text-decoration: none;
    transition: color 0.15s;
    margin-bottom: 1rem;
  }
  .back-link:hover {
    color: var(--color);
  }
  .muted {
    color: var(--color-secondary);
  }

  .thread-header {
    margin-bottom: 1.5rem;
  }
  .thread-title {
    font-size: 1.5rem;
    font-weight: 700;
  }
  .thread-meta {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--color-secondary);
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 0.5rem;
  }
  .user-link {
    color: var(--primary);
    text-decoration: none;
    transition: color 0.15s;
  }
  .user-link.strong {
    font-weight: 500;
  }
  .user-link:hover {
    text-decoration: underline;
  }
  .strong-name {
    color: var(--color);
  }
  .bullet {
    color: var(--color-secondary);
  }
  .to-line {
    color: var(--color-secondary);
  }
  .mono {
    font-family: var(--font-mono);
  }
  .mono.small {
    font-size: 0.75rem;
  }
  .url-link {
    color: var(--color-secondary);
    text-decoration: none;
    transition: color 0.15s;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .url-link:hover {
    color: var(--color);
  }

  .action-row {
    margin-top: 1rem;
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
  }
  .delete-btn {
    margin-left: auto;
    color: var(--danger);
  }
  .delete-btn:hover {
    background: var(--danger);
    color: white;
    border-color: var(--danger);
  }
  .status-meta {
    margin-top: 0.75rem;
    font-size: 0.75rem;
    color: var(--color-secondary);
  }
  .status-meta > div {
    margin: 0.125rem 0;
  }

  .message-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .message-card {
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--surface);
  }
  .message-header {
    font-size: 0.75rem;
    color: var(--color-secondary);
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .author-link {
    font-weight: 700;
    color: var(--primary);
    text-decoration: none;
    transition: color 0.15s;
  }
  .author-link:hover {
    text-decoration: underline;
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .muted-inline {
    color: var(--color-secondary);
  }
  .success {
    color: var(--success);
  }
  .danger {
    color: var(--danger);
  }
  .delete-failed-btn {
    color: var(--color-secondary);
    transition: color 0.15s;
  }
  .delete-failed-btn:hover {
    color: var(--danger);
  }

  .recipients-line {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    font-size: 0.75rem;
    color: var(--color-secondary);
    margin-bottom: 0.5rem;
  }
  .rcpt-label {
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    opacity: 0.75;
  }

  .message-body {
    white-space: pre-wrap;
    font-size: 0.875rem;
    line-height: 1.625;
  }
  .empty-body {
    font-size: 0.875rem;
    font-style: italic;
    color: var(--color-secondary);
  }

  .att-list {
    list-style: none;
    padding: 0;
    margin-top: 0.75rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .att-item {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    background: var(--background);
    color: var(--color);
  }
  .att-size {
    color: var(--color-secondary);
  }
</style>
