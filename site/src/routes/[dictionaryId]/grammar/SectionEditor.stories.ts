import type { Story, StoryMeta } from 'svelte-look'
import type Component from './SectionEditor.svelte'
import { readable } from 'svelte/store'
import { mock_t } from '$lib/mocks/mock-t'
import { mock_dict_db } from '$lib/mocks/mock-dict-db'
import { log_writes } from '$lib/mocks/db'

const dictionary = {
  id: 'demo',
  url: 'demo',
  name: 'Nahuatl',
  gloss_languages: ['en'],
  orthographies: [{ code: 'default', name: 'Latin' }],
} as never

const entries_data = readable({
  tlahtoa: { id: 'tlahtoa', main: { lexeme: { default: 'tlahtoa' } }, senses: [] },
  kalli: { id: 'kalli', main: { lexeme: { default: 'kalli' } }, senses: [] },
})

const search_entries = async () => ({ hits: [{ id: 'tlahtoa' }, { id: 'kalli' }] })

const clause_slots = [
  { id: 'sl1', sort_key: 'a', name: { en: 'Subject' }, code: 'SBJ' },
  { id: 'sl2', sort_key: 'b', name: { en: 'Object' }, code: 'OBJ' },
]
const sentences = [
  { id: 'q1', text: { default: 'Ni-tlahtoa' }, translation: { en: 'I speak.' }, discourse_role: 'storyline' },
]
const section_sentences = [{ id: 'ss1', section_id: 's1', sentence_id: 'q1', sort_key: 'a' }]

export const shared_meta: StoryMeta = {
  viewports: [{ width: 720, height: 720 }],
  page_data: {
    t: mock_t,
    dictionary,
    entries_data,
    search_entries,
    writes: log_writes,
    dict_db: mock_dict_db({ clause_slots, sentences, section_sentences }),
  } as never,
}

export const Editing: Story<typeof Component> = {
  props: {
    section: {
      id: 's1',
      title: { en: 'Subject prefixes' },
      body: { en: 'Subjects are marked by a prefix on the verb.' },
      usage_conditions: {},
      entry_id: null,
      _save: async () => {},
    },
    on_close: () => {},
  } as never,
}

export const WithLinkedEntry: Story<typeof Component> = {
  props: {
    section: {
      id: 's2',
      title: { en: 'Speech verb' },
      body: { en: 'The verb *tlahtoa* “to speak” takes the full agreement paradigm.' },
      usage_conditions: { en: 'Cite this section from the entry.' },
      entry_id: 'tlahtoa',
      _save: async () => {},
    },
    on_close: () => {},
  } as never,
}

// Manager-scoped: body prose only (no title / entry link / usage / slot / examples).
export const ProseOnly: Story<typeof Component> = {
  props: {
    section: {
      id: 'intro',
      title: null,
      body: { en: 'Nahuatl is a *polysynthetic* language; a single verb can express a whole clause.' },
      usage_conditions: {},
      entry_id: null,
      _save: async () => {},
    },
    on_close: () => {},
    prose_only: true,
  } as never,
}
