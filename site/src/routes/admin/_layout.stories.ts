import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+layout.svelte'
import { createRawSnippet } from 'svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 900, height: 500 }],
}

const children = createRawSnippet(() => ({
  render: () => '<div style="padding: 1rem">Admin content</div>',
}))

export const SignedOut: PageStory<typeof Component> = {
  props: {
    children,
    auth_user: { user: null, logout: () => {} },
    db: null,
    sync: null,
  } as never,
}
