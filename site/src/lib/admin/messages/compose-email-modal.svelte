<script lang="ts" module>
  /** A registered user the compose modal is pre-addressed to (from a user page). */
  export interface PresetUser {
    id: string
    email: string
    name: string | null
  }
</script>

<script lang="ts">
  import type { ComposeSendResult, MessagesComposeAttachment } from '$api/messages/compose/+server'
  import type { LiveDb } from '$lib/db/client/live/live-db.svelte'
  import type { Recipient } from '$lib/admin/messages/recipient-input.svelte'
  import ComposeRecipients from '$lib/admin/messages/compose-recipients.svelte'
  import IconMdiAlertCircle from '~icons/mdi/alert-circle'
  import IconMdiCheckCircle from '~icons/mdi/check-circle'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiEmailPlusOutline from '~icons/mdi/email-plus-outline'
  import IconMdiLoading from '~icons/mdi/loading'
  import IconMdiPaperclip from '~icons/mdi/paperclip'
  import IconMdiSend from '~icons/mdi/send'
  import { api_messages_compose } from '$api/messages/compose/_call'
  import Modal from '$lib/svelte-pieces/Modal.svelte'
  import StagedImageThumb from '$lib/svelte-pieces/StagedImageThumb.svelte'
  import RichTextEditor from '$lib/svelte-pieces/RichTextEditor.svelte'
  import { format_bytes } from '$lib/utils/format-bytes'
  import { html_to_text } from '$lib/utils/html-to-text'
  import { is_image_mimetype } from '$lib/utils/is-image-mimetype'
  import { paste_image_from_clipboard } from '$lib/utils/paste-image-from-clipboard'

  interface Props {
    db: LiveDb | null | undefined
    from_email: string
    from_name: string
    on_close: () => void
    on_sent: (thread_id: string) => void
    preset_user?: PresetUser | null
  }

  let {
    db,
    from_email,
    from_name,
    on_close,
    on_sent,
    preset_user = null,
  }: Props = $props()

  let subject = $state('')
  let body_html = $state('')
  const body_text = $derived(html_to_text(body_html))
  // Seed the To field from the preset (the modal is freshly mounted on each open,
  // so capturing preset_user's initial value here is correct). It becomes a normal
  // removable pill — the admin can clear it or add more recipients.
  function initial_recipients(): Recipient[] {
    const seed = preset_user
    return seed ? [{ user_id: seed.id, email: seed.email, name: seed.name }] : []
  }
  let to_recipients = $state<Recipient[]>(initial_recipients())
  let cc_recipients = $state<Recipient[]>([])
  let bcc_recipients = $state<Recipient[]>([])
  // Admin-initiated outbound usually needs no follow-up, so default to resolved
  // (keeps it out of the unresolved inbox). Uncheck when expecting a reply.
  let mark_resolved = $state(true)
  interface StagedAttachment {
    file: File
    preview_url: string | null
  }
  let staged = $state<StagedAttachment[]>([])
  let sending = $state(false)
  let error: string | null = $state(null)
  // Per-recipient outcomes from the last send — only surfaced when something
  // failed (success closes/navigates immediately).
  let results = $state<ComposeSendResult[]>([])

  let form_el = $state<HTMLFormElement>()
  // Focusable but visually-hidden proxies so the native validation bubble can
  // anchor to the custom recipient picker and rich-text editor (neither is a
  // real form control). Their validity is driven reactively below.
  let recipient_validity = $state<HTMLInputElement>()
  let body_validity = $state<HTMLInputElement>()

  const recipient_valid = $derived(to_recipients.length > 0)
  const body_valid = $derived(body_text.trim().length > 0)
  const failed_results = $derived(results.filter(result => result.delivery_status === 'failed'))

  $effect(() => {
    recipient_validity?.setCustomValidity(
      recipient_valid ? '' : 'Add at least one recipient.',
    )
  })
  $effect(() => {
    body_validity?.setCustomValidity(body_valid ? '' : 'Write a message before sending.')
  })

  async function send() {
    if (sending)
      return

    sending = true
    error = null
    results = []

    let attachments: MessagesComposeAttachment[]
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

    const { data, error: api_error } = await api_messages_compose({
      recipients: to_recipients.map(recipient =>
        recipient.user_id ? { user_id: recipient.user_id } : { email: recipient.email }),
      subject,
      body_text,
      body_html,
      cc: cc_recipients.length > 0 ? cc_recipients.map(recipient => recipient.email) : undefined,
      bcc: bcc_recipients.length > 0 ? bcc_recipients.map(recipient => recipient.email) : undefined,
      resolve: mark_resolved,
      attachments,
    })

    sending = false
    if (api_error) {
      error = api_error.message
      return
    }

    const { results: send_results } = data
    results = send_results
    const failed = send_results.filter(result => result.delivery_status === 'failed')
    if (failed.length > 0) {
      // Keep the modal open with the ✓/✗ summary; successes are sent and failures
      // were saved as retryable failed threads. Drop the recipients that went
      // through so a follow-up Send only retries the ones that failed (no dupes).
      const sent_emails = new Set(
        send_results.filter(result => result.delivery_status === 'sent').map(result => result.recipient_email.toLowerCase()),
      )
      to_recipients = to_recipients.filter(recipient => !sent_emails.has(recipient.email.toLowerCase()))
      return
    }

    // All sent — open the first created thread.
    const first_thread = send_results.find(result => result.thread_id)?.thread_id
    if (first_thread)
      on_sent(first_thread)
    else
      on_close()
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

  function stage_file(file: File): StagedAttachment {
    return {
      file,
      preview_url: is_image_mimetype(file.type) ? URL.createObjectURL(file) : null,
    }
  }

  function revoke_preview(entry: StagedAttachment) {
    if (entry.preview_url)
      URL.revokeObjectURL(entry.preview_url)
  }

  function add_files(event: Event) {
    const input = event.target as HTMLInputElement
    if (!input.files)
      return
    for (const file of input.files)
      staged = [...staged, stage_file(file)]
    input.value = ''
  }

  function remove_staged(index: number) {
    const entry = staged[index]
    if (entry)
      revoke_preview(entry)
    staged = staged.filter((_, i) => i !== index)
  }

  function handle_paste(event: ClipboardEvent) {
    const file = paste_image_from_clipboard(event)
    if (file)
      staged = [...staged, stage_file(file)]
  }

  function on_editor_keydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      // Route through the form so native constraint validation runs (instead of
      // silently bypassing it like a direct send() call would).
      form_el?.requestSubmit()
    }
  }
