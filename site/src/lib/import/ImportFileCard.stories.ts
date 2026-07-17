import type { Story, StoryMeta } from 'svelte-look'
import type Component from './ImportFileCard.svelte'
import type { SourceFileRow } from '$lib/db/server/source-files'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  page_data: { t: mock_t },
  viewports: [{ width: 760, height: 420 }],
}

function file(overrides: Partial<SourceFileRow> = {}): SourceFileRow {
  return {
    id: 'f1',
    dictionary_id: 'demo',
    source_id: null,
    filename: 'kalanga-dictionary-scan.pdf',
    mimetype: 'application/pdf',
    size_bytes: 48_733_211,
    storage_key: 'import/demo/f1',
    import_instructions: null,
    source_note: null,
    upload_confirmed_at: '2026-07-17T01:00:00Z',
    import_requested_at: null,
    import_thread_id: null,
    uploaded_by_user_id: 'u1',
    created_at: '2026-07-17T01:00:00Z',
    updated_at: '2026-07-17T01:00:00Z',
    ...overrides,
  }
}

const base = { dictionary_id: 'demo', on_changed: () => {} }

/** Fresh upload — empty required instructions + optional source boxes. */
export const NeedsInstructions: Story<typeof Component> = {
  props: { ...base, file: file() },
}

/** Filled out, ready to request. */
export const ReadyToRequest: Story<typeof Component> = {
  props: { ...base, file: file({ import_instructions: 'Import all entries with their senses and example sentences. Glosses are in English and Setswana.', source_note: 'Wentzel, P. J. (1983). The Relationship between Venda and Western Shona.' }) },
}

/** Already part of a requested import — read-only. */
export const Requested: Story<typeof Component> = {
  props: { ...base, file: file({ import_instructions: 'Import all entries. Skip the grammar sketch at the front.', source_note: 'Smith 1979 print dictionary', import_requested_at: '2026-07-17T02:00:00Z', import_thread_id: 't1' }) },
}
