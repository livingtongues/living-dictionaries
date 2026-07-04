import type { Story, StoryMeta } from 'svelte-look'
import type Component from './BadgeArray.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 420, height: 90 }],
}

export const Editable: Story<typeof Component> = {
  props: {
    strings: ['first tag', 'second tag', 'https://livingtongues.org'],
    canEdit: true,
    addMessage: 'Add tag',
  },
}

export const ReadOnly: Story<typeof Component> = {
  props: { strings: ['first tag', 'second tag'] },
}