</script>

<Modal {on_close} class="compose-modal">
  {#snippet heading()}
    <span class="heading-inline">
      <IconMdiEmailPlusOutline />
      {preset_user ? `New email to ${preset_user.name || preset_user.email}` : 'Compose message'}
    </span>
  {/snippet}

  <form class="form" bind:this={form_el} onsubmit={(event) => { event.preventDefault(); void send() }}>
    <div class="field-anchor">
      <ComposeRecipients
        {db}
        {from_email}
        {from_name}
        bind:to_recipients
        bind:cc_recipients
        bind:bcc_recipients
        disabled={sending} />
      <input bind:this={recipient_validity} class="validity-proxy" tabindex="-1" aria-hidden="true" />
    </div>

    <input type="text" bind:value={subject} placeholder="Subject" required disabled={sending} class="subject-input" />

    <div class="field-anchor">
      <RichTextEditor
        bind:value={body_html}
        placeholder="Write your message…"
        disabled={sending}
        toolbar="email"
        on_keydown={on_editor_keydown}
        on_paste={handle_paste} />
      <input bind:this={body_validity} class="validity-proxy" tabindex="-1" aria-hidden="true" />
    </div>

    {#if staged.length > 0}
      <div class="staged">
        {#each staged as att, idx (idx)}
          {#if att.preview_url}
            <StagedImageThumb src={att.preview_url} alt={att.file.name} on_remove={() => remove_staged(idx)} />
          {:else}
            <span class="staged-item">
              <IconMdiPaperclip />
              <span class="staged-name">{att.file.name}</span>
              <span class="staged-size">({format_bytes(att.file.size)})</span>
              <button type="button" class="remove-staged" aria-label="Remove attachment" disabled={sending} onclick={() => remove_staged(idx)}>
                <IconMdiClose />
              </button>
            </span>
          {/if}
        {/each}
      </div>
    {/if}

    {#if error}
      <div class="error-banner">
        <IconMdiAlertCircle style="margin-top: 0.125rem; flex-shrink: 0" />
        <span class="error-text">{error}</span>
      </div>
    {/if}

    {#if failed_results.length > 0}
      <div class="results-summary">
        <p class="results-heading">
          {results.length - failed_results.length} sent · {failed_results.length} failed.
          Failed sends were saved — retry them from their thread. Fix or remove them below and Send again.
        </p>
        <ul class="results-list">
          {#each results as result (result.recipient_email)}
            <li class="result-item" class:failed={result.delivery_status === 'failed'}>
              {#if result.delivery_status === 'sent'}
                <IconMdiCheckCircle class="result-icon ok" />
              {:else}
                <IconMdiAlertCircle class="result-icon bad" />
              {/if}
              <span class="result-email">{result.recipient_email}</span>
              {#if result.delivery_error}
                <span class="result-error">— {result.delivery_error}</span>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <div class="modal-footer">
      <label class="btn btn-outline btn-sm attach-label">
        <IconMdiPaperclip style="margin-right: 0.25rem" />
        Attach
        <input type="file" multiple onchange={add_files} class="hidden-input" disabled={sending} />
      </label>
      <label class="resolve-toggle">
        <input type="checkbox" bind:checked={mark_resolved} disabled={sending} />
        Mark as resolved
      </label>
      <button type="button" class="btn btn-outline btn-sm" onclick={on_close} disabled={sending}>Cancel</button>
      <button type="submit" class="btn btn-primary btn-sm" disabled={sending}>
        {#if sending}
          <IconMdiLoading class="animate-spin" style="margin-right: 0.25rem" />Sending…
        {:else}
          <IconMdiSend style="margin-right: 0.25rem" />Send <span class="hint">(Ctrl+Enter)</span>
        {/if}
      </button>
    </div>
  </form>
</Modal>

<style>
  :global(.compose-modal) {
    max-width: 42rem !important;
  }

  .heading-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .field-anchor {
    position: relative;
  }
  /* Visually hidden but still focusable (NOT display:none/visibility:hidden) so
     the browser can anchor + report a native validation bubble on the custom
     recipient picker / rich-text editor. */
  .validity-proxy {
    position: absolute;
    left: 1rem;
    bottom: 0.25rem;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: 0;
    border: 0;
    opacity: 0;
    pointer-events: none;
  }
  .subject-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    background: var(--background);
    border: 1px solid var(--border-color);
    font-size: 0.875rem;
    color: var(--color);
  }
  .subject-input:focus {
    outline: none;
    border-color: var(--primary);
  }
  .subject-input:disabled {
    opacity: 0.5;
  }
  .staged {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .staged-item {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--color-secondary);
    padding: 0.25rem 0.5rem;
    background: var(--background);
    border: 1px solid var(--border-color);
    border-radius: 999px;
  }
  .staged-name {
    color: var(--color);
  }
  .staged-size {
    font-size: 0.75rem;
  }
  .remove-staged {
    padding: 0.25rem;
    color: var(--color-secondary);
    background: transparent;
    border: 0;
    cursor: pointer;
    display: inline-flex;
  }
  .remove-staged:hover {
    color: var(--danger);
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
  .results-summary {
    padding: 0.625rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border-color);
    background: var(--surface);
  }
  .results-heading {
    margin: 0 0 0.5rem;
    font-size: 0.75rem;
    color: var(--color-secondary);
  }
  .results-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .result-item {
    display: flex;
    align-items: baseline;
    gap: 0.375rem;
    font-size: 0.8125rem;
    color: var(--color);
  }
  :global(.results-summary .result-icon) {
    align-self: center;
    flex-shrink: 0;
  }
  :global(.results-summary .result-icon.ok) {
    color: var(--success, #16a34a);
  }
  :global(.results-summary .result-icon.bad) {
    color: var(--danger);
  }
  .result-email {
    font-family: var(--font-mono);
  }
  .result-error {
    color: var(--danger);
    font-size: 0.75rem;
  }
  .modal-footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .attach-label {
    cursor: pointer;
    margin-right: auto;
  }
  .resolve-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    color: var(--color-secondary);
    cursor: pointer;
    user-select: none;
  }
  .resolve-toggle input {
    cursor: pointer;
  }
  .hidden-input {
    display: none;
  }
  .hint {
    font-size: 0.75rem;
    opacity: 0.7;
    margin-left: 0.25rem;
  }
</style>
