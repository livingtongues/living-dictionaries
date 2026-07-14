import type { Story, StoryMeta } from 'svelte-look'
import type Component from './ClauseTemplateStrip.svelte'
import { readable } from 'svelte/store'
import { mock_t } from '$lib/mocks/mock-t'
import { mock_dict_db } from '$lib/mocks/mock-dict-db'

const dictionary = {
  id: 'demo',
  url: 'demo',
  name: 'Nahuatl',
  gloss_languages: ['en'],
  orthographies: [{ code: 'default', name: 'Latin' }],
} as never

const entries_data = readable({})

const clause_slots = [
  { id: 'sl1', sort_key: 'a', name: { en: 'Subject' }, code: 'SBJ' },
  { id: 'sl2', sort_key: 'b', name: { en: 'Object' }, code: 'OBJ' },
  { id: 'sl3', sort_key: 'c', name: { en: 'Verb stem' }, code: 'V' },
  { id: 'sl4', sort_key: 'd', name: { en: 'Directional' }, code: 'DIR' },
]

const grammar_sections = [
  { id: 's1', sort_key: 'a', slot_id: 'sl1', title: { en: 'ni- (1sg subject)' }, entry_id: null },
  { id: 's2', sort_key: 'a', slot_id: 'sl2', title: { en: 'c- (3sg object)' }, entry_id: null },
  { id: 's3', sort_key: 'a', slot_id: 'sl3', title: { en: 'tlahtoa' }, entry_id: null },
  { id: 's4', sort_key: 'a', slot_id: 'sl4', title: { en: 'on- (thither)' }, entry_id: null },
]

export const shared_meta: StoryMeta = {
  viewports: [{ width: 640, height: 220 }],
  page_data: {
    t: mock_t,
    dictionary,
    entries_data,
    dict_db: mock_dict_db({ clause_slots, grammar_sections }),
  } as never,
}

export const Template: Story<typeof Component> = { props: {} as never }
