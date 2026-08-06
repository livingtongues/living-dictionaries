<script lang="ts">
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import type { SourceType } from '$lib/constants'
  import type { Tables } from '$lib/types'
  import { page } from '$app/state'
  import { SOURCE_TYPES } from '$lib/constants'
  import { log_warning } from '$lib/debug/remote-log'
  import { slugify } from '$lib/utils/slugify'
  import { commit_source, find_existing_source } from './source-save'

  interface Props {
    /** Existing source to edit, or `null`/undefined to create a new one. */
    source?: Tables<'sources'> | null
    on_close: () => void
    on_saved?: (source: { slug: string }) => void
  }

  const { source = null, on_close, on_saved }: Props = $props()
  const { writes, dictionary } = $derived(page.data)
  const sources = $derived(page.data.sources)
  const is_edit = $derived(!!source?.id)

  // Seed once from the prop — this modal is freshly mounted for each open.
  // svelte-ignore state_referenced_locally
  const seed: Partial<Tables<'sources'>> = source ?? {}
  let slug = $state(seed.slug ?? '')
  let slug_touched = $state(!!seed.slug)
  let citation = $state(seed.citation ?? '')
  let abbreviation = $state(seed.abbreviation ?? '')
  let author = $state(seed.author ?? '')
  let year = $state(seed.year ?? '')
  let url = $state(seed.url ?? '')
  let license = $state(seed.license ?? '')
  let type = $state<SourceType | ''>(seed.type ?? '')
  let saving = $state(false)
  let failure_message = $state('')
  const clean_slug = $derived(slugify(slug))
  const existing_source = $derived(find_existing_source({
    sources: $sources ?? [],
    slug: clean_slug,
    source_id: source?.id,
  }))

  // Auto-fill the slug from the abbreviation (fallback citation) until the user edits it directly.
  $effect(() => {
    if (!is_edit && !slug_touched)
      slug = slugify(abbreviation || citation)
  })

  async function save() {
    if (!clean_slug) {
      failure_message = page.data.t({ dynamicKey: 'source.slug_required', fallback: 'A slug is required (add an abbreviation or citation).' })
      return
    }
    if (existing_source) {
      failure_message = page.data.t({
        dynamicKey: 'source.slug_exists',
        fallback: `A source already uses “${clean_slug}”. Use that source or choose a different slug.`,
      })
      return
    }
    saving = true
    failure_message = ''
    const fields = {
      slug: clean_slug,
      citation: citation.trim() || null,
      abbreviation: abbreviation.trim() || null,
      author: author.trim() || null,
      year: year.trim() || null,
      url: url.trim() || null,
      license: license.trim() || null,
      type: type || null,
    }
    const result = await commit_source({
      write: () => is_edit
        ? writes.update_source({ id: source.id, ...fields })
        : writes.insert_source(fields),
      slug: clean_slug,
      on_saved,
      on_close,
    })
    if ('failure_kind' in result) {
      const { failure_kind } = result
      failure_message = failure_kind === 'duplicate_slug'
        ? page.data.t({ dynamicKey: 'source.slug_exists', fallback: `A source already uses “${clean_slug}”. Use that source or choose a different slug.` })
        : page.data.t({ dynamicKey: 'source.save_failed', fallback: 'The source could not be saved. Your edits are still here; please try again.' })
      log_warning({
        message: 'source_save_failed',
        context: {
          dictionary_id: dictionary?.id ?? null,
          operation: is_edit ? 'update' : 'create',
          failure_kind,
          slug: clean_slug,
        },
      })
    }
    saving = false
  }

  function reuse_existing_source() {
    if (!existing_source || !on_saved)
      return
    on_saved({ slug: existing_source.slug })
    on_close()
  }
</script>

