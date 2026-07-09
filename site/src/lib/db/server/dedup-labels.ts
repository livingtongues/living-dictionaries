import type Database from 'better-sqlite3'
import type { MultiString } from '$lib/types'
import { randomUUID } from 'node:crypto'
import { delete_dict_row } from './dictionary-sync-helpers'

/**
 * One-time (re-runnable) cleanup: merge same-name duplicate `tags` / `dialects`
 * within a dictionary down to a single canonical row, repointing entry junctions
 * and tombstoning the extras. Born of the write-side dup bug fixed in d0c2fc5f
 * (write-ins couldn't see existing labels before the store loaded, so editors
 * minted a fresh tag/dialect on every keystroke-save — e.g. sugtstun had
 * `millie` ×98).
 *
 * SYNC: every write here bumps the dict's `last_modified_at` (insert/update
 * triggers) and the tombstones land in `deletes` — so already-connected editors
 * pull the new canonical junctions + the dup tombstones via `/changes` (the
 * client's own `process_delete_cascade` FK-cascades the dup junctions away when
 * it applies each label tombstone). Cold loaders get the rebuilt R2 snapshot
 * once the caller bumps `shared.db.dictionaries.updated_at`.
 *
 * Canonical = earliest `created_at` (tiebreak lowest id). Tag `private`:
 * public-wins (any member visible-to-all → merged visible). Dialect MultiString
 * name: union — fill canonical locale keys that are missing/empty from the dups
 * (canonical's own non-empty values always win).
 */

export interface DedupLabelsReport {
  /** Groups (same normalized name, >1 member) collapsed. */
  tag_groups_merged: number
  /** Duplicate tag rows tombstoned. */
  tags_removed: number
  /** New canonical `entry_tags` junctions created. */
  tag_junctions_created: number
  /** Canonical tags whose `private` flag was flipped to public. */
  tag_privacy_widened: number
  dialect_groups_merged: number
  dialects_removed: number
  dialect_junctions_created: number
  /** Locale keys folded into a canonical dialect name from its dups. */
  dialect_locales_filled: number
}

export function empty_report(): DedupLabelsReport {
  return {
    tag_groups_merged: 0,
    tags_removed: 0,
    tag_junctions_created: 0,
    tag_privacy_widened: 0,
    dialect_groups_merged: 0,
    dialects_removed: 0,
    dialect_junctions_created: 0,
    dialect_locales_filled: 0,
  }
}

export function report_has_changes(report: DedupLabelsReport): boolean {
  return report.tags_removed > 0
    || report.tag_junctions_created > 0
    || report.tag_privacy_widened > 0
    || report.dialects_removed > 0
    || report.dialect_junctions_created > 0
    || report.dialect_locales_filled > 0
}

interface TagRow {
  id: string
  name: string
  private: number | null
  created_at: string
}

interface DialectRow {
  id: string
  name: string // raw JSON MultiString
  created_at: string
}

/** created_at ASC, id ASC — deterministic canonical pick. */
function by_age<T extends { created_at: string, id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.created_at !== b.created_at)
      return a.created_at < b.created_at ? -1 : 1
    return a.id < b.id ? -1 : 1
  })
}

function group_by<T>(rows: T[], key: (row: T) => string | null): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const k = key(row)
    if (k === null)
      continue
    const existing = groups.get(k)
    if (existing)
      existing.push(row)
    else
      groups.set(k, [row])
  }
  return groups
}

/**
 * Ensure `entry` is linked to `canonical_label_id` in `junction_table`, minting a
 * fresh junction if absent. Returns 1 when a junction was created, else 0.
 */
