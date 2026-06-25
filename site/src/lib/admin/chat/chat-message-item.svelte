<script lang="ts">
  import type { ChatMessageWithAttachments } from '$lib/server/chat/chat-db'
  import RichTextEditor from '$lib/svelte-pieces/RichTextEditor.svelte'
  import { html_to_text } from '$lib/utils/html-to-text'
  import { linkify_html } from '$lib/utils/linkify-html'
  import IconMdiCheck from '~icons/mdi/check'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiFileOutline from '~icons/mdi/file-outline'
  import IconMdiPencilOutline from '~icons/mdi/pencil-outline'
  import IconMdiTrashCanOutline from '~icons/mdi/trash-can-outline'
  import { chat_attachment_url, format_bytes, is_image_mimetype } from './attachments'

  interface Props {
    message: ChatMessageWithAttachments
    author_name: string
    is_own: boolean
    on_edit: (input: { message_id: string, body_html: string, body_text: string }) => Promise<void> | void
    on_delete: (message_id: string) => Promise<void> | void
  }
  let { message, author_name, is_own, on_edit, on_delete }: Props = $props()

  let editing = $state(false)
  let draft = $state('')
  let busy = $state(false)

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
    {#if is_own && !message.deleted_at && !editing}
      <span class="msg-actions">
        <button type="button" title="Edit" aria-label="Edit" onclick={start_edit}><IconMdiPencilOutline /></button>
        <button type="button" title="Delete" aria-label="Delete" onclick={remove} disabled={busy}><IconMdiTrashCanOutline /></button>
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
    <!-- body_html is TipTap output authored by a trusted admin. MVP renders it directly;
         add HTML sanitization if non-admins ever author chat. -->
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
  .msg:hover .msg-actions {
    opacity: 1;
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
