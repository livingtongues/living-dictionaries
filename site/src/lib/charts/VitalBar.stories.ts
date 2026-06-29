import type { Story, StoryMeta } from 'svelte-look'
import type Component from './VitalBar.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 560, height: 170 }],
}

// Numbers mirror the production screenshot (LCP/INP/CLS green, FCP/TTFB amber).
export const LCP_Good: Story<typeof Component> = {
  props: { vital: { metric: 'LCP', count: 316, p50: 984, p75: 2100, p95: 8800 } } as never,
}

export const INP_Good: Story<typeof Component> = {
  props: { vital: { metric: 'INP', count: 216, p50: 48, p75: 88, p95: 248 } } as never,
}

export const CLS_Good: Story<typeof Component> = {
  props: { vital: { metric: 'CLS', count: 218, p50: 0.001, p75: 0.012, p95: 0.262 } } as never,
}

export const FCP_NeedsWork: Story<typeof Component> = {
  props: { vital: { metric: 'FCP', count: 406, p50: 852, p75: 1840, p95: 4200 } } as never,
}

export const TTFB_NeedsWork: Story<typeof Component> = {
  props: { vital: { metric: 'TTFB', count: 561, p50: 451, p75: 860, p95: 2300 } } as never,
}

// A poor (red) state for coverage of the third zone + the >10s formatting.
export const LCP_Poor: Story<typeof Component> = {
  props: { vital: { metric: 'LCP', count: 88, p50: 3200, p75: 5400, p95: 12400 } } as never,
}
