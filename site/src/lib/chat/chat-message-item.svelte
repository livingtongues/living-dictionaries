<script lang="ts">
  import type { ChatMessageWithAttachments } from '$lib/server/chat/chat-db'
  import RichTextEditor from '$lib/components/ui/RichTextEditor.svelte'
  import { html_to_text } from '$lib/utils/html-to-text'
  import { linkify_html } from '$lib/utils/linkify-html'
  import IconMdiCheck from '~icons/mdi/check'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiEmoticonOutline from '~icons/mdi/emoticon-outline'
  import IconMdiFileOutline from '~icons/mdi/file-outline'
  import IconMdiPencilOutline from '~icons/mdi/pencil-outline'
  import IconMdiTrashCanOutline from '~icons/mdi/trash-can-outline'
  import { chat_attachment_url, format_bytes, is_image_mimetype } from './attachments'
  import ReactionPicker from './reaction-picker.svelte'

  interface Props {
    message: ChatMessageWithAttachments
    author_name: string
    is_own: boolean
    me_user_id: string
    on_edit: (input: { message_id: string, body_html: string, body_text: string }) => Promise<void> | void
    on_delete: (message_id: string) => Promise<void> | void
    on_react: (input: { message_id: string, emoji: string }) => Promise<void> | void
  }
  let { message, author_name, is_own, me_user_id, on_edit, on_delete, on_react }: Props = $props()

  let editing = $state(false)
  let draft = $state('')
  let busy = $state(false)
  let show_reactions = $state(false)

  function react(emoji: string) {
    void on_react({ message_id: message.id, emoji })
  }

  function start_edit() {
    draft = message.body_html
    editing = true
  }

  async function save_edit() {
    const body_text = html_to_text(draft).trim()
    if (!body_text) {
      editing = false
      return
    }
    busy = true
    await on_edit({ message_id: message.id, body_html: draft, body_text })
    busy = false
    editing = false
  }

  async function remove() {
    if (!confirm('Delete this message?'))
      return
    busy = true
    await on_delete(message.id)
    busy = false
  }

  function time_label(iso: string): string {
    return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }
</script>

