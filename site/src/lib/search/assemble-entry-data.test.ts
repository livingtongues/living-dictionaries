import { describe, expect, test } from 'vitest'
import { assemble_entry_data } from './assemble-entry-data'
import type { AssembleEntryDataInput } from './assemble-entry-data'
import type { Tables } from '$lib/types'

function base_input(overrides: Partial<AssembleEntryDataInput> = {}): AssembleEntryDataInput {
  const entry = {
    id: 'entry-1',
    dictionary_id: 'dict-1',
    lexeme: { default: 'jaʼ' },
    phonetic: 'xaʔ',
    notes: { default: 'a note' },
    coordinates: null,
    elicitation_id: 'el-1',
    dirty: 1,
    created_by_user_id: 'u1',
    created_at: '2024-01-01T00:00:00Z',
    updated_by_user_id: 'u1',
    updated_at: '2024-02-02T00:00:00Z',
  } as unknown as Tables<'entries'> & Record<string, unknown>

  return {
    entry,
    senses: [],
    sentences_by_sense: {},
    photos_by_sense: {},
    videos_by_sense: {},
    audios: [],
    tags: [],
    dialects: [],
    admin_level: 0,
    ...overrides,
  }
}

describe(assemble_entry_data, () => {
  test('strips bookkeeping columns into `main` and keeps id + updated_at at top level', () => {
    const result = assemble_entry_data(base_input())
    expect(result.id).toBe('entry-1')
    expect(result.updated_at).toBe('2024-02-02T00:00:00Z')
    expect(result.main).toEqual({
      lexeme: { default: 'jaʼ' },
      phonetic: 'xaʔ',
      notes: { default: 'a note' },
      coordinates: null,
      elicitation_id: 'el-1',
    })
    expect(result.main).not.toHaveProperty('dictionary_id')
    expect(result.main).not.toHaveProperty('dirty')
    expect(result.main).not.toHaveProperty('created_by_user_id')
    expect(result.main).not.toHaveProperty('updated_at')
  })

  test('shapes senses: strips entry_id and attaches grouped sentences/photos/videos', () => {
    const sense = {
      id: 'sense-1',
      entry_id: 'entry-1',
      glosses: { en: 'water' },
      parts_of_speech: ['n'],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    } as unknown as Tables<'senses'> & Record<string, unknown>

    const result = assemble_entry_data(base_input({
      senses: [sense],
      sentences_by_sense: { 'sense-1': [{ id: 'st-1', text: { default: 'drink water' } } as any] },
      photos_by_sense: { 'sense-1': [{ id: 'ph-1', serving_url: 'lh3/abc', storage_path: 'p/abc' } as any] },
    }))

    expect(result.senses).toHaveLength(1)
    expect(result.senses[0]).not.toHaveProperty('entry_id')
    expect(result.senses[0].glosses).toEqual({ en: 'water' })
    expect(result.senses[0].sentences).toHaveLength(1)
    expect(result.senses[0].photos?.[0].serving_url).toBe('lh3/abc')
    expect(result.senses[0].videos).toBeUndefined()
  })

  test('omits audios/tags/dialects when empty; includes when present', () => {
    const empty = assemble_entry_data(base_input())
    expect(empty).not.toHaveProperty('audios')
    expect(empty).not.toHaveProperty('tags')
    expect(empty).not.toHaveProperty('dialects')

    const filled = assemble_entry_data(base_input({
      audios: [{ id: 'a1', storage_path: 'au/1' } as any],
      dialects: [{ id: 'd1', name: { default: 'Coastal' } } as any],
    }))
    expect(filled.audios).toHaveLength(1)
    expect(filled.dialects).toHaveLength(1)
  })

  test('de-dupes duplicate child rows by id (guards keyed {#each} against corrupt local junctions)', () => {
    const sense = { id: 'sense-1', entry_id: 'entry-1', glosses: { en: 'water' } } as any
    const result = assemble_entry_data(base_input({
      senses: [sense, { ...sense }],
      sentences_by_sense: { 'sense-1': [{ id: 'st-1' } as any, { id: 'st-1' } as any, { id: 'st-2' } as any] },
      photos_by_sense: { 'sense-1': [{ id: 'ph-1' } as any, { id: 'ph-1' } as any] },
      audios: [{ id: 'a1' } as any, { id: 'a1' } as any],
      tags: [{ id: 't1', name: 'x', private: 0 } as any, { id: 't1', name: 'x', private: 0 } as any],
      dialects: [{ id: 'd1' } as any, { id: 'd1' } as any],
    }))
    expect(result.senses).toHaveLength(1)
    expect(result.senses[0].sentences?.map(s => s.id)).toEqual(['st-1', 'st-2'])
    expect(result.senses[0].photos).toHaveLength(1)
    expect(result.audios).toHaveLength(1)
    expect(result.tags).toHaveLength(1)
    expect(result.dialects).toHaveLength(1)
  })

  test('filters private + v4 tags by admin level', () => {
    const tags = [
      { id: 't-public', name: 'animals', private: 0 },
      { id: 't-private', name: 'sensitive', private: 1 },
      { id: 't-v4', name: 'v4-internal', private: 0 },
    ] as any

    const anon = assemble_entry_data(base_input({ tags, admin_level: 0 }))
    expect(anon.tags?.map(t => t.id)).toEqual(['t-public'])

    const level_1 = assemble_entry_data(base_input({ tags, admin_level: 1 }))
    expect(level_1.tags?.map(t => t.id)).toEqual(['t-public', 't-private'])

    const level_2 = assemble_entry_data(base_input({ tags, admin_level: 2 }))
    expect(level_2.tags?.map(t => t.id)).toEqual(['t-public', 't-private'])

    const level_3 = assemble_entry_data(base_input({ tags, admin_level: 3 }))
    expect(level_3.tags?.map(t => t.id)).toEqual(['t-public', 't-private', 't-v4'])
  })
})
