import type { Story, StoryMeta } from 'svelte-look'
import type Component from './SideMenu.svelte'
import type { DictSyncStatus } from '$lib/db/dict-client/dict-sync-status.svelte'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 224, height: 560 }],
  page_data: { t: mock_t, url: new URL('http://localhost/demo/entries') },
}

const dictionary = {
  id: 'demo',
  url: 'demo',
  name: 'Nahuatl',
  public: true,
} as never

function mock_sync_status(state: {
  online?: boolean
  busy?: boolean
  last_error?: string | null
  last_sync_at?: string | null
}): DictSyncStatus {
  return {
    online: true,
    busy: false,
    last_error: null,
    last_sync_at: null,
    ...state,
    sync_now: async () => {},
  } as unknown as DictSyncStatus
}

const shared_props = {
  dictionary,
  entry_count: 1234,
  on_close: () => {},
  loading: false,
  can_edit: true,
  dict_sync_status: mock_sync_status({ last_sync_at: new Date().toISOString() }),
}

export const Manager: Story<typeof Component> = {
  props: { ...shared_props, is_manager: true, is_editor_or_above: true },
}

export const Editor: Story<typeof Component> = {
  props: { ...shared_props, is_manager: false, is_editor_or_above: true },
}

export const Contributor: Story<typeof Component> = {
  props: { ...shared_props, is_manager: false, is_editor_or_above: false },
}

export const Viewer: Story<typeof Component> = {
  props: { ...shared_props, is_manager: false, is_editor_or_above: false, can_edit: false, dict_sync_status: null },
}

export const SyncStatusSyncing: Story<typeof Component> = {
  props: { ...shared_props, is_manager: true, is_editor_or_above: true, dict_sync_status: mock_sync_status({ busy: true }) },
}

export const SyncStatusError: Story<typeof Component> = {
  props: { ...shared_props, is_manager: true, is_editor_or_above: true, dict_sync_status: mock_sync_status({ last_error: 'HTTP 500', last_sync_at: new Date().toISOString() }) },
}

export const SyncStatusOffline: Story<typeof Component> = {
  props: { ...shared_props, is_manager: true, is_editor_or_above: true, dict_sync_status: mock_sync_status({ online: false }) },
}

export const SyncStatusIdle: Story<typeof Component> = {
  props: { ...shared_props, is_manager: true, is_editor_or_above: true, dict_sync_status: mock_sync_status({}) },
}
