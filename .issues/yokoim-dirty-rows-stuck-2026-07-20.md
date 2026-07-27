# Yokoim editor has 44 dirty rows stuck

## Production evidence — 2026-07-20

- One real signed-in editor session on `yokoim` reported `dirty_rows_stuck` five times from 17:37 through 19:50 UTC.
- The count remained exactly **44 dirty rows / 0 deletes** for more than two hours.
- `last_sync_at` kept advancing and `last_error` stayed null, so the sync loop was alive but was not clearing these specific rows.
- The editor is deliberately unnamed here; resolve the user from telemetry only if direct outreach is needed.

## Follow-up

- [x] ✅ Rechecked production through 2026-07-21 02:29 UTC: the same session continued reporting exactly 44 rows with advancing `last_sync_at` and no error.
- [x] ✅ Identified all 44 as canonical server-side `entry_dialects` rows with stale `dirty=1`. Every entry and dialect parent exists and `PRAGMA foreign_key_check` is clean. They were created together on 2026-07-09; this was not new unsynced work from the reporting browser.
- [x] ✅ Traced acknowledgement history: an authorized super-manager pushed exactly 44 Yokoim rows at 2026-07-20 11:44 UTC. The rows' content was already canonical, so no history delta was emitted. `merge_dict_row` deliberately excludes `dirty` from accepted columns, but on conflict it also leaves a pre-existing server `dirty=1` untouched. The reporting user has no Yokoim role, so their worker correctly performs pull-only sync: `last_sync_at` advances while it cannot push/clear these inherited flags.
- [x] ✅ Recovery completed at 2026-07-21 03:09 UTC. Created an online backup at `/data/.backup-staging/yokoim-before-dirty-cleanup-2026-07-21T03-09-23.109Z.db`, then transactionally changed only `entry_dialects WHERE dirty=1`: 44 before → 44 changed → 0 after; FK integrity remained clean.
- [x] ✅ Rebuilt the clean Yokoim R2 snapshot. The standalone builder lacked initialized Svelte runtime env and uploaded nothing, so the snapshot was queued for the normal in-app builder; it uploaded successfully at 2026-07-21 03:15:34 UTC.
- [x] ✅ No editor outreach is required and nobody should be asked to reload/close. The reporting browser contains no unique work; it inherited server flags while browsing anonymously/pull-only. Its old OPFS copy may continue warning until naturally replaced, but the canonical data and future snapshot are clean.

## Fleet-wide recheck — 2026-07-26 (daily log review)

The Yokoim cleanup fixed one dictionary; the **class is fleet-wide and still open**. Counted directly
against the production per-dictionary databases on 2026-07-26 21:00 UTC:

**5,437 rows carrying a stale server-side `dirty = 1`, across 33 dictionaries** — every one of them in
`entry_dialects` or `entry_tags`, never in a content table (consistent with the bulk-write inheritance
root cause above).

| Dictionary | Stale flags | Table |
|---|---:|---|
| batsi-kop-tsotsil-tsot | 2,146 | `entry_dialects` |
| wancho | 1,163 | `entry_dialects` |
| south-saami | 1,078 | `entry_dialects` |
| galo | 499 | `entry_dialects` |
| sugtstun | 200 | `entry_tags` |
| mahasuvi | 116 | `entry_dialects` |
| udekau | 65 | `entry_tags` |
| algonquin | 39 | `entry_tags` |
| vismay-international-corp | 32 | `entry_dialects` |
| daashi-dictionary | 18 | `entry_dialects` |
| *…23 more, each ≤12* | 81 | both |

Every affected dictionary ships these flags in its R2 snapshot, so **each visitor's browser inherits
phantom unsaved work it can never push** (pull-only clients don't send dirty rows — see
`dict-sync-engine.ts` `#build_request`, gated on `#has_editor_role`) and warns `dirty_rows_stuck`
every 30 minutes forever.

Confirmed instances this week, all with `last_error: null` and advancing `last_sync_at`, and in every
case **the reporting user holds no role on that dictionary** (checked `dictionary_roles`):
mahasuvi (116 rows, since 07-22), batsi-kop ×2 users (2,146 rows), boienen (2 rows, since 07-20),
algonquin (39 rows), yokoim (44 rows, since fixed).

