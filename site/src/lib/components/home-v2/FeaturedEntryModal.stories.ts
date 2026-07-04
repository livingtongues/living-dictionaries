import type { Story, StoryMeta } from 'svelte-look'
import type Component from './FeaturedEntryModal.svelte'
import { mock_t } from '$lib/mocks/mock-t'
import { story_cards } from './story-helpers'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 720 }],
  page_data: { t: mock_t, locale: 'en' },
}

const noop = () => {}

/** Post-pivot row: every modal snapshot field present. */
export const FullFields: Story<typeof Component> = {
  props: {
    card: {
      ...story_cards[0],
      dict_location: 'Odisha, India',
      phonetic: 'gso.ʔɛ',
      glosses: { en: 'water', or: 'ପାଣି', hi: 'पानी' },
      speaker_name: 'Purna Chandra Muduli',
      example_sentence: { text: { default: 'Gsoʔ ɖuŋ ɖuŋ.' }, translation: { en: 'The water is deep.' } },
    },
    on_close: noop,
  },
}

/** Pre-pivot row (26-card seed batch): modal fields NULL — degrades to the card basics. */
export const PrePivotRow: Story<typeof Component> = {
  props: {
    card: story_cards[1],
    on_close: noop,
  },
}
