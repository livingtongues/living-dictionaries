import type { Story, StoryMeta } from 'svelte-look'
import type Component from '$lib/admin/messages/recipient-input.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 520, height: 260 }],
}

export const Empty: Story<typeof Component> = {
  props: {
    db: null,
    recipients: [],
    label: 'To',
    id: 'story-to-empty',
  },
}

export const OneRecipient: Story<typeof Component> = {
  props: {
    db: null,
    recipients: [
      { user_id: 'u1', email: 'eric.customer@example.com', name: 'Eric Customer' },
    ],
    label: 'To',
    id: 'story-to-one',
  },
}

export const ManyRecipients: Story<typeof Component> = {
  props: {
    db: null,
    recipients: [
      { user_id: 'u1', email: 'eric.customer@example.com', name: 'Eric Customer' },
      { user_id: 'u2', email: 'anna@example.com', name: 'Anna Daigneault' },
      { user_id: null, email: 'stranger@example.com', name: null },
    ],
    label: 'To',
    id: 'story-to-many',
  },
}