<Modal on_close={on_close}>
  {#snippet heading()}
    <span>{is_edit ? page.data.t({ dynamicKey: 'source.edit', fallback: 'Edit source' }) : page.data.t({ dynamicKey: 'source.create', fallback: 'Add source' })}</span>
  {/snippet}

  <form onsubmit={(e) => { e.preventDefault(); save() }}>
    <label>
      <span>{page.data.t({ dynamicKey: 'source.citation', fallback: 'Citation' })}</span>
      <textarea rows="2" bind:value={citation} placeholder="Smith, Jane. 2020. Example Language Dictionary. City: Example University Press."></textarea>
    </label>

    <div class="row">
      <label>
        <span>{page.data.t({ dynamicKey: 'source.abbreviation', fallback: 'Abbreviation' })}</span>
        <input bind:value={abbreviation} placeholder="Smith 2020" />
      </label>
      <label>
        <span>{page.data.t({ dynamicKey: 'source.type', fallback: 'Type' })}</span>
        <select bind:value={type}>
          <option value="">—</option>
          {#each SOURCE_TYPES as source_type (source_type)}
            <option value={source_type}>{page.data.t({ dynamicKey: `source.type_${source_type}`, fallback: source_type })}</option>
          {/each}
        </select>
      </label>
    </div>

    <div class="row">
      <label>
        <span>{page.data.t({ dynamicKey: 'source.author', fallback: 'Author' })}</span>
        <input bind:value={author} />
      </label>
      <label>
        <span>{page.data.t({ dynamicKey: 'source.year', fallback: 'Year' })}</span>
        <input bind:value={year} placeholder="1979" />
      </label>
    </div>

    <div class="row">
      <label>
        <span>{page.data.t({ dynamicKey: 'source.url', fallback: 'URL' })}</span>
        <input type="url" bind:value={url} />
      </label>
      <label>
        <span>{page.data.t({ dynamicKey: 'source.license', fallback: 'License' })}</span>
        <input bind:value={license} />
      </label>
    </div>

    {#if !is_edit}
      <label>
        <span>{page.data.t({ dynamicKey: 'source.slug', fallback: 'Slug (stable id)' })}</span>
        <input
          bind:value={slug}
          aria-invalid={existing_source ? 'true' : undefined}
          oninput={() => { slug_touched = true; failure_message = '' }}
          placeholder="smith-2020" />
        <small>{page.data.t({ dynamicKey: 'source.slug_hint', fallback: 'Referenced by entries.' })}</small>
      </label>
    {/if}

    {#if failure_message || existing_source}
      <div class="save-error" role="alert">
        <span>{failure_message || page.data.t({ dynamicKey: 'source.slug_exists', fallback: `A source already uses “${clean_slug}”. Use that source or choose a different slug.` })}</span>
        {#if existing_source && on_saved}
          <button type="button" onclick={reuse_existing_source}>
            {page.data.t({ dynamicKey: 'source.use_existing', fallback: `Use ${existing_source.abbreviation || existing_source.citation || existing_source.slug}` })}
          </button>
        {:else if existing_source}
          <a href={`/${dictionary?.id}/sources`}>
            {page.data.t({ dynamicKey: 'source.view_existing', fallback: 'View the existing source' })}
          </a>
        {/if}
      </div>
    {/if}

    <div class="modal-footer">
      <HeadlessButton class="btn-ghost btn-default" onclick={on_close}>{page.data.t('misc.cancel')}</HeadlessButton>
      <HeadlessButton class="btn-primary btn-default" type="submit" loading={saving}>{page.data.t('misc.save')}</HeadlessButton>
    </div>
  </form>
</Modal>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.875rem;
    flex: 1;
  }
  label > span {
    font-weight: 600;
    color: color-mix(in srgb, var(--color) 80%, var(--background));
  }
  label small {
    font-size: 0.75rem;
    opacity: 0.6;
  }
  .row {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .save-error {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.375rem;
    padding: 0.75rem;
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--danger) 12%, var(--surface));
    color: var(--danger);
    font-size: 0.875rem;
  }
  .save-error button,
  .save-error a {
    color: inherit;
    font-weight: 600;
    text-decoration: underline;
  }
</style>
