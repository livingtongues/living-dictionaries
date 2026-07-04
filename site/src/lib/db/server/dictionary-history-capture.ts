import type Database from 'better-sqlite3'
import type { HistoryOwner } from './dictionary-history-db'
import { parse_dict_row } from '$lib/db/schemas/dictionary-json-columns'

/**
 * Pure-ish capture helpers for the change-history audit log. Called from the
 * merge chokepoint (`process_dict_changes`). Kept separate so they're trivially
 * unit-testable (snapshot/delta) and the owner-resolution matrix lives in one
 * greppable place.
 */

/**
 * Columns dropped from BOTH snapshot and delta: pure sync/audit mechanics. The
 * who/when already live as first-class columns on the `changes` row, and
 * `dirty` is meaningless in history.
 */
export const HISTORY_NOISE_COLUMNS = new Set(['dirty', 'updated_at', 'updated_by_user_id'])

/**
 * Columns excluded from the delta comparison: the noise above PLUS the
 * immutable columns the merge never updates on conflict (`id`, `created_at`,
 * `created_by_user_id`). Comparing those would flag a phantom change when a
 * re-push carries a newer created_at, even though it's never persisted.
 */
const DELTA_IGNORED_COLUMNS = new Set([...HISTORY_NOISE_COLUMNS, 'id', 'created_at', 'created_by_user_id'])

/** Deterministic stringify (object keys sorted; array order preserved). */
function stable_stringify(value: unknown): string {
  if (value === null || typeof value !== 'object')
    return JSON.stringify(value)
  if (Array.isArray(value))
    return `[${value.map(stable_stringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map(k => `${JSON.stringify(k)}:${stable_stringify(obj[k])}`).join(',')}}`
}

function deep_equal(a: unknown, b: unknown): boolean {
  return stable_stringify(a) === stable_stringify(b)
}

/**
 * After-image snapshot: parsed row (JSON columns as nested objects), with
 * NULL/undefined columns stripped and the noise columns dropped. Schema-drift
 * proof — it's just whatever columns the row currently has.
 */
export function build_snapshot(table_name: string, row: Record<string, unknown>): Record<string, unknown> {
  const parsed = parse_dict_row(table_name, { ...row })
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (HISTORY_NOISE_COLUMNS.has(key))
      continue
    if (value === null || value === undefined)
      continue
    out[key] = value
  }
  return out
}

/**
 * Column-level diff for an UPDATE: `{col:{old,new}}` over the columns present
 * in `incoming` (the client's pushed row), excluding noise. Returns null when
 * there's no real change (insert has no `existing`; an updated_at-only re-push
 * produces an empty diff → null → no history row).
 */
export function build_delta(
  table_name: string,
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>,
): Record<string, { old?: unknown, new?: unknown }> | null {
  if (!existing)
    return null // insert — full state is in the snapshot
  const old_parsed = parse_dict_row(table_name, { ...existing })
  const new_parsed = parse_dict_row(table_name, { ...incoming })
  const delta: Record<string, { old?: unknown, new?: unknown }> = {}
  for (const [key, new_value] of Object.entries(new_parsed)) {
    if (DELTA_IGNORED_COLUMNS.has(key))
      continue
    const old_value = old_parsed[key] ?? null
    const normalized_new = new_value ?? null
    if (!deep_equal(old_value, normalized_new))
      delta[key] = { old: old_value, new: normalized_new }
  }
  return Object.keys(delta).length ? delta : null
}

// ── owner resolution ─────────────────────────────────────────────────────────

function push_owner(out: HistoryOwner[], seen: Set<string>, type: string, id: unknown) {
  if (typeof id !== 'string' || !id)
    return
  const key = `${type}:${id}`
  if (seen.has(key))
    return
  seen.add(key)
  out.push({ type, id })
}

function entry_id_of_sense(db: Database.Database, sense_id: unknown): string | undefined {
  if (typeof sense_id !== 'string')
    return undefined
  const row = db.prepare('SELECT entry_id FROM senses WHERE id = ?').get(sense_id) as { entry_id: string } | undefined
  return row?.entry_id
}

/**
 * Resolve which browse-subject(s) a change to `table_name`/`row` belongs to.
 * Only emits `entry` / `text` / `sentence` owners (the indexed princes).
 * Fan-out is bounded — shared-entity renames (speakers/tags/dialects) emit NO
 * owners, so a rename never blasts across hundreds of entries. **Entry edits
 * never resolve to a text.** Best-effort: reads current db state, so a junction
 * not yet inserted in the same batch is simply picked up via its own change.
 */
