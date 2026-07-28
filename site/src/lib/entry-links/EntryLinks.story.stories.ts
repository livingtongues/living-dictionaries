import type { Story, StoryMeta } from 'svelte-look'
import type Component from './EntryLinks.story.svelte'
import { readable } from 'svelte/store'
import { mock_t } from '$lib/mocks/mock-t'

const dictionary = {
  id: 'demo',
  url: 'demo',
  name: 'Ponca',
  gloss_languages: ['en'],
  orthographies: [{ code: 'default', name: 'Latin' }],
} as never

const entries_data = readable({
  lift: {
    id: 'lift',
    main: { lexeme: { default: 'Đihą́' } },
    senses: [{ id: 'se1', glosses: { en: 'to lift' }, parts_of_speech: ['v'] }],
    audios: [{ id: 'a1', storage_path: 'demo/audio/a1.mp3' }],
  },
  happy: {
    id: 'happy',
    main: { lexeme: { default: 'Gíđe' } },
    senses: [{ id: 'se2', glosses: { en: 'to be happy' }, parts_of_speech: ['v'] }],
  },
  happy2: {
    id: 'happy2',
    main: { lexeme: { default: 'Gíđe' } },
    senses: [{ id: 'se3', glosses: { en: 'to return home' }, parts_of_speech: ['v'] }],
    audios: [{ id: 'a2', storage_path: 'demo/audio/a2.mp3' }],
  },
  prefix_a: {
    id: 'prefix_a',
    main: { lexeme: { default: 'A-' } },
    senses: [{ id: 'se4', glosses: { en: 'first person singular subject' } }],
  },
})

const entries = [
  { id: 'lift', lexeme: { default: 'Đihą́' } },
  { id: 'happy', lexeme: { default: 'Gíđe' } },
  { id: 'happy2', lexeme: { default: 'Gíđe' } },
  { id: 'prefix_a', lexeme: { default: 'A-' } },
]

const prose = `<p>Consider the conjugations surrounding the Ponca verb <strong>Đihą́</strong> ‘to lift’. The <strong>first person subject</strong> is marked with the usual prefix <strong>A-</strong>, and a verb such as Gíđe follows the same pattern.</p><p>English words in <strong>bold</strong> — like <strong>agent</strong> and <strong>patient</strong> — are never linked, and neither is the article a in running prose.</p>`

export const shared_meta: StoryMeta = {
  viewports: [{ width: 720, height: 300 }],
  // The linking pass is a DOM attachment and the popover portals — both are
  // client-only, so these stories must mount in a real browser.
  csr: true,
  page_data: { t: mock_t, dictionary, entries_data } as never,
}

/** The link affordance in ordinary prose: vernacular linked, English left alone. */
export const LinkedProse: Story<typeof Component> = {
  props: { html: prose, entries } as never,
  interactions: async (page: any) => { await page.waitForSelector('.entry-mention') },
}

/** Tapping a word — headword, part of speech, gloss, audio, jump to the entry. */
export const PopoverWithAudio: Story<typeof Component> = {
  props: { html: prose, entries, open_form: 'Đihą́' } as never,
  interactions: async (page: any) => { await page.waitForSelector('[role="dialog"]') },
}

/** Two entries share the written form, so the reader picks. */
export const PopoverHomographs: Story<typeof Component> = {
  props: { html: prose, entries, open_form: 'Gíđe' } as never,
  interactions: async (page: any) => { await page.waitForSelector('[role="dialog"]') },
}
