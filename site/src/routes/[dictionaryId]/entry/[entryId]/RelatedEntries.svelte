<script lang="ts">
  import type { MultiString } from '$lib/types'
  import type { TranslationKeys } from '$lib/i18n/types'
  import { page } from '$app/state'
  import { RELATIONSHIP_TYPES } from '$lib/constants'
  import AddRelatedEntryModal from './AddRelatedEntryModal.svelte'
  import RelationshipTypesInfo from './RelationshipTypesInfo.svelte'
  import IconMdiHelpCircleOutline from '~icons/mdi/help-circle-outline'
  import IconFaSolidTimes from '~icons/fa-solid/times'
  import IconFaSolidPlus from '~icons/fa-solid/plus'

  interface Props {
    entry_id: string
    can_edit?: boolean
  }

  const { entry_id, can_edit = false }: Props = $props()

  const dict_db = $derived(page.data.dict_db)
  const dictionary_id = $derived(page.params.dictionaryId)

  let show_help = $state(false)
  let show_add = $state(false)

  interface RelatedItem {
    id: string
    label: string
    related_id: string
    related_lexeme: string
    note?: string
  }

  function display_string(value: MultiString | null | undefined): string {
    if (!value) return ''
    return value.default ?? Object.values(value).find(Boolean) ?? ''
  }

  const rows = $derived(
    dict_db?.entry_relationships.query({ where: 'from_entry_id = ? OR to_entry_id = ?', params: [entry_id, entry_id] }).rows ?? [],
  )

  const entry_lexeme = $derived(display_string(dict_db?.entries.objects[entry_id]?.lexeme as MultiString | undefined))

  // Shape each relationship row from THIS entry's viewpoint: pick the other
  // endpoint for the jump link, and the forward-or-inverse label for the type.
  const items = $derived.by<RelatedItem[]>(() => {
    const entries = dict_db?.entries.objects ?? {}
    const custom_types = dict_db?.relationship_types.objects ?? {}
    const out: RelatedItem[] = []
    for (const row of rows) {
      const forward = row.from_entry_id === entry_id
      const related_id = (forward ? row.to_entry_id : row.from_entry_id) as string
      let label = ''
      if (row.custom_type_id) {
        const type = custom_types[row.custom_type_id]
        label = display_string(forward ? type?.name : (type?.inverse_name ?? type?.name))
      } else if (row.type) {
        const global = RELATIONSHIP_TYPES[row.type as keyof typeof RELATIONSHIP_TYPES]
        const slug = forward ? row.type : (global?.inverse_slug ?? row.type)
        // The dynamic key is a real en.json entry (RELATIONSHIP_TYPES ⊂ relationship_type.*);
        // the cast just satisfies the literal-keyed `t` signature.
        label = page.data.t(`relationship_type.${slug}` as TranslationKeys)
      }
      out.push({
        id: row.id as string,
        label,
        related_id,
        related_lexeme: display_string(entries[related_id]?.lexeme as MultiString | undefined),
        note: display_string(row.note as MultiString | undefined) || undefined,
      })
    }
    return out
  })

  async function remove(relationship_id: string) {
    if (!confirm(page.data.t('relationship_type.remove_confirm'))) return
    await page.data.dbOperations.delete_relationship(relationship_id)
  }
</script>

{#if items.length || can_edit}
  <div class="side-section" class:at-end={!items.length}>
    <div class="section-label">
      {page.data.t('relationship_type.related_entries')}
      <button type="button" class="btn-ghost help-button" aria-label="?" onclick={() => { show_help = true }}>
        <IconMdiHelpCircleOutline />
      </button>
    </div>
    <ul>
      {#each items as item (item.id)}
        <li>
          <span class="rel-label">{item.label}</span>
          <a href="/{dictionary_id}/entry/{item.related_id}">{item.related_lexeme || '—'}</a>
          {#if item.note}<span class="rel-note">({item.note})</span>{/if}
          {#if can_edit}
            <button type="button" class="btn-ghost remove-button" aria-label={page.data.t('misc.remove')} onclick={() => remove(item.id)}>
              <IconFaSolidTimes />
            </button>
          {/if}
        </li>
      {/each}
    </ul>
    {#if can_edit}
      <button type="button" class="btn-ghost add-button" onclick={() => { show_add = true }}>
        <IconFaSolidPlus style="font-size: 0.7rem" /> {page.data.t('relationship_type.add')}
      </button>
    {/if}
    <div class="dashed-divider"></div>
  </div>
{/if}

{#if show_help}
  <RelationshipTypesInfo on_close={() => { show_help = false }} />
{/if}

{#if show_add}
  <AddRelatedEntryModal
    {entry_id}
    {entry_lexeme}
    exclude_ids={items.map(item => item.related_id)}
    on_close={() => { show_add = false }} />
{/if}

<style>
  .side-section {
    order: 2;
  }

  @media (min-width: 768px) {
    .side-section {
      padding-left: 0.5rem;
      padding-right: 0.5rem;
    }
  }

  .section-label {
    border-radius: 0.25rem;
    font-size: 0.75rem;
    line-height: 1rem;
    color: var(--color-secondary);
    margin-top: 0.25rem;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .help-button {
    padding: 0.125rem;
    font-size: 0.85rem;
    color: var(--color-secondary);
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  li {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  .rel-label {
    color: var(--color-secondary);
    font-size: 0.8rem;
    flex-shrink: 0;
  }

  li a {
    font-weight: 600;
    color: var(--primary, #2563eb);
    text-decoration: none;
  }

  li a:hover {
    text-decoration: underline;
  }

  .rel-note {
    color: var(--color-secondary);
    font-size: 0.8rem;
  }

  .remove-button {
    padding: 0.125rem 0.25rem;
    font-size: 0.7rem;
    color: var(--color-secondary);
    align-self: center;
  }

  .add-button {
    gap: 0.375rem;
    padding: 0.375rem 0.5rem;
    margin-top: 0.25rem;
    font-size: 0.8rem;
    color: var(--color-secondary);
  }

  .dashed-divider {
    border-bottom-width: 2px;
    padding-bottom: 0.25rem;
    margin-bottom: 0.5rem;
    border-style: dashed;
  }
</style>
