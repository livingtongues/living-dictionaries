import type Database from 'better-sqlite3'
import type { EntryData, Tables } from '$lib/types'
import { parse_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import { BUNDLE_DROP_COLUMNS } from '$lib/search/read-dict-bundle'
import { assemble_entry_data } from '$lib/search/assemble-entry-data'

/**
 * Server-side twin of the browser Orama worker's per-entry assembly: read one
 * entry's subgraph from the per-dict better-sqlite3 DB and shape it into the
 * `EntryData` read-model via the shared `assemble_entry_data`. Powers SSR + the
 * cold-window endpoint so a shared entry URL resolves real content + OG meta on
 * first paint. Returns `null` when the entry id doesn't exist.
 *
 * Rows are parsed (`parse_dict_row`) and stripped of the same sync-bookkeeping
 * columns as the client bundle (`BUNDLE_DROP_COLUMNS`) so SSR and warm-client
 * output stay byte-identical.
 */
export function build_entry_data({ db, entry_id, admin_level }: {
  db: Database.Database
  entry_id: string
  admin_level: number
}): EntryData | null {
  const entry = select_one(db, 'entries', 'SELECT * FROM entries WHERE id = ?', [entry_id]) as (Tables<'entries'> & Record<string, unknown>) | undefined
  if (!entry)
    return null

  const senses = select(db, 'senses', 'SELECT * FROM senses WHERE entry_id = ? ORDER BY created_at', [entry_id]) as (Tables<'senses'> & Record<string, unknown>)[]
  const sense_ids = senses.map(sense => sense.id as string)

  const sentences_by_sense: Record<string, any[]> = {}
  const photos_by_sense: Record<string, any[]> = {}
  const videos_by_sense: Record<string, any[]> = {}

  for (const sense_id of sense_ids) {
    sentences_by_sense[sense_id] = select(db, 'sentences',
      `SELECT s.* FROM sentences s
         JOIN senses_in_sentences j ON j.sentence_id = s.id
        WHERE j.sense_id = ? ORDER BY s.created_at`, [sense_id])

    photos_by_sense[sense_id] = select(db, 'photos',
      `SELECT p.* FROM photos p
         JOIN sense_photos j ON j.photo_id = p.id
        WHERE j.sense_id = ? ORDER BY p.created_at`, [sense_id])

    const videos = select(db, 'videos',
      `SELECT v.* FROM videos v
         JOIN sense_videos j ON j.video_id = v.id
        WHERE j.sense_id = ? ORDER BY v.created_at`, [sense_id])
    for (const video of videos) {
      const speakers = speakers_for(db, 'video_speakers', 'video_id', video.id as string)
      if (speakers.length)
        video.speakers = speakers
    }
    videos_by_sense[sense_id] = videos
  }

  const audios = select(db, 'audio', 'SELECT * FROM audio WHERE entry_id = ? ORDER BY created_at', [entry_id])
  for (const audio of audios) {
    const speakers = speakers_for(db, 'audio_speakers', 'audio_id', audio.id as string)
    if (speakers.length)
      audio.speakers = speakers
  }

  const tags = select(db, 'tags',
    `SELECT t.* FROM tags t
       JOIN entry_tags j ON j.tag_id = t.id
      WHERE j.entry_id = ? ORDER BY t.created_at`, [entry_id])

  const dialects = select(db, 'dialects',
    `SELECT d.* FROM dialects d
       JOIN entry_dialects j ON j.dialect_id = d.id
      WHERE j.entry_id = ? ORDER BY d.created_at`, [entry_id])

  return assemble_entry_data({
    entry,
    senses,
    sentences_by_sense,
    photos_by_sense,
    videos_by_sense,
    audios: audios as NonNullable<EntryData['audios']>,
    tags: tags as NonNullable<EntryData['tags']>,
    dialects: dialects as NonNullable<EntryData['dialects']>,
    admin_level,
  })
}

function clean(table: string, row: Record<string, unknown>): Record<string, unknown> {
  parse_dict_row(table, row)
  for (const column of BUNDLE_DROP_COLUMNS)
    delete row[column]
  return row
}

function select(db: Database.Database, table: string, sql: string, params: unknown[]): Record<string, any>[] {
  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
  return rows.map(row => clean(table, row))
}

function select_one(db: Database.Database, table: string, sql: string, params: unknown[]): Record<string, unknown> | undefined {
  const row = db.prepare(sql).get(...params) as Record<string, unknown> | undefined
  return row ? clean(table, row) : undefined
}

function speakers_for(db: Database.Database, junction: string, id_column: string, owner_id: string): Record<string, any>[] {
  return select(db, 'speakers',
    `SELECT sp.* FROM speakers sp
       JOIN ${junction} j ON j.speaker_id = sp.id
      WHERE j.${id_column} = ? ORDER BY sp.created_at`, [owner_id])
}
