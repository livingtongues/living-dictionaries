import type Database from 'better-sqlite3'
import type { HistoryEvent } from './dictionary-history-db'
import type { SingleWriteResult } from './v1-entry-write'
import type { SourceType } from '$lib/constants'
import { SOURCE_TYPES } from '$lib/constants'
import { parse_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import { read_last_modified_at } from './dictionary-db'
import { record_history } from './dictionary-history-db'
import { merge_dict_row } from './dictionary-sync-helpers'
import { run_tombstone_delete } from './v1-entry-write'
import { load_source_slug_set } from './source-slugs'

export { assert_known_source_slugs, load_source_slug_set } from './source-slugs'

/**
 * `/api/v1` sources sub-resource: the per-dict citation registry referenced by
 * `entries`/`sentences`/`texts` `sources` slug arrays and by the scalar
 * `audio.source`/`videos.source` slug columns. Writes go through
 * `merge_dict_row` (same path + history as a browser push). Unlike tags/dialects
 * (found-or-created on entry write), sources are STRICT — an entry/sentence write
 * rejects an unknown slug, so sources must be created here first. A source can't
 * be deleted while referenced; `remove_source_from_all` strips it everywhere.
 */

/** Tables carrying a `sources` slug-array column. */
const REFERENCING_TABLES = ['entries', 'senses', 'sentences', 'texts'] as const
type ReferencingTable = typeof REFERENCING_TABLES[number]

/** Tables carrying a `citations` JSON `SourceCitation[]` column (slug refs with a locator). */
const CITATION_TABLES = ['entries', 'sentences', 'texts'] as const
type CitationTable = typeof CITATION_TABLES[number]

/** Media tables carrying a scalar `source` slug column (photos excluded — theirs is free-text caption). */
const MEDIA_REFERENCING_TABLES = ['audio', 'videos'] as const
type MediaReferencingTable = typeof MEDIA_REFERENCING_TABLES[number]

export interface SourceRecord {
  id: string
  slug: string
  citation: string | null
  abbreviation: string | null
  author: string | null
  year: string | null
  url: string | null
  license: string | null
  type: string | null
  orthography: string | null
}

export interface SourceReferenceCounts { entries: number, senses: number, sentences: number, texts: number, audio: number, videos: number, citations: number }

const SOURCE_COLUMNS = `id, slug, citation, abbreviation, author, year, url, license, type, orthography`

export function list_sources(db: Database.Database): SourceRecord[] {
  return db.prepare(`SELECT ${SOURCE_COLUMNS} FROM sources ORDER BY slug`).all() as SourceRecord[]
}

export function get_source(db: Database.Database, id: string): SourceRecord | undefined {
  return db.prepare(`SELECT ${SOURCE_COLUMNS} FROM sources WHERE id = ?`).get(id) as SourceRecord | undefined
}

function count_in_table(db: Database.Database, table: ReferencingTable, slug: string): number {
  const row = db.prepare(
    `SELECT COUNT(*) AS c FROM "${table}" WHERE sources IS NOT NULL AND EXISTS (SELECT 1 FROM json_each("${table}".sources) WHERE value = ?)`,
  ).get(slug) as { c: number }
  return row.c
}

function count_in_media_table(db: Database.Database, table: MediaReferencingTable, slug: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM "${table}" WHERE source = ?`).get(slug) as { c: number }
  return row.c
}

function count_in_citation_table(db: Database.Database, table: CitationTable, slug: string): number {
  const row = db.prepare(
    `SELECT COUNT(*) AS c FROM "${table}" WHERE citations IS NOT NULL AND EXISTS (SELECT 1 FROM json_each("${table}".citations) WHERE json_extract(value, '$.slug') = ?)`,
  ).get(slug) as { c: number }
  return row.c
}

export function count_source_references(db: Database.Database, slug: string): SourceReferenceCounts {
  return {
    entries: count_in_table(db, 'entries', slug),
    senses: count_in_table(db, 'senses', slug),
    sentences: count_in_table(db, 'sentences', slug),
    texts: count_in_table(db, 'texts', slug),
    audio: count_in_media_table(db, 'audio', slug),
    videos: count_in_media_table(db, 'videos', slug),
    citations: CITATION_TABLES.reduce((sum, table) => sum + count_in_citation_table(db, table, slug), 0),
  }
}

function total_references(counts: SourceReferenceCounts): number {
  return counts.entries + counts.senses + counts.sentences + counts.texts + counts.audio + counts.videos + counts.citations
}

function commit_history(history_db: Database.Database | undefined, event: HistoryEvent | null) {
  if (history_db && event) {
    try {
      record_history(history_db, [event])
    } catch (err) {
      console.warn('Could not record v1 source history:', err)
    }
  }
}

function validate_type(type: string | undefined): SourceType | null {
  if (type === undefined || type === null || type === '')
    return null
  if (!SOURCE_TYPES.includes(type as SourceType))
    throw new Error(`invalid source type '${type}'; expected one of ${SOURCE_TYPES.join(', ')}`)
  return type as SourceType
}

export interface SourceInput {
  slug: string
  citation?: string
  abbreviation?: string
  author?: string
  year?: string
  url?: string
  license?: string
  type?: string
  /** Which writing system this source's forms use — an orthography `code` from
   *  the dictionary's `orthographies` (or `default`); nullable. */
  orthography?: string
}

export function create_source({ db, history_db, user_id, api_key_id, input }: {
  db: Database.Database
  history_db?: Database.Database
  user_id: string
  api_key_id?: string | null
  input: SourceInput
}): { source: SourceRecord, cursor: string | null } {
  const slug = (input.slug || '').trim()
  if (!slug)
    throw new Error('source slug is required')
  if (load_source_slug_set(db).has(slug))
    throw new Error(`a source with slug '${slug}' already exists`)
  const type = validate_type(input.type)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const source: SourceRecord = {
    id,
    slug,
    citation: input.citation?.trim() || null,
    abbreviation: input.abbreviation?.trim() || null,
    author: input.author?.trim() || null,
    year: input.year?.trim() || null,
    url: input.url?.trim() || null,
    license: input.license?.trim() || null,
    type,
    orthography: input.orthography?.trim() || null,
  }
  const event = merge_dict_row({ db, table_name: 'sources', row: { ...source, created_at: now, updated_at: now }, user_id, at: now, api_key_id })
  commit_history(history_db, event)
  return { source, cursor: read_last_modified_at(db) }
}

const SOURCE_PATCH_FIELDS = ['citation', 'abbreviation', 'author', 'year', 'url', 'license', 'orthography'] as const

/** Field-merge a source's metadata (and/or rename its slug). Rejects a slug collision. */
export function apply_source_update({ db, history_db, source_id, patch, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  source_id: string
  patch: Partial<SourceInput>
  user_id: string
  api_key_id?: string | null
}): SingleWriteResult {
  const existing = db.prepare(`SELECT * FROM sources WHERE id = ?`).get(source_id) as Record<string, unknown> | undefined
  if (!existing)
    return { found: false, new_synced_up_to: read_last_modified_at(db) }

  const source = patch as Record<string, unknown>
  const now = new Date().toISOString()
  const row: Record<string, unknown> = { ...existing, updated_at: now }
  delete row.updated_by_user_id
  let changed = false

  if ('slug' in source) {
    const slug = (patch.slug || '').trim()
    if (!slug)
      throw new Error('source slug cannot be empty')
    if (load_source_slug_set(db).has(slug) && slug !== existing.slug)
      throw new Error(`a source with slug '${slug}' already exists`)
    // NOTE: renaming a slug does NOT rewrite referencing rows — callers should
    // avoid slug renames on in-use sources (the UI hides it once referenced).
    row.slug = slug
    changed = true
  }
  if ('type' in source) {
    row.type = validate_type(patch.type) ?? null
    changed = true
  }
  for (const field of SOURCE_PATCH_FIELDS) {
    if (field in source) {
      row[field] = (source[field] as string | undefined)?.trim() || null
      changed = true
    }
  }
  if (!changed)
    return { found: true, new_synced_up_to: read_last_modified_at(db) }

  const event = merge_dict_row({ db, table_name: 'sources', row, user_id, at: now, api_key_id })
  commit_history(history_db, event)
  return { found: true, new_synced_up_to: read_last_modified_at(db) }
}

/**
 * Strip a slug from every referencing entry/sense/sentence/text `sources` array,
 * NULL it on referencing audio/videos rows, AND drop it from every
 * entry/sentence/text `citations` array. NOTE: an audio/video row whose only
 * attribution was this source becomes unattributed — legal (the
 * speaker-or-source rule is write-time only), same status as legacy rows.
 */
export function remove_source_from_all({ db, history_db, slug, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  slug: string
  user_id: string
  api_key_id?: string | null
}): { new_synced_up_to: string | null } {
  const now = new Date().toISOString()
  const events: HistoryEvent[] = []
  for (const table of REFERENCING_TABLES) {
    const rows = db.prepare(
      `SELECT * FROM "${table}" WHERE sources IS NOT NULL AND EXISTS (SELECT 1 FROM json_each("${table}".sources) WHERE value = ?)`,
    ).all(slug) as Record<string, unknown>[]
    for (const raw of rows) {
      const current = JSON.parse((raw.sources as string) ?? '[]') as string[]
      const next = current.filter(existing_slug => existing_slug !== slug)
      // Parse the row's OTHER JSON columns first — merge_dict_row re-stringifies,
      // so passing raw JSON strings back would double-encode lexeme/notes/etc.
      const row: Record<string, unknown> = { ...parse_dict_row(table, raw), sources: next.length ? next : null, updated_at: now }
      delete row.updated_by_user_id
      const event = merge_dict_row({ db, table_name: table, row, user_id, at: now, api_key_id })
      if (event)
        events.push(event)
    }
  }
  for (const table of MEDIA_REFERENCING_TABLES) {
    const rows = db.prepare(`SELECT * FROM "${table}" WHERE source = ?`).all(slug) as Record<string, unknown>[]
    for (const raw of rows) {
      const row: Record<string, unknown> = { ...parse_dict_row(table, raw), source: null, updated_at: now }
      delete row.updated_by_user_id
      const event = merge_dict_row({ db, table_name: table, row, user_id, at: now, api_key_id })
      if (event)
        events.push(event)
    }
  }
  for (const table of CITATION_TABLES) {
    const rows = db.prepare(
      `SELECT * FROM "${table}" WHERE citations IS NOT NULL AND EXISTS (SELECT 1 FROM json_each("${table}".citations) WHERE json_extract(value, '$.slug') = ?)`,
    ).all(slug) as Record<string, unknown>[]
    for (const raw of rows) {
      const current = JSON.parse((raw.citations as string) ?? '[]') as { slug: string }[]
      const next = current.filter(citation => citation.slug !== slug)
      const row: Record<string, unknown> = { ...parse_dict_row(table, raw), citations: next.length ? next : null, updated_at: now }
      delete row.updated_by_user_id
      const event = merge_dict_row({ db, table_name: table, row, user_id, at: now, api_key_id })
      if (event)
        events.push(event)
    }
  }
  if (history_db && events.length) {
    try {
      record_history(history_db, events)
    } catch (err) {
      console.warn('Could not record v1 source-unlink history:', err)
    }
  }
  return { new_synced_up_to: read_last_modified_at(db) }
}

/**
 * Delete a source. Refuses (throws) while it's still referenced — callers strip
 * references first via {@link remove_source_from_all}. Returns `found: false` if
 * the source id doesn't exist.
 */
export function apply_source_delete({ db, history_db, source_id, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  source_id: string
  user_id: string
  api_key_id?: string | null
}): SingleWriteResult {
  const existing = get_source(db, source_id)
  if (!existing)
    return { found: false, new_synced_up_to: read_last_modified_at(db) }
  const counts = count_source_references(db, existing.slug)
  if (total_references(counts) > 0)
    throw new Error(`source '${existing.slug}' is still used by ${counts.entries} entries, ${counts.senses} senses, ${counts.sentences} sentences, ${counts.texts} texts, ${counts.audio} audio, ${counts.videos} videos, ${counts.citations} citations; remove those references first`)
  return run_tombstone_delete({ db, history_db, table_name: 'sources', id: source_id, user_id, api_key_id })
}
