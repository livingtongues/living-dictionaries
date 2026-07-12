import type { Writable } from 'svelte/store'
import type { EntryData, Tables } from '$lib/types'

/**
 * The one event vocabulary crossing the entries-worker → UI-store boundary
 * (replaces 9 positional comlink-proxied setter callbacks). The worker emits
 * patches; `create_patch_reducer` owns every main-thread state transition.
 *
 * NOTE this whole boundary is slated for retirement by `.issues/in-worker-orama.md`
 * (read-model moves into the dict leader worker; tabs get paged RPCs + a
 * `search_index_updated` broadcast). Until then this union is the seam.
 */
export type WorkerPatch
  = | { type: 'entries_set', entries: Record<string, EntryData> } // bulk init — replaces the whole record
    | { type: 'entries_upsert', entries: Record<string, EntryData> } // incremental — merges
    | { type: 'entry_delete', entry_id: string }
    | { type: 'speakers', rows: Tables<'speakers'>[] }
    | { type: 'tags', rows: Tables<'tags'>[] }
    | { type: 'dialects', rows: Tables<'dialects'>[] }
    | { type: 'sources', rows: Tables<'sources'>[] }
    | { type: 'loading', value: boolean }
    | { type: 'index_updated' } // pulses the store true→false so open queries re-run

export interface PatchStores {
  entries_data: Writable<Record<string, EntryData>>
  speakers: Writable<Tables<'speakers'>[]>
  tags: Writable<Tables<'tags'>[]>
  dialects: Writable<Tables<'dialects'>[]>
  sources: Writable<Tables<'sources'>[]>
  loading: Writable<boolean>
  search_index_updated: Writable<boolean>
}

export function create_patch_reducer(stores: PatchStores) {
  const { entries_data, speakers, tags, dialects, sources, loading, search_index_updated } = stores
  return function apply_patch(patch: WorkerPatch): void {
    switch (patch.type) {
      case 'entries_set':
        entries_data.set(patch.entries)
        break
      case 'entries_upsert':
        entries_data.update(current => ({ ...current, ...patch.entries }))
        break
      case 'entry_delete':
        entries_data.update((current) => {
          const next = { ...current }
          delete next[patch.entry_id]
          return next
        })
        break
      case 'speakers':
        speakers.set(patch.rows)
        break
      case 'tags':
        tags.set(patch.rows)
        break
      case 'dialects':
        dialects.set(patch.rows)
        break
      case 'sources':
        sources.set(patch.rows)
        break
      case 'loading':
        loading.set(patch.value)
        break
      case 'index_updated':
        // pulse: consumers watch for the true edge; reset immediately so the
        // next update produces a fresh edge
        search_index_updated.set(true)
        search_index_updated.set(false)
        break
      default: {
        const unhandled: never = patch
        void unhandled
      }
    }
  }
}
