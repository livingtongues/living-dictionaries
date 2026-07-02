import type { Story, StoryMeta } from 'svelte-look'
import type Component from './RelationshipTypesInfo.svelte'

function t(key: string | { dynamicKey?: string, fallback?: string }): string {
  if (typeof key === 'object')
    return key.fallback || key.dynamicKey || ''
  const labels: Record<string, string> = {
    'relationship_type.related_entries': 'Related entries',
    'relationship_type.help_intro': 'Entries can be linked to other entries in this dictionary to show how words relate to each other. Each link has a type describing the relationship:',
    'relationship_type.custom_types_note': 'A dictionary can also define its own custom relationship types.',
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
    'relationship_type.synonym_description': 'Has the same or nearly the same meaning (small ↔ little).',
    'relationship_type.antonym_description': 'Has the opposite meaning (hot ↔ cold).',
    'relationship_type.cognate_description': 'Shares a common historical origin with a word in another language or dialect.',
    'relationship_type.dialectal_variant_description': 'The same word as used in a different dialect.',
    'relationship_type.see_also_description': 'A general pointer to another entry worth comparing.',
    'relationship_type.spelling_variant_description': 'An alternative accepted spelling of the same word.',
    'relationship_type.hypernym_description': 'This word is the broader category that includes the other (animal is broader than dog).',
    'relationship_type.hyponym_description': 'This word is a specific kind of the other (dog is narrower than animal).',
    'relationship_type.holonym_description': 'The other word names a part of this one (hand has part finger).',
    'relationship_type.meronym_description': 'This word names a part of the other (finger is part of hand).',
    'relationship_type.derived_from_description': 'This word was formed from the other (teacher is derived from teach).',
    'relationship_type.root_of_description': 'This word is the root the other was formed from (teach is the root of teacher).',
    'relationship_type.borrowed_from_description': 'This word was adopted from the other word, often from another language.',
    'relationship_type.loaned_to_description': 'The other word was adopted from this one.',
  }
  return labels[key] || key
}

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 720 }],
  page_data: { t },
  csr: true,
}

export const Default: Story<typeof Component> = {
  props: { on_close: () => {} },
}
