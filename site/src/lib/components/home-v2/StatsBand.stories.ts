import type { Story, StoryMeta } from 'svelte-look'
import type Component from './StatsBand.svelte'
import { story_t } from './story-helpers'

export const shared_meta: StoryMeta = {
  page_data: { t: story_t, locale: 'en' },
}

export const Desktop: Story<typeof Component> = {
  viewports: [{ width: 1200, height: 200 }],
  props: {
    stats: { dictionaries: 2232, entries: 555071, audio: 145691, photos: 21643, videos: 435, users: 5335 },
  },
}

export const Mobile: Story<typeof Component> = {
  viewports: [{ width: 390, height: 340 }],
  props: {
    stats: { dictionaries: 2232, entries: 555071, audio: 145691, photos: 21643, videos: 435, users: 5335 },
  },
}
