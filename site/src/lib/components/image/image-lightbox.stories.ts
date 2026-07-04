import type { Story, StoryMeta } from 'svelte-look'
import type Component from '$lib/components/image/image-lightbox.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 640, height: 420 }],
}

const noop = (() => {}) as never

export const Default: Story<typeof Component> = {
  props: { src: '/dev-placeholder-image.svg', alt: 'preview', on_close: noop },
}
