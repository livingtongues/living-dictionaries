import type { Story, StoryMeta } from 'svelte-look'
import type Component from './DictBootProgressDemo.svelte'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 640, height: 130 }],
  csr: true,
  page_data: { t: mock_t },
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

// THE GIVE-UP STATE (2026-08-03). Before this existed a failed boot rendered as an
// indeterminate bar that never ended — one visitor watched it for 9.5 minutes.
export const Failed_Viewer: Story<typeof Component> = {
  viewports: [{ width: 640, height: 340 }],
  props: { failed: true, has_editor_role: false },
}

// An editor is ASKED before their local copy is discarded: an unopenable file
// cannot be proven free of un-pushed writes.
export const Failed_Editor: Story<typeof Component> = {
  viewports: [{ width: 640, height: 340 }],
  props: { failed: true, has_editor_role: true },
}

// Narrow phone width — the failure card is where a real visitor meets this.
export const Failed_Viewer_Mobile: Story<typeof Component> = {
  viewports: [{ width: 390, height: 380 }],
  props: { failed: true, has_editor_role: false },
}
