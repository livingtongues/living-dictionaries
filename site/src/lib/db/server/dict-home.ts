import type Database from 'better-sqlite3'
import type { MultiString } from '$lib/types'

/**
 * Server-side reads for the dictionary home page (`/[dictionaryId]`).
 * Queried in `+page.server.ts` from the server's copy of `dictionaries/{id}.db`
 * so the page paints instantly — the browser's live dict_db takes over once the
 * local snapshot opens. Cheap indexed reads (a handful of rows via subqueries).
 */

export interface DictHomeCardAudio {
  id: string
  storage_path: string
  speaker_name: string | null
}

export interface DictHomeCard {
  /** `featured_entries.id` for featured cards; the entry id for recent cards. */
  id: string
  entry_id: string
  lexeme: MultiString
  phonetic: string | null
  glosses: MultiString | null
  parts_of_speech: string[] | null
  dialect: string | null
  photo_storage_path: string | null
  /** Ordered (created_at ASC) — same shape the live client builds via `from_entry_audios`. */
  audios: DictHomeCardAudio[]
}

const CARD_MEDIA_SUBQUERIES = `
  (SELECT s.glosses FROM senses s WHERE s.entry_id = e.id ORDER BY s.created_at LIMIT 1) AS glosses,
  (SELECT s.parts_of_speech FROM senses s WHERE s.entry_id = e.id ORDER BY s.created_at LIMIT 1) AS parts_of_speech,
  (SELECT json_extract(d.name, '$.default') FROM entry_dialects ed
     JOIN dialects d ON d.id = ed.dialect_id
   WHERE ed.entry_id = e.id ORDER BY ed.created_at LIMIT 1) AS dialect,
  (SELECT p.storage_path FROM senses s
     JOIN sense_photos sp ON sp.sense_id = s.id
     JOIN photos p ON p.id = sp.photo_id
   WHERE s.entry_id = e.id ORDER BY sp.created_at LIMIT 1) AS photo_storage_path`

/** All audio options per card entry, with the first attached speaker's name (a handful of cards → one indexed query). */
function attach_card_audios({ db, cards }: { db: Database.Database, cards: DictHomeCard[] }): DictHomeCard[] {
  if (!cards.length)
    return cards
  const entry_ids = [...new Set(cards.map(({ entry_id }) => entry_id))]
  const rows = db.prepare(`
    SELECT a.entry_id, a.id, a.storage_path,
      (SELECT s.name FROM audio_speakers asp
         JOIN speakers s ON s.id = asp.speaker_id
       WHERE asp.audio_id = a.id ORDER BY asp.created_at LIMIT 1) AS speaker_name
    FROM audio a
    WHERE a.entry_id IN (${entry_ids.map(() => '?').join(', ')})
    ORDER BY a.created_at`).all(...entry_ids) as { entry_id: string, id: string, storage_path: string, speaker_name: string | null }[]
  const by_entry = new Map<string, DictHomeCardAudio[]>()
  for (const { entry_id, id, storage_path, speaker_name } of rows) {
    if (!by_entry.has(entry_id))
      by_entry.set(entry_id, [])
    by_entry.get(entry_id).push({ id, storage_path, speaker_name })
  }
  for (const card of cards)
    card.audios = by_entry.get(card.entry_id) ?? []
  return cards
}

function parse_json_column<T>(value: unknown): T | null {
  if (typeof value !== 'string' || value === '')
    return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function to_card(row: Record<string, unknown>): DictHomeCard {
  return {
    id: row.id as string,
    entry_id: row.entry_id as string,
    lexeme: parse_json_column<MultiString>(row.lexeme) ?? {},
    phonetic: (row.phonetic as string | null) ?? null,
    glosses: parse_json_column<MultiString>(row.glosses),
    parts_of_speech: parse_json_column<string[]>(row.parts_of_speech),
    dialect: (row.dialect as string | null) ?? null,
    photo_storage_path: (row.photo_storage_path as string | null) ?? null,
    audios: [],
  }
}

/** Starred entries in strip order (fractional `sort_key`). */
export function get_featured_cards({ db }: { db: Database.Database }): DictHomeCard[] {
  const rows = db.prepare(`
    SELECT fe.id, fe.entry_id, e.lexeme, e.phonetic,${CARD_MEDIA_SUBQUERIES}
    FROM featured_entries fe
    JOIN entries e ON e.id = fe.entry_id
    ORDER BY fe.sort_key`).all() as Record<string, unknown>[]
  return attach_card_audios({ db, cards: rows.map(to_card) })
}

/**
 * Markdown of the grammar "intro" — the first top-level `grammar_sections` body,
 * in the first gloss language present. Source for the home-page grammar teaser +
 * sitemap presence since the 2026-07-15 cutover (replacing the legacy
 * `dictionaries.grammar` blob). Returns '' for a dict with no sections yet (an
 * un-backfilled dict.db or one predating the migration) so the caller can fall
 * back to the blob. Tolerates a dict.db that predates the grammar migration.
 */
export function get_grammar_intro_markdown({ db, gloss_languages = [] }: {
  db: Database.Database
  gloss_languages?: string[]
}): string {
  const has_table = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'grammar_sections'`).get()
  if (!has_table)
    return ''
  const row = db.prepare(
    `SELECT body FROM grammar_sections WHERE parent_id IS NULL ORDER BY sort_key ASC LIMIT 1`,
  ).get() as { body: string | null } | undefined
  const body = parse_json_column<MultiString>(row?.body)
  if (!body)
    return ''
  for (const lang of [...gloss_languages, ...Object.keys(body)]) {
    const value = body[lang]
    if (value && value.trim())
      return value
  }
  return ''
}

/** Newest entries for the "recently added" strip — fetched with headroom so the
 * client's featured-overlap filter still leaves a full strip (display cap is 8). */
export function get_recent_cards({ db, limit = 12 }: { db: Database.Database, limit?: number }): DictHomeCard[] {
  const rows = db.prepare(`
    SELECT e.id, e.id AS entry_id, e.lexeme, e.phonetic,${CARD_MEDIA_SUBQUERIES}
    FROM entries e
    ORDER BY e.created_at DESC
    LIMIT ?`).all(limit) as Record<string, unknown>[]
  return attach_card_audios({ db, cards: rows.map(to_card) })
}
