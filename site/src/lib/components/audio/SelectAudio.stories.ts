import type { Story, StoryMeta } from 'svelte-look'
import type Component from './SelectAudio.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 340, height: 70 }],
  page_data: { t: ((key: string) => key) as never },
}

export const Default: Story<typeof Component> = {
  props: { file: undefined },
}
