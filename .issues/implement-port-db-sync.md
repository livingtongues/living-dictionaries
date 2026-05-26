# Implementation: port DB + sync architecture from house → LD `site/`

Implementing `.issues/port-db-sync-architecture.md`. This is a large multi-file port.

## Strategy

Work bottom-up by story. Story A (shared.db + admin.db sync) is the foundation; Story B (dict.db editor sync) builds on it; Story C (viewer R2 pull) adds the snapshot pipeline on top.

Stub `verify_auth` (L3 dependency) where needed so endpoints compile.

## Progress

### Story A — Admin sync (shared.db ↔ admin.db)

- [x] `lib/constants.ts` (LD-specific + ResponseCodes from house)
- [x] `lib/db/schemas/shared.types.ts` (LD-specific types)
- [x] `lib/db/schemas/shared.ts` (Drizzle schema)
- [x] `lib/db/schemas/json-columns.ts` (with tests)
- [x] `lib/db/schemas/shared-migrations/20260525_initial.sql`
- [x] `lib/db/server/run-sql-migrations.ts`
- [x] `lib/db/server/shared-db.ts`
- [x] `lib/db/server/typed-query.ts`
- [x] `lib/db/sync/types.ts` (single-sector for LD)
- [x] `lib/db/sync/errors.ts`
- [x] `lib/db/server/sync-helpers.ts` (process_sync — simplified for LD)
- [x] `lib/db/sync/history.svelte.ts`
- [x] `lib/db/sync/SyncStatus.svelte`
- [x] `lib/db/client/connection.ts`
- [x] `lib/db/client/live/{notifier,reconcile-rows,table-store,types,live-db}.ts`
- [x] `lib/db/client/db.ts`
- [x] `lib/db/sync/engine.svelte.ts`
- [x] `lib/auth/verify.ts` (stub — returns null user; L3 will replace)
- [x] `lib/admins.ts` (LD admin allow-list with admin_level)
- [x] `lib/utils/requests.ts` (post_request helper)
- [x] `routes/api/admin-sync/{+server.ts, _call.ts}`
- [x] `hooks.server.ts` (boot-time get_shared_db)

### Story B — Editor sync (per-dictionary.db, bidirectional)

- [x] `lib/db/schemas/dictionary.ts` (Drizzle for dict.db)
- [x] `lib/db/schemas/dictionary.types.ts`
- [x] `lib/db/schemas/dictionary-migrations/20260525_initial.sql`
- [x] `lib/db/schemas/dictionary-json-columns.ts`
- [x] `lib/db/server/dictionary-db.ts` (LRU cache for per-dict connections)
- [x] `routes/api/dictionary/[id]/db/+server.ts` (fresh snapshot fetch for editors)
- [x] `routes/api/dictionary/[id]/changes/+server.ts` (push + pull)
- [ ] **DEFERRED**: SharedWorker + OPFS VFS client architecture (Story B.1)
  - This is a major new piece, not present in house or tutor. Needs its own session.
  - Includes: SharedWorker bootstrap, OPFS VFS wrapper, RPC protocol, main-thread shim, multi-tab broadcasting.

### Story C — Viewer sync (per-dictionary.db, pull-only from R2)

- [x] `lib/r2/client.ts` (R2 PutObject wrapper)
- [x] `lib/db/server/r2-snapshot-builder.ts` (30-min cron logic)
- [x] Update `hooks.server.ts` with cron `setInterval` + `start_worker_once` guard
- [ ] **DEFERRED**: Client first-fetch flow (depends on SharedWorker from B.1)
- [x] `snapshot_expired` sentinel in `/changes` (server-side only)

### Notes / decisions made during implementation

