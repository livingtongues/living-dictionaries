import type { Story, StoryMeta } from 'svelte-look'
import type Component from './AdminBadge.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 360, height: 60 }],
}

export const SuperAdmin: Story<typeof Component> = {
  props: { level: 3 },
}

export const Admin: Story<typeof Component> = {
  props: { level: 2 },
}

export const SuperManager: Story<typeof Component> = {
  props: { level: 1 },
}

export const LargeSuperAdmin: Story<typeof Component> = {
  props: { level: 3, size: 'lg' },
}

export const LargeSuperManager: Story<typeof Component> = {
  props: { level: 1, size: 'lg' },
}
