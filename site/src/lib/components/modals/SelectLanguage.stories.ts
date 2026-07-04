import type { Story, StoryMeta } from 'svelte-look'
import type Component from './SelectLanguage.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 620 }],
  page_data: {
    t: (key: string | { fallback?: string }) => typeof key === 'object' ? key.fallback || '' : key === 'header.select_language' ? 'Select language' : key,
    locale: 'en',
    auth_user: { user: null, is_admin: false },
  },
}

export const Default: Story<typeof Component> = {
  props: { on_close: () => {} },
}
