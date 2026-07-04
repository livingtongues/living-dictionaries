import type { Story, StoryMeta } from 'svelte-look'
import type Component from './BadgeArrayEmit.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 420, height: 90 }],
}

export const Editable: Story<typeof Component> = {
  props: {
    strings: ['speaker one', 'speaker two'],
    canEdit: true,
    addMessage: 'Add speaker',
  },
}

export const ReadOnly: Story<typeof Component> = {
  props: { strings: ['speaker one', 'speaker two'] },
}
