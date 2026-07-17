<script lang="ts">
  import type { SourceFileRow } from '$lib/db/server/source-files'
  import IconMdiMessageOutline from '~icons/mdi/message-outline'
  import IconFa6SolidRobot from '~icons/fa6-solid/robot'
  import IconIcOutlineCloudUpload from '~icons/ic/outline-cloud-upload'
  import IconFa6SolidPaperPlane from '~icons/fa6-solid/paper-plane'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import ImportFileCard from '$lib/import/ImportFileCard.svelte'
  import UploadProgressRow from '$lib/import/UploadProgressRow.svelte'
  import { upload_import_file } from '$lib/import/upload-import-file'
  import type { ImportUploadHandle } from '$lib/import/upload-import-file'
  import { api_dict_files_list, api_dict_files_request_import } from '$api/v1/dictionaries/[id]/files/_call'
  import { toast } from '$lib/state/toast.svelte'
  import { page } from '$app/state'

  const { data } = $props()
  const { dictionary, is_manager } = $derived(data)
  const { t } = $derived(page.data)

  let files = $state<SourceFileRow[]>([])
  interface ActiveUpload {
    key: string
    filename: string
    handle: ImportUploadHandle
  }
  let active_uploads = $state<ActiveUpload[]>([])
  let dragging = $state(false)
  let request_note = $state('')
  let requesting = $state(false)
  let request_sent = $state(false)

  const MAX_BYTES = 100 * 1024 * 1024

  const pending_files = $derived(files.filter(file => !file.import_requested_at))
  const requested_files = $derived(files.filter(file => !!file.import_requested_at))
  const missing_instructions = $derived(pending_files.filter(file => !file.import_instructions?.trim()))
  const can_request = $derived(pending_files.length > 0 && missing_instructions.length === 0 && active_uploads.length === 0 && !requesting)

  async function refresh_files() {
    const { data: listed, error } = await api_dict_files_list({ dictionary_id: dictionary.id })
    if (error) {
      // 401/403 = no real session (e.g. component stories) — just show the empty state.
      if (error.status !== 401 && error.status !== 403)
        toast.error(error.message)
      return
    }
    files = listed.files.filter(file => !!file.upload_confirmed_at)
  }

  $effect(() => {
    if (is_manager)
      refresh_files()
  })

  function add_files(list: FileList | null) {
    dragging = false
    if (!list)
      return
    for (const file of Array.from(list)) {
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: ${t('import_page.max_file_size')}`)
        continue
      }
      const handle = upload_import_file({ file, dictionary_id: dictionary.id })
      const upload: ActiveUpload = { key: `${file.name}-${Date.now()}-${Math.random()}`, filename: file.name, handle }
      active_uploads = [...active_uploads, upload]
      handle.done
        .then(async () => {
          await refresh_files()
        })
        .catch((err: Error) => toast.error(`${file.name}: ${err.message}`))
        .finally(() => {
          active_uploads = active_uploads.filter(active => active.key !== upload.key)
        })
    }
  }

  async function request_import() {
    if (!can_request)
      return
    requesting = true
    const { data: result, error } = await api_dict_files_request_import({
      dictionary_id: dictionary.id,
      file_ids: pending_files.map(file => file.id),
      ...(request_note.trim() ? { message: request_note.trim() } : {}),
    })
    requesting = false
    if (error) {
      toast.error(error.message)
      return
    }
    if (result) {
      request_sent = true
      request_note = ''
      await refresh_files()
    }
  }
</script>

<div class="import-page">
  <h3 class="import-heading">
    {t('import_page.import')}
  </h3>

  <section class="any-format">
    <h4>{t('import_page.any_format_title')}</h4>
    <p>{t('import_page.any_format_body')}</p>
  </section>

  <ol class="steps">
    <li>{t('import_page.how_step_1')}</li>
    <li>{t('import_page.how_step_2')}</li>
    <li>{t('import_page.how_step_3')}</li>
  </ol>

  {#if is_manager}
    <label
      class="drop-zone"
      class:dragging
      ondrop={(event) => { event.preventDefault(); add_files(event.dataTransfer?.files ?? null) }}
      ondragover={(event) => { event.preventDefault(); dragging = true }}
      ondragleave={(event) => { event.preventDefault(); dragging = false }}>
      <input
        type="file"
        multiple
        style="display: none"
        oninput={(event) => { add_files(event.currentTarget.files); event.currentTarget.value = '' }} />
      <IconIcOutlineCloudUpload style="font-size: 2rem" />
      <span class="drop-title">{t('import_page.drop_files')}</span>
      <span class="drop-sub">{t('import_page.max_file_size')}</span>
    </label>

    {#each active_uploads as upload (upload.key)}
      <UploadProgressRow filename={upload.filename} handle={upload.handle} />
    {/each}

    {#if pending_files.length}
      <div class="file-list">
        {#each pending_files as file (file.id)}
          <ImportFileCard {file} dictionary_id={dictionary.id} on_changed={refresh_files} />
        {/each}
      </div>

      <label class="request-note">
        <span class="note-label">{t('import_page.request_note_label')}</span>
        <textarea rows="2" bind:value={request_note}></textarea>
      </label>

      <div class="request-row">
        {#if missing_instructions.length}
          <span class="request-hint">{t('import_page.instructions_required')}</span>
        {/if}
        <button type="button" class="btn-primary btn-default" disabled={!can_request} onclick={request_import}>
          <IconFa6SolidPaperPlane style="margin-right: 0.4rem" />
          {t('import_page.request_button')}
        </button>
      </div>
    {/if}

    {#if request_sent}
      <p class="sent-note">{t('import_page.request_sent')}</p>
    {/if}

    {#if requested_files.length}
      <h4 class="requested-heading">{t('import_page.requested_files')}</h4>
      <div class="file-list">
        {#each requested_files as file (file.id)}
          <ImportFileCard {file} dictionary_id={dictionary.id} on_changed={refresh_files} />
        {/each}
      </div>
    {/if}

    <div class="agent-callout">
      <IconFa6SolidRobot style="font-size: 1.1rem; flex-shrink: 0; margin-top: 0.15rem" />
      <p>
        <strong>{t('import_page.self_serve_title')}</strong>
        {t('import_page.self_serve_body')}
        <a href={`/${dictionary.url}/agents`}>Agents →</a>
      </p>
    </div>
  {:else}
    <p class="managers-only">{t('import_page.managers_only')}</p>
    <div class="actions">
      <ShowHide>
        {#snippet children({ show, toggle })}
          <button type="button" class="btn btn-default" style="gap: 0.4rem" onclick={toggle}>
            <IconMdiMessageOutline />
            {t('header.contact_us')}
          </button>
          {#if show}
            {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
              <Contact subject="import_data" on_close={toggle} />
            {/await}
          {/if}
        {/snippet}
      </ShowHide>
    </div>
  {/if}
</div>

<style>
  .import-page {
    max-width: 768px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .import-heading {
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 600;
    color: var(--color);
  }

  .any-format {
    background: linear-gradient(135deg, color-mix(in srgb, var(--primary), transparent 92%), color-mix(in srgb, var(--primary), transparent 97%));
    border: 1px solid color-mix(in srgb, var(--primary), transparent 80%);
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
  }
  .any-format h4 {
    font-weight: 700;
    margin-bottom: 0.375rem;
  }
  .any-format p {
    line-height: 1.55;
    font-size: 0.925rem;
  }

  .steps {
    list-style-type: decimal;
    padding-left: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    line-height: 1.5;
    font-size: 0.925rem;
  }

  .drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 1.5rem 1rem;
    border: 2px dashed color-mix(in srgb, var(--color) 25%, var(--background));
    border-radius: 0.75rem;
    cursor: pointer;
    color: var(--color-secondary);
    transition: border-color 0.15s, background-color 0.15s;
  }
  .drop-zone:hover,
  .drop-zone.dragging {
    border-color: var(--primary);
    background: color-mix(in srgb, var(--primary), transparent 95%);
    color: var(--primary);
  }
  .drop-title {
    font-weight: 600;
    font-size: 0.925rem;
  }
  .drop-sub {
    font-size: 0.78rem;
  }

  .file-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .request-note {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .note-label {
    font-size: 0.78rem;
    font-weight: 600;
    color: color-mix(in srgb, var(--color) 80%, var(--background));
  }
  .request-note textarea {
    width: 100%;
    resize: vertical;
    font-size: 0.875rem;
  }

  .request-row {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .request-hint {
    font-size: 0.8rem;
    color: var(--color-secondary);
  }

  .sent-note {
    background: color-mix(in srgb, var(--success), transparent 88%);
    color: var(--success);
    border-radius: 0.5rem;
    padding: 0.6rem 1rem;
    font-size: 0.9rem;
  }

  .requested-heading {
    font-weight: 600;
    margin-top: 0.5rem;
  }

  .agent-callout {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    background: var(--surface);
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
    line-height: 1.5;
    color: color-mix(in srgb, var(--color) 85%, var(--background));
  }
  .agent-callout a {
    color: var(--primary);
    text-decoration: underline;
    white-space: nowrap;
  }

  .managers-only {
    color: var(--color-secondary);
    line-height: 1.5;
  }
  .actions {
    display: flex;
  }
</style>
