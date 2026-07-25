import type { ImportFileForClient, ImportRequestSummary } from './types'

/**
 * What the manager sees on their Import page. Since import conversations became
 * the dictionary's permanent record (`.issues/import-conversations.md`), NOTHING
 * is ever dropped from this list: a request and its resources stay visible under
 * "Past imports" forever, long after we resolve it. Resources filed under a
 * source WITHOUT ever being requested (an agent's own upload) belong on the
 * Sources page instead, so those are the only ones excluded.
 */
export function listed_import_files({ files }: { files: ImportFileForClient[] }): ImportFileForClient[] {
  return files.filter(file => !file.source_id || !!file.import_thread_id)
}

/** Requested and we've started — the resources are frozen and the work is underway. */
export function import_in_progress(request: Pick<ImportRequestSummary, 'started_at' | 'resolved_at'>): boolean {
  return !!request.started_at && !request.resolved_at
}

export function completed_source_files_by_source(files: ImportFileForClient[]): Record<string, ImportFileForClient[]> {
  const grouped: Record<string, ImportFileForClient[]> = {}
  for (const file of files) {
    if (!file.upload_confirmed_at || !file.source_id)
      continue
    grouped[file.source_id] ??= []
    grouped[file.source_id].push(file)
  }
  return grouped
}

if (import.meta.vitest) {
  const file = (overrides: Partial<ImportFileForClient> = {}): ImportFileForClient => ({
    id: 'file-1',
    dictionary_id: 'dict-1',
    source_id: null,
    filename: 'words.txt',
    mimetype: 'text/plain',
    size_bytes: 10,
    storage_key: 'import/dict-1/file-1',
    import_instructions: 'Import everything.',
    source_note: null,
    upload_confirmed_at: '2026-07-24T00:00:00Z',
    import_requested_at: null,
    import_thread_id: null,
    uploaded_by_user_id: 'user-1',
    created_at: '2026-07-24T00:00:00Z',
    updated_at: '2026-07-24T00:00:00Z',
    can_manage_requested: true,
    is_frozen: false,
    ...overrides,
  })

  describe(listed_import_files, () => {
    test('keeps unlinked resources and every requested one, drops agent uploads filed straight to a source', () => {
      expect(listed_import_files({
        files: [
          file(),
          file({ id: 'requested', import_requested_at: '2026-07-24T01:00:00Z', import_thread_id: 'thread-1' }),
          file({ id: 'agent-upload', source_id: 'source-1' }),
        ],
      }).map(row => row.id)).toEqual(['file-1', 'requested'])
    })

    test('a finished import stays listed forever — resolving no longer hides the record', () => {
      const files = [file({ id: 'done', source_id: 'source-1', import_requested_at: '2026-07-24T01:00:00Z', import_thread_id: 'thread-1', is_frozen: true })]
      expect(listed_import_files({ files }).map(row => row.id)).toEqual(['done'])
    })
  })

  describe(import_in_progress, () => {
    test('is true only between starting and resolving', () => {
      expect(import_in_progress({ started_at: null, resolved_at: null })).toBe(false)
      expect(import_in_progress({ started_at: '2026-07-25T00:00:00Z', resolved_at: null })).toBe(true)
      expect(import_in_progress({ started_at: '2026-07-25T00:00:00Z', resolved_at: '2026-07-26T00:00:00Z' })).toBe(false)
    })
  })

  describe(completed_source_files_by_source, () => {
    test('groups only confirmed linked files beneath their permanent source', () => {
      expect(completed_source_files_by_source([
        file({ id: 'first', source_id: 'source-1' }),
        file({ id: 'second', source_id: 'source-1' }),
        file({ id: 'other', source_id: 'source-2' }),
        file({ id: 'pending', source_id: 'source-1', upload_confirmed_at: null }),
        file({ id: 'active' }),
      ])).toEqual({
        'source-1': [expect.objectContaining({ id: 'first' }), expect.objectContaining({ id: 'second' })],
        'source-2': [expect.objectContaining({ id: 'other' })],
      })
    })
  })
}
