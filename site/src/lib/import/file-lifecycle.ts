import type { ImportFileForClient } from './types'

export function active_import_files(files: ImportFileForClient[]): ImportFileForClient[] {
  return files.filter(file => !file.source_id)
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
    ...overrides,
  })

  describe(active_import_files, () => {
    test('keeps unlinked resources and removes completed source files', () => {
      expect(active_import_files([
        file(),
        file({ id: 'requested', import_requested_at: '2026-07-24T01:00:00Z' }),
        file({ id: 'completed', source_id: 'source-1' }),
      ]).map(row => row.id)).toEqual(['file-1', 'requested'])
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
