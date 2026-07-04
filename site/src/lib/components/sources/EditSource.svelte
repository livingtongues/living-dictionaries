<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import type { SourceType } from '$lib/constants'
  import type { Tables } from '$lib/types'
  import { page } from '$app/state'
  import { SOURCE_TYPES } from '$lib/constants'
  import { slugify } from '$lib/utils/slugify'

  interface Props {
    /** Existing source to edit, or `null`/undefined to create a new one. */
    source?: Tables<'sources'> | null
    on_close: () => void
    on_saved?: (source: { slug: string }) => void
  }

  const { source = null, on_close, on_saved }: Props = $props()
  const { dbOperations } = $derived(page.data)
  const is_edit = !!source?.id

  // Seed once from the prop — this modal is freshly mounted for each open.
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

  // Auto-fill the slug from the abbreviation (fallback citation) until the user edits it directly.
  $effect(() => {
    if (!is_edit && !slug_touched)
      slug = slugify(abbreviation || citation)
  })

  async function save() {
    const clean_slug = slugify(slug)
    if (!clean_slug) {
      alert(page.data.t({ dynamicKey: 'source.slug_required', fallback: 'A slug is required (add an abbreviation or citation).' }))
      return
    }
    saving = true
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
    if (is_edit)
      await dbOperations.update_source({ id: source.id, ...fields })
    else
      await dbOperations.insert_source(fields)
    saving = false
    on_saved?.({ slug: clean_slug })
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
        <input bind:value={slug} oninput={() => (slug_touched = true)} placeholder="smith-2020" />
        <small>{page.data.t({ dynamicKey: 'source.slug_hint', fallback: 'Referenced by entries.' })}</small>
      </label>
    {/if}

    <div class="modal-footer">
      <Button onclick={on_close} form="simple" color="black">{page.data.t('misc.cancel')}</Button>
      <Button type="submit" form="filled" loading={saving}>{page.data.t('misc.save')}</Button>
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
</style>
