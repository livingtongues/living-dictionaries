<script lang="ts">
  import type { ImportFileForClient, ImportRequestSummary } from '$lib/import/types'
  import IconMdiPencilOutline from '~icons/mdi/pencil-outline'
  import { page } from '$app/state'
  import { api_dict_import_request_update } from '$api/v1/dictionaries/[id]/files/_call'
  import { format_date_time } from '$lib/utils/format-relative-time'
  import { toast } from '$lib/state/toast.svelte'
  import ImportFileCard from './ImportFileCard.svelte'

  interface Props {
    request: ImportRequestSummary
    files: ImportFileForClient[]
    dictionary_id: string
    on_changed: () => void
  }

  const { request, files, dictionary_id, on_changed }: Props = $props()
  const { t } = $derived(page.data)
  let editing = $state(false)
  let saving = $state(false)
  let request_note = $state('')

  function start_editing() {
    request_note = request.request_note ?? ''
    editing = true
  }

  function cancel_editing() {
    request_note = request.request_note ?? ''
    editing = false
  }

  async function save_request_note() {
    if (saving)
      return
    saving = true
    const { error } = await api_dict_import_request_update({
      dictionary_id,
      thread_id: request.thread_id,
      request_note,
    })
    saving = false
    if (error) {
      toast.error(error.message)
      return
    }
    editing = false
    on_changed()
  }
</script>

<section class="request-group">
  <div class="request-head">
    <div>
      <div class="request-title">{t('import_page.request_group')}</div>
      <div class="request-date">{format_date_time(request.requested_at)}</div>
    </div>
    {#if request.can_manage && !editing}
      <button type="button" class="btn-ghost btn-sm edit-note" onclick={start_editing}>
        <IconMdiPencilOutline />
        {t('import_page.edit_request_note')}
      </button>
    {/if}
  </div>

  {#if editing}
    <label class="request-note">
      <span>{t('import_page.request_note_label')}</span>
      <textarea rows="2" bind:value={request_note}></textarea>
    </label>
    <div class="edit-actions">
      <button type="button" class="btn btn-sm" disabled={saving} onclick={cancel_editing}>{t('misc.cancel')}</button>
      <button type="button" class="btn-primary btn-sm" disabled={saving} onclick={save_request_note}>
        {saving ? t('import_page.saving') : t('import_page.save_changes')}
      </button>
    </div>
  {:else if request.request_note}
    <div class="request-note-readonly">
      <span>{t('import_page.request_note')}</span>
      <p>{request.request_note}</p>
    </div>
  {/if}

  <div class="file-list">
    {#each files as file (file.id)}
      <ImportFileCard {file} {dictionary_id} {on_changed} />
    {/each}
  </div>
</section>

<style>
  .request-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.875rem;
    border: 1px solid color-mix(in srgb, var(--color) 12%, var(--background));
    border-radius: 0.875rem;
    background: color-mix(in srgb, var(--surface) 92%, var(--background));
  }
  .request-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
  }
  .request-title {
    font-weight: 600;
    font-size: 0.9rem;
  }
  .request-date {
    color: var(--color-secondary);
    font-size: 0.75rem;
  }
  .edit-note {
    gap: 0.35rem;
    flex-shrink: 0;
  }
  .request-note {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.78rem;
    font-weight: 600;
  }
  .request-note textarea {
    width: 100%;
    resize: vertical;
    font-size: 0.875rem;
    font-weight: 400;
  }
  .request-note-readonly {
    padding: 0.625rem 0.75rem;
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--primary) 5%, var(--background));
  }
  .request-note-readonly span {
    display: block;
    margin-bottom: 0.2rem;
    color: var(--color-secondary);
    font-size: 0.72rem;
    font-weight: 600;
  }
  .request-note-readonly p {
    white-space: pre-wrap;
    font-size: 0.85rem;
  }
  .file-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
