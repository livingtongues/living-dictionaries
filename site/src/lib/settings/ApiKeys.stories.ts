import type { Story, StoryMeta } from 'svelte-look'
import type Component from './ApiKeys.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 560, height: 420 }],
  // Needs onMount + $state; the API fetch fails in isolation (no backend) so the
  // panel shows its create form + empty state — enough to verify layout/styling.
  // Populated/token-reveal states are verified via the live HTTP smoke test.
  csr: true,
}

export const Default: Story<typeof Component> = {
  props: { dictionary_id: 'demo-dict' },
}
