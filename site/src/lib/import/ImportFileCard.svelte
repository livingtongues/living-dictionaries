<script lang="ts">
  import type { ImportFileForClient } from '$lib/import/types'
  import IconFa6SolidFile from '~icons/fa6-solid/file'
  import IconFa6SolidTrash from '~icons/fa6-solid/trash'
  import IconFa6SolidDownload from '~icons/fa6-solid/download'
  import IconMdiPencilOutline from '~icons/mdi/pencil-outline'
  import { page } from '$app/state'
  import { api_dict_file_delete, api_dict_file_update } from '$api/v1/dictionaries/[id]/files/_call'
  import { format_bytes } from '$lib/utils/format-bytes'
  import { format_date_time, format_relative_time } from '$lib/utils/format-relative-time'
  import { toast } from '$lib/state/toast.svelte'

  interface Props {
    file: ImportFileForClient
    dictionary_id: string
    on_changed: () => void
  }

  const { file, dictionary_id, on_changed }: Props = $props()
  const { t } = $derived(page.data)
  const requested = $derived(!!file.import_requested_at)

  let instructions_edit = $state<string | null>(null)
  let source_note_edit = $state<string | null>(null)
  const instructions = $derived(instructions_edit ?? file.import_instructions ?? '')
  const source_note = $derived(source_note_edit ?? file.source_note ?? '')
  let editing = $state(false)
  let saving = $state(false)

  async function save_field(field: 'import_instructions' | 'source_note', value: string) {
    const current = field === 'import_instructions' ? (file.import_instructions ?? '') : (file.source_note ?? '')
    if (value.trim() === current.trim())
      return
    const { error } = await api_dict_file_update({ dictionary_id, file_id: file.id, [field]: value })
    if (error)
      toast.error(error.message)
    else {
      if (field === 'import_instructions')
        instructions_edit = null
      else
        source_note_edit = null
      on_changed()
    }
  }

  async function remove() {
    const message = requested
      ? `${t('import_page.delete_requested_confirm')} "${file.filename}"?`
      : `${t('import_page.delete_file')}: "${file.filename}"?`
    if (!confirm(message))
      return
    const { error } = await api_dict_file_delete({ dictionary_id, file_id: file.id })
    if (error)
      toast.error(error.message)
    else
      on_changed()
  }

  function start_editing() {
    instructions_edit = file.import_instructions ?? ''
    source_note_edit = file.source_note ?? ''
    editing = true
  }

  function cancel_editing() {
    instructions_edit = null
    source_note_edit = null
    editing = false
  }

  async function save_requested_metadata() {
    if (saving)
      return
    saving = true
    const { error } = await api_dict_file_update({
      dictionary_id,
      file_id: file.id,
      import_instructions: instructions,
      source_note,
    })
    saving = false
    if (error) {
      toast.error(error.message)
      return
    }
    instructions_edit = null
    source_note_edit = null
    editing = false
    on_changed()
  }
</script>

