import type { Story, StoryMeta } from 'svelte-look'
import type Component from './DonutChart.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 520, height: 280 }],
  csr: true,
}

// Nested (sunburst): inner ring = OS, outer ring = versions.
export const NestedOs: Story<typeof Component> = {
  props: {
    center_value: '177',
    center_label: 'sessions',
    data: [
      { label: 'Windows', value: 71, color: '#7c3aed', children: [{ label: '10/11', value: 71 }] },
      { label: 'Android', value: 39, color: '#06b6d4', children: [{ label: '14', value: 21 }, { label: '13', value: 12 }, { label: '12', value: 6 }] },
      { label: 'macOS', value: 32, color: '#10b981', children: [{ label: '10.15', value: 32 }] },
      { label: 'iOS', value: 21, color: '#f59e0b', children: [{ label: '18', value: 13 }, { label: '17', value: 8 }] },
      { label: 'Linux', value: 9, color: '#64748b', children: [{ label: 'unknown', value: 9 }] },
      { label: 'ChromeOS', value: 5, color: '#ec4899', children: [{ label: 'unknown', value: 5 }] },
    ],
  } as never,
}

// Hovering a legend row (or a wedge) highlights the matching wedge(s) + row and
// dims the rest. This story hovers "Android" before the screenshot to prove it.
export const HoverHighlight: Story<typeof Component> = {
  csr: true,
  interactions: async (page) => {
    await page.waitForSelector('.legend li')
    const items = await page.$$('.legend li')
    await items[1].hover()
  },
  props: {
    center_value: '177',
    center_label: 'sessions',
    data: [
      { label: 'Windows', value: 71, color: '#7c3aed', children: [{ label: '10/11', value: 71 }] },
      { label: 'Android', value: 39, color: '#06b6d4', children: [{ label: '14', value: 21 }, { label: '13', value: 12 }, { label: '12', value: 6 }] },
      { label: 'macOS', value: 32, color: '#10b981', children: [{ label: '10.15', value: 32 }] },
      { label: 'iOS', value: 21, color: '#f59e0b', children: [{ label: '18', value: 13 }, { label: '17', value: 8 }] },
    ],
  } as never,
}

// Single ring, but children still surface as version sub-labels in the legend
// (`nested={false}` — the mode the OS donut uses, since most desktop OS versions
// are frozen in the UA and a second ring just mirrors the first).
export const SingleRingOs: Story<typeof Component> = {
  props: {
    nested: false,
    center_value: '461',
    center_label: 'sessions',
    data: [
      { label: 'Windows', value: 209, color: '#7c3aed', children: [{ label: '10/11', value: 209 }] },
      { label: 'Linux', value: 126, color: '#64748b', children: [{ label: 'unknown', value: 126 }] },
      { label: 'macOS', value: 53, color: '#10b981', children: [{ label: '10.15', value: 53 }] },
      { label: 'Android', value: 45, color: '#06b6d4', children: [{ label: '14', value: 30 }, { label: '13', value: 15 }] },
      { label: 'iOS', value: 16, color: '#f59e0b', children: [{ label: '18', value: 10 }, { label: '17', value: 6 }] },
      { label: 'ChromeOS', value: 12, color: '#ec4899', children: [{ label: 'unknown', value: 12 }] },
    ],
  } as never,
}

// Single ring (no children) = browser families.
export const SingleRingBrowsers: Story<typeof Component> = {
  props: {
    data: [
      { label: 'Chrome', value: 110, color: '#7c3aed' },
      { label: 'Safari', value: 41, color: '#06b6d4' },
      { label: 'Edge', value: 15, color: '#10b981' },
      { label: 'Firefox', value: 8, color: '#f59e0b' },
      { label: 'Samsung Internet', value: 3, color: '#ec4899' },
    ],
  } as never,
}
