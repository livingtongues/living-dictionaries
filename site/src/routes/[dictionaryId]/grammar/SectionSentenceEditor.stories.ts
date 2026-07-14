import type { Story, StoryMeta } from 'svelte-look'
import type Component from './SectionSentenceEditor.svelte'
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

const sentences = [
  { id: 'q1', text: { default: 'Ni-tlahtoa' }, translation: { en: 'I speak.' }, discourse_role: 'storyline' },
  { id: 'q2', text: { default: 'Ti-tlahtoa' }, translation: { en: 'You speak.' } },
  { id: 'q3', text: { default: 'Ø-tlahtoa' }, translation: { en: 'He/she speaks.' } },
]

const section_sentences = [
  { id: 'ss1', section_id: 's1', sentence_id: 'q1', sort_key: 'a' },
  { id: 'ss2', section_id: 's1', sentence_id: 'q2', sort_key: 'b' },
]

export const shared_meta: StoryMeta = {
  viewports: [{ width: 560, height: 360 }],
  page_data: {
    t: mock_t,
    dictionary,
    writes: log_writes,
    dict_db: mock_dict_db({ sentences, section_sentences }),
  } as never,
}

export const WithAttached: Story<typeof Component> = { props: { section_id: 's1' } as never }

export const EmptySection: Story<typeof Component> = {
  page_data: {
    t: mock_t,
    dictionary,
    writes: log_writes,
    dict_db: mock_dict_db({ sentences, section_sentences: [] }),
  } as never,
  props: { section_id: 's9' } as never,
}
