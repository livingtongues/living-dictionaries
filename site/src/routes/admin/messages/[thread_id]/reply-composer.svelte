<script lang="ts">
  import type { MessagesReplyAttachment } from '../../../api/messages/reply/+server'
  import type { LiveDb } from '$lib/db/client/live/live-db.svelte'
  import type { Recipient } from '$lib/admin/messages/recipient-input.svelte'
  import type { Sync } from '$lib/db/sync/engine.svelte.js'
  import CcBccFields from '$lib/admin/messages/cc-bcc-fields.svelte'
  import IconMdiAlertCircle from '~icons/mdi/alert-circle'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiLoading from '~icons/mdi/loading'
  import IconMdiPaperclip from '~icons/mdi/paperclip'
  import IconMdiReply from '~icons/mdi/reply'
  import IconMdiSend from '~icons/mdi/send'
  import RichTextEditor from '$lib/components/ui/RichTextEditor.svelte'
  import { format_bytes } from '$lib/utils/format-bytes'
  import { html_to_text } from '$lib/utils/html-to-text'
  import { api_messages_reply } from '../../../api/messages/reply/_call'

  interface Props {
    thread_id: string
    db: LiveDb | null | undefined
    sync: Sync | null
    /** Two-way bound so the AI-triage "Use draft" button can prefill the editor. */
    body_html?: string
  }

  let { thread_id, db, sync, body_html = $bindable('') }: Props = $props()

  const body_text = $derived(html_to_text(body_html))
  let cc_recipients = $state<Recipient[]>([])
  let bcc_recipients = $state<Recipient[]>([])
  let staged = $state<{ file: File }[]>([])
  let sending = $state(false)
  let error: string | null = $state(null)
  let last_send_at = $state(0)
  const RATE_LIMIT_MS = 10_000

  async function send() {
    if (!body_text.trim() || sending)
      return
    const now = Date.now()
    if (now - last_send_at < RATE_LIMIT_MS) {
      error = `Please wait a moment before sending again (rate-limit ${Math.ceil((RATE_LIMIT_MS - (now - last_send_at)) / 1000)}s).`
      return
    }

    sending = true
    error = null

    let attachments: MessagesReplyAttachment[]
    try {
      attachments = await Promise.all(
        staged.map(async ({ file }) => ({
          filename: file.name,
          mimetype: file.type || 'application/octet-stream',
          content_b64: await read_file_as_base64(file),
        })),
      )
    } catch (err) {
      error = `Failed to read attachment: ${(err as Error).message}`
      sending = false
      return
    }

    const cc_emails = cc_recipients.map(recipient => recipient.email)
    const bcc_emails = bcc_recipients.map(recipient => recipient.email)

    const { data, error: api_error } = await api_messages_reply({
      thread_id,
      body_text,
      body_html,
      cc: cc_emails.length > 0 ? cc_emails : undefined,
      bcc: bcc_emails.length > 0 ? bcc_emails : undefined,
      attachments,
    })

    sending = false
    if (api_error) {
      error = api_error.message
      return
    }
    if (data.delivery_status === 'failed') {
      error = data.delivery_error || 'SES rejected the send. The message is saved as failed — retry from the dashboard.'
      last_send_at = now
      reset_fields()
      void sync?.sync().catch(() => undefined)
      return
    }

    last_send_at = now
    reset_fields()
    void sync?.sync().catch(() => undefined)
  }

  function reset_fields() {
    body_html = ''
    staged = []
    cc_recipients = []
    bcc_recipients = []
  }

  function read_file_as_base64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        const comma = result.indexOf(',')
        resolve(comma >= 0 ? result.slice(comma + 1) : result)
      }
      reader.onerror = () => reject(reader.error ?? new Error('Read failed'))
      reader.readAsDataURL(file)
    })
  }

  function add_files(event: Event) {
    const input = event.target as HTMLInputElement
    if (!input.files)
      return
    for (const file of Array.from(input.files))
      staged.push({ file })
    input.value = ''
  }

  function remove_staged(index: number) {
    staged.splice(index, 1)
  }

  function on_editor_keydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      void send()
    }
  }
</script>

<form class="composer" onsubmit={(event) => { event.preventDefault(); void send() }}>
  <h2 class="composer-heading">
    <IconMdiReply style="margin-right: 0.25rem" />Reply to thread
  </h2>

  <CcBccFields {db} bind:cc_recipients bind:bcc_recipients disabled={sending} />

  <RichTextEditor
    bind:value={body_html}
    placeholder="Type your reply…"
    disabled={sending}
    toolbar="email"
    on_keydown={on_editor_keydown} />

  {#if staged.length > 0}
    <ul class="staged-list">
      {#each staged as att, idx (idx)}
        <li class="staged-item">
          <IconMdiPaperclip />
          <span class="staged-name">{att.file.name}</span>
          <span class="staged-size">({format_bytes(att.file.size)})</span>
          <button type="button" class="remove-staged" aria-label="Remove attachment" onclick={() => remove_staged(idx)}>
            <IconMdiClose />
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="action-row">
    <label class="btn-outline btn-sm attach-label">
      <IconMdiPaperclip style="margin-right: 0.25rem" />
      Attach
      <input type="file" multiple onchange={add_files} class="hidden-input" />
    </label>

    <button type="submit" class="btn btn-default send-btn" disabled={!body_text.trim() || sending}>
      {#if sending}
        <IconMdiLoading class="animate-spin" style="margin-right: 0.25rem" />Sending…
      {:else}
        <IconMdiSend style="margin-right: 0.25rem" />Send reply <span class="hint">(Ctrl+Enter)</span>
      {/if}
    </button>
  </div>

  {#if error}
    <div class="error-banner">
      <IconMdiAlertCircle style="margin-top: 0.125rem; flex-shrink: 0" />
      <span class="error-text">{error}</span>
    </div>
  {/if}
</form>

<style>
  .composer {
    margin-top: 1.5rem;
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .composer-heading {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-secondary);
    margin: 0;
  }
  .staged-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .staged-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--color-secondary);
  }
  .staged-name {
    color: var(--color);
  }
  .staged-size {
    font-size: 0.75rem;
  }
  .remove-staged {
    margin-left: auto;
    padding: 0.25rem;
    color: var(--color-secondary);
    background: transparent;
    border: 0;
    cursor: pointer;
  }
  .remove-staged:hover {
    color: var(--danger);
  }

  .action-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .attach-label {
    cursor: pointer;
  }
  .hidden-input {
    display: none;
  }
  .send-btn {
    margin-left: auto;
  }
  .hint {
    font-size: 0.75rem;
    opacity: 0.7;
    margin-left: 0.25rem;
  }

  .error-banner {
    padding: 0.75rem;
    border-radius: 0.5rem;
    background: var(--danger);
    color: white;
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }
  .error-text {
    font-size: 0.875rem;
  }
</style>
