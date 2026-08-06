import type { EntryData } from '$lib/types'
import type { DictLiveDb } from '$lib/db/dict-client/dict-live-db.svelte'
import { apply_bulk_review, apply_bulk_source } from './bulk-actions'
import { create_guarded_writes } from '$lib/db/dict-client/guarded-writes'
import { log_warning } from '$lib/debug/remote-log'

vi.mock('$lib/debug/remote-log', async (importOriginal) => {
  const original = await importOriginal<typeof import('$lib/debug/remote-log')>()
  return { ...original, log_warning: vi.fn(), track: vi.fn() }
})

function make_entries(ids: string[]): Record<string, EntryData> {
  return Object.fromEntries(ids.map(id => [id, {
    id,
    main: { lexeme: { default: id } },
    senses: [],
    updated_at: '2026-08-05T00:00:00.000Z',
  } as unknown as EntryData]))
}

/** The facade over a db whose `entries.update` fails for the named ids. */
function make_writes({ failing_ids = [] as string[] } = {}) {
  const updated: { id: string, row: Record<string, unknown> }[] = []
  const on_error = vi.fn()
  const dict_db = {
    entries: {
      update: (row: { id: string }) => {
        if (failing_ids.includes(row.id))
          return Promise.reject(new Error(`refused ${row.id}`))
        updated.push({ id: row.id, row })
        return Promise.resolve()
      },
    },
  } as unknown as DictLiveDb
  const writes = create_guarded_writes({
    dict_db,
    connection: null,
    dictionary: { id: 'dict-1', url: 'dict-1' },
    get_user_id: () => 'editor-1',
    is_loading: () => false,
    on_error,
  })
  return { writes, on_error, updated }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe(apply_bulk_source, () => {
  test('paints each row only after its write lands, and skips one that already has the slug', async () => {
    const entries = make_entries(['e1', 'e2'])
    entries.e2.main.sources = ['smith-2001']
    const { writes, updated, on_error } = make_writes()

    const outcome = await apply_bulk_source({ writes, entries, entry_ids: ['e1', 'e2'], slug: 'smith-2001' })

    expect(outcome).toEqual({ written: 1, refused: 0, skipped: 1 })
    expect(updated).toEqual([{ id: 'e1', row: { id: 'e1', sources: ['smith-2001'] } }])
    expect(entries.e1.main.sources).toEqual(['smith-2001'])
    expect(on_error).not.toHaveBeenCalled()
  })

  test('a refused write leaves the row untouched, surfaces an error, and the loop continues', async () => {
    const entries = make_entries(['e1', 'e2', 'e3'])
    const { writes, on_error } = make_writes({ failing_ids: ['e2'] })

    const outcome = await apply_bulk_source({ writes, entries, entry_ids: ['e1', 'e2', 'e3'], slug: 'smith-2001' })

    expect(outcome).toEqual({ written: 2, refused: 1, skipped: 0 })
    // the refused entry keeps its old (absent) value — no phantom edit on screen
    expect(entries.e2.main.sources).toBe(undefined)
    expect(entries.e1.main.sources).toEqual(['smith-2001'])
    expect(entries.e3.main.sources).toEqual(['smith-2001'])
    expect(on_error).toHaveBeenCalledExactlyOnceWith(new Error('refused e2'))
  })

  test('a missing database refuses EVERY entry with `write_blocked` telemetry instead of resolving as success', async () => {
    const entries = make_entries(['e1', 'e2'])
    const on_error = vi.fn()
    const writes = create_guarded_writes({
      dict_db: null,
      connection: null,
      dictionary: { id: 'dict-1', url: 'dict-1' },
      get_user_id: () => 'editor-1',
      is_loading: () => false,
      on_error,
    })

    const outcome = await apply_bulk_source({ writes, entries, entry_ids: ['e1', 'e2'], slug: 'smith-2001' })

    expect(outcome).toEqual({ written: 0, refused: 2, skipped: 0 })
    expect(entries.e1.main.sources).toBe(undefined)
    expect(entries.e2.main.sources).toBe(undefined)
    expect(on_error).toHaveBeenCalledTimes(2)
    expect(log_warning).toHaveBeenCalledWith({
      message: 'write_blocked',
      context: { reason: 'no_dict_db', dictionary_id: 'dict-1', signed_in: true },
    })
  })
})

describe(apply_bulk_review, () => {
  test('sets the flag on every entry that accepted the write', async () => {
    const entries = make_entries(['e1', 'e2'])
    const { writes, updated } = make_writes()

    const outcome = await apply_bulk_review({ writes, entries, entry_ids: ['e1', 'e2'], review: { category: 'headword_in_gloss', note: '' } })

    expect(outcome).toEqual({ written: 2, refused: 0, skipped: 0 })
    expect(updated).toHaveLength(2)
    expect(entries.e1.main.review).toEqual({ category: 'headword_in_gloss', note: '' })
  })

  test('a refused write leaves the flag alone and the loop finishes the selection', async () => {
    const entries = make_entries(['e1', 'e2', 'e3'])
    const { writes, on_error } = make_writes({ failing_ids: ['e1'] })

    const outcome = await apply_bulk_review({ writes, entries, entry_ids: ['e1', 'e2', 'e3'], review: null })

    expect(outcome).toEqual({ written: 2, refused: 1, skipped: 0 })
    expect(entries.e1.main.review).toBe(undefined)
    expect(entries.e3.main.review).toBe(null)
    expect(on_error).toHaveBeenCalledExactlyOnceWith(new Error('refused e1'))
  })
})
