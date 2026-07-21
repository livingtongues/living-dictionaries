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

## Remaining hardening

- [ ] Make the server merge normalize any pre-existing canonical `dirty` flag to `NULL`, or strip/normalize `dirty` on server pull responses, with a regression test for an existing server row carrying `dirty=1`. This prevents legacy server flags from being inherited by pull-only clients.
