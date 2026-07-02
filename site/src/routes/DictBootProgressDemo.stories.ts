import type { Story, StoryMeta } from 'svelte-look'
import type Component from './DictBootProgressDemo.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 640, height: 130 }],
  csr: true,
}

// Editor path (VPS `x-db-bytes`) — determinate %: mid-download of a big dict.
export const Downloading_Determinate: Story<typeof Component> = {
  props: { stage: 'snapshot_fetch', received_bytes: 3_400_000, total_bytes: 8_100_000 },
}

// Near-complete determinate download.
export const Downloading_Almost_Done: Story<typeof Component> = {
  props: { stage: 'snapshot_fetch', received_bytes: 7_700_000, total_bytes: 8_100_000 },
}

// Viewer/R2 path — no advertised total → indeterminate bar + MB counter.
export const Downloading_Indeterminate: Story<typeof Component> = {
  props: { stage: 'snapshot_fetch', received_bytes: 2_100_000, total_bytes: null },
}

// Post-download phase: opening the OPFS DB.
export const Opening: Story<typeof Component> = {
  props: { stage: 'opfs_open', received_bytes: 8_100_000, total_bytes: 8_100_000 },
}

// Post-download phase: running migrations.
export const Preparing: Story<typeof Component> = {
  props: { stage: 'migrate', received_bytes: 8_100_000, total_bytes: 8_100_000 },
}