export function resolve_owners(db: Database.Database, table_name: string, row: Record<string, unknown>): HistoryOwner[] {
  const out: HistoryOwner[] = []
  const seen = new Set<string>()

  switch (table_name) {
    case 'entries':
      push_owner(out, seen, 'entry', row.id)
      break
    case 'senses':
      push_owner(out, seen, 'entry', row.entry_id)
      break
    case 'texts':
      push_owner(out, seen, 'text', row.id)
      break
    case 'sentences': {
      push_owner(out, seen, 'sentence', row.id)
      push_owner(out, seen, 'text', row.text_id)
      const linked = db.prepare(
        `SELECT s.entry_id AS entry_id FROM senses_in_sentences j
           JOIN senses s ON s.id = j.sense_id WHERE j.sentence_id = ?`,
      ).all(row.id) as { entry_id: string }[]
      for (const { entry_id } of linked)
        push_owner(out, seen, 'entry', entry_id)
      break
    }
    case 'senses_in_sentences':
      push_owner(out, seen, 'sentence', row.sentence_id)
      push_owner(out, seen, 'entry', entry_id_of_sense(db, row.sense_id))
      break
    case 'audio':
      push_owner(out, seen, 'entry', row.entry_id)
      push_owner(out, seen, 'sentence', row.sentence_id)
      push_owner(out, seen, 'text', row.text_id)
      break
    case 'audio_speakers': {
      const audio = db.prepare('SELECT * FROM audio WHERE id = ?').get(row.audio_id) as Record<string, unknown> | undefined
      if (audio)
        for (const o of resolve_owners(db, 'audio', audio)) push_owner(out, seen, o.type, o.id)
      break
    }
    case 'videos': {
      push_owner(out, seen, 'text', row.text_id)
      const sv = db.prepare(
        `SELECT s.entry_id AS entry_id FROM sense_videos j JOIN senses s ON s.id = j.sense_id WHERE j.video_id = ?`,
      ).all(row.id) as { entry_id: string }[]
      for (const { entry_id } of sv)
        push_owner(out, seen, 'entry', entry_id)
      const sentv = db.prepare('SELECT sentence_id FROM sentence_videos WHERE video_id = ?').all(row.id) as { sentence_id: string }[]
      for (const { sentence_id } of sentv)
        push_owner(out, seen, 'sentence', sentence_id)
      break
    }
    case 'video_speakers': {
      const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(row.video_id) as Record<string, unknown> | undefined
      if (video)
        for (const o of resolve_owners(db, 'videos', video)) push_owner(out, seen, o.type, o.id)
      break
    }
    case 'sense_videos':
      push_owner(out, seen, 'entry', entry_id_of_sense(db, row.sense_id))
      break
    case 'sentence_videos': {
      push_owner(out, seen, 'sentence', row.sentence_id)
      const sentence = db.prepare('SELECT * FROM sentences WHERE id = ?').get(row.sentence_id) as Record<string, unknown> | undefined
      if (sentence)
        for (const o of resolve_owners(db, 'sentences', sentence)) push_owner(out, seen, o.type, o.id)
      break
    }
    case 'sense_photos':
      push_owner(out, seen, 'entry', entry_id_of_sense(db, row.sense_id))
      break
    case 'sentence_photos': {
      push_owner(out, seen, 'sentence', row.sentence_id)
      const sentence = db.prepare('SELECT * FROM sentences WHERE id = ?').get(row.sentence_id) as Record<string, unknown> | undefined
      if (sentence)
        for (const o of resolve_owners(db, 'sentences', sentence)) push_owner(out, seen, o.type, o.id)
      break
    }
    case 'entry_dialects':
    case 'entry_tags':
    case 'featured_entries':
      push_owner(out, seen, 'entry', row.entry_id)
      break
    case 'entry_relationships':
      // A relationship belongs to BOTH endpoints — history fans out to each entry.
      push_owner(out, seen, 'entry', row.from_entry_id)
      push_owner(out, seen, 'entry', row.to_entry_id)
      break
    // photos, speakers, dialects, tags, sources, relationship_types → no owners
    // (recorded, but not attributed to any prince; shared-entity renames
    // deliberately do not fan out).
    default:
      break
  }

  return out
}
