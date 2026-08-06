import type { EntryReview } from '$lib/db/schemas/dictionary.types'
import type { EntryData } from '$lib/types'
import type { GuardedWrites } from '$lib/db/dict-client/guarded-writes'

/**
 * The two bulk edits that write a scalar column on every selected entry.
 *
 * They live outside `BulkActionBar.svelte` because the ORDER matters and the
 * order is what a component test can't reach: paint the on-screen row ONLY
 * after the guarded write resolves. The original pair assigned
 * `entry.main.… =` first and awaited afterwards with no rollback and no catch,
 * so a refused write left the table showing an edit that never persisted and
 * abandoned the rest of the selection (2026-08-04 nightly review, item 2).
 *
 * The facade owns the refusal: it toasts, logs `write_blocked`, and returns
 * `undefined` — so a failed entry simply keeps its old value and the loop
 * carries on. The counts come back for tests and any future summary UI.
 */

export interface BulkOutcome {
  written: number
  refused: number
  /** Entries skipped without attempting a write (already had the value / not loaded). */
  skipped: number
}

type BulkEntries = Record<string, EntryData | undefined>

export async function apply_bulk_source({ writes, entries, entry_ids, slug }: {
  writes: Pick<GuardedWrites, 'set_sources'>
  entries: BulkEntries
  entry_ids: string[]
  slug: string
}): Promise<BulkOutcome> {
  const outcome: BulkOutcome = { written: 0, refused: 0, skipped: 0 }
  for (const entry_id of entry_ids) {
    const entry = entries[entry_id]
    if (!entry || entry.main.sources?.includes(slug)) {
      outcome.skipped++
      continue
    }
    const merged = [...(entry.main.sources || []), slug]
    const written = await writes.set_sources({ entry_id, sources: merged })
    if (!written) {
      outcome.refused++
      continue
    }
    entry.main.sources = merged
    outcome.written++
  }
  return outcome
}

export async function apply_bulk_review({ writes, entries, entry_ids, review }: {
  writes: Pick<GuardedWrites, 'set_review'>
  entries: BulkEntries
  entry_ids: string[]
  /** null clears the flag. */
  review: EntryReview | null
}): Promise<BulkOutcome> {
  const outcome: BulkOutcome = { written: 0, refused: 0, skipped: 0 }
  for (const entry_id of entry_ids) {
    const written = await writes.set_review({ entry_id, review })
    if (!written) {
      outcome.refused++
      continue
    }
    outcome.written++
    const entry = entries[entry_id]
    if (entry)
      entry.main.review = review
  }
  return outcome
}
