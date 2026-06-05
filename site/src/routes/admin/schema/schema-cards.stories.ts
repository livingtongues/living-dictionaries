import type { Story, StoryMeta } from 'svelte-look'
import type Component from './schema-cards.svelte'
import { mock_schema } from './_mock-schema'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 1000, height: 1800 }],
}

export const Default: Story<typeof Component> = {
  props: {
    schema: mock_schema,
  },
}
