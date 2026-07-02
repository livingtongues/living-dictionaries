# Squash SQL migrations into single initials (pre-cutover) + schema audit

Pre-Supabase-cutover housekeeping: collapse each migration set into ONE `20260702_initial.sql`,
converge prod (living VPS) migration tables to match, and audit the schema before real data lands.

## Context / discovered facts

- THREE migration sets (not two): `shared-migrations/` (9 files incl. ghost history),
  `dictionary-migrations/` (4), `history-migrations/` (2). All under
  `site/src/lib/db/schemas/`.
- All consumers use `import.meta.glob` on the dirs — no hard-coded names anywhere in runtime code:
  - server: `shared-db.ts`, `dictionary-db.ts`, `dictionary-history-db.ts` (each derives
    `latest_*_migration` from glob)
  - client: `client/db.ts` (shared bundle), `dict-client/dict-migrations-bundle.ts`
  - cutover scripts: `scripts/supabase-cutover/open-sqlite.ts` reads the same dirs from disk
- Hard-coded name references that DO need updating:
  - `site/e2e/history-sync.mjs` → `const MIGRATION = '20260606_initial.sql'` (hits the real
    endpoint handshake — must become `20260702_initial.sql`)
  - `site/scripts/migrate-dict-dbs-hard-delete.mjs` → obsolete one-off, reads
    `20260606_initial.sql` from disk (delete the script)
- Handshakes: admin sync = strict equality on latest shared migration name (CLIENT_BEHIND /
  SERVER_BEHIND); dict `/changes` = lexicographic `<` compare (409 schema_outdated / 503
  server_outdated). Stale open tabs after deploy will hit these and the recovery policy reloads
  (`client-behind-recovery.ts`). Jacob clears his + Greg's clients anyway.
- Migration runners apply BY NAME (a name not in the `migrations` table runs). So the squashed
  initial WILL be executed against every existing DB (prod shared.db, river.db, river.history.db,
  local `.data`, any surviving browser DBs) → **the squashed files must be idempotent**
  (CREATE TABLE/INDEX/TRIGGER IF NOT EXISTS, DROP TRIGGER IF EXISTS + CREATE for
  process_delete_cascade, INSERT OR IGNORE for the agent user seed, no ALTERs).
  - chat tables in `20260625d_chat.sql` lack IF NOT EXISTS → add it when folding.
- `dict_db_schema_version` stamps include the `.sql` extension. Prod river row currently
  `20260702_relationship_delete_cascade_repair.sql`.
- R2 snapshots carry the server's `migrations` table (only `deletes` is wiped at build) — after
  prod rewrite, next rebuild ships the clean single-row table. Stale snapshot is harmless (new
  clients idempotently apply the initial over it).
- Prod state (2026-07-02): 1 dict (`river`, 8693 entries / 9751 senses / 11244 sentences / 4733
  audio / 2825 entry_relationships). shared.db has 7 users, 22k client_logs. Prod shared
  migrations table still lists ghost `20260526_messages.sql`.

## Decisions (Jacob, 2026-07-02)
- Squash all THREE sets (incl. history) ✅
- Fold ALL six index fixes into the squash ✅
- Fix entry_count now (mirror chokepoint) ✅
- Delete obsolete migrate-dict-dbs-hard-delete.mjs ✅

## Plan

1. ✅ Recon (this file)
2. ✅ Write squashed files (final-state fold + approved index changes + convergence
   DROP INDEX sections; chat tables gained IF NOT EXISTS; process_delete_cascade is
   DROP+CREATE in both DBs; sentences/texts `sources` + users `notify_channel` +
   client_logs geo + message_threads triage columns appended at CREATE-TABLE END to
   match pre-squash ALTER column order)
3. ✅ Deleted 14 old SQL files + obsolete script; e2e MIGRATION const → 20260702_initial.sql
4. ✅ entry_count fix: `mirror_dictionary_cursor` (v1-route-context.ts) now recounts
   entries + writes entry_count in the same catalog UPDATE; /changes endpoint now
   calls it instead of its inline mirror; Drizzle comment updated; e2e assertion added
5. ✅ Drizzle: sources.type typed with SOURCE_TYPES enum (surfaced + fixed a loose
   string in EditSource.svelte)
6. ✅ Verify locally:
   - schema-equivalence (verify-squash script): OLD chain vs NEW file — diffs are
     EXACTLY the approved index changes (3 shared drops; 11 dict drops + 5 adds;
     history identical)
   - convergence: NEW file re-applied over OLD-chain DB → 0 diffs, all 3 sets
   - EQP checks all ✓ (natural-unique leading col serves from_entry_id; junction
     UNIQUE autoindexes serve FK lookups; deletes/elicitation use new indexes)
   - real-DB test: new initials applied over copies of local .data shared/dict/history
     DBs — applied clean, indexes converged, row counts unchanged, FK check clean
   - vitest 1043 passed; svelte-check 0 errors; eslint clean on touched files
7. ✅ build + test:history e2e — 33 assertions PASS (incl. new entry_count assertion).
   NOTE: the e2e script lingers after PASS (server child keeps event loop alive) —
   piped through `| tail` it looks hung; the PASS is in the buffered output.
