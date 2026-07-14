import type { Story, StoryMeta } from 'svelte-look'
import type Component from './GrammarNotes.svelte'
import { mock_t } from '$lib/mocks/mock-t'

const dictionary = { id: 'demo', url: 'demo', name: 'Nahuatl', gloss_languages: ['en'] } as never

const entry = { id: 'tlahtoa', senses: [{ id: 'sense-1' }] } as never

const dict_db = {
  grammar_sections: {
    rows: [
      { id: 's1', entry_id: 'tlahtoa', sense_id: null, sort_key: 'a', title: { en: 'Verb morphology' } },
      { id: 's2', entry_id: null, sense_id: 'sense-1', sort_key: 'b', title: { en: 'Speech verbs' } },
      { id: 's3', entry_id: 'other', sense_id: null, sort_key: 'c', title: { en: 'Unrelated section' } },
    ],
  },
} as never

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 260 }],
  page_data: { t: mock_t, dictionary, dict_db },
}

export const WithNotes: Story<typeof Component> = {
  props: { entry } as never,
}

export const NoMatches: Story<typeof Component> = {
  page_data: {
    t: mock_t,
    dictionary,
    dict_db: { grammar_sections: { rows: [{ id: 's3', entry_id: 'other', sense_id: null, sort_key: 'c', title: { en: 'Unrelated' } }] } },
  } as never,
  props: { entry } as never,
}
