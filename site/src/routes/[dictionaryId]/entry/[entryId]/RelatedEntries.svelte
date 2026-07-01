<script lang="ts">
  import type { MultiString } from '$lib/types'
  import type { TranslationKeys } from '$lib/i18n/types'
  import { page } from '$app/state'
  import { RELATIONSHIP_TYPES } from '$lib/constants'

  interface Props {
    entry_id: string
  }

  const { entry_id }: Props = $props()

  const dict_db = $derived(page.data.dict_db)
  const dictionary_id = $derived(page.params.dictionaryId)

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
</script>

{#if items.length}
  <div class="side-section">
    <div class="section-label">{page.data.t('relationship_type.related_entries')}</div>
    <ul>
      {#each items as item (item.id)}
        <li>
          <span class="rel-label">{item.label}</span>
          <a href="/{dictionary_id}/entry/{item.related_id}">{item.related_lexeme || '—'}</a>
          {#if item.note}<span class="rel-note">({item.note})</span>{/if}
        </li>
      {/each}
    </ul>
    <div class="dashed-divider"></div>
  </div>
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

  .dashed-divider {
    border-bottom-width: 2px;
    padding-bottom: 0.25rem;
    margin-bottom: 0.5rem;
    border-style: dashed;
  }
</style>
