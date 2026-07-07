import type { Story, StoryMeta } from 'svelte-look'
import type Component from './AboutContent.svelte'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  page_data: { t: mock_t, locale: 'en' },
}

export const Desktop: Story<typeof Component> = {
  viewports: [{ width: 900, height: 1400 }],
}

export const Mobile: Story<typeof Component> = {
  viewports: [{ width: 390, height: 1600 }],
}
