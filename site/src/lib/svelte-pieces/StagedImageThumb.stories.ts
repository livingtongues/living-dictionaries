import type { Story, StoryMeta } from 'svelte-look'
import type Component from '$lib/svelte-pieces/StagedImageThumb.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 160, height: 120 }],
}

const noop = (() => {}) as never

export const Default: Story<typeof Component> = {
  props: { src: '/dev-placeholder-image.svg', alt: 'preview', on_remove: noop },
}

export const Viewable: Story<typeof Component> = {
  props: { src: '/dev-placeholder-image.svg', alt: 'preview', on_remove: noop, on_view: noop },
}
