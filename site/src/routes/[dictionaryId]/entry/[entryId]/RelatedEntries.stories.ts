import type { Story, StoryMeta } from 'svelte-look'
import type Component from './RelatedEntries.svelte'

/** Mock the translate fn — resolves the relationship_type.* keys the component uses. */
function t(key: string | { dynamicKey?: string, fallback?: string }): string {
  if (typeof key === 'object')
    return key.fallback || key.dynamicKey || ''
  const labels: Record<string, string> = {
    'relationship_type.related_entries': 'Related entries',
    'relationship_type.synonym': 'Synonym',
    'relationship_type.antonym': 'Antonym',
    'relationship_type.cognate': 'Cognate',
    'relationship_type.dialectal_variant': 'Dialectal variant',
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
