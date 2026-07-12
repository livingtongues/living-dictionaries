import { proxy } from 'comlink'
import type { InitEntryWorkerOptions } from './entry.worker'
import type { WorkerPatch } from './worker-patch'
import type { SearchEntriesOptions } from './search-entries'
import type { SearchCorpusOptions } from './search-corpus'

export async function search_entries(options: SearchEntriesOptions) {
  const { api } = await import('./expose-entry-worker')
  return api.search_entries(options)
}

export async function search_sentences(options: SearchCorpusOptions & { dictionary_id: string }) {
  const { api } = await import('./expose-entry-worker')
  return api.search_sentences(options)
}

export async function search_texts(options: SearchCorpusOptions & { dictionary_id: string }) {
  const { api } = await import('./expose-entry-worker')
  return api.search_texts(options)
}

export async function apply_rows(
  changes: Record<string, Record<string, unknown>[]>,
  deletes?: { table_name: string, id: string }[],
) {
  const { api } = await import('./expose-entry-worker')
  return api.apply_rows(changes, deletes)
}

export async function init_entries(options: InitEntryWorkerOptions) {
  const { dictionary_id, can_edit, admin, bundle, on_patch } = options
  const { api } = await import('./expose-entry-worker')
  return api.init_entries(
    { dictionary_id, can_edit, admin },
    bundle,
    proxy(on_patch as (patch: WorkerPatch) => Promise<void>),
  )
}
