/**
 * The refused-write contract on the sync wire (cross-repo, approved 2026-08-05):
 * a write the server refused becomes (a) a typed, countable telemetry event and
 * (b) a visible message to the person who wrote it.
 *
 * Before this, the only refusal the wire could express was `skipped_orphans`,
 * and the client folded it into a `log_tail` string nothing ever reads — a
 * pushed row could be dropped forever with no queryable row and no word to the
 * editor. `rejected_rows` is ADDITIVE: the servers still send `skipped_orphans`
 * so an old bundle keeps its FK-recovery behaviour, and clients prefer
 * `rejected_rows` when present.
 *
 * Reasons are only ever emitted from code paths that actually exist here:
 *   tombstoned   — shared.db's tombstone-resurrection guard refused the row
 *   orphan       — FK-recovery skipped it (its parent is gone server-side)
 *   duplicate    — a natural-key collision adopted a different canonical id
 *   unauthorized — the caller may not write this row (readonly table / no role)
 */

import type { TranslationKeys } from '$lib/i18n/types'

export const REJECTION_REASONS = ['tombstoned', 'orphan', 'unauthorized', 'duplicate'] as const

export type RejectionReason = typeof REJECTION_REASONS[number]

export interface RejectedRow {
  table_name: string
  id: string
  reason: RejectionReason
}

/**
 * Cap on ids carried per (table, reason) group. A refusal can cover a whole
 * push (a lapsed role rejects every dirty row), and telemetry rows are not a
 * place to ship thousands of uuids — `count` stays exact, `ids` is a sample.
 */
export const MAX_REJECTED_IDS_PER_GROUP = 20

export interface RejectionGroup {
  reason: RejectionReason
  table_name: string
  /** Exact number of rows refused for this (table, reason) — not `ids.length`. */
  count: number
  ids: string[]
}

/**
 * One event per (table, reason) per round trip, never one per row — a push of
 * 400 refused rows must not become 400 log rows.
 */
export function group_rejected_rows(rejected: readonly RejectedRow[]): RejectionGroup[] {
  const groups = new Map<string, RejectionGroup>()
  for (const row of rejected) {
    const key = `${row.reason}::${row.table_name}`
    const group = groups.get(key)
    if (!group) {
      groups.set(key, { reason: row.reason, table_name: row.table_name, count: 1, ids: [row.id] })
      continue
    }
    group.count++
    if (group.ids.length < MAX_REJECTED_IDS_PER_GROUP)
      group.ids.push(row.id)
  }
  return [...groups.values()]
}

/**
 * What the client should act on this round trip. Prefers `rejected_rows`; falls
 * back to the legacy `skipped_orphans` shape so a client talking to a server
 * that predates the contract still reports the one refusal it could express.
 */
export function resolve_rejected_rows({ rejected_rows, skipped_orphans }: {
  rejected_rows?: RejectedRow[]
  skipped_orphans?: { table_name: string, id: string, parent_table?: string }[]
}): RejectedRow[] {
  if (rejected_rows?.length)
    return rejected_rows
  return (skipped_orphans ?? []).map(orphan => ({ table_name: orphan.table_name, id: orphan.id, reason: 'orphan' as const }))
}

/** Headline for the user-facing toast: how many, and why (or `mixed`). */
export interface PushRejectionSummary {
  count: number
  reason: RejectionReason | 'mixed'
}

export function summarize_rejections(rejected: readonly RejectedRow[]): PushRejectionSummary {
  const reasons = new Set(rejected.map(row => row.reason))
  return { count: rejected.length, reason: reasons.size === 1 ? [...reasons][0] : 'mixed' }
}

/**
 * A rejection that nothing clears (a lapsed role, a permanently orphaned row)
 * recurs on EVERY 30-second round trip. Report the first one, then suppress the
 * identical signature for this long — otherwise one wedged editor produces a
 * toast every half minute and 2,880 telemetry rows a day saying the same thing.
 */
export const REJECTION_REPORT_THROTTLE_MS = 10 * 60 * 1000

/** Stable identity of "what was refused this round trip", for the throttle. */
export function rejection_signature(groups: readonly RejectionGroup[]): string {
  return groups.map(group => `${group.reason}:${group.table_name}:${group.count}`).sort().join('|')
}

