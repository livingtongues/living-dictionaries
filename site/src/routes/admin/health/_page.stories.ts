import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'
import { empty_analytics, mock_analytics, mock_analytics_bots, mock_analytics_schema_drift } from '$lib/analytics/mock-analytics'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 1000, height: 1800 }],
  csr: true,
}

// The page awaits ONE fetch: the daily checkpoint envelope (payload + staleness
// stamp). Stories resolve it immediately so the fully rendered page is verified.
function checkpoint(analytics: unknown, overrides: Record<string, unknown> = {}) {
  return {
    checkpoint: Promise.resolve({
      analytics,
      checkpoint: { generated_at: '2026-07-30T10:30:00.000Z', computed_ms: 41_000, reason: 'cron', running: false, ...overrides },
    }),
  } as never
}

export const Default: PageStory<typeof Component> = {
  props: checkpoint(mock_analytics),
}

export const Bots: PageStory<typeof Component> = {
  props: checkpoint(mock_analytics_bots),
}

export const SchemaDrift: PageStory<typeof Component> = {
  props: checkpoint(mock_analytics_schema_drift),
}

export const Empty: PageStory<typeof Component> = {
  props: checkpoint(empty_analytics),
}

/** Before the daily job has ever run (or after the file was pruned): no numbers, one button. */
export const NoCheckpoint: PageStory<typeof Component> = {
  props: checkpoint(null, { generated_at: null, computed_ms: null, reason: null }),
}
