import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'
import { empty_analytics, mock_analytics, mock_analytics_bots, mock_analytics_schema_drift } from '$lib/analytics/mock-analytics'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 1000, height: 1800 }],
  csr: true,
}

export const Default: PageStory<typeof Component> = {
  props: { analytics: mock_analytics } as never,
}

export const Bots: PageStory<typeof Component> = {
  props: { analytics: mock_analytics_bots } as never,
}

export const SchemaDrift: PageStory<typeof Component> = {
  props: { analytics: mock_analytics_schema_drift } as never,
}

export const Empty: PageStory<typeof Component> = {
  props: { analytics: empty_analytics } as never,
}