function ensure_junction({ db, junction_table, label_column, entry_id, canonical_id, user_id, dry_run }: {
  db: Database.Database
  junction_table: 'entry_tags' | 'entry_dialects'
  label_column: 'tag_id' | 'dialect_id'
  entry_id: string
  canonical_id: string
  user_id: string
  dry_run: boolean
}): number {
  const exists = db.prepare(
    `SELECT 1 FROM "${junction_table}" WHERE entry_id = ? AND "${label_column}" = ? LIMIT 1`,
  ).get(entry_id, canonical_id)
  if (exists)
    return 0
  if (!dry_run) {
    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO "${junction_table}" (id, entry_id, "${label_column}", dirty, created_by_user_id, created_at, updated_by_user_id, updated_at)
       VALUES (?, ?, ?, 1, ?, ?, ?, ?)`,
    ).run(randomUUID(), entry_id, canonical_id, user_id, now, user_id, now)
  }
  return 1
}

/** Entries linked to any of the given (duplicate) label ids. */
function entries_linked_to({ db, junction_table, label_column, label_ids }: {
  db: Database.Database
  junction_table: 'entry_tags' | 'entry_dialects'
  label_column: 'tag_id' | 'dialect_id'
  label_ids: string[]
}): string[] {
  const placeholders = label_ids.map(() => '?').join(', ')
  const rows = db.prepare(
    `SELECT DISTINCT entry_id FROM "${junction_table}" WHERE "${label_column}" IN (${placeholders})`,
  ).all(...label_ids) as { entry_id: string }[]
  return rows.map(row => row.entry_id)
}

function dedup_tags({ db, user_id, dry_run, report }: {
  db: Database.Database
  user_id: string
  dry_run: boolean
  report: DedupLabelsReport
}) {
  const tags = db.prepare(`SELECT id, name, "private", created_at FROM tags`).all() as TagRow[]
  const groups = group_by(tags, tag => tag.name.trim().toLowerCase() || null)

  for (const members of groups.values()) {
    if (members.length < 2)
      continue
    report.tag_groups_merged++

    const [canonical, ...dups] = by_age(members)
    const dup_ids = dups.map(dup => dup.id)

    // public-wins: any member visible-to-all → canonical visible.
    const any_public = members.some(member => !member.private)
    if (any_public && canonical.private) {
      report.tag_privacy_widened++
      if (!dry_run) {
        db.prepare(`UPDATE tags SET "private" = NULL, dirty = 1, updated_at = ? WHERE id = ?`)
          .run(new Date().toISOString(), canonical.id)
      }
    }

    for (const entry_id of entries_linked_to({ db, junction_table: 'entry_tags', label_column: 'tag_id', label_ids: dup_ids })) {
      report.tag_junctions_created += ensure_junction({
        db, junction_table: 'entry_tags', label_column: 'tag_id', entry_id, canonical_id: canonical.id, user_id, dry_run,
      })
    }

    for (const dup of dups) {
      report.tags_removed++
      if (!dry_run)
        delete_dict_row({ db, table_name: 'tags', id: dup.id, user_id })
    }
  }
}

function dedup_dialects({ db, user_id, dry_run, report }: {
  db: Database.Database
  user_id: string
  dry_run: boolean
  report: DedupLabelsReport
}) {
  const dialects = db.prepare(`SELECT id, name, created_at FROM dialects`).all() as DialectRow[]
  const parsed = dialects.map(dialect => ({
    ...dialect,
    parsed_name: JSON.parse(dialect.name) as MultiString,
  }))
  const groups = group_by(parsed, (dialect) => {
    const key = (dialect.parsed_name.default ?? '').trim().toLowerCase()
    return key || null // skip empty-default: can't safely match
  })

  for (const members of groups.values()) {
    if (members.length < 2)
      continue
    report.dialect_groups_merged++

    const [canonical, ...dups] = by_age(members)
    const dup_ids = dups.map(dup => dup.id)

    // union: fill canonical locale keys that are missing/empty from the dups.
    const merged_name: MultiString = { ...canonical.parsed_name }
    let filled = 0
    for (const dup of by_age(dups)) {
      for (const [locale, value] of Object.entries(dup.parsed_name)) {
        if (value && !(merged_name[locale]?.trim())) {
          merged_name[locale] = value
          filled++
        }
      }
    }
    if (filled) {
      report.dialect_locales_filled += filled
      if (!dry_run) {
        db.prepare(`UPDATE dialects SET name = ?, dirty = 1, updated_at = ? WHERE id = ?`)
          .run(JSON.stringify(merged_name), new Date().toISOString(), canonical.id)
      }
    }

    for (const entry_id of entries_linked_to({ db, junction_table: 'entry_dialects', label_column: 'dialect_id', label_ids: dup_ids })) {
      report.dialect_junctions_created += ensure_junction({
        db, junction_table: 'entry_dialects', label_column: 'dialect_id', entry_id, canonical_id: canonical.id, user_id, dry_run,
      })
    }

    for (const dup of dups) {
      report.dialects_removed++
      if (!dry_run)
        delete_dict_row({ db, table_name: 'dialects', id: dup.id, user_id })
    }
  }
}

/**
 * Dedup a single dictionary's tags + dialects. Wrapped in one transaction so a
 * dry-run touches nothing and a real run is atomic. `dry_run` computes the exact
 * counts (reads only) without writing.
 */
export function dedup_dict_labels({ db, user_id, dry_run }: {
  db: Database.Database
  user_id: string
  dry_run: boolean
}): DedupLabelsReport {
  const report = empty_report()
  db.pragma('defer_foreign_keys = ON')
  db.exec('BEGIN IMMEDIATE')
  try {
    dedup_tags({ db, user_id, dry_run, report })
    dedup_dialects({ db, user_id, dry_run, report })
    if (dry_run)
      db.exec('ROLLBACK')
    else
      db.exec('COMMIT')
    return report
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
