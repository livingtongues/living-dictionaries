import type { Story, StoryMeta } from 'svelte-look'
import type Component from './WordCards.svelte'
import { story_cards, story_t } from './story-helpers'

export const shared_meta: StoryMeta = {
  page_data: { t: story_t, locale: 'en' },
}

/** Real seed cards (lh3 CDN photos load over the network). */
export const Strip: Story<typeof Component> = {
  viewports: [{ width: 1200, height: 220 }],
  props: {
    cards: story_cards,
  },
}

export const MobileStrip: Story<typeof Component> = {
  viewports: [{ width: 390, height: 190 }],
  props: {
    cards: story_cards,
  },
}
