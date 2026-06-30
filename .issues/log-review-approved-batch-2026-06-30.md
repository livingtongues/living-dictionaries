# Approved batch from the 2026-06-29 overnight brief (+ nightly-review N-items)

Routed via inbox 2026-06-30. All approved; execute + verify (vitest/tsc/lint/check).

## LD log-review items
- ✅ **L1** — `dictionary_partners` backfill migration (`20260629b_dictionary_partners_backfill.sql`):
  idempotent `CREATE TABLE IF NOT EXISTS` + indexes + `DROP/CREATE process_delete_cascade` (live
  trigger lacked the `dictionary_partners` arm). Schema-drift audit done against live `sqlite_master`:
  **only `dictionary_partners` was missing** (messages/chat/api_keys/email_aliases all present).
- ✅ **L2** — `process_sync` skips + logs missing syncable tables (`present_syncable_tables()` →
  `sync_missing_syncable_table` warn) instead of 500-ing. Regression test in `sync-helpers.test.ts`.
- ✅ **L3** — schema-drift guard on the pipeline-health strip: `PipelineHealth.missing_syncable_tables`
  in `log-analytics.ts` + a red banner in `analytics/+page.svelte`. Snapshot updated.
- ✅ **L4** — visibility-aware heartbeats: heartbeats already skipped while hidden; added an **idle
  gate** (`IDLE_TIMEOUT_MS = 5min`, activity listeners) so a visible-but-untouched tab (today's 11h
  ~1,200-heartbeat session) stops emitting. Resumes on pointer/key/scroll/visibility-return. Test added.
- ✅ **L5** — leader-worker failures by SQLite `code` + current/stale build: `LeaderHealth.failed_by_code`
  + `failed_current`/`failed_stale` in `log-analytics.ts`; "Failed by code" table + current/stale
  sub-line on the page. Snapshot updated (exercises NOTADB/timeout + v-cur/v-old).
- ✅ **L6** — `log_server_event` in failure paths:
  - `[dictionaryId]/+layout.ts` catch — rethrows the RAW error on the server so `handleError`
    captures it (was wrapped in an `error(500)` HttpError that handleError skips).
  - Added to catch-and-return paths: `dictionaries/[id]/catalog`, `dictionaries/[id]/partners`,
    `dictionaries/[id]/invites/[invite_id]/accept`, `email/invite`, `messages/reply`, and the two
    best-effort cleanup catches in `dictionaries/[id]` (db-file + R2-snapshot removal).
  - **Already instrumented (verified):** auth send-code/verify, upload, email-inbound.
  - **Intentionally deferred (low-stakes/internal):** admin-chat routes, `admin/schema-from-sql`
    (dev tool), `api/log` (self-referential — must NOT log, loop risk), and the v1 sub-resource
    catches that return expected `BAD_REQUEST` on bad input (not server-fault gaps).

## Nightly-review (Codex) N-items — single-writer through LD
- ✅ **N1** — `v1-entry-write.ts` per-item history now buffered in `item_history` and merged into the
  shared list ONLY after `RELEASE v1_item`; a later-row failure discards it with the rolled-back rows.
  Regression test (`v1-entry-write.test.ts`) spies `merge_dict_row` to fail the 2nd row → asserts
  entry rolled back AND `changes` empty.
- ✅ **N3** — legacy `helpers/get-post-requests.ts` deleted; all 10 `_call.ts` imports repointed to
  `$lib/utils/requests` (pure import swap — none used the differing `fetch`/options args).
- ✅ **N4** — `src/lib/db/server/v1-route-context.ts` exports `load_v1_dictionary_context` (resolve +
  auth gate) + `mirror_dictionary_cursor`. All 6 v1 route files refactored onto them (deleted 2 dup
  `mirror_updated_at` fns + 3 inline mirrors + 12 resolve/verify boilerplate blocks).
- ✅ **N5** — `src/lib/api/v1/openapi.test.ts`: compile-time `Record<keyof EntryInput, true>` (etc.)
  key inventories force interface↔test sync; runtime asserts OpenAPI schema props == those keys,
  `required:['lexeme']`, SensePatch allOf+id, all 6 paths×methods, 3.1.0 + server origin.

## Verification (all green)
- `pnpm vitest run` → **756 passed / 3 skipped** (115 files; +6 new tests).
- `tsc --noEmit` clean · `eslint` clean on all changed files · `pnpm check` → 0 errors.
- Visual (svelte-look): schema-drift banner + leader-health "Failed by code" table render (new
  `SchemaDrift` story).

## Deploy note
The L1 migration runs automatically on next deploy (server + every admin client via the `migrations`
table). Do NOT hand-mutate prod — let the migration record itself. After deploy, the `/admin/analytics`
schema-drift banner should clear and admin-sync stops skip-logging `dictionary_partners`.
