import type { Story, StoryMeta } from 'svelte-look'
import type Component from './GalleryEntry.svelte'
import type { EntryData, Tables } from '$lib/types'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 320, height: 340 }],
  page_data: { t: mock_t, db_operations: {} },
}

const dictionary = {
  id: 'demo',
  url: 'demo',
  gloss_languages: ['en'],
} as unknown as Tables<'dictionaries'>

function make_entry({ lexeme, gloss }: { lexeme: string, gloss: string }): EntryData {
  return {
    id: 'e1',
    updated_at: '2026-01-01T00:00:00Z',
    main: { lexeme: { default: lexeme } },
    senses: [{
      id: 's1',
      glosses: { en: gloss },
      photos: [{
        id: 'p1',
        serving_url: 'LGuBKhg7vuv5-aJcOdnb_ucOXLSCIR1Kjxrh70xRlaIHqWo-mWqfWUcH3Xznz63QsFZmkeVmoNN0PEXzSc0Jh4g',
      }],
    }],
  } as unknown as EntryData
}

export const WithGloss: Story<typeof Component> = {
  props: { dictionary, can_edit: false, entry: make_entry({ lexeme: 'adiʔol', gloss: 'cotton leaves' }) },
}

export const NoGloss: Story<typeof Component> = {
  props: { dictionary, can_edit: false, entry: make_entry({ lexeme: 'aŋkullaol', gloss: '' }) },
}

export const CanEdit: Story<typeof Component> = {
  props: { dictionary, can_edit: true, entry: make_entry({ lexeme: 'ame ol', gloss: 'monkey' }) },
}
