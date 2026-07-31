import type { Story, StoryMeta } from 'svelte-look'
import type Component from '$lib/chat/chat-upload-progress.svelte'
import type { UploadProgress } from '$lib/chat/chat-upload'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 520, height: 320 }],
}

function entry(overrides: Partial<UploadProgress> = {}): UploadProgress {
  return {
    index: 0,
    filename: '2026-07-31-combined.mp4',
    mimetype: 'video/mp4',
    bytes_sent: 0,
    bytes_total: 172_000_000,
    fraction: 0,
    bytes_per_second: null,
    seconds_remaining: null,
    status: 'waiting',
    ...overrides,
  }
}

const noop = () => {}

export const SingleLargeVideoMidUpload: Story<typeof Component> = {
  props: {
    entries: [entry({ bytes_sent: 61_000_000, fraction: 0.355, bytes_per_second: 3_100_000, seconds_remaining: 36, status: 'uploading' })],
    on_cancel: noop,
  },
}

export const JustStarted: Story<typeof Component> = {
  props: {
    entries: [entry({ bytes_sent: 240_000, fraction: 0.0014, status: 'uploading' })],
    on_cancel: noop,
  },
}

export const SlowUploadLongEta: Story<typeof Component> = {
  props: {
    entries: [entry({ bytes_sent: 8_000_000, fraction: 0.046, bytes_per_second: 420_000, seconds_remaining: 390, status: 'uploading' })],
    on_cancel: noop,
  },
}

export const MixedBatch: Story<typeof Component> = {
  props: {
    entries: [
      entry({ index: 0, filename: 'screenshare.mp4', bytes_total: 172_000_000, bytes_sent: 172_000_000, fraction: 1, status: 'done' }),
      entry({ index: 1, filename: 'interview-take-2.m4a', mimetype: 'audio/mp4', bytes_total: 41_000_000, bytes_sent: 12_400_000, fraction: 0.3, bytes_per_second: 2_400_000, seconds_remaining: 12, status: 'uploading' }),
      entry({ index: 2, filename: 'field-notes.pdf', mimetype: 'application/pdf', bytes_total: 248_000, bytes_sent: 0, fraction: 0, status: 'waiting' }),
      entry({ index: 3, filename: 'tree.jpg', mimetype: 'image/jpeg', bytes_total: 2_100_000, bytes_sent: 0, fraction: 0, status: 'waiting' }),
    ],
    on_cancel: noop,
  },
}

export const Failed: Story<typeof Component> = {
  props: {
    entries: [entry({ bytes_sent: 24_000_000, fraction: 0.14, status: 'error', error_message: 'Network error during upload' })],
    on_cancel: noop,
  },
}

export const AllDone: Story<typeof Component> = {
  props: {
    entries: [
      entry({ index: 0, filename: 'screenshare.mp4', bytes_sent: 172_000_000, fraction: 1, status: 'done' }),
      entry({ index: 1, filename: 'tree.jpg', mimetype: 'image/jpeg', bytes_total: 2_100_000, bytes_sent: 2_100_000, fraction: 1, status: 'done' }),
    ],
  },
}
