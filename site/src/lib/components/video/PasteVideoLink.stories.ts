import type { Story, StoryMeta } from 'svelte-look'
import type Component from './PasteVideoLink.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 520, height: 120 }],
  csr: true,
  page_data: {
    t: (key: string) => key === 'misc.invalid_url' ? 'Invalid video URL' : key === 'video.video_url' ? 'Video URL' : 'Add',
  },
}

export const InvalidUrl: Story<typeof Component> = {
  viewports: [{ width: 520, height: 120 }],
  props: { on_pasted_valid_url: () => undefined },
  interactions: async (page) => {
    page.once('dialog', dialog => dialog.accept())
    await page.type('input', 'https://example.com/not-a-video')
    await page.click('button[type="submit"]')
  },
}
