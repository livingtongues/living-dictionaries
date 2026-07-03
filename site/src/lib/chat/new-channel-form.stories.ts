import type { Story, StoryMeta } from 'svelte-look'
import type Component from './new-channel-form.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 280, height: 220 }],
}

/** Collapsed trigger button. */
export const Trigger: Story<typeof Component> = {
  props: { can_create_admin_room: false, on_created: () => {} },
}

/** Open form with the super-admin-only admin-room flag. */
export const OpenSuperAdmin: Story<typeof Component> = {
  csr: true,
  props: { can_create_admin_room: true, on_created: () => {} },
  interactions: async (page) => {
    await page.waitForSelector('.new-channel-btn')
    await page.click('.new-channel-btn')
    await page.waitForSelector('.new-channel-form')
  },
}
