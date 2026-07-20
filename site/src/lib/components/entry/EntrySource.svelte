<script lang="ts">
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { page } from '$app/state'
  import MultiSelect from '$lib/components/ui/array/MultiSelect.svelte'
  import type { SelectOption } from '$lib/components/ui/array/select-options.interface'
  import EditSource from '$lib/components/sources/EditSource.svelte'
  import IconFaSolidPlus from '~icons/fa-solid/plus'

  import type { SourceCitation } from '$lib/db/schemas/dictionary.types'

  interface Props {
    can_edit?: boolean
    value: string[]
    /** Read-only citation loci (page/example numbers) — shown muted after each source chip. */
    citations?: SourceCitation[] | null
    on_update: (new_value: string[]) => void
  }

  const { can_edit = false, value, citations = null, on_update }: Props = $props()
  const { sources } = $derived(page.data)
  const locator_of = $derived((slug: string) => (citations || []).find(citation => citation.slug === slug && citation.locator)?.locator)
  /** Source chips: the `sources` slugs plus any citation-only slugs. */
  const chip_slugs = $derived([...new Set([...(value || []), ...(citations || []).map(citation => citation.slug)])])

  const options = $derived(($sources || []).map(source => ({ value: source.slug, name: source.abbreviation || source.citation || source.slug })) satisfies SelectOption[])
  const label_of = $derived((slug: string) => options.find(option => option.value === slug)?.name || slug)

  let selectedOptions: Record<string, SelectOption> = $state({})
  let creating = $state(false)

  function prepare(values: string[]) {
    selectedOptions = (values || []).reduce((accumulator, slug) => {
      accumulator[slug] = options.find(option => option.value === slug) || { value: slug, name: slug }
      return accumulator
    }, {} as Record<string, SelectOption>)
  }
</script>

<ShowHide>
  {#snippet children({ show, set, toggle })}
    <div class="value-display" class:editable={can_edit} onclick={() => { if (can_edit) { prepare(value); set(true) } }}>
      <div class="chips">
        {#each chip_slugs as slug (slug)}
          <div class="chip">{label_of(slug)}{#if locator_of(slug)}<span class="locator">{locator_of(slug)}</span>{/if}</div>
        {/each}
        {#if can_edit && !chip_slugs.length}
          <button type="button" class="add-source">
            <IconFaSolidPlus style="margin-bottom: 0.25rem" />
            {page.data.t('misc.add')}
          </button>
        {/if}
      </div>
    </div>

    {#if show}
      <Modal noscroll on_close={toggle}>
        {#snippet heading()}
          <span>{page.data.t('entry_field.sources')}</span>
        {/snippet}

        <form onsubmit={(e) => { e.preventDefault(); on_update(Object.keys(selectedOptions)); toggle() }}>
          <MultiSelect bind:selectedOptions {options} placeholder={page.data.t('entry_field.sources')} />

          <button type="button" class="create-new" onclick={() => (creating = true)}>
            <IconFaSolidPlus />
            {page.data.t({ dynamicKey: 'source.create', fallback: 'Add source' })}
          </button>

          <div style="min-height: 40vh"></div>

          <div class="modal-footer">
            <HeadlessButton class="btn-ghost btn-default" onclick={toggle}>{page.data.t('misc.cancel')}</HeadlessButton>
            <HeadlessButton class="btn-primary btn-default" type="submit">{page.data.t('misc.save')}</HeadlessButton>
          </div>
        </form>
      </Modal>
    {/if}

    {#if creating}
      <EditSource
        on_close={() => (creating = false)}
        on_saved={({ slug }) => { selectedOptions = { ...selectedOptions, [slug]: { value: slug, name: label_of(slug) } } }} />
    {/if}
  {/snippet}
</ShowHide>

<style>
  .value-display {
    width: 100%;
  }
  .editable {
    cursor: pointer;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .chip {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    line-height: 1.25;
    /* mode-aware take on the old blue-100 chip (hardcoded blue-100 was unreadable in dark mode) */
    background-color: color-mix(in srgb, var(--primary) 14%, var(--background));
    color: var(--color);
    border-radius: 0.25rem;
  }
  .locator {
    opacity: 0.6;
    margin-left: 0.375em;
  }
  .add-source {
    opacity: 0.4;
    padding: 0.125rem;
    text-align: left;
    flex-grow: 1;
    border-radius: 0.25rem;
  }
  .add-source:hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%);
  }
  .create-new {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--primary, #1e40af);
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
</style>
