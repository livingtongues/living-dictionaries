import type { Story, StoryMeta } from 'svelte-look'
import type Component from './Welcome.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 560 }],
}

export const Default: Story<typeof Component> = {
  props: {},
}
