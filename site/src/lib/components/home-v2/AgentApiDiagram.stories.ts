import type { Story, StoryMeta } from 'svelte-look'
import type Component from './AgentApiDiagram.svelte'
import { story_t } from './story-helpers'

export const shared_meta: StoryMeta = {
  page_data: { t: story_t, locale: 'en' },
}

export const Desktop: Story<typeof Component> = {
  viewports: [{ width: 1200, height: 460 }],
}

export const Mobile: Story<typeof Component> = {
  viewports: [{ width: 390, height: 900 }],
}
