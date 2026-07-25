import type { ImportFileForClient, ImportRequestSummary } from './types'

/**
 * What the manager still sees on their Import page. A resource is filed under
 * its permanent source at the START of an import job (that's provenance, and it
 * makes the source downloadable right away), so `source_id` is NOT the "job
 * done" marker — the request thread being resolved is. Requested resources
 * therefore stay listed, showing an in-progress pill, until we close the thread.
 */
export function active_import_files({ files, requests }: {
  files: ImportFileForClient[]
  requests: ImportRequestSummary[]
}): ImportFileForClient[] {
  const open_threads = new Set(requests.filter(request => !request.resolved_at).map(request => request.thread_id))
  return files.filter(file => !file.source_id || (!!file.import_thread_id && open_threads.has(file.import_thread_id)))
}

export function import_in_progress(file: ImportFileForClient): boolean {
  return !!file.import_requested_at && !!file.source_id
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

  const request = (overrides: Partial<ImportRequestSummary> = {}): ImportRequestSummary => ({
    thread_id: 'thread-1',
    request_note: null,
    requested_at: '2026-07-24T01:00:00Z',
    can_manage: true,
    resolved_at: null,
    ...overrides,
  })

  describe(active_import_files, () => {
    test('keeps unlinked resources and hides files linked outside an open request', () => {
      expect(active_import_files({
        files: [
          file(),
          file({ id: 'requested', import_requested_at: '2026-07-24T01:00:00Z', import_thread_id: 'thread-1' }),
          file({ id: 'archived', source_id: 'source-1' }),
        ],
        requests: [request()],
      }).map(row => row.id)).toEqual(['file-1', 'requested'])
    })

    test('keeps a source-linked resource visible while its request thread is open, drops it once resolved', () => {
      const files = [file({ id: 'in-progress', source_id: 'source-1', import_requested_at: '2026-07-24T01:00:00Z', import_thread_id: 'thread-1' })]
      expect(active_import_files({ files, requests: [request()] }).map(row => row.id)).toEqual(['in-progress'])
      expect(active_import_files({ files, requests: [request({ resolved_at: '2026-07-25T00:00:00Z' })] })).toEqual([])
    })
  })

  describe(import_in_progress, () => {
    test('is true only once a requested resource has been filed under its source', () => {
      expect(import_in_progress(file({ import_requested_at: '2026-07-24T01:00:00Z', source_id: 'source-1' }))).toBe(true)
      expect(import_in_progress(file({ import_requested_at: '2026-07-24T01:00:00Z' }))).toBe(false)
      expect(import_in_progress(file({ source_id: 'source-1' }))).toBe(false)
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
