import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 900, height: 2000 }],
}

export const Default: PageStory<typeof Component> = {
  props: {} as never,
}