- **`verify_auth` stub**: returns `{ user_id, email, admin_level }` from a dev-only header `x-dev-user-id` for now, or throws 401. To be replaced by L3 auth port.
- **`process_sync`**: simplified to single-sector vs house's 3-sector model. LD's admin.db is one big bucket of tables flagged `admin` vs `server-only`.
- **Trigger-fanout for `last_modified_at`**: per Q-shared.2, hand-written in the SQL migration file.
- **Watermark in shared.db sync**: still uses `db_metadata.synced_up_to` (no per-sector since there's only one sector).
- **Dict.db push/pull endpoint**: pushes mirror `db_metadata.last_modified_at` → `shared.db.dictionaries.updated_at` (cross-DB cascade).
- **Migration discipline**: per Q10, server keeps `dictionaries.dict_db_schema_version` to know which dicts need migration. Lazy apply in `get_dictionary_db(id)`. Boot-time sweep deferred to follow-up.
- **L4 Phase-2 email tables**: deferred (not in shared.ts).
- **SharedWorker / OPFS** for dict.db client: deferred to follow-up. Server-side push/pull endpoints work and can be exercised via curl/tests.

### Verification done

- `pnpm lint` — clean (after fixes)
- `pnpm check` — clean (svelte-check via tsgo passes)
- `pnpm test` — 45 tests pass across 10 files, including:
  - `json-columns.test.ts` — 6 tests covering JSON parse/stringify round trips for shared.db
  - `dictionary-json-columns.test.ts` — 2 tests covering dict.db JSON columns
  - `sync-helpers.test.ts` — 5 tests covering VALID_COLUMNS + strip_sql_ext
  - `last-visit-ping.test.ts` — 7 tests covering today_local_date / ping logic
  - `reconcile-rows.test.ts` — 4 tests covering live-row reactivity diffing
  - `sync-roundtrip.test.ts` — 5 tests covering full process_sync flows (handshake, push, pull, tombstones)
  - `dictionary-sync.test.ts` — 4 tests covering process_dict_changes (insert, viewer pull-only, soft-delete, last-write-wins)
  - `admins.test.ts` — 5 tests on admin allow-list
  - `reconcile-rows.test.ts` (live diffing)
  - i18n inline tests (carried over from prior work)

### Follow-up tasks (out of this session's scope)

1. **L3 Auth port** — replace `lib/auth/verify.ts` stub with real email-OTP + jose JWT verification.
2. **L4 Email/messages tables** — add `message_threads` + `messages` to shared.db when L4 lands.

---

## Session 2 (2026-05-25) — Land remaining client-side pieces

Picking up the deferred items. Priority order from the user prompt:

### Priority 2 — Server-side gaps (all done)

- [x] **2a. Boot-time per-dict migration sweep** in `hooks.server.ts` (Q10.1).
- [x] **2b. `GET /api/me/dictionary-roles`** endpoint (Story B.6, REST half).
- [x] **2c. Manager REST endpoints** for `dictionary_roles` (Story A.3):
  - `GET    /api/dictionaries/[id]/roles` ✅
  - `POST   /api/dictionaries/[id]/roles` (also folds in invite creation) ✅
  - `DELETE /api/dictionaries/[id]/roles/[role_id]` ✅

### Verification harness page (added so user can cross-tab test in browser)

- [x] `/test/dict-sync/[id]` — Svelte page that wires up SharedWorker → DictLiveDb → reactive entries UI with add/delete.
- [x] `/api/dev/seed-test-dict` — dev-only endpoint creating a test dict + role.
- [x] `lib/auth/dev-identity.ts` — localStorage-backed dev identity (`dev_user_id` + `dev_user_email`).

### Priority 1 — SharedWorker + OPFS VFS for dict.db (Story B.1)

Files landed in `site/src/lib/db/dict-client/`:
- [x] `shared-worker.ts` — SharedWorker entrypoint with per-dict open instances + refcount lifecycle.
- [x] `shared-worker-lifecycle.ts` — main-thread `new SharedWorker(URL)` spawn + pagehide-bye.
- [x] `rpc-types.ts` — RPC message shapes (open/query/exec/close/bye/sync_now + 4 broadcasts).
- [x] `dict-connection.ts` — main-thread `SqliteConnection`-shaped shim over MessagePort RPC + inline test for the SQL table-name extractor.
- [x] `dict-live-db.svelte.ts` — Svelte 5 reactive LiveDb mirror for dict.db (drop-in for the admin LiveDb pattern; subscribes to `tables_changed` broadcasts → `TableChangeNotifier.notify`).
- [x] `opfs-vfs-loader.ts` — OPFS VFS bootstrap with `OriginPrivateFileSystemVFS`; `MemoryAsyncVFS` fallback when SyncAccessHandle unavailable.
- [x] `dict-sync-engine.ts` — per-dict push+pull engine running inside the SharedWorker (30 s interval + on-demand).
- [x] `fetch-snapshot.ts` — VPS for editor / R2 for viewer; carries dev-stub auth headers.
- [x] `dict-migrations-bundle.ts` — client-importable migrations map + `LATEST_DICT_MIGRATION`; covered by unit test.
- [x] `opfs-lru.ts` — IndexedDB-backed LRU with 200 MB visitor budget; editors exempt; eviction skips currently-open dicts.

### Constraints (locked in design doc)

- One SharedWorker per origin; LRU cache of open wa-sqlite + OPFS instances. ✅
- wa-sqlite has **no `sqlite3_deserialize`** — write bytes to OPFS file, open via OPFS VFS. ✅
- wa-sqlite version 1.0.0 ships `OriginPrivateFileSystemVFS` (no `OPFSCoopSyncVFS`/`OPFSAdaptiveVFS`). Use it. ✅
- Pre-iOS-17 fallback: MemoryAsyncVFS, re-fetch every session. ✅ (note: w/o `sqlite3_deserialize` viewers on memory fallback can't load the snapshot bytes — they get an empty schema and the sync engine pulls from `/changes?since=null`. Documented in the file's leading comment. Editors on pre-iOS-17 are blocked, as the doc accepts.)
- Migration files via `import.meta.glob('./dictionary-migrations/*.sql', { eager: true, query: '?raw' })`. ✅
- Error sentinels: 410 `snapshot_expired` → discard OPFS + refetch; 409 `schema_outdated` → page reload broadcast. ✅
- Auth dev-stub headers (`x-dev-user-id` + `x-dev-email`) for the VPS snapshot fetch until L3 lands. ✅

### Verification

- `pnpm lint` — clean ✅
- `pnpm check` — clean ✅
- `pnpm test` — 60 tests across 12 files pass ✅ (5 new in `dict-migrations-bundle.test.ts`, 5 in inline `extract_table_name` tests, 50 carried over)
- **Manual browser test path** (user runs `pnpm dev`):
  - Navigate to `http://localhost:3041/test/dict-sync/test-dict-1`
  - First load: page calls `/api/dev/seed-test-dict` (creates dict + role + applies migrations), spawns SharedWorker, fetches `/api/dictionary/test-dict-1/db`, opens OPFS file.
  - Type a lexeme + click Add → should show in the entries list immediately.
  - Open second tab to same URL → entries list pre-populated; add in tab A → appears in tab B within ~10 ms.
  - Delete in tab A → disappears in tab B.
  - DevTools: `Application → Shared Workers` should list `living-dictionaries-dicts`. `Application → IndexedDB` should show `wa-sqlite-*` (admin) + `dict-opfs-lru`. OPFS isn't in DevTools UI directly but `Storage → Quota Manager` shows usage.
  - Identity is per-localStorage: change `dev_user_email` to test "different user" scenarios.

### Gotchas / decisions made during implementation

- **`SharedWorkerGlobalScope` lib type missing** — tsconfig only includes `DOM` + `DOM.Iterable`. Declared a minimal local `SharedWorkerScope` shape in `shared-worker.ts` rather than adding WebWorker lib (would pollute other files).
- **`MemoryAsyncVFS` constructor takes no args** — early draft passed a name string; corrected.
- **OPFS write expects `BufferSource`** — Uint8Array casts to it but TS lib disagreement required `as unknown as BufferSource`.
- **The `_call.ts` for DELETE endpoint** can't use `post_request` (it's POST-only) — implemented a small inline fetch that mirrors its return shape.
- **`fetch_dict_snapshot` for MemoryVFS fallback** still issues the snapshot fetch to keep telemetry uniform, then discards the bytes (wa-sqlite can't deserialize them into MemoryVFS). The sync engine then pulls from `/changes?since=null`. This is the pre-iOS-17-viewer-only path the architecture doc accepts.
- **`DictInsertType` widens `id` to optional** — Drizzle's `InferInsertModel` requires every notNull primaryKey field, but `LiveDb.insert()` auto-generates UUIDs. Original admin LiveDb avoids this by also widening the type. Captured for parity.
- **Test page seeding** — `/api/dev/seed-test-dict` is `dev`-gated; it 404s in production. It (a) creates a `users` row keyed by the dev identity, (b) creates a `dictionaries` row keyed by the path param, (c) grants `editor` role to the user, (d) lazy-opens dict.db so migrations apply. Idempotent via `ON CONFLICT … DO UPDATE`.
- **Dev identity** lives in localStorage (`dev_user_id` + `dev_user_email`). `lib/auth/dev-identity.ts` reads/writes — auto-seeds a UUID + `agent@mock.com` on first call. To test multi-user scenarios in dev: set `dev_user_email` in DevTools, reload.

### New test page files (for cross-tab verification)

- `lib/auth/dev-identity.ts` — localStorage-backed dev identity helper.
- `routes/api/dev/seed-test-dict/+server.ts` + `_call.ts` — dev-only seed endpoint.
- `routes/test/dict-sync/[id]/+page.svelte` — the verification page itself.

---

## Pickup notes for next session

### State at end of this session

- Server-side gaps (Priority 2): all done, lint/check/test green.
- SharedWorker + OPFS VFS (Priority 1): all 10 files landed in `site/src/lib/db/dict-client/`, lint/check/test green.
- Cross-tab verification page wired at `/test/dict-sync/[id]` for manual testing.
- 60 tests pass across 12 files (55 in test files, 5 inline in `dict-connection.ts`).
- Nothing committed — the user will do that.

### What's left for follow-up sessions

1. **Manual browser verification** — the user hasn't run it yet. They'll boot `pnpm dev`, hit `http://localhost:3041/test/dict-sync/test-dict-1`, and confirm:
   - SharedWorker registers in DevTools.
   - Add Entry persists across reload (OPFS file holds).
   - Adding in tab A appears in tab B.
   - Network shows the right snapshot fetch (`/api/dictionary/test-dict-1/db` since the dev user is editor).
   - Likely bugs to chase if any: Vite's worker bundling of `import.meta.glob` for SQL files; the wa-sqlite OPFS VFS first-write race when the snapshot bytes are written before SQLite opens the file.
2. **L3 Auth port** — replace `lib/auth/verify.ts` stub with real email-OTP + jose JWT verification. After it lands, `lib/auth/dev-identity.ts` can be removed and the test page should switch to whatever cookie/Authorization flow L3 uses.
3. **Story B.6 `PersistedState` cache** for `/api/me/dictionary-roles` — the server endpoint exists; the client-side cache layer doesn't.
4. **Production dict-page routes** — replace `/test/dict-sync/[id]` with proper `/[dict_id]/+page.svelte` routes (entry list, entry detail, settings tabs). The DictLiveDb wiring carries over directly.
5. **L4 Email/messages tables** — Phase-2 backend; out of this scope.

### Files touched this session

Server-side:
- `site/src/hooks.server.ts` (added migration sweep)
- `site/src/routes/api/me/dictionary-roles/{+server.ts,_call.ts}` (new)
- `site/src/routes/api/dictionaries/[id]/roles/{+server.ts,_call.ts}` (new)
- `site/src/routes/api/dictionaries/[id]/roles/[role_id]/{+server.ts,_call.ts}` (new)
- `site/src/routes/api/dev/seed-test-dict/{+server.ts,_call.ts}` (new)

Client-side (all new in `site/src/lib/db/dict-client/`):
- `rpc-types.ts`
- `dict-migrations-bundle.ts` + `dict-migrations-bundle.test.ts`
- `fetch-snapshot.ts`
- `opfs-vfs-loader.ts`
- `dict-sync-engine.ts`
- `shared-worker.ts`
- `shared-worker-lifecycle.ts`
- `dict-connection.ts`
- `dict-live-db.svelte.ts`
- `opfs-lru.ts`

Other:
- `site/src/lib/auth/dev-identity.ts` (new)
- `site/src/routes/test/dict-sync/[id]/+page.svelte` (new test page)
