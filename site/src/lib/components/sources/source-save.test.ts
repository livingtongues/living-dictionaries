import { describe, expect, test } from 'vitest'
import { classify_source_save_failure, commit_source, find_existing_source } from './source-save'

const sources = [
  { id: 'source-1', slug: 'smith-2020', abbreviation: 'Smith 2020' },
  { id: 'source-2', slug: 'jones-1999', abbreviation: 'Jones 1999' },
] as any[]

describe(find_existing_source, () => {
  test('finds a source with the same normalized slug', () => {
    expect(find_existing_source({ sources, slug: 'smith-2020' })?.id).toBe('source-1')
  })

  test('does not treat the source being edited as a duplicate', () => {
    expect(find_existing_source({ sources, slug: 'smith-2020', source_id: 'source-1' })).toBe(undefined)
  })
})

describe(classify_source_save_failure, () => {
  test('classifies the SQLite slug constraint without exposing source content', () => {
    expect(classify_source_save_failure(new Error('UNIQUE constraint failed: sources.slug'))).toBe('duplicate_slug')
  })

  test('classifies other failures generically', () => {
    expect(classify_source_save_failure(new Error('OPFS unavailable'))).toBe('write_failed')
  })
})

describe(commit_source, () => {
  test('reports the saved slug and closes only after the write succeeds', async () => {
    const calls: string[] = []
    const result = await commit_source({
      write: () => { calls.push('write'); return Promise.resolve() },
      slug: 'smith-2020',
      on_saved: ({ slug }) => { calls.push(`saved:${slug}`) },
      on_close: () => { calls.push('close') },
    })

    expect(result).toEqual({ success: true })
    expect(calls).toEqual(['write', 'saved:smith-2020', 'close'])
  })

  test('keeps the editor open and classifies a duplicate write race', async () => {
    const on_saved = vi.fn()
    const on_close = vi.fn()
    const result = await commit_source({
      write: () => Promise.reject(new Error('UNIQUE constraint failed: sources.slug')),
      slug: 'smith-2020',
      on_saved,
      on_close,
    })

    expect(result).toEqual({ success: false, failure_kind: 'duplicate_slug' })
    expect(on_saved).not.toHaveBeenCalled()
    expect(on_close).not.toHaveBeenCalled()
  })
})
