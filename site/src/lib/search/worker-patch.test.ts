import { get, writable } from 'svelte/store'
import type { EntryData, Tables } from '$lib/types'
import { create_patch_reducer } from './worker-patch'

function make_stores() {
  return {
    entries_data: writable<Record<string, EntryData>>({}),
    speakers: writable<Tables<'speakers'>[]>([]),
    tags: writable<Tables<'tags'>[]>([]),
    dialects: writable<Tables<'dialects'>[]>([]),
    sources: writable<Tables<'sources'>[]>([]),
    loading: writable(true),
    search_index_updated: writable(false),
  }
}

const entry = (id: string) => ({ id } as EntryData)

describe(create_patch_reducer, () => {
  test('entries_set replaces the whole record; entries_upsert merges into it', () => {
    const stores = make_stores()
    const apply_patch = create_patch_reducer(stores)

    apply_patch({ type: 'entries_set', entries: { a: entry('a'), b: entry('b') } })
    expect(Object.keys(get(stores.entries_data))).toEqual(['a', 'b'])

    apply_patch({ type: 'entries_upsert', entries: { b: { ...entry('b'), phonetic: 'updated' } as EntryData, c: entry('c') } })
    const merged = get(stores.entries_data)
    expect(Object.keys(merged)).toEqual(['a', 'b', 'c'])
    expect((merged.b as { phonetic?: string }).phonetic).toBe('updated')

    // a later entries_set replaces again (per-navigation bulk rebuild)
    apply_patch({ type: 'entries_set', entries: { z: entry('z') } })
    expect(Object.keys(get(stores.entries_data))).toEqual(['z'])
  })

  test('entry_delete removes the entry; upsert after delete makes it reappear (documented behavior)', () => {
    const stores = make_stores()
    const apply_patch = create_patch_reducer(stores)

    apply_patch({ type: 'entries_set', entries: { a: entry('a'), b: entry('b') } })
    apply_patch({ type: 'entry_delete', entry_id: 'a' })
    expect(Object.keys(get(stores.entries_data))).toEqual(['b'])

    // The reducer is last-write-wins with no tombstones: an upsert arriving
    // after a delete for the same id resurrects it. The worker is responsible
    // for ordering (deletes are processed after upserts within one apply_rows).
    apply_patch({ type: 'entries_upsert', entries: { a: entry('a') } })
    expect(Object.keys(get(stores.entries_data)).sort()).toEqual(['a', 'b'])
  })

  test('side-table patches replace their store contents', () => {
    const stores = make_stores()
    const apply_patch = create_patch_reducer(stores)

    const speaker = { id: 'sp1' } as Tables<'speakers'>
    const tag = { id: 't1' } as Tables<'tags'>
    const dialect = { id: 'd1' } as Tables<'dialects'>
    const source = { id: 'src1' } as Tables<'sources'>

    apply_patch({ type: 'speakers', rows: [speaker] })
    apply_patch({ type: 'tags', rows: [tag] })
    apply_patch({ type: 'dialects', rows: [dialect] })
    apply_patch({ type: 'sources', rows: [source] })

    expect(get(stores.speakers)).toEqual([speaker])
    expect(get(stores.tags)).toEqual([tag])
    expect(get(stores.dialects)).toEqual([dialect])
    expect(get(stores.sources)).toEqual([source])

    apply_patch({ type: 'speakers', rows: [] })
    expect(get(stores.speakers)).toEqual([])
  })

  test('loading sets the given value', () => {
    const stores = make_stores()
    const apply_patch = create_patch_reducer(stores)
    expect(get(stores.loading)).toBeTruthy()
    apply_patch({ type: 'loading', value: false })
    expect(get(stores.loading)).toBeFalsy()
  })

  test('index_updated pulses true then false so every patch produces a fresh edge', () => {
    const stores = make_stores()
    const apply_patch = create_patch_reducer(stores)
    const seen: boolean[] = []
    const unsubscribe = stores.search_index_updated.subscribe(value => seen.push(value))

    apply_patch({ type: 'index_updated' })
    apply_patch({ type: 'index_updated' })

    expect(seen).toEqual([false, true, false, true, false])
    expect(get(stores.search_index_updated)).toBeFalsy()
    unsubscribe()
  })
})
