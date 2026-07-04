import type { Story, StoryMeta } from 'svelte-look'
import type Component from './HeroSearch.svelte'
import { story_dicts, story_t } from './story-helpers'

export const shared_meta: StoryMeta = {
  page_data: { t: story_t, locale: 'en' },
}

export const Empty: Story<typeof Component> = {
  viewports: [{ width: 640, height: 120 }],
  props: { dicts: story_dicts },
}

/** Typing shows the ranked dropdown (fuzzy + diacritic-insensitive). */
export const WithResults: Story<typeof Component> = {
  viewports: [{ width: 640, height: 420 }],
  csr: true,
  props: { dicts: story_dicts },
  interactions: async (page) => {
    await page.click('input')
    await page.type('input', 'michif')
    await new Promise(resolve => setTimeout(resolve, 300))
  },
}
