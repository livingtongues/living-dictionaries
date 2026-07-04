<script lang="ts">
  import { MAX_CHAT_ATTACHMENT_BYTES, MAX_CHAT_ATTACHMENTS_PER_MESSAGE } from '$lib/chat/constants'
  import ImageLightbox from '$lib/components/image/image-lightbox.svelte'
  import RichTextEditor from '$lib/svelte-pieces/RichTextEditor.svelte'
  import StagedImageThumb from '$lib/svelte-pieces/StagedImageThumb.svelte'
  import { html_to_text } from '$lib/utils/html-to-text'
  import { paste_image_from_clipboard } from '$lib/utils/paste-image-from-clipboard'
  import { onDestroy } from 'svelte'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiPaperclip from '~icons/mdi/paperclip'
  import IconMdiSend from '~icons/mdi/send'
  import { format_bytes, is_image_mimetype } from './attachments'

  interface Props {
    placeholder?: string
    sending?: boolean
    on_send: (input: { body_html: string, body_text: string, files: File[] }) => Promise<void> | void
  }
  let { placeholder = 'Write a message…', sending = false, on_send }: Props = $props()

  interface StagedFile {
    file: File
    /** Object URL for image previews; null for non-image files (shown as a chip). */
    preview_url: string | null
  }

  let html = $state('')
  let staged = $state<StagedFile[]>([])
  let file_input = $state<HTMLInputElement>()
  let viewer_url = $state<string | null>(null)
  const text = $derived(html_to_text(html).trim())
  const can_send = $derived((text.length > 0 || staged.length > 0) && !sending)

  function stage_file(file: File): StagedFile {
    return {
      file,
      preview_url: is_image_mimetype(file.type) ? URL.createObjectURL(file) : null,
    }
  }

  function revoke_preview(entry: StagedFile) {
    if (entry.preview_url)
      URL.revokeObjectURL(entry.preview_url)
  }

  function add_files(picked: FileList | File[] | null) {
    if (!picked)
      return
    const next = [...staged]
    for (const file of picked) {
      if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
        alert(`"${file.name}" is too large (max ${format_bytes(MAX_CHAT_ATTACHMENT_BYTES)}).`)
        continue
      }
      if (next.length >= MAX_CHAT_ATTACHMENTS_PER_MESSAGE) {
        alert(`Up to ${MAX_CHAT_ATTACHMENTS_PER_MESSAGE} files per message.`)
        break
      }
      next.push(stage_file(file))
    }
    staged = next
    if (file_input)
      file_input.value = ''
  }

  function handle_paste(event: ClipboardEvent) {
    const file = paste_image_from_clipboard(event)
    if (file)
      add_files([file])
  }

  function remove_file(index: number) {
    const entry = staged[index]
    if (entry)
      revoke_preview(entry)
    staged = staged.filter((_, i) => i !== index)
  }

  async function submit() {
    if (!can_send)
      return
    const body_html = html
    const body_text = text
    const to_send = staged.map(entry => entry.file)
    html = '' // optimistic clear so the composer feels instant
    for (const entry of staged)
      revoke_preview(entry)
    staged = []
    await on_send({ body_html, body_text, files: to_send })
  }

  function on_keydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      void submit()
    }
  }

  onDestroy(() => {
    for (const entry of staged)
      revoke_preview(entry)
  })
</script>

<div class="composer">
  <RichTextEditor bind:value={html} {placeholder} {on_keydown} on_paste={handle_paste} toolbar="email" />

  {#if staged.length}
    <div class="chips">
      {#each staged as entry, index (index)}
        {#if entry.preview_url}
          <StagedImageThumb src={entry.preview_url} alt={entry.file.name} on_remove={() => remove_file(index)} on_view={() => { viewer_url = entry.preview_url }} />
        {:else}
          <span class="chip">
            <span class="chip-name">{entry.file.name}</span>
            <span class="chip-size">{format_bytes(entry.file.size)}</span>
            <button type="button" class="chip-x" aria-label="Remove" onclick={() => remove_file(index)}><IconMdiClose /></button>
          </span>
        {/if}
      {/each}
    </div>
  {/if}

  {#if viewer_url}
    <ImageLightbox src={viewer_url} on_close={() => { viewer_url = null }} />
  {/if}

  <div class="composer-actions">
    <button type="button" class="attach-btn" title="Attach files" aria-label="Attach files" onclick={() => file_input?.click()}>
      <IconMdiPaperclip />
    </button>
    <input
      bind:this={file_input}
      type="file"
      multiple
      class="file-input"
      onchange={event => add_files((event.currentTarget as HTMLInputElement).files)} />
    <span class="hint">⌘/Ctrl + Enter to send</span>
    <button type="button" class="btn btn-primary btn-sm" disabled={!can_send} onclick={submit}>
      <IconMdiSend /> Send
    </button>
  </div>
</div>

<style>
  .composer {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    padding-top: 0.375rem;
    padding-right: 0.375rem;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.2rem 0.4rem 0.2rem 0.55rem;
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 999px;
    font-size: 0.75rem;
    max-width: 16rem;
  }
  .chip-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chip-size {
    color: var(--color-secondary);
    flex-shrink: 0;
  }
  .chip-x {
    display: inline-flex;
    border: none;
    background: transparent;
    color: var(--color-secondary);
    cursor: pointer;
    padding: 0.1rem;
    border-radius: 50%;
  }
  .chip-x:hover {
    color: var(--color);
  }
  .composer-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .attach-btn {
    display: inline-flex;
    border: none;
    background: transparent;
    color: var(--color-secondary);
    cursor: pointer;
    padding: 0.3rem;
    border-radius: 0.375rem;
    font-size: 1.1rem;
  }
  .attach-btn:hover {
    color: var(--color);
    background: var(--surface);
  }
  .file-input {
    display: none;
  }
  .hint {
    font-size: 0.75rem;
    color: var(--color-secondary);
    margin-left: auto;
  }
  .btn-sm {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.4rem 0.875rem;
  }
</style>
