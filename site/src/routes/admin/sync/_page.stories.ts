import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 900, height: 1300 }],
}

const auth_user = {
  user: { id: 'admin-1', email: 'jwrunner7@gmail.com', name: 'Jacob Bowdoin', is_admin: true, admin_level: 3 },
  token: 'fake',
  logout: () => {},
}

const log_entries = [
  { timestamp: new Date('2026-05-29T15:00:00Z'), level: 'info', phase: 'sync', message: 'Starting sync' },
  { timestamp: new Date('2026-05-29T15:00:00.088Z'), level: 'info', phase: 'pull', message: 'Server responded in 88ms' },
  { timestamp: new Date('2026-05-29T15:00:00.100Z'), level: 'info', phase: 'pull', table: 'users', message: 'Downloaded', row_count: 4 },
  { timestamp: new Date('2026-05-29T15:00:00.144Z'), level: 'success', phase: 'sync', message: 'Sync complete in 0.6s — 0↑ 4↓' },
]

const base_sync = {
  is_syncing: false,
  blocked_by_client_behind: false,
  last_error: null as string | null,
  total_dirty: 0,
  watermark: 48213,
  last_sync_result: {
    success: true,
    items_uploaded: 0,
    items_downloaded: 4,
    deletes_pushed: 0,
    deletes_pulled: 1,
    duration_ms: 612,
    error: null,
    last_sync_time: '2026-05-29T14:55:01.234Z',
  },
  log_entries,
  history: {
    reports: [
      {
        started_at: '2026-05-29T14:55:00.000Z',
        finished_at: '2026-05-29T14:55:00.600Z',
        success: true,
        summary: '0↑ 4↓ 1🗑',
        duration_ms: 612,
        items_uploaded: 0,
        items_downloaded: 4,
        deletes_pushed: 0,
        deletes_pulled: 1,
        error: null,
        entries: log_entries,
      },
    ],
    remove: () => {},
    clear: () => {},
  },
  sync: () => Promise.resolve(),
}

export const Idle: PageStory<typeof Component> = {
  props: { auth_user, db: null, sync: base_sync } as never,
}

export const Syncing: PageStory<typeof Component> = {
  props: { auth_user, db: null, sync: { ...base_sync, is_syncing: true } } as never,
}

export const WithError: PageStory<typeof Component> = {
  props: {
    auth_user,
    db: null,
    sync: {
      ...base_sync,
      last_error: 'fetch failed: Network unreachable',
      last_sync_result: { ...base_sync.last_sync_result, success: false, error: 'fetch failed: Network unreachable' },
    },
  } as never,
}

export const Empty: PageStory<typeof Component> = {
  props: {
    auth_user,
    db: null,
    sync: { ...base_sync, last_sync_result: null, log_entries: [], history: { ...base_sync.history, reports: [] } },
  } as never,
}
