/**
 * Super-admin maintenance: dedup same-name `tags` / `dialects` across every
 * dictionary (or one, via `dict_id`). See `$lib/db/server/dedup-labels.ts` for
 * the algorithm + sync reasoning. `dry_run: true` reports exact counts without
 * writing.
 *
 * On a real run, each affected dict's `shared.db.dictionaries.updated_at` is
 * bumped so the R2 snapshot builder rebuilds it (cold loaders) — already-open
 * editors converge via `/changes` (fresh junction rows + dup tombstones).
 *
 * Super-admin (level 3) only: it writes to production content DBs wholesale.
 */
import type { RequestHandler } from './$types'
import { existsSync } from 'node:fs'
import { is_admin_at_least } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { dictionary_db_path, get_dictionary_db } from '$lib/db/server/dictionary-db'
import { dedup_dict_labels, empty_report, report_has_changes } from '$lib/db/server/dedup-labels'
import type { DedupLabelsReport } from '$lib/db/server/dedup-labels'
import { error, json } from '@sveltejs/kit'

export interface AdminDedupLabelsRequestBody {
  /** true = compute counts only, write nothing. */
  dry_run: boolean
  /** Limit to one dictionary; omit to sweep all. */
  dict_id?: string
}

export interface AdminDedupLabelsResponseBody {
  dry_run: boolean
  dicts_scanned: number
  dicts_affected: number
  totals: DedupLabelsReport
  /** Per-dict reports, affected dicts only (sorted by tags_removed desc). */
  per_dict: (DedupLabelsReport & { dict_id: string })[]
}

function add_totals(a: DedupLabelsReport, b: DedupLabelsReport): DedupLabelsReport {
  return {
    tag_groups_merged: a.tag_groups_merged + b.tag_groups_merged,
    tags_removed: a.tags_removed + b.tags_removed,
    tag_junctions_created: a.tag_junctions_created + b.tag_junctions_created,
    tag_privacy_widened: a.tag_privacy_widened + b.tag_privacy_widened,
    dialect_groups_merged: a.dialect_groups_merged + b.dialect_groups_merged,
    dialects_removed: a.dialects_removed + b.dialects_removed,
    dialect_junctions_created: a.dialect_junctions_created + b.dialect_junctions_created,
    dialect_locales_filled: a.dialect_locales_filled + b.dialect_locales_filled,
  }
}

export const POST: RequestHandler = async (event) => {
  const { user_id, email } = await verify_auth(event)
  if (!is_admin_at_least(email, 3))
    error(ResponseCodes.FORBIDDEN, 'Super admin only')

  const { dry_run, dict_id } = await event.request.json() as AdminDedupLabelsRequestBody
  if (typeof dry_run !== 'boolean')
    error(ResponseCodes.BAD_REQUEST, 'dry_run (boolean) required')

  const shared = get_shared_db()
  const dict_ids = dict_id
    ? [dict_id]
    : (shared.prepare(`SELECT id FROM dictionaries ORDER BY id`).all() as { id: string }[]).map(row => row.id)

  let totals = empty_report()
  const per_dict: (DedupLabelsReport & { dict_id: string })[] = []
  let dicts_scanned = 0

  for (const id of dict_ids) {
    if (!existsSync(dictionary_db_path(id)))
      continue // never-opened dict — nothing to dedup, don't create a file
    dicts_scanned++
    const db = get_dictionary_db(id)
    const report = dedup_dict_labels({ db, user_id, dry_run })
    totals = add_totals(totals, report)
    if (report_has_changes(report)) {
      per_dict.push({ dict_id: id, ...report })
      if (!dry_run) {
        shared.prepare(`UPDATE dictionaries SET updated_at = ?, dirty = 1 WHERE id = ?`)
          .run(new Date().toISOString(), id)
      }
    }
  }

  per_dict.sort((a, b) => b.tags_removed - a.tags_removed)

  return json({
    dry_run,
    dicts_scanned,
    dicts_affected: per_dict.length,
    totals,
    per_dict,
  } satisfies AdminDedupLabelsResponseBody)
}
