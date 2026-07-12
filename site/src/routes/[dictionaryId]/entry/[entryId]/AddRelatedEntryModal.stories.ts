import type { Story, StoryMeta } from 'svelte-look'
import type Component from './AddRelatedEntryModal.svelte'

function t(key: string | { dynamicKey?: string, fallback?: string }): string {
  if (typeof key === 'object')
    return key.fallback || key.dynamicKey || ''
  const labels: Record<string, string> = {
    'relationship_type.add': 'Add related entry',
    'relationship_type.choose_entry': 'Choose an entry',
    'relationship_type.relationship': 'Relationship',
    'relationship_type.no_matches': 'No matching entries found.',
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
    'relationship_type.hyponym_description': 'This word is a specific kind of the other (dog is narrower than animal).',
    'entry.search_entries': 'Search Entries',
    'entry_field.notes': 'Notes',
    'misc.cancel': 'Cancel',
    'misc.save': 'Save',
    'misc.remove': 'Remove',
  }
  return labels[key] || key
}

const entries: Record<string, { id: string, main: { lexeme: Record<string, string> }, senses: { id: string, glosses: Record<string, string> }[] }> = {
  animal: { id: 'animal', main: { lexeme: { default: 'animal' } }, senses: [{ id: 's1', glosses: { en: 'living creature' } }] },
  cat: { id: 'cat', main: { lexeme: { default: 'cat' } }, senses: [{ id: 's2', glosses: { en: 'small domesticated feline' } }] },
  canine: { id: 'canine', main: { lexeme: { default: 'canine' } }, senses: [{ id: 's3', glosses: { en: 'of or like a dog' } }] },
  wolf: { id: 'wolf', main: { lexeme: { default: 'wolf' } }, senses: [{ id: 's4', glosses: { en: 'wild canid' } }] },
}

const entries_data = {
  subscribe(run: (value: typeof entries) => void) {
    run(entries)
    return () => {}
  },
}

async function search_entries({ query_params }: { query_params: { query: string } }) {
  const query = query_params.query.toLowerCase()
  const hits = Object.values(entries)
    .filter(entry => !query || entry.main.lexeme.default.includes(query))
    .map(entry => ({ id: entry.id }))
  return { hits, count: hits.length, elapsed: { formatted: '0ms' }, facets: {} }
}

const dict_db = {
  relationship_types: {
    objects: {
      ct1: { name: { default: 'Compare' }, inverse_name: null, symmetric: 1 },
    },
  },
}

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 620 }],
  page_data: {
    t,
    dict_db,
    entries_data,
    search_entries,
    dictionary: { id: 'demo' },
    writes: { insert_relationship: async () => ({}) },
  },
  csr: true,
}

const shared_props = {
  entry_id: 'dog',
  entry_lexeme: 'dog',
  on_close: () => {},
}

export const SearchStep: Story<typeof Component> = {
  props: shared_props,
  interactions: async (page) => {
    await page.waitForSelector('.result-row')
  },
}

export const TypeAndPreview: Story<typeof Component> = {
  props: shared_props,
  interactions: async (page) => {
    await page.waitForSelector('.result-row')
    const rows = await page.$$('.result-row')
    await rows[0].click() // pick 'animal'
    await page.waitForSelector('#relationship-type-select')
    await page.select('#relationship-type-select', 'hyponym')
  },
}
