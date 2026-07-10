import type { Story, StoryMeta } from 'svelte-look'
import type Component from './HomeEntryCard.svelte'
import { mock_t } from '$lib/mocks/mock-t'
import { story_cards } from '$lib/components/home-v2/story-helpers'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 200, height: 200 }],
  page_data: { t: mock_t, locale: 'en' },
}

const noop = () => {}

export const WithPhotoFullData: Story<typeof Component> = {
  props: {
    href: '#',
    entry_id: 'e1',
    lexeme: story_cards[0].lexeme,
    phonetic: 'mikʷʼɛɬ',
    pos: 'n.',
    glosses: [story_cards[0].gloss, 'helecho'],
    dialect: 'Northern',
    photo_serving_url: story_cards[0].photo_serving_url,
    audio_storage_path: story_cards[0].audio_storage_path,
  },
}

/** No photo → deterministic soft hue gradient stands in; full entry data. */
export const NoPhotoFullData: Story<typeof Component> = {
  props: {
    href: '#',
    entry_id: 'entry-without-photo',
    lexeme: 'tzʼikin',
    phonetic: 'tsʼikin',
    pos: 'n.',
    glosses: ['bird', 'pájaro'],
    audio_storage_path: story_cards[0].audio_storage_path,
  },
}

/** Alternate orthography + dialect chip. */
export const NoPhotoAltOrthography: Story<typeof Component> = {
  props: {
    href: '#',
    entry_id: 'entry-alt-ortho',
    lexeme: 'ᱥᱟᱱᱛᱟᱲ',
    alt: 'santaṛ',
    pos: 'n.',
    glosses: ['orange'],
    dialect: 'Mayurbhanj',
    audio_storage_path: story_cards[0].audio_storage_path,
  },
}

/** Gloss only, no audio → no ear button. */
export const NoPhotoGlossOnly: Story<typeof Component> = {
  props: {
    href: '#',
    entry_id: 'entry-gloss-only',
    lexeme: 'aŋätī',
    glosses: ['to walk slowly'],
  },
}

/** Lexeme only → centered. */
export const NoPhotoSparse: Story<typeof Component> = {
  props: {
    href: '#',
    entry_id: 'entry-sparse',
    lexeme: 'weyeḱen',
  },
}

/** Long lexeme clamps to two lines. */
export const NoPhotoLongLexeme: Story<typeof Component> = {
  props: {
    href: '#',
    entry_id: 'entry-long-lexeme',
    lexeme: 'nakattirundhukondiruppen',
    phonetic: 'nakattiɾundʱukondiɾuppen',
    pos: 'v.',
    glosses: ['I will keep on swimming'],
    audio_storage_path: story_cards[0].audio_storage_path,
  },
}

/** Editor manage overlay (hover-revealed on desktop). */
export const ManageControls: Story<typeof Component> = {
  csr: true,
  interactions: async (page) => {
    await page.mouse.move(100, 100)
  },
  props: {
    href: '#',
    entry_id: 'e1',
    lexeme: story_cards[0].lexeme,
    glosses: [story_cards[0].gloss],
    photo_serving_url: story_cards[0].photo_serving_url,
    audio_storage_path: story_cards[0].audio_storage_path,
    manage: {
      can_move_left: true,
      can_move_right: false,
      on_move_left: noop,
      on_move_right: noop,
      on_unstar: noop,
    },
  },
}
