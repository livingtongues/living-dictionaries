<script lang="ts">
  import { MAX_CHAT_ATTACHMENT_BYTES, MAX_CHAT_ATTACHMENTS_PER_MESSAGE } from '$lib/chat/constants'
  import RichTextEditor from '$lib/svelte-pieces/RichTextEditor.svelte'
  import { html_to_text } from '$lib/utils/html-to-text'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiPaperclip from '~icons/mdi/paperclip'
  import IconMdiSend from '~icons/mdi/send'
  import { format_bytes } from './attachments'

  interface Props {
    placeholder?: string
    sending?: boolean
    on_send: (input: { body_html: string, body_text: string, files: File[] }) => Promise<void> | void
  }
  let { placeholder = 'Write a message…', sending = false, on_send }: Props = $props()

  let html = $state('')
  let files = $state<File[]>([])
  let file_input = $state<HTMLInputElement>()
  const text = $derived(html_to_text(html).trim())
  const can_send = $derived((text.length > 0 || files.length > 0) && !sending)

  function add_files(picked: FileList | null) {
    if (!picked)
      return
    const next = [...files]
    for (const file of picked) {
      if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
        alert(`"${file.name}" is too large (max ${format_bytes(MAX_CHAT_ATTACHMENT_BYTES)}).`)
        continue
      }
      if (next.length >= MAX_CHAT_ATTACHMENTS_PER_MESSAGE) {
        alert(`Up to ${MAX_CHAT_ATTACHMENTS_PER_MESSAGE} files per message.`)
        break
      }
      next.push(file)
    }
    files = next
    if (file_input)
      file_input.value = ''
  }

  function remove_file(index: number) {
    files = files.filter((_, i) => i !== index)
  }

  async function submit() {
    if (!can_send)
      return
    const body_html = html
    const body_text = text
    const to_send = files
    html = '' // optimistic clear so the composer feels instant
    files = []
    await on_send({ body_html, body_text, files: to_send })
  }

  function on_keydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      void submit()
    }
  }
</script>

<div class="composer">
  <RichTextEditor bind:value={html} {placeholder} {on_keydown} toolbar="email" />

  {#if files.length}
    <div class="chips">
      {#each files as file, index (index)}
        <span class="chip">
          <span class="chip-name">{file.name}</span>
          <span class="chip-size">{format_bytes(file.size)}</span>
          <button type="button" class="chip-x" aria-label="Remove" onclick={() => remove_file(index)}><IconMdiClose /></button>
        </span>
      {/each}
    </div>
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
    gap: 0.375rem;
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
