import type { Story, StoryMeta } from 'svelte-look'
import type Component from './HomeStats.svelte'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 720, height: 120 }],
  page_data: { t: mock_t, locale: 'en' },
}

/** Local Orama index not ready — tiles pulse. */
export const Loading: Story<typeof Component> = {
  props: {
    stats: null,
  },
}

/** Values arrived — count-up finishes ~900ms after mount. */
export const Loaded: Story<typeof Component> = {
  csr: true,
  interactions: async (page) => {
    await page.waitForFunction(() => document.body.textContent?.includes('2,592'), { timeout: 3000 })
  },
  props: {
    stats: { entries: 2592, with_audio: 1904, with_photos: 312, with_video: 48, speakers: 11 },
  },
}
