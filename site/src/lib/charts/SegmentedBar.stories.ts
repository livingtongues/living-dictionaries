import type { Story, StoryMeta } from 'svelte-look'
import type Component from './SegmentedBar.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 620, height: 140 }],
  csr: true,
}

export const Device: Story<typeof Component> = {
  props: {
    segments: [
      { label: 'Desktop', value: 103, color: '#7c3aed', icon: '🖥️' },
      { label: 'Mobile', value: 60, color: '#06b6d4', icon: '📱' },
      { label: 'Tablet', value: 14, color: '#f59e0b' },
    ],
  } as never,
}

// A dominant first segment + a thin one (its name collapses to %, and it gets a
// legend entry below since it was too thin to label inline).
export const LocalDbTiers: Story<typeof Component> = {
  props: {
    segments: [
      { label: 'opfs-worker', value: 168, color: '#10b981' },
      { label: 'idb-main', value: 6, color: '#f59e0b' },
    ],
  } as never,
}
