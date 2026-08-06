import type { Story, StoryMeta } from 'svelte-look'
import type Component from './AgentPrompt.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 620, height: 320 }],
  csr: true,
}

export const Default: Story<typeof Component> = {
  props: { dictionary_id: 'kalinga-itneg' },
}
