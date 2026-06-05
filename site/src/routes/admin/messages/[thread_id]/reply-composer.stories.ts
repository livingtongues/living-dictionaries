import type { Story, StoryMeta } from 'svelte-look'
import type Component from './reply-composer.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 720, height: 480 }],
  csr: true,
}

export const Empty: Story<typeof Component> = {
  props: {
    thread_id: 'demo-thread-1',
    sync: null,
  },
}
