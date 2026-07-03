import type { Story, StoryMeta } from 'svelte-look'
import type Component from '$lib/admin/messages/cc-bcc-fields.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 560, height: 260 }],
}

export const Collapsed: Story<typeof Component> = {
  props: {
    db: null,
    cc_recipients: [],
    bcc_recipients: [],
  },
}

// Seeded Cc/Bcc → the disclosure auto-opens, showing the pill inputs.
export const Expanded: Story<typeof Component> = {
  props: {
    db: null,
    cc_recipients: [{ user_id: 'u1', email: 'anna@example.com', name: 'Anna Daigneault' }],
    bcc_recipients: [{ user_id: null, email: 'archive@example.com', name: null }],
  },
}
