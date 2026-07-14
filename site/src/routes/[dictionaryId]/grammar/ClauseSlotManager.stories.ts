import type { Story, StoryMeta } from 'svelte-look'
import type Component from './ClauseSlotManager.svelte'
import { mock_t } from '$lib/mocks/mock-t'
import { mock_dict_db } from '$lib/mocks/mock-dict-db'
import { log_writes } from '$lib/mocks/db'

const dictionary = { id: 'demo', url: 'demo', name: 'Nahuatl', gloss_languages: ['en'] } as never

const clause_slots = [
  { id: 'sl1', sort_key: 'a', name: { en: 'Subject' }, code: 'SBJ' },
  { id: 'sl2', sort_key: 'b', name: { en: 'Object' }, code: 'OBJ' },
  { id: 'sl3', sort_key: 'c', name: { en: 'Verb stem' }, code: null },
]

export const shared_meta: StoryMeta = {
  viewports: [{ width: 520, height: 320 }],
  page_data: {
    t: mock_t,
    dictionary,
    writes: log_writes,
    dict_db: mock_dict_db({ clause_slots }),
  } as never,
}

export const WithSlots: Story<typeof Component> = { props: {} as never }

export const Empty: Story<typeof Component> = {
  page_data: {
    t: mock_t,
    dictionary,
    writes: log_writes,
    dict_db: mock_dict_db({ clause_slots: [] }),
  } as never,
  props: {} as never,
}
