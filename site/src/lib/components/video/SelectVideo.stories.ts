import type { Story, StoryMeta } from 'svelte-look'
import type Component from './SelectVideo.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 340, height: 90 }],
  page_data: { t: ((key: string) => key) as never },
}

export const Default: Story<typeof Component> = {
  props: {},
}
