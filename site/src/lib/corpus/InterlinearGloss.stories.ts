import type { Story, StoryMeta } from 'svelte-look'
import type Component from './InterlinearGloss.svelte'
import type { SentenceToken } from '$lib/db/schemas/dictionary.types'
import { mock_dict_db } from '$lib/mocks/mock-dict-db'
import { mock_t } from '$lib/mocks/mock-t'

const dictionary = {
  id: 'demo',
  url: 'demo',
  name: 'Ponca',
  gloss_languages: ['en'],
  orthographies: [{ code: 'default', name: 'Ponca', primary: true }],
} as never

// The dictionary's legend — codes render small-caps + tap-to-expand wherever they
// appear inside a gloss cell.
const glossing_abbreviations = [
  { id: 'g1', code: '1SG', name: { en: 'first person singular' }, category: 'person' },
  { id: 'g2', code: '2SG', name: { en: 'second person singular' }, category: 'person' },
  { id: 'g3', code: '1SG>2SG', name: { en: 'first person singular acting on second person singular' }, category: 'person' },
  { id: 'g4', code: 'PL', name: { en: 'plural' }, category: 'number' },
  { id: 'g5', code: 'INS', name: { en: 'instrumental prefix' }, category: 'derivation' },
]

const dict_db = mock_dict_db({ glossing_abbreviations })

export const shared_meta: StoryMeta = {
  viewports: [{ width: 620, height: 150 }],
  page_data: { t: mock_t, dictionary, dict_db } as never,
}

// Headman & O'Neill 2019:20 — a single polysynthetic word, segmented into the
// morphemes the book itself analyses it into.
const wibdiha: SentenceToken[] = [
  {
    form: 'Wíbđihą̀',
    start: 0,
    end: 8,
    morphemes: [
      { form: 'Wí', gloss: { default: '1SG>2SG' } },
      { form: 'b', gloss: { default: '1SG' }, separator: '-' },
      { form: 'đihą́', gloss: { en: 'lift' }, entry_id: 'e-dihe', separator: '-' },
    ],
  },
]

export const SegmentedWord: Story<typeof Component> = {
  props: { tokens: wibdiha, language: 'en' } as never,
}

// Headman & O'Neill 2019:13 — a full verb showing the template: person marker,
// instrumental prefix, stem, plural suffix.
const dagasai: SentenceToken[] = [
  {
    form: 'Đagásaʼì',
    start: 0,
    end: 8,
    morphemes: [
      { form: 'Đa', gloss: { default: '2SG' } },
      { form: 'gá', gloss: { default: 'INS' }, separator: '-' },
      { form: 'sa', gloss: { en: 'chop' }, entry_id: 'e-gase', separator: '-' },
      { form: 'ʼì', gloss: { default: 'PL' }, separator: '-' },
    ],
  },
]

export const VerbTemplate: Story<typeof Component> = {
  props: { tokens: dagasai, language: 'en' } as never,
}

// A multi-word sentence with a mixed cell (`eat PFV`-style) and punctuation that
// is excluded from the aligned columns.
const multiword: SentenceToken[] = [
  { form: 'Nąbé', start: 0, end: 4, gloss: { en: 'hand', default: 'PL' }, entry_id: 'e-nabe' },
  { form: 'ągútʼaitè', start: 5, end: 14, gloss: { en: 'we reached out', default: '1SG' } },
  { form: ',', start: 14, end: 15, status: 'ignored' },
  { form: 'xįháte', start: 16, end: 22, gloss: { en: 'ragged clothes' } },
]

export const MultiWord: Story<typeof Component> = {
  props: { tokens: multiword, language: 'en' } as never,
}

// No glosses anywhere — the component renders nothing rather than an empty grid.
export const NoGlosses: Story<typeof Component> = {
  props: { tokens: [{ form: 'Đagásaʼì', start: 0, end: 8 }], language: 'en' } as never,
}
