import type { Story, StoryMeta } from 'svelte-look'
import type Component from '$lib/admin/messages/compose-recipients.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 560, height: 320 }],
}

export const SingleRecipient: Story<typeof Component> = {
  props: {
    db: null,
    from_email: 'jacob@livingdictionaries.app',
    from_name: 'Jacob Bowdoin',
    to_recipients: [{ user_id: 'u1', email: 'eric.customer@example.com', name: 'Eric Customer' }],
    cc_recipients: [],
    bcc_recipients: [],
  },
}

export const MultipleRecipients: Story<typeof Component> = {
  props: {
    db: null,
    from_email: 'jacob@livingdictionaries.app',
    from_name: 'Jacob Bowdoin',
    to_recipients: [
      { user_id: 'u1', email: 'eric.customer@example.com', name: 'Eric Customer' },
      { user_id: 'u2', email: 'anna@example.com', name: 'Anna Daigneault' },
      { user_id: null, email: 'stranger@example.com', name: null },
    ],
    cc_recipients: [],
    bcc_recipients: [],
  },
}