<div class="file-card" class:requested>
  <div class="file-head">
    <IconFa6SolidFile style="flex-shrink: 0; opacity: 0.5" />
    <span class="file-name" title={file.filename}>{file.filename}</span>
    <span class="file-size">{format_bytes(file.size_bytes)}</span>
    {#if requested}
      <span class="badge requested-badge" title={format_date_time(file.import_requested_at)}>
        {t('import_page.requested')} · {format_relative_time(file.import_requested_at)}
      </span>
    {:else}
      <span class="badge uploaded-badge">{t('import_page.uploaded')}</span>
    {/if}
    <span style="flex-grow: 1"></span>
    <a class="icon-btn" href={`/api/v1/dictionaries/${dictionary_id}/files/${file.id}`} title={t('import_page.download_file')} download={file.filename}>
      <IconFa6SolidDownload />
    </a>
    {#if requested && file.can_manage_requested}
      <button type="button" class="icon-btn" title={t('import_page.edit_metadata')} onclick={start_editing}>
        <IconMdiPencilOutline />
      </button>
    {/if}
    {#if !requested || file.can_manage_requested}
      <button type="button" class="icon-btn danger" title={t('import_page.delete_file')} onclick={remove}>
        <IconFa6SolidTrash />
      </button>
    {/if}
  </div>

  {#if requested && editing}
    <label class="field">
      <span class="field-label">{t('import_page.instructions_label')} <span class="required-star">*</span></span>
      <textarea rows="2" value={instructions} placeholder={t('import_page.instructions_placeholder')} oninput={(event) => { instructions_edit = event.currentTarget.value }}></textarea>
    </label>
    <label class="field">
      <span class="field-label">{t('import_page.source_label')}</span>
      <textarea rows="2" value={source_note} placeholder={t('import_page.source_placeholder')} oninput={(event) => { source_note_edit = event.currentTarget.value }}></textarea>
    </label>
    <div class="edit-actions">
      <button type="button" class="btn btn-sm" disabled={saving} onclick={cancel_editing}>{t('misc.cancel')}</button>
      <button type="button" class="btn-primary btn-sm" disabled={saving || !instructions.trim()} onclick={save_requested_metadata}>
        {saving ? t('import_page.saving') : t('import_page.save_changes')}
      </button>
    </div>
  {:else if requested}
    {#if file.import_instructions}
      <div class="readonly-field">{file.import_instructions}</div>
    {/if}
    {#if file.source_note}
      <div class="readonly-field muted">{file.source_note}</div>
    {/if}
  {:else}
    <label class="field">
      <span class="field-label">{t('import_page.instructions_label')} <span class="required-star">*</span></span>
      <textarea
        rows="2"
        value={instructions}
        placeholder={t('import_page.instructions_placeholder')}
        oninput={(event) => { instructions_edit = event.currentTarget.value }}
        onblur={() => save_field('import_instructions', instructions)}></textarea>
    </label>
    <label class="field">
      <span class="field-label">{t('import_page.source_label')}</span>
      <textarea
        rows="2"
        value={source_note}
        placeholder={t('import_page.source_placeholder')}
        oninput={(event) => { source_note_edit = event.currentTarget.value }}
        onblur={() => save_field('source_note', source_note)}></textarea>
    </label>
  {/if}
</div>

<style>
  .file-card {
    border: 1px solid color-mix(in srgb, var(--color) 14%, var(--background));
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    background: var(--surface);
  }
  .file-card.requested {
    border-color: color-mix(in srgb, var(--primary) 15%, var(--background));
  }
  .file-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    flex-wrap: wrap;
  }
  .file-name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 20rem;
  }
  .file-size {
    font-size: 0.8rem;
    color: var(--color-secondary);
    white-space: nowrap;
  }
  .badge {
    font-size: 0.7rem;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    white-space: nowrap;
  }
  .uploaded-badge {
    background: color-mix(in srgb, var(--success), transparent 86%);
    color: var(--success);
  }
  .requested-badge {
    background: color-mix(in srgb, var(--primary), transparent 86%);
    color: var(--primary);
  }
  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0.375rem;
    color: var(--color-secondary);
    font-size: 0.8rem;
  }
  .icon-btn:hover {
    color: var(--primary);
    background: color-mix(in srgb, var(--color) 7%, var(--background));
  }
  .icon-btn.danger:hover {
    color: #dc2626;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .field-label {
    font-size: 0.78rem;
    font-weight: 600;
    color: color-mix(in srgb, var(--color) 80%, var(--background));
  }
  .required-star {
    color: #dc2626;
  }
  textarea {
    width: 100%;
    resize: vertical;
    font-size: 0.875rem;
  }
  .readonly-field {
    font-size: 0.85rem;
    white-space: pre-wrap;
    background: color-mix(in srgb, var(--color) 4%, var(--background));
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
  }
  .readonly-field.muted {
    color: var(--color-secondary);
  }
  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
