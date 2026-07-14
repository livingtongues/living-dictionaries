import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'
import { empty_analytics, mock_analytics, mock_analytics_bots, mock_analytics_schema_drift } from '$lib/analytics/mock-analytics'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 1000, height: 1800 }],
  csr: true,
}

// The page loads two streamed tiers (`primary` light, `secondary` full) and swaps
// to `secondary` once it resolves — stories resolve both to the same mock so the
// full rendered page is what's verified.
function tiers(analytics: unknown) {
  return { primary: Promise.resolve(analytics), secondary: Promise.resolve(analytics) } as never
}

export const Default: PageStory<typeof Component> = {
  props: tiers(mock_analytics),
}

export const Bots: PageStory<typeof Component> = {
  props: tiers(mock_analytics_bots),
}

export const SchemaDrift: PageStory<typeof Component> = {
  props: tiers(mock_analytics_schema_drift),
}

export const Empty: PageStory<typeof Component> = {
  props: tiers(empty_analytics),
}
