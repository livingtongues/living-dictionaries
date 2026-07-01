import { writable } from 'svelte/store'
import type { Story, StoryMeta } from 'svelte-look'
import type Component from './EntryFilters.svelte'

function t(key: string | { dynamicKey?: string, fallback?: string }): string {
  if (typeof key === 'object')
    return key.fallback || key.dynamicKey || ''
  if (key === 'page.direction')
    return 'ltr'
  if (key === 'entry.has_exists')
    return 'Has'
  if (key === 'entry.does_not_exist')
    return 'No'
  const labels: Record<string, string> = {
    'entry.filters': 'Filters',
    'entry.view_entries': 'View entries',
    'entry.image': 'Image',
    'entry_field.example_sentence': 'Example Sentence',
    'entry_field.audio': 'Audio',
    'entry_field.video': 'Video',
    'entry_field.speaker': 'Speaker',
    'entry_field.noun_class': 'Noun Class',
    'entry_field.plural_form': 'Plural form',
    'entry_field.parts_of_speech': 'Part of Speech',
    'entry_field.semantic_domains': 'Semantic Domain',
  }
  return labels[key] || key
}

const empty_array_facet = { count: 0, values: {} }

const array_facets = {
  _parts_of_speech: empty_array_facet,
  _semantic_domains: empty_array_facet,
  _dialects: empty_array_facet,
  _tags: empty_array_facet,
  _speakers: empty_array_facet,
}

function bool_facet({ has, lacks }: { has?: number, lacks?: number }) {
  const values: Record<string, number> = {}
  if (has) values.true = has
  if (lacks) values.false = lacks
  return { count: (has || 0) + (lacks || 0), values }
}

export const shared_meta: StoryMeta = {
  viewports: [{ width: 800, height: 820 }],
  page_data: { t, tags: [], dialects: [], speakers: [] },
}

// Reproduces the reported bug scenario: 4524 entries, all lacking every field
// except example sentence (which has a real split). Only the Example Sentence
// "No" toggle should render; the other "No X" toggles must be hidden.
export const AllEntriesLackFields: Story<typeof Component> = {
  props: {
    search_params: writable({}) as any,
    on_close: () => {},
    result_facets: {
      ...array_facets,
      has_sentence: bool_facet({ has: 3806, lacks: 718 }),
      has_image: bool_facet({ lacks: 4524 }),
      has_audio: bool_facet({ lacks: 4524 }),
      has_video: bool_facet({ lacks: 4524 }),
      has_speaker: bool_facet({ lacks: 4524 }),
      has_noun_class: bool_facet({ lacks: 4524 }),
      has_plural_form: bool_facet({ lacks: 4524 }),
      has_part_of_speech: bool_facet({ lacks: 4524 }),
      has_semantic_domain: bool_facet({ lacks: 4524 }),
    } as any,
  },
}

// Sanity check: every field has a real split, so BOTH Has and No toggles appear.
export const MixedFields: Story<typeof Component> = {
  props: {
    search_params: writable({}) as any,
    on_close: () => {},
    result_facets: {
      ...array_facets,
      has_sentence: bool_facet({ has: 3806, lacks: 718 }),
      has_image: bool_facet({ has: 1200, lacks: 3324 }),
      has_audio: bool_facet({ has: 900, lacks: 3624 }),
      has_video: bool_facet({ has: 50, lacks: 4474 }),
      has_speaker: bool_facet({ has: 800, lacks: 3724 }),
      has_noun_class: bool_facet({ has: 300, lacks: 4224 }),
      has_plural_form: bool_facet({ has: 400, lacks: 4124 }),
      has_part_of_speech: bool_facet({ has: 2000, lacks: 2524 }),
      has_semantic_domain: bool_facet({ has: 1500, lacks: 3024 }),
    } as any,
  },
}
