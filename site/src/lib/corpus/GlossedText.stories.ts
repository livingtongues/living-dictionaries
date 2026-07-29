import type { Story, StoryMeta } from 'svelte-look'
import type Component from './GlossedText.svelte'
import { mock_t } from '$lib/mocks/mock-t'
import { mock_dict_db } from '$lib/mocks/mock-dict-db'

const glossing_abbreviations = [
  { id: 'g1', code: '1SG', name: { en: 'first person singular' }, category: 'person' },
  { id: 'g2', code: '1PL.PST', name: { en: 'first person plural past' }, category: 'person' },
  { id: 'g3', code: 'PL', name: { en: 'plural' }, category: 'number' },
]

export const shared_meta: StoryMeta = {
  viewports: [{ width: 320, height: 80 }],
  page_data: {
    t: mock_t,
    dictionary: { gloss_languages: ['en'] },
    dict_db: mock_dict_db({ glossing_abbreviations }),
  } as never,
}

// A Ponca-style morphology string: the codes are small-caps, the rest is plain.
export const Codes: Story<typeof Component> = {
  props: { text: '1SG-đihą́-PL' },
}

// Nothing in the legend matches — the text renders verbatim.
export const NoMatch: Story<typeof Component> = {
  props: { text: 'reduplicated stem' },
}

// A dictionary with NO legend of its own still gets the standard Leipzig
// catalog — the codes light up and expand to the site-wide (translatable) names.
export const NoLegend: Story<typeof Component> = {
  page_data: {
    t: mock_t,
    dictionary: { gloss_languages: ['en'] },
    dict_db: mock_dict_db({ glossing_abbreviations: [] }),
  } as never,
  props: { text: '1SG-đihą́-PL' },
}

// Free-text fields are prose as often as they are analysis: a standalone "A" is
// an English word before it is a Leipzig code, so it stays plain.
export const AmbiguousCodesLeftAlone: Story<typeof Component> = {
  page_data: {
    t: mock_t,
    dictionary: { gloss_languages: ['en'] },
    dict_db: mock_dict_db({ glossing_abbreviations: [] }),
  } as never,
  props: { text: 'A stem doubled in the PL' },
}

// Tapping a code opens its expansion.
export const Expanded: Story<typeof Component> = {
  viewports: [{ width: 320, height: 200 }],
  props: { text: '1PL.PST-đihą́' },
  csr: true,
  interactions: async (page) => {
    await page.click('button.code')
    await page.waitForSelector('[role="dialog"]')
  },
}
