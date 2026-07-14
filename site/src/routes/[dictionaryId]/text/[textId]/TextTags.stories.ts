import type { Story, StoryMeta } from 'svelte-look'
import type Component from './TextTags.svelte'
import { mock_t } from '$lib/mocks/mock-t'
import { mock_dict_db } from '$lib/mocks/mock-dict-db'
import { log_writes } from '$lib/mocks/db'

const dictionary = { id: 'demo', url: 'demo', name: 'Nahuatl', gloss_languages: ['en'] } as never

const tags = [
  { id: 't1', name: 'The clever fox', kind: 'motif', code: 'K11.1' },
  { id: 't2', name: 'Origin myth', kind: 'genre', code: null },
  { id: 't3', name: 'Animal bride', kind: 'tale_type', code: 'ATU 402' },
]

const text_tags = [
  { id: 'tt1', text_id: 'tx1', tag_id: 't1' },
  { id: 'tt2', text_id: 'tx1', tag_id: 't2' },
]

export const shared_meta: StoryMeta = {
  viewports: [{ width: 560, height: 200 }],
  page_data: {
    t: mock_t,
    dictionary,
    writes: log_writes,
    dict_db: mock_dict_db({ tags, text_tags }),
  } as never,
}

export const ReadOnly: Story<typeof Component> = { props: { text_id: 'tx1', can_edit: false } as never }

export const Editable: Story<typeof Component> = { props: { text_id: 'tx1', can_edit: true } as never }

export const NoTags: Story<typeof Component> = {
  page_data: {
    t: mock_t,
    dictionary,
    writes: log_writes,
    dict_db: mock_dict_db({ tags, text_tags: [] }),
  } as never,
  props: { text_id: 'tx9', can_edit: true } as never,
}
