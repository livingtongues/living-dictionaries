import type { Story, StoryMeta } from 'svelte-look'
import type Component from './ImageDropZone.svelte'
import { createRawSnippet } from 'svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 340, height: 120 }],
  page_data: { t: ((key: string) => key) as never },
}

export const DashedBorder: Story<typeof Component> = {
  props: {
    border: true,
    label: createRawSnippet(() => ({ render: () => '<span>Add photo</span>' })),
  },
}

export const Borderless: Story<typeof Component> = {
  props: { border: false },
}
