# Port R2 snapshot builder + remove R2-deferral notes (living)

Bring living's R2 db-snapshot pipeline to parity with `living-dictionaries-example`.
Media (images/audio/video) stays on GCS for now — R2 is used only for **email
attachments** (already wired) and **db snapshots** (this work).

## Context
- R2 client/attachments/delete-object are already byte-identical to the example.
- `dictionaries.snapshot_uploaded_at` column + index already exist (20260525_initial.sql).
- Email attachments already use R2 (`messages/reply`, `email-inbound`).
- Missing: snapshot builder cron, constants, hooks wiring, read-side R2 branch.

## Changes
- [x] ✅ `lib/constants.ts` — add `r2_dict_snapshot_key()` + `R2_SNAPSHOT_INTERVAL_MS`.
- [x] ✅ `lib/db/server/r2-snapshot-builder.ts` — NEW, ported from example (per-dict
      sweep → `db.backup()` → gzip → R2 PUT `dictionaries/{id}.db.gz` → bump
      `snapshot_uploaded_at`). Singleton via globalThis.
- [x] ✅ `hooks.server.ts` — `start_r2_snapshot_builder()` gated by
      `R2_SNAPSHOT_BUILDER_ENABLED === 'true'` (kept existing boot `get_shared_db()`).
- [x] ✅ `lib/db/dict-client/fetch-snapshot.ts` — branch editor→VPS, viewer→public
      R2 (`snapshots.livingdictionaries.app`). "no R2 yet" note removed.
- [x] ✅ `routes/api/dictionary/[id]/db/+server.ts` — gated to editors
      (`verify_auth_dict_role`), preserved url-or-id resolution. "no R2" note removed.
- [x] ✅ `routes/api/dictionaries/[id]/+server.ts` (teardown) — added R2 snapshot
      delete (`delete_object`). R2-snapshot-cleanup deferral removed; orphaned-media
      deferral kept (GCS, not ported).
- [x] ✅ Test for `sweep_dirty_dictionaries` (in-memory dbs + mocked R2) — 4 tests pass.

## Verify ✅
- New test: 4/4 pass.
- Touched-area suite: 52/52 pass (`src/lib/db`, `src/routes/api/dictionary*`).
- `pnpm --filter site check`: 0 new errors (7 pre-existing in i18n/auth/introspect — tsconfig module/target, untouched).

## Out of scope (flagged)
- orphaned-media-log harvest (GCS media concern; example has it, living doesn't).
- Per-dict migration sweep in hooks (example has it; unrelated to R2 — note it).
- Dev caveat: viewers fetch prod R2 in dev (matches example blueprint).

## Verify
- `pnpm --filter site check` (typecheck)
- `pnpm --filter site test` (existing + new test)
