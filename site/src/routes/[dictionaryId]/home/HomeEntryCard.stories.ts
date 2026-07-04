import type { Story, StoryMeta } from 'svelte-look'
import type Component from './HomeEntryCard.svelte'
import { mock_t } from '$lib/mocks/mock-t'
import { story_cards } from '$lib/components/home-v2/story-helpers'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 200, height: 200 }],
  page_data: { t: mock_t, locale: 'en' },
}

const noop = () => {}

export const WithPhoto: Story<typeof Component> = {
  props: {
    href: '#',
    entry_id: 'e1',
    lexeme: story_cards[0].lexeme,
    gloss: story_cards[0].gloss,
    photo_serving_url: story_cards[0].photo_serving_url,
    audio_storage_path: story_cards[0].audio_storage_path,
  },
}

/** No photo → deterministic hue gradient stands in. */
export const NoPhoto: Story<typeof Component> = {
  props: {
    href: '#',
    entry_id: 'entry-without-photo',
    lexeme: 'tzʼikin',
    gloss: 'bird',
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
    gloss: story_cards[0].gloss,
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
