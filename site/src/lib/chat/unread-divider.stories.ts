import type { Story, StoryMeta } from 'svelte-look'
import type Component from './unread-divider.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 420, height: 48 }],
}

export const Default: Story<typeof Component> = {
  props: {},
}
