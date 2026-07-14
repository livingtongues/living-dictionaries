import type { Story, StoryMeta } from 'svelte-look'
import type Component from './SectionEditor.svelte'
import { readable } from 'svelte/store'
import { mock_t } from '$lib/mocks/mock-t'

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

export const shared_meta: StoryMeta = {
  viewports: [{ width: 720, height: 640 }],
  page_data: { t: mock_t, dictionary, entries_data, search_entries },
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
