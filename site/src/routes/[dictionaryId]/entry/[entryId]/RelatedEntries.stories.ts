import type { Story, StoryMeta } from 'svelte-look'
import type Component from './RelatedEntries.svelte'

/** Mock the translate fn — resolves the relationship_type.* keys the component uses. */
function t(key: string | { dynamicKey?: string, fallback?: string }): string {
  if (typeof key === 'object')
    return key.fallback || key.dynamicKey || ''
  const labels: Record<string, string> = {
    'relationship_type.related_entries': 'Related entries',
    'relationship_type.add': 'Add related entry',
    'relationship_type.remove_confirm': 'Remove this link between entries?',
    'misc.remove': 'Remove',
    'relationship_type.synonym': 'Synonym',
    'relationship_type.antonym': 'Antonym',
    'relationship_type.cognate': 'Cognate',
    'relationship_type.dialectal_variant': 'Dialectal variant',
    'relationship_type.see_also': 'See also',
    'relationship_type.spelling_variant': 'Spelling variant',
    'relationship_type.hypernym': 'Broader than',
    'relationship_type.hyponym': 'Narrower than',
    'relationship_type.holonym': 'Has part',
    'relationship_type.meronym': 'Part of',
    'relationship_type.derived_from': 'Derived from',
    'relationship_type.root_of': 'Root of',
    'relationship_type.borrowed_from': 'Borrowed from',
    'relationship_type.loaned_to': 'Loaned to',
  }
  return labels[key] || key
}

/**
 * Minimal `dict_db` stand-in: the component only reads
 * `entry_relationships.query().rows`, `entries.objects`, `relationship_types.objects`.
 * Rows are all curated to involve the 'dog' viewpoint entry.
 */
const dict_db = {
  entry_relationships: {
    query: () => ({
      rows: [
        { id: 'r1', from_entry_id: 'dog', to_entry_id: 'perro', type: 'cognate' },
        { id: 'r2', from_entry_id: 'dog', to_entry_id: 'hund', type: 'cognate' },
        { id: 'r3', from_entry_id: 'dogg', to_entry_id: 'dog', type: 'dialectal_variant' },
        // Directed global, inverse side: canonical stored { animal → dog, hypernym };
        // from dog's viewpoint the inverse label 'hyponym' renders ("Narrower than").
        { id: 'r6', from_entry_id: 'animal', to_entry_id: 'dog', type: 'hypernym' },
        // Directed global, forward side: dog is the whole ("Has part").
        { id: 'r7', from_entry_id: 'dog', to_entry_id: 'tail', type: 'holonym' },
        // Symmetric global.
        { id: 'r8', from_entry_id: 'dog', to_entry_id: 'wolf', type: 'see_also' },
        { id: 'r4', from_entry_id: 'dog', to_entry_id: 'canine', custom_type_id: 'ct1', note: { default: 'informal register' } },
        { id: 'r5', from_entry_id: 'puppy', to_entry_id: 'dog', custom_type_id: 'ct2' },
      ],
    }),
  },
  entries: {
    objects: {
      dog: { lexeme: { default: 'dog' } },
      perro: { lexeme: { default: 'perro' } },
      hund: { lexeme: { default: 'Hund' } },
      dogg: { lexeme: { default: 'dogg' } },
      canine: { lexeme: { default: 'canine' } },
      puppy: { lexeme: { default: 'puppy' } },
      animal: { lexeme: { default: 'animal' } },
      tail: { lexeme: { default: 'tail' } },
      wolf: { lexeme: { default: 'wolf' } },
    },
  },
  relationship_types: {
    objects: {
      ct1: { name: { default: 'Compare' }, inverse_name: null, symmetric: 1 },
      ct2: { name: { default: 'young of' }, inverse_name: { default: 'adult of' }, symmetric: null },
    },
  },
}

export const shared_meta: StoryMeta = {
  viewports: [{ width: 420, height: 260 }],
  page_data: { t, dict_db },
  params: { dictionaryId: 'demo' },
}

export const WithRelationships: Story<typeof Component> = {
  props: { entry_id: 'dog' },
}

export const Editor: Story<typeof Component> = {
  props: { entry_id: 'dog', can_edit: true },
  viewports: [{ width: 420, height: 320 }],
}

/** No relationships yet — editors still see the section with the add button. */
export const EmptyEditor: Story<typeof Component> = {
  props: { entry_id: 'wolf', can_edit: true },
  viewports: [{ width: 420, height: 120 }],
  page_data: {
    t,
    dict_db: {
      ...dict_db,
      entry_relationships: { query: () => ({ rows: [] }) },
    },
  },
}
