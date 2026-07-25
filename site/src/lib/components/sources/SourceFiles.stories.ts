import type { Story, StoryMeta } from 'svelte-look'
import type Component from './SourceFiles.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 680, height: 300 }, { width: 390, height: 360 }],
}

export const CorrectedSource: Story<typeof Component> = {
  props: {
    dictionary_id: 'enxet',
    files: [
      {
        id: 'file-1',
        dictionary_id: 'enxet',
        source_id: 'source-1',
        filename: 'Enxet-SFM-for-LD.txt',
        mimetype: 'text/plain',
        size_bytes: 1077435,
        storage_key: 'import/enxet/file-1',
        import_instructions: 'Use this corrected file.',
        source_note: 'Corrected revision received from Gundolf on July 23, 2026.',
        upload_confirmed_at: '2026-07-24T12:00:00Z',
        import_requested_at: '2026-07-23T12:00:00Z',
        import_thread_id: 'thread-1',
        uploaded_by_user_id: 'user-1',
        created_at: '2026-07-24T12:00:00Z',
        updated_at: '2026-07-24T12:00:00Z',
        can_manage_requested: true,
      },
      {
        id: 'file-2',
        dictionary_id: 'enxet',
        source_id: 'source-1',
        filename: 'original-field-notes-and-abbreviations.pdf',
        mimetype: 'application/pdf',
        size_bytes: 2841020,
        storage_key: 'import/enxet/file-2',
        import_instructions: null,
        source_note: null,
        upload_confirmed_at: '2026-07-20T12:00:00Z',
        import_requested_at: '2026-07-20T12:00:00Z',
        import_thread_id: 'thread-1',
        uploaded_by_user_id: 'user-1',
        created_at: '2026-07-20T12:00:00Z',
        updated_at: '2026-07-20T12:00:00Z',
        can_manage_requested: true,
      },
    ],
  },
}
