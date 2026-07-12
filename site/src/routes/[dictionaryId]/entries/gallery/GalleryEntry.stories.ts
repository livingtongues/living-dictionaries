import type { Story, StoryMeta } from 'svelte-look'
import type Component from './GalleryEntry.svelte'
import type { EntryData, Tables } from '$lib/types'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 320, height: 340 }],
  page_data: { t: mock_t, writes: {} },
}

const dictionary = {
  id: 'demo',
  url: 'demo',
  gloss_languages: ['en', 'es'],
} as unknown as Tables<'dictionaries'>

const photo = {
  id: 'p1',
  serving_url: 'LGuBKhg7vuv5-aJcOdnb_ucOXLSCIR1Kjxrh70xRlaIHqWo-mWqfWUcH3Xznz63QsFZmkeVmoNN0PEXzSc0Jh4g',
  source: 'Community field collection',
  photographer: 'A. Photographer',
}

function make_entry({ lexeme, gloss, full }: { lexeme: string, gloss: string, full?: boolean }): EntryData {
  return {
    id: 'e1',
    updated_at: '2026-01-01T00:00:00Z',
    main: {
      lexeme: { default: lexeme, ...full && { lo2: 'ଅଦିଓଲ' } },
      ...full && { phonetic: 'adiʔɔl' },
    },
    ...full && { dialects: [{ id: 'd1', name: { default: 'Plains' } }] },
    ...full && { audios: [{ id: 'a1', storage_path: 'demo/audio/e1.mp3' }] },
    senses: [{
      id: 's1',
      glosses: { en: gloss, ...full && { es: 'hojas de algodón' } },
      ...full && { parts_of_speech: ['n'] },
      photos: [photo],
    }],
  } as unknown as EntryData
}

export const WithGloss: Story<typeof Component> = {
  props: { dictionary, can_edit: false, entry: make_entry({ lexeme: 'adiʔol', gloss: 'cotton leaves' }) },
}

export const FullDetails: Story<typeof Component> = {
  props: { dictionary, can_edit: false, entry: make_entry({ lexeme: 'adiʔol', gloss: 'cotton leaves', full: true }) },
}

export const NoGloss: Story<typeof Component> = {
  props: { dictionary, can_edit: false, entry: make_entry({ lexeme: 'aŋkullaol', gloss: '' }) },
}

export const FullscreenViewer: Story<typeof Component> = {
  viewports: [{ width: 800, height: 600 }],
  csr: true,
  interactions: async (page) => {
    await page.click('.thumb')
    await page.waitForSelector('.viewer', { timeout: 15000 })
    await new Promise(resolve => setTimeout(resolve, 400)) // let the zoom settle
  },
  props: { dictionary, can_edit: true, entry: make_entry({ lexeme: 'adiʔol', gloss: 'cotton leaves', full: true }) },
}
