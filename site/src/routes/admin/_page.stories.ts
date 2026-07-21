import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 1100, height: 1200 }],
}

// db/sync null → NotifyChannelToggle defaults to 'email'; the ntfy hero shows
// the signed-in admin's topic from the allow-list (jwrunner7@gmail.com).
const data = {
  auth_user: { user: { id: 'admin-1', email: 'jwrunner7@gmail.com', name: 'Jacob' }, admin_level: 3 },
  db: null,
  sync: null,
}

export const Default: PageStory<typeof Component> = {
  props: data as never,
}

export const Level2Admin: PageStory<typeof Component> = {
  props: {
    ...data,
    auth_user: { user: { id: 'admin-2', email: 'livingtongues@gmail.com', name: 'Greg' }, admin_level: 2 },
  } as never,
}