<div class="msg" class:own={is_own}>
  <div class="msg-head">
    <span class="author">{author_name}</span>
    <span class="time">{time_label(message.created_at)}</span>
    {#if message.edited_at && !message.deleted_at}<span class="edited">(edited)</span>{/if}
    {#if !message.deleted_at && !editing}
      <span class={['msg-actions', { open: show_reactions }]}>
        <span class="react-wrap">
          <button type="button" title="Add reaction" aria-label="Add reaction" aria-expanded={show_reactions} onclick={() => { show_reactions = !show_reactions }}><IconMdiEmoticonOutline /></button>
          {#if show_reactions}
            <ReactionPicker on_pick={react} close={() => { show_reactions = false }} />
          {/if}
        </span>
        {#if is_own}
          <button type="button" title="Edit" aria-label="Edit" onclick={start_edit}><IconMdiPencilOutline /></button>
          <button type="button" title="Delete" aria-label="Delete" onclick={remove} disabled={busy}><IconMdiTrashCanOutline /></button>
        {/if}
      </span>
    {/if}
  </div>

  {#if message.deleted_at}
    <p class="deleted">message deleted</p>
  {:else if editing}
    <div class="edit-box">
      <RichTextEditor bind:value={draft} toolbar="email" placeholder="Edit message…" />
      <div class="edit-actions">
        <button type="button" class="btn btn-primary btn-xs" onclick={save_edit} disabled={busy}><IconMdiCheck /> Save</button>
        <button type="button" class="btn btn-default btn-xs" onclick={() => { editing = false }}><IconMdiClose /> Cancel</button>
      </div>
    </div>
  {:else}
    <!-- body_html is server-sanitized at the write boundary (post/edit run it
         through `xss` in chat-db.ts) — members include non-admin partners. -->
    {#if message.body_html.trim()}
      <div class="body">{@html linkify_html(message.body_html)}</div>
    {/if}
    {#if message.attachments.length}
      <div class="attachments">
        {#each message.attachments as attachment (attachment.id)}
          {#if is_image_mimetype(attachment.mimetype)}
            <a class="att-image" href={chat_attachment_url(attachment.id)} target="_blank" rel="noopener" title={attachment.filename}>
              <img src={chat_attachment_url(attachment.id)} alt={attachment.filename} loading="lazy" />
            </a>
          {:else}
            <a class="att-file" href={chat_attachment_url(attachment.id)} target="_blank" rel="noopener">
              <IconMdiFileOutline />
              <span class="att-name">{attachment.filename}</span>
              {#if attachment.size_bytes}<span class="att-size">{format_bytes(attachment.size_bytes)}</span>{/if}
            </a>
          {/if}
        {/each}
      </div>
    {/if}
    {#if message.reactions.length}
      <div class="reactions">
        {#each message.reactions as reaction (reaction.emoji)}
          <button
            type="button"
            class={['chip', { mine: reaction.user_ids.includes(me_user_id) }]}
            title={`${reaction.user_ids.length} reaction${reaction.user_ids.length === 1 ? '' : 's'}`}
            onclick={() => react(reaction.emoji)}>
            <span class="chip-emoji">{reaction.emoji}</span>
            <span class="chip-count">{reaction.user_ids.length}</span>
          </button>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .msg {
    padding: 0.4rem 0.5rem;
    border-radius: 0.5rem;
  }
  .msg:hover {
    background: color-mix(in srgb, transparent, var(--color) 4%);
  }
  .msg-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .author {
    font-weight: 600;
    font-size: 0.875rem;
  }
  .time {
    font-size: 0.7rem;
    color: var(--color-secondary);
  }
  .edited {
    font-size: 0.7rem;
    color: var(--color-secondary);
    font-style: italic;
  }
  .msg-actions {
    margin-left: auto;
    display: inline-flex;
    gap: 0.125rem;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .msg:hover .msg-actions,
  .msg-actions.open {
    opacity: 1;
  }
  .react-wrap {
    position: relative;
    display: inline-flex;
  }
  .msg-actions button {
    border: none;
    background: transparent;
    color: var(--color-secondary);
    cursor: pointer;
    padding: 0.15rem;
    border-radius: 0.25rem;
    display: inline-flex;
  }
  .msg-actions button:hover {
    color: var(--color);
    background: var(--surface);
  }
  .body {
    font-size: 0.9rem;
    line-height: 1.5;
    margin-top: 0.1rem;
    word-break: break-word;
    /* `anywhere` is the reliable cross-browser break for long URLs/tokens
       (iOS Safari honours it where `break-word` alone can leak). */
    overflow-wrap: anywhere;
    min-width: 0;
  }
  .body :global(p) {
    margin: 0 0 0.25rem;
  }
  .body :global(a) {
    color: var(--primary);
    text-decoration: underline;
  }
  .deleted {
    font-size: 0.85rem;
    font-style: italic;
    color: var(--color-secondary);
    margin-top: 0.1rem;
  }
  .reactions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-top: 0.3rem;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    padding: 0.05rem 0.4rem;
    border: 1px solid var(--border-color);
    border-radius: 999px;
    background: var(--surface);
    cursor: pointer;
    font-size: 0.8rem;
    line-height: 1.4;
  }
  .chip:hover {
    border-color: var(--primary);
  }
  .chip.mine {
    border-color: var(--primary);
    background: color-mix(in srgb, var(--primary), transparent 85%);
  }
  .chip-emoji {
    font-size: 0.9rem;
  }
  .chip-count {
    color: var(--color-secondary);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .chip.mine .chip-count {
    color: var(--primary);
  }
  .attachments {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.35rem;
  }
  .att-image {
    display: inline-flex;
    border-radius: 0.5rem;
    overflow: hidden;
    border: 1px solid var(--border-color);
    max-width: 14rem;
  }
  .att-image img {
    display: block;
    max-width: 14rem;
    max-height: 12rem;
    object-fit: cover;
  }
  .att-file {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.4rem 0.65rem;
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    font-size: 0.8rem;
    color: var(--color);
    text-decoration: none;
    max-width: 16rem;
  }
  .att-file:hover {
    border-color: var(--primary);
  }
  .att-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .att-size {
    color: var(--color-secondary);
    flex-shrink: 0;
  }
  .edit-box {
    margin-top: 0.25rem;
  }
  .edit-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.4rem;
  }
  .btn-xs {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.6rem;
    font-size: 0.8rem;
  }
</style>
