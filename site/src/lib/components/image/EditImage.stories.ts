import type { Story, StoryMeta } from 'svelte-look'
import type Component from './EditImage.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 640 }],
  page_data: {
    t: (key: string | { fallback?: string }) => typeof key === 'object' ? key.fallback || '' : key,
    db_operations: { addImage: () => ({ subscribe: () => () => {} }) },
  },
}

export const Default: Story<typeof Component> = {
  props: { on_close: () => {}, sense_id: 'sense1' },
}