8. ✅ Committed 5497c415 + pushed svelte-5-migration → webhook deploy verified
   (polled prod migrations table until 20260702_initial.sql appeared)
9. ✅ Prod converge (2026-07-02 ~11:21 UTC):
   - backups: *.bak-squash-20260702-111915 (shared.db, river.db, river.history.db)
   - anonymous POST /changes lazy-opened river.db → applied initial + index changes
   - converge script: all 3 migrations tables → single 20260702_initial.sql row
     (ghost 20260526_messages.sql gone); river indexes verified (new partials present,
     composite deletes idx + _from gone); dict_db_schema_version stamped;
     entry_count backfilled to 8693; updated_at bumped → snapshot rebuild queued
   - shared.db: 3 redundant indexes confirmed dropped; healthz 200; zero
     server-side errors in client_logs in the surrounding 40-min window
10. ✅ Local .data converge — all shared/dict/history DBs on the single row.
    GOTCHA FOUND: history DBs stuck mid-chain (initial applied, 20260630 ALTER not)
    fail the squashed initial at `idx_changes_api_key` (CREATE TABLE no-ops so the
    column is missing, then the index references it). Healed locally by ALTERing the
    column first. Prod river.history had both old migrations → unaffected. Same class
    of risk exists for any long-dormant browser DB (mid-chain OPFS/IDB) — accepted:
    Jacob clears his client, tells Greg; domain changes at cutover anyway.
11. ✅ Knowledge: .knowledge/migration/migration-squash-2026-07-02.md (+ index entry,
    + staleness note in adding-a-syncable-dict-table.md)

## Status: DONE (pending snapshot-rebuild confirmation poll)
   - `shared-migrations/20260702_initial.sql` (fold: initial + client_logs geo cols +
     log_daily_metrics + notify_channel + chat + triage cols + agent seed + api_keys —
     dictionary_partners backfill is subsumed)
   - `dictionary-migrations/20260702_initial.sql` (fold: initial + sources + entry_relationships +
     final process_delete_cascade + keep the 2 repair sweep DELETEs — no-op on fresh DBs, heals
     dev-window DBs)
   - `history-migrations/20260702_initial.sql` (fold: initial + api_key_id col + index)
   - plus approved audit changes (see report) — with a small convergence section
     (`DROP INDEX IF EXISTS` for removed indexes) so existing DBs converge when the initial
     no-op-applies over them
3. Delete the 15 old SQL files. Update `e2e/history-sync.mjs` MIGRATION const. Delete
   `site/scripts/migrate-dict-dbs-hard-delete.mjs` (if approved).
4. Verify locally:
   - schema-equivalence script: fresh DB from OLD chain (git show) vs NEW single file → compare
     PRAGMA table_info / foreign_key_list / index_list+index_xinfo / trigger bodies (normalized)
   - idempotency: apply NEW initial over a DB built from the OLD chain → no error, schema equal
   - `pnpm test` (site), `pnpm check`/tsc, lint
   - boot dev server against existing `.data` (real-world idempotent re-apply)
   - `pnpm -F site build` + e2e `test:history` if feasible
5. Commit + push `svelte-5-migration` → webhook deploy. Verify boot via logs/healthz.
6. Prod converge (backup first: shared.db, river.db, river.history.db):
   - rewrite `migrations` tables in all three DBs → single `20260702_initial.sql` row
     (idempotent script via `docker exec sveltekit_blue node`)
   - set `dictionaries.dict_db_schema_version = '20260702_initial.sql'` for river
   - optional: force river snapshot rebuild so R2 carries the clean migrations table
7. Rewrite local `.data` migrations tables the same way.
8. Knowledge: short note in `.knowledge/migration/` re: squash + idempotent-initial convention;
   update stale references if they claim current behavior.

## Audit findings (delivered in chat 2026-07-02; decisions pending)

A. fold into squash if approved:
- dict `deletes` index wrong for its query: pull/prune use bare `updated_at` — replace
  `idx_deletes_table_updated_at(table_name,updated_at)` with `(updated_at)` (dict.db only;
  shared.db query IS table-filtered, composite correct there)
- redundant junction indexes duplicated by UNIQUE natural-key leading column (9 dict + 1 shared
  `idx_dictionary_roles_dict` + `idx_entry_relationships_from`)
- `api_keys`: explicit `idx_api_keys_token_hash` duplicates UNIQUE — drop
- `log_daily_metrics`: `idx_log_daily_metrics_day` redundant with composite PK — drop
- missing FK-cascade indexes: `entry_relationships.from_sense_id/to_sense_id/custom_type_id`
  (partial WHERE NOT NULL)
- missing `entries.elicitation_id` partial index (v1 exact filter)
- Drizzle-only: type `sources.type` as enum

B. real bug, non-schema: `dictionaries.entry_count` never maintained post-import (no `SET
entry_count` anywhere; river shows 0 vs 8693; public /dictionaries + admin + v1 read it; Drizzle
comment claims push endpoint + heal cron maintain it — neither exists)

C. noted, leave alone: audio/videos parent XOR unenforced; tags.name plain vs dialects.name
MultiString; user-FK child columns unindexed on rare delete paths; chat tables not in Drizzle
(documented choice); invites no natural UNIQUE.
