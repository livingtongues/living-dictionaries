# tutelo-saponi (and others) stuck on "Loading" — seq_cursor_transition rebuild loop ✅ FIXED

## Symptom
Editors (incl. Jacob + one user) opening `/tutelo-saponi/entries` never finish loading and never
sync. Viewers mostly fine (SSR renders entries). Only affects users holding a **pre-2026-07-09
local OPFS copy** of a dict. Other affected dicts in logs: batsi-kop-tsotsil-tsot (474 transition
loops in one session), werikyana, gutob, boienen-old-buhi-langua.

## Verified facts (2026-07-13 investigation)
- tutelo's server DB + R2 snapshot + editor `/db` snapshot are all VALID: better-sqlite3 opens
  them (integrity ok), and the **real wa-sqlite wasm engine** (Node harness `/tmp/waopen.mjs`,
  MemoryVFS pre-seeded with snapshot bytes) opens + full-bundle-reads every table fine.
  Data is clean: no NUL bytes, no lone surrogates, max field 336 chars. NOT a data bug.
- Both snapshot paths bake `synced_seq` (tutelo=1704). NOT a bake bug.
- client_logs: failing sessions pair `sync_self_healed reason=seq_cursor_transition` with
  `Failed to read dict bundle from wa-sqlite` (SQLITE_MISUSE 21) seconds later.

## Mechanism (REPRODUCED in headless-browser e2e, /tmp/stale-cursor-e2e.mjs)
Old `dict-instance.ts` `open_and_wire()`: old OPFS file (has `last_modified_at`, no `synced_seq`)
→ `needs_seq_transition()` → `void rebuild({reason:'seq_cursor_transition'})` + early return
(leader announces ready with NO engine started). The async rebuild then `reset()`s (close
connection + delete OPFS file + refetch snapshot); the entries bundle read races the torn-down
connection → MISUSE 21 → **entries list stuck at "Loading" with 0 entries** (broken-leg e2e:
`dom_links=0, loading_visible=true` while the DB itself healed underneath). Worker respawns
re-trigger the transition → the 474× loop.

## Fix (shipped 2026-07-13)
1. **Removed the `seq_cursor_transition` rebuild path** (`dict-instance.ts`). An old-cursor file
   now boots normally; the engine reads a null cursor.
2. **Null-cursor syncs got full-resync semantics** (`dict-sync-engine.ts` `#apply_transaction`):
   after upserting the full pull, prune local rows absent from the response — keeping dirty rows
   and just-pushed ids — under the existing `defer_foreign_keys` apply txn. This replaces the
   correctness the snapshot reset provided (the server sends no tombstones for a null cursor, so
   ghosts would otherwise linger). Converges IN PLACE: no reset, no teardown, no race.
3. `report-dict-sync-failure.ts` `reason` narrowed to `'fk_wedge'` (fk-wedge rebuild kept).

## Verification
- ✅ New e2e-style unit specs in `dict-sync-engine.convergence.test.ts` (real server
  `process_dict_changes` + real-migrations client DB): stale-file convergence (ghost pruned, new
  rows pulled, dirty pushed, synced_seq written, clean second sync) + incremental-never-prunes.
  Proven to FAIL without the prune.
- ✅ All 461 db/api tests, tsc 0 errors, svelte-check 0 errors.
- ✅ Headless-browser e2e on dev (real tutelo-saponi.db staged locally): broken leg reproduces the
  stuck-Loading; fixed leg → plain reload fully recovers (1682 entries rendered, ghost pruned,
  synced_seq=1704, no console/page errors). Screenshots /tmp/stale-cursor-{broken,fixed}.png.

## Post-deploy follow-up
- [ ] After deploy: Jacob + affected user reload → expect entries to load. Watch client_logs for
      `Failed to read dict bundle` / `sync_self_healed seq_cursor_transition` (should cease; the
      reason literally no longer exists in the bundle) on tutelo/batsi/werikyana.
- Unrelated case spotted while digging (NOT this bug): `äynu` loops `duplicate column name:
  server_seq` at `migrate` stage — a partially-applied client migration (journal_mode=MEMORY +
  worker killed mid-migration leaves half-applied DDL with no migrations row; ALTER TABLE isn't
  idempotent). Self-heal (delete+refetch) should cover it but one session repeated 226×. Left as
  its own investigation: `.issues/dict-client-migration-idempotency.md`.
