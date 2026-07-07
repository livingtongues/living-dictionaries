import type { Story, StoryMeta } from 'svelte-look'
import type Component from './FeaturedEntryFullscreen.svelte'
import { mock_t } from '$lib/mocks/mock-t'
import { story_cards } from './story-helpers'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 720 }, { width: 1024, height: 720 }],
  page_data: { t: mock_t, locale: 'en' },
}

const noop = () => {}

export const Default: Story<typeof Component> = {
  props: {
    card: story_cards[0],
    on_close: noop,
  },
}

/** Long dictionary name + gloss — check the overlay bars truncate gracefully. */
export const LongNames: Story<typeof Component> = {
  props: {
    card: {
      ...story_cards[1],
      dict_name: 'Werikyana Tiriyó Português Inglês Living Dictionary',
      gloss: 'a very long gloss that describes the pictured thing in detail',
    },
    on_close: noop,
  },
}
