import type Database from 'better-sqlite3'
import type { MediaCellKey, MediaFieldInput } from './v1-media-write'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { open_dictionary_db_in_memory } from './dictionary-db'
import { merge_dict_row } from './dictionary-sync-helpers'
import { attach_media, delete_media, MEDIA_CELLS, read_media_record } from './v1-media-write'

let db: Database.Database
const USER = 'edt-1'
const NOW = '2026-01-01T00:00:00.000Z'

function seed(table: 'entries' | 'senses' | 'sentences' | 'texts' | 'speakers' | 'sources', row: Record<string, unknown>) {
  merge_dict_row({ db, table_name: table, row: { created_at: NOW, updated_at: NOW, ...row }, user_id: USER })
}

beforeEach(() => {
  db = open_dictionary_db_in_memory('dict-1')
  seed('entries', { id: 'e1', lexeme: { default: 'mbwa' } })
  seed('senses', { id: 's1', entry_id: 'e1' })
  seed('sentences', { id: 'sent1', text: { default: 'a sentence' } })
  seed('texts', { id: 't1', title: { default: 'a story' } })
  seed('speakers', { id: 'sp1', name: 'Ana' })
  seed('sources', { id: 'src1', slug: 'field-2026', citation: 'Fieldwork 2026' })
})

afterEach(() => db.close())

/** Owner id + medium-specific input fields for each cell. Audio/video carry a
 * registry source slug (the speaker-less attribution path); photo `source` is
 * free-text caption and photos need no attribution. */
const CELL_FIXTURES: Record<MediaCellKey, { owner_id: string, fields: MediaFieldInput }> = {
  'audio:entry': { owner_id: 'e1', fields: { storage_path: 'a.mp3', source: 'field-2026' } },
  'audio:sentence': { owner_id: 'sent1', fields: { storage_path: 'a.mp3', source: 'field-2026' } },
  'audio:text': { owner_id: 't1', fields: { storage_path: 'a.mp3', source: 'field-2026' } },
  'photo:sense': { owner_id: 's1', fields: { storage_path: 'p.jpg', serving_url: 'hash', photographer: 'Sam', source: 'a free-text caption' } },
  'photo:sentence': { owner_id: 'sent1', fields: { storage_path: 'p.jpg', serving_url: 'hash' } },
  'video:sense': { owner_id: 's1', fields: { hosted_elsewhere: { type: 'youtube', video_id: 'abc' }, source: 'field-2026' } },
  'video:sentence': { owner_id: 'sent1', fields: { storage_path: 'v.mp4', source: 'field-2026' } },
  'video:text': { owner_id: 't1', fields: { hosted_elsewhere: { type: 'vimeo', video_id: '123' }, source: 'field-2026' } },
}

