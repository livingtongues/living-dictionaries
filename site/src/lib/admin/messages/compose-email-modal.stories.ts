import type { Story, StoryMeta } from 'svelte-look'
import type Component from '$lib/admin/messages/compose-email-modal.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 900, height: 700 }],
}

export const Empty: Story<typeof Component> = {
  props: {
    db: null,
    from_email: 'jacob@livingdictionaries.app',
    from_name: 'Jacob Bowdoin',
    on_close: () => {},
    on_sent: () => {},
  },
}

export const PresetUser: Story<typeof Component> = {
  props: {
    db: null,
    from_email: 'jacob@livingdictionaries.app',
    from_name: 'Jacob Bowdoin',
    preset_user: {
      id: 'demo-user',
      email: 'eric.customer@example.com',
      name: 'Eric Customer',
    },
    on_close: () => {},
    on_sent: () => {},
  },
}
