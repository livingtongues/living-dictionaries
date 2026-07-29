import type { Story, StoryMeta } from 'svelte-look'
import Component from './RecordErrorPreview.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 400, height: 260 }],
}

export const Default: Story<typeof Component> = {}