**Second cost:** the false positives poison `dirty_rows_stuck`, whose whole purpose is catching a
*genuine* editor wedge. With 33 dictionaries emitting them, a real wedge is hard to see.

## Remaining hardening — ✅ ALL DONE 2026-07-27

- [x] ✅ **Server merge normalizes the flag, and the pull strips it.** Three layers, because the class
      needed a source fix, a repair-on-touch, and a guard for rows nobody ever touches again:
      1. **The SOURCE, found while doing this work:** `dictionary-sync-helpers.ts` was never the
         culprit — **`$lib/db/server/dedup-labels.ts` was**. That server-side maintenance job minted
         `entry_tags`/`entry_dialects` junctions with a literal `dirty, … VALUES (?, ?, ?, 1, …)` and
         also set `dirty = 1` when widening a tag's privacy / renaming a dialect. That is exactly the
         "created together in bulk, only junction tables, never content tables" signature. Those
         writes no longer set `dirty` at all (propagation is `server_seq`'s job).
      2. `merge_dict_row` now clears a pre-existing server `dirty` on every upsert (a pushed value is
         still never trusted).
      3. The `/changes` PULL strips `dirty` from every outgoing row (`normalize_server_dirty`),
         including the dedup-echo path — so even a row nobody re-merges stops spreading — and
         `clear_dirty_flags()` in `r2-snapshot-builder.ts` clears them in the snapshot COPY (never the
         live db), which self-heals any dictionary the one-off pass missed.
      Regression tests in `dictionary-sync.test.ts`: a pull never carries a flagged row, a merge clears
      an existing server flag, and a snapshot copy ships clean (idempotently).
- [x] ✅ **One-off cleanup pass over the 33 dictionaries — DONE on production 2026-07-27 03:19 UTC.**
      Scan of all **1,284** dictionary DBs found exactly the expected **5,437 rows / 33 dictionaries**
      (`entry_dialects` 5,103 + `entry_tags` 334, nothing else). Dry-run first, then per dictionary:
      online backup → `/data/.backup-staging/{id}-before-dirty-cleanup-2026-07-27T03-19-36-571Z.db` →
      one transaction `UPDATE … SET dirty = NULL WHERE dirty IS NOT NULL` → re-count → `foreign_key_check`.
      Result: **5,437 cleared, 0 residual, 0 FK violations, 0 errors**; a re-scan reports
      `affected: 0`. Then `dictionaries.updated_at` was bumped for those 33 catalog rows to queue a
      re-snapshot; the builder uploaded all 33 by 03:21 UTC. Verified from the PUBLIC R2 object:
      `batsi-kop-tsotsil-tsot.db.gz` (the worst, 2,146 flags) now has **0 dirty rows of 9,241
      `entry_dialects`**.
- [x] ✅ **`dirty_rows_stuck` enriched** with `{ tables: {name: count}, has_editor_role,
      oldest_dirty_updated_at }` (`report-dict-sync-failure.ts` + the engine watchdog, which now counts
      per table and takes `MIN(updated_at)`). An inherited flag self-classifies:
      `has_editor_role: false` + junction-only `tables` + an `oldest_dirty_updated_at` predating the
      session = the harmless class; anything else is a genuine wedge.

## Open, related, NOT fixed tonight (needs a decision)

The **same class exists in `shared.db`** — 351 canonical rows carrying `dirty`: `dictionaries` 195,
`dictionary_partners` 79, `dictionary_roles` 56, `invites` 11, `message_threads` 9, `messages` 1. It
was left alone deliberately: unlike the dict DBs, LD's server code writes `dirty = 1` there ON PURPOSE
(`gloss-languages.ts`, `orthographies.ts`, and the database skill's own ops rule #2 tells operators to
do it on any shared.db edit), so the flag may be load-bearing for admin-client convergence. Only admins
sync shared.db and they hold editor rights, so the "can never clear it" trap doesn't bite the same way —
but the semantics deserve one decision rather than a copy of tonight's fix.

