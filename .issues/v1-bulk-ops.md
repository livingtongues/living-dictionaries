# v1 bulk operations — relationships batch, delete-by-import_id, bulk-read docs

Source: agent feedback thread `cf6809b0-1c26-495d-8c61-9cb3b41fb003` (River, 2026-07-18, marked
resolved 2026-07-19) — gaps 2, 8, 9.

## 1. Bulk relationships

Entries batch at ≤1000/request but `POST …/relationships` takes ONE `RelationshipInput` per call —
cognate ledgers are naturally tens of thousands of rows.

- Accept `{ relationships: RelationshipInput[] }` (cap 1000, mirror `MAX_ENTRIES_PER_REQUEST`) with
  per-item `results: [{ status: 'created'|'exists'|'failed', relationship_id?, error? }]` in input
  order — same contract as bulk entries (retry-safe: `exists` on idempotent re-POST).
- Keep the current single-object body working (wrap internally) — don't break existing callers.
- Reuse the existing canonicalization (directed pairs rewritten to canonical slug + flipped endpoints)
  and symmetric dedupe per item; a failure in one item must not abort the rest (per-item best-effort,
  like entries).
- Wrap the batch in one transaction per chunk for write amplification, but report per-item.
- openapi: request/response schemas + "Batch ≤1000" note; guides: mention in import guide.
- Tests: mixed batch (created + exists + failed), canonicalization inside a batch, cap enforcement.

## 2. Batch delete by `import_id` (+ dry-run) + documented full-reset path

Bad-import recovery is currently thousands of single DELETEs. Entries from a bulk import carry a
private tag named after the `import_id`.

- `POST …/entries/batch-delete` with `{ import_id, dry_run? }`:
  - `dry_run: true` → `{ count, sample_entry_ids: […≤20] }`, NO writes.
  - real run → tombstone each matched entry via the `deletes` table (`INSERT INTO deletes` →
    `process_delete_cascade` trigger FK-cascades senses/junctions and propagates to peers + the
    snapshot builder — NEVER raw `DELETE`, per sync invariants).
  - Response mirrors dry-run shape + `deleted: true`.
- Scope: entries linked to the private tag whose name == import_id. Decide + document what happens to
  the tag row itself (recommend: delete the now-empty private tag too) and to sentences that were
  created as those entries' examples but are ALSO linked elsewhere (junction cascade removes the link;
  only delete orphaned standalone example sentences created by that import — simplest v1: leave
  orphaned sentences, document it; revisit if importers complain).
- Guides: a "recovering from a bad import" section — dry-run first, then delete, then re-import with
  the same deterministic ids; plus the "full reset" answer (delete by each import_id used, or ask an
  admin to reset the dictionary).
- Log a server event with count (`v1_batch_delete`) — this is a big destructive lever; also consider
  requiring `dry_run` result count echoed back (`confirm_count`) to arm the real run. Recommended:
  yes, require `confirm_count` matching the live count (cheap tripwire against stale scripts).

## 3. Bulk export — docs only (Jacob decision: NO JSONL endpoints)

Verification/backup by paging 500-at-a-time is the wrong tool. The gzipped SQLite snapshot at
`snapshots.livingdictionaries.app/dictionaries/{id}.db.gz` exists for **every dictionary except
`bucket='secure'`** and is THE bulk-read/mirror/backup path.

- Work lives in `.issues/v1-api-quick-wins.md` §11 (fix the wrong "public and unlisted" docs claim +
  add a snapshot-loading guide). Freshness fix is `.issues/snapshot-edge-cache.md`.
- This issue only: make sure the import/verify guides cross-link the snapshot guide ("verify a big
  import by downloading the snapshot and running COUNT/spot-check queries locally").

## Acceptance
- `pnpm test` / `tsc` / `pnpm lint` / `pnpm check`; openapi.test.ts inventory updated.
- Live dev smoke: bulk-relationship batch on a dev dict; batch-delete dry-run vs real on a throwaway
  import_id (verify tombstones + peer sync via a second client, or at least the deletes rows).
- `.knowledge/api/v1-write-api.md` updated (batch-delete semantics + confirm_count rationale).