describe(attach_media, () => {
  for (const cell_key of Object.keys(MEDIA_CELLS) as MediaCellKey[]) {
    test(`${cell_key}: attach links + reads back, then delete removes`, () => {
      const { owner_id, fields } = CELL_FIXTURES[cell_key]
      const cell = MEDIA_CELLS[cell_key]

      const result = attach_media({ db, cell_key, owner_id, fields, user_id: USER })
      expect(result.found).toBeTruthy()
      expect(result.created).toBeTruthy()
      const media_id = result.media.id

      // Row exists in the media table and is linked to the owner.
      const linked = cell.link.kind === 'column'
        ? db.prepare(`SELECT 1 FROM "${cell.media_table}" WHERE id = ? AND "${cell.link.column}" = ?`).get(media_id, owner_id)
        : db.prepare(`SELECT 1 FROM "${cell.link.table}" WHERE "${cell.link.owner_col}" = ? AND "${cell.link.media_col}" = ?`).get(owner_id, media_id)
      expect(linked).toBeTruthy()

      const record = read_media_record({ db, cell_key, media_id })
      expect(record.id).toBe(media_id)
      expect(record.storage_path ?? record.hosted_elsewhere).toBeTruthy()

      const del = delete_media({ db, cell_key, owner_id, media_id, user_id: USER })
      expect(del.found).toBeTruthy()
      expect(db.prepare(`SELECT 1 FROM "${cell.media_table}" WHERE id = ?`).get(media_id)).toBeUndefined()
    })
  }

  test('audio:entry attaches a speaker junction', () => {
    const result = attach_media({ db, cell_key: 'audio:entry', owner_id: 'e1', fields: { storage_path: 'a.mp3' }, speaker_id: 'sp1', user_id: USER })
    expect(result.media.speakers).toEqual([{ id: 'sp1', name: 'Ana' }])
    const junction = db.prepare(`SELECT 1 FROM audio_speakers WHERE audio_id = ? AND speaker_id = ?`).get(result.media.id, 'sp1')
    expect(junction).toBeTruthy()
  })

  test('rejects a non-existent speaker', () => {
    expect(() => attach_media({ db, cell_key: 'audio:entry', owner_id: 'e1', fields: { storage_path: 'a.mp3' }, speaker_id: 'ghost', user_id: USER }))
      .toThrow('speaker not found')
  })

  test('rejects a speaker on a medium that has none (photo)', () => {
    expect(() => attach_media({ db, cell_key: 'photo:sense', owner_id: 's1', fields: { storage_path: 'p.jpg', serving_url: 'h' }, speaker_id: 'sp1', user_id: USER }))
      .toThrow('does not support a speaker')
  })

  test('found:false when the owner does not exist', () => {
    const result = attach_media({ db, cell_key: 'audio:entry', owner_id: 'ghost', fields: { storage_path: 'a.mp3' }, user_id: USER })
    expect(result.found).toBeFalsy()
    expect(result.created).toBeFalsy()
  })

  test('idempotent: re-attaching the same media id is a no-op', () => {
    const first = attach_media({ db, cell_key: 'audio:entry', owner_id: 'e1', media_id: 'aud-fixed', fields: { storage_path: 'a.mp3', source: 'field-2026' }, user_id: USER })
    expect(first.created).toBeTruthy()
    const second = attach_media({ db, cell_key: 'audio:entry', owner_id: 'e1', media_id: 'aud-fixed', fields: { storage_path: 'other.mp3', source: 'field-2026' }, user_id: USER })
    expect(second.created).toBeFalsy()
    expect(db.prepare(`SELECT COUNT(*) AS c FROM audio WHERE entry_id = ?`).get('e1')).toEqual({ c: 1 })
  })

  test('replace: removes existing media of the medium on the owner first', () => {
    attach_media({ db, cell_key: 'audio:entry', owner_id: 'e1', fields: { storage_path: 'first.mp3', source: 'field-2026' }, user_id: USER })
    attach_media({ db, cell_key: 'audio:entry', owner_id: 'e1', fields: { storage_path: 'second.mp3', source: 'field-2026' }, replace: true, user_id: USER })
    const rows = db.prepare(`SELECT storage_path FROM audio WHERE entry_id = ?`).all('e1')
    expect(rows).toEqual([{ storage_path: 'second.mp3' }])
  })

  test('audio without speaker or source is rejected (attribution rule)', () => {
    expect(() => attach_media({ db, cell_key: 'audio:entry', owner_id: 'e1', fields: { storage_path: 'a.mp3' }, user_id: USER }))
      .toThrow('requires attribution')
  })

  test('video without speaker or source is rejected (attribution rule)', () => {
    expect(() => attach_media({ db, cell_key: 'video:sense', owner_id: 's1', fields: { hosted_elsewhere: { type: 'youtube', video_id: 'abc' } }, user_id: USER }))
      .toThrow('requires attribution')
  })

  test('later partial edits preserve cached hosted metadata', () => {
    const result = attach_media({
      db,
      cell_key: 'video:sense',
      owner_id: 's1',
      fields: {
        hosted_elsewhere: { type: 'youtube', video_id: 'abc', start_at_seconds: 12 },
        hosted_metadata: { title: 'Field recording', thumbnail_url: 'https://example.com/thumb.jpg' },
        source: 'field-2026',
      },
      user_id: USER,
    })
    const existing = db.prepare(`SELECT created_at, created_by_user_id FROM videos WHERE id = ?`).get(result.media.id) as { created_at: string, created_by_user_id: string }
    merge_dict_row({ db, table_name: 'videos', row: { id: result.media.id, ...existing, videographer: 'Ana', updated_at: '2030-01-02T00:00:00.000Z' }, user_id: USER })
    expect(read_media_record({ db, cell_key: 'video:sense', media_id: result.media.id })).toMatchObject({
      hosted_elsewhere: { type: 'youtube', video_id: 'abc', start_at_seconds: 12 },
      hosted_metadata: { title: 'Field recording', thumbnail_url: 'https://example.com/thumb.jpg' },
      source: 'field-2026',
      videographer: 'Ana',
    })
  })

  test('audio with an unknown source slug is rejected (strict registry)', () => {
    expect(() => attach_media({ db, cell_key: 'audio:entry', owner_id: 'e1', fields: { storage_path: 'a.mp3', source: 'no-such-slug' }, user_id: USER }))
      .toThrow(`unknown source slug 'no-such-slug'`)
  })

  test('audio with a speaker but no source passes the attribution rule', () => {
    const result = attach_media({ db, cell_key: 'audio:entry', owner_id: 'e1', fields: { storage_path: 'a.mp3' }, speaker_id: 'sp1', user_id: USER })
    expect(result.created).toBeTruthy()
    expect(result.media.source).toBeNull()
  })

  test('photo needs no attribution and its free-text source is stored verbatim', () => {
    const result = attach_media({ db, cell_key: 'photo:sense', owner_id: 's1', fields: { storage_path: 'p.jpg', serving_url: 'h', source: 'any prose caption' }, user_id: USER })
    expect(result.created).toBeTruthy()
    expect(result.media.source).toBe('any prose caption')
  })
})

describe(delete_media, () => {
  test('found:false when the media is not linked to this owner', () => {
    const attached = attach_media({ db, cell_key: 'photo:sense', owner_id: 's1', fields: { storage_path: 'p.jpg', serving_url: 'h' }, user_id: USER })
    // Correct id but wrong owner.
    const result = delete_media({ db, cell_key: 'photo:sense', owner_id: 'ghost-sense', media_id: attached.media.id, user_id: USER })
    expect(result.found).toBeFalsy()
    expect(db.prepare(`SELECT 1 FROM photos WHERE id = ?`).get(attached.media.id)).toBeTruthy()
  })
})