export function should_report_rejections({ signature, last, now }: {
  signature: string
  last: { key: string, at: number } | null
  now: number
}): boolean {
  if (!last || last.key !== signature)
    return true
  return now - last.at >= REJECTION_REPORT_THROTTLE_MS
}

/**
 * i18n keys for the toast's "why" clause. Written out (not built by string
 * concatenation) so the key catalog stays greppable and the missing-key report
 * can see them.
 */
export const REJECTION_REASON_I18N_KEYS: Record<RejectionReason | 'mixed', TranslationKeys> = {
  tombstoned: 'misc.push_rejected_tombstoned',
  orphan: 'misc.push_rejected_orphan',
  unauthorized: 'misc.push_rejected_unauthorized',
  duplicate: 'misc.push_rejected_duplicate',
  mixed: 'misc.push_rejected_mixed',
}

if (import.meta.vitest) {
  describe(group_rejected_rows, () => {
    test('one group per (table, reason) with an exact count', () => {
      expect(group_rejected_rows([
        { table_name: 'senses', id: 's1', reason: 'orphan' },
        { table_name: 'senses', id: 's2', reason: 'orphan' },
        { table_name: 'entries', id: 'e1', reason: 'orphan' },
        { table_name: 'senses', id: 's3', reason: 'duplicate' },
      ])).toEqual([
        { reason: 'orphan', table_name: 'senses', count: 2, ids: ['s1', 's2'] },
        { reason: 'orphan', table_name: 'entries', count: 1, ids: ['e1'] },
        { reason: 'duplicate', table_name: 'senses', count: 1, ids: ['s3'] },
      ])
    })

    test('caps the id sample but keeps the count exact', () => {
      const rows: RejectedRow[] = Array.from({ length: 55 }, (_, index) => ({ table_name: 'entries', id: `e${index}`, reason: 'unauthorized' }))
      const [group] = group_rejected_rows(rows)
      expect(group.count).toBe(55)
      expect(group.ids).toHaveLength(MAX_REJECTED_IDS_PER_GROUP)
    })
  })

  describe(resolve_rejected_rows, () => {
    test('prefers rejected_rows and ignores the legacy echo of the same refusals', () => {
      expect(resolve_rejected_rows({
        rejected_rows: [{ table_name: 'senses', id: 's1', reason: 'orphan' }],
        skipped_orphans: [{ table_name: 'senses', id: 's1', parent_table: 'entries' }],
      })).toEqual([{ table_name: 'senses', id: 's1', reason: 'orphan' }])
    })

    test('falls back to skipped_orphans from a pre-contract server', () => {
      expect(resolve_rejected_rows({ skipped_orphans: [{ table_name: 'senses', id: 's1', parent_table: 'entries' }] }))
        .toEqual([{ table_name: 'senses', id: 's1', reason: 'orphan' }])
    })

    test('nothing refused → empty', () => {
      expect(resolve_rejected_rows({})).toEqual([])
    })
  })

  describe(should_report_rejections, () => {
    const now = 1_000_000
    const signature = 'orphan:senses:2'

    test('reports the first occurrence', () => {
      expect(should_report_rejections({ signature, last: null, now })).toBe(true)
    })

    test('suppresses the identical refusal recurring on the next round trip', () => {
      expect(should_report_rejections({ signature, last: { key: signature, at: now - 1000 }, now })).toBe(false)
    })

    test('a changed refusal always reports', () => {
      expect(should_report_rejections({ signature: 'orphan:senses:3', last: { key: signature, at: now - 1000 }, now })).toBe(true)
    })

    test('reports again once the window passes', () => {
      expect(should_report_rejections({ signature, last: { key: signature, at: now - REJECTION_REPORT_THROTTLE_MS }, now })).toBe(true)
    })
  })

  describe(summarize_rejections, () => {
    test('single reason', () => {
      expect(summarize_rejections([
        { table_name: 'senses', id: 's1', reason: 'orphan' },
        { table_name: 'entries', id: 'e1', reason: 'orphan' },
      ])).toEqual({ count: 2, reason: 'orphan' })
    })

    test('more than one reason collapses to mixed', () => {
      expect(summarize_rejections([
        { table_name: 'senses', id: 's1', reason: 'orphan' },
        { table_name: 'entries', id: 'e1', reason: 'duplicate' },
      ])).toEqual({ count: 2, reason: 'mixed' })
    })
  })
}
