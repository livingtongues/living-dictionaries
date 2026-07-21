import type { Story, StoryMeta } from 'svelte-look'
import type Component from './ImportRequestGroup.svelte'
import type { ImportFileForClient } from '$lib/import/types'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  page_data: { t: mock_t },
  viewports: [{ width: 760, height: 540 }],
}

const file: ImportFileForClient = {
  id: 'f1',
  dictionary_id: 'demo',
  source_id: null,
  filename: 'kalanga-dictionary-scan.pdf',
  mimetype: 'application/pdf',
  size_bytes: 48_733_211,
  storage_key: 'import/demo/f1',
  import_instructions: 'Import all entries. Skip the grammar sketch at the front.',
  source_note: 'Smith 1979 print dictionary',
  upload_confirmed_at: '2026-07-17T01:00:00Z',
  import_requested_at: '2026-07-17T02:00:00Z',
  import_thread_id: 't1',
  uploaded_by_user_id: 'u1',
  created_at: '2026-07-17T01:00:00Z',
  updated_at: '2026-07-17T01:00:00Z',
  can_manage_requested: true,
}

export const RequestedGroup: Story<typeof Component> = {
  props: {
    dictionary_id: 'demo',
    on_changed: () => {},
    request: {
      thread_id: 't1',
      request_note: 'The handwritten notes in the margins are important; include them where practical.',
      requested_at: '2026-07-17T02:00:00Z',
      can_manage: true,
    },
    files: [file],
  },
}

export const EditingRequestNote: Story<typeof Component> = {
  csr: true,
  props: RequestedGroup.props,
  interactions: async (page) => {
    await page.click('.edit-note')
  },
}
