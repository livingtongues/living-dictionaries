import type { Story, StoryMeta } from 'svelte-look'
import type Component from './read-bubbles.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 320, height: 80 }],
}

export const One: Story<typeof Component> = {
  props: { members: [{ user_id: 'u-anna', name: 'Anna Luísa' }] },
}

export const Few: Story<typeof Component> = {
  props: { members: [{ user_id: 'u-anna', name: 'Anna Luísa' }, { user_id: 'u-greg', name: 'Greg Anderson' }, { user_id: 'u-diego', name: 'Diego Córdova' }] },
}

export const Overflow: Story<typeof Component> = {
  props: { members: [
    { user_id: 'u-anna', name: 'Anna Luísa' },
    { user_id: 'u-greg', name: 'Greg Anderson' },
    { user_id: 'u-diego', name: 'Diego Córdova' },
    { user_id: 'u-maria', name: 'Maria Silva' },
    { user_id: 'u-jon', name: 'Jon Doe' },
    { user_id: 'u-sam', name: 'Sam Park' },
  ] },
}
