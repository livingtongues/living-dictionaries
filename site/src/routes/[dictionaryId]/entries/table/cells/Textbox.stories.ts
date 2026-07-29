import type { Story, StoryMeta } from 'svelte-look'
import type Component from './Textbox.svelte'
import { mock_t } from '$lib/mocks/mock-t'
import { mock_dict_db } from '$lib/mocks/mock-dict-db'

const glossing_abbreviations = [
  { id: 'g1', code: '1SG', name: { en: 'first person singular' }, category: 'person' },
  { id: 'g2', code: '2SG.OBJ', name: { en: 'second person singular object' }, category: 'person' },
]

export const shared_meta: StoryMeta = {
  viewports: [{ width: 260, height: 60 }],
  page_data: {
    t: mock_t,
    can_edit: true,
    dictionary: { gloss_languages: ['en'] },
    dict_db: mock_dict_db({ glossing_abbreviations }),
  } as never,
}

export const Plain: Story<typeof Component> = {
  props: {
    value: 'ä',
    field: 'phonetic',
    display: 'Phonetic',
    on_update: () => {},
  },
}

// The morphology column lights up the dictionary's glossing codes.
export const Morphology: Story<typeof Component> = {
  props: {
    value: '1SG-đihą́-2SG.OBJ',
    field: 'morphology',
    display: 'Morphology',
    gloss_codes: true,
    on_update: () => {},
  },
}
