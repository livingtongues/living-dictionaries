# OPFS leader-worker dict DB — follow-ups (post-port review 2026-06-11)

Single surviving OPFS/dict-db issue. Most P1/P2 items were FIXED in the 2026-06-11 hardening pass
(below); durable design notes live in `.knowledge/migration/opfs-leader-worker-dict-db.md`.

> The four harness files in `dict-client/worker/` (`opfs-sah-vfs.js`, `opfs-connection.ts`,
> `leader-election.ts`, `transport.ts`) are **byte-identical with house** — patch both repos
> together. House twin: `~/code/house/.issues/opfs-db-follow-ups.md` (shared items marked ⇄).

## ✅ Fixed (2026-06-11 hardening pass — all verified)

- ✅ ⇄ **transport.ts duplicate re-send** — pending RPCs re-posted on every same-epoch `ready`
  double-executed in-flight execs. Now epoch-gated.
- ✅ ⇄ **Harness: SAH leak on failed open** (`worker/opfs-connection.ts`) — a corrupt file failed the
  first PRAGMA *after* `open_v2`, leaving the held sync-access-handle open forever → the file could
  never be deleted/reopened. Now closes the db on any post-open failure.
- ✅ ⇄ **Harness: one-wasm-instance-per-open broke every SECOND open in a worker** — module-level
  `registered_vfs` skipped `vfs_register` on a fresh wasm instance → unknown-VFS error. This silently
  broke `reset()` and made self-heal impossible in BOTH repos. Now one memoized sqlite3 instance per
  worker with the VFS registered on it.
- ✅ **Corrupt-file self-heal** — `open_opfs_prepared` retries once: delete the unopenable file →
  refetch snapshot → reopen. No more dead leader + 20s RPC timeouts after a crash mid-write.
- ✅ **Snapshot-404 fallback** — a failed snapshot fetch (new dict pre-cron, dev-only dict, offline)
  falls through to an empty OPFS DB + migrations from scratch + pull-since-null backfill (mirrors the
  MemoryVFS path, but persistent). Dev no longer hard-depends on prod R2.
- ✅ **`snapshot_expired` recovery** — was a no-op (in-place delete with the SAH held silently fails).
  Now `maybe_auto_reset()`: full `reset()` automatically when there are no un-pushed dirty rows
  (viewers always; clean editors), once per worker lifetime (no 410-loop). Editors WITH dirty rows
  are left intact + get the toast (see below).
- ✅ **`reset()` hardening** — engine stopped first; close + delete serialized through the op-mutex.
- ✅ **Editor promotion while cached** — `[dictionaryId]/+layout.ts` re-asserts `set_role` via
  `open_dict` on every load when `can_edit` (was: only on first open → writes queued dirty forever
  until reload). *(Code-reviewed; no dedicated e2e — promote path is idempotent + tiny.)*
- ✅ **Sentinel toasts** — `schema_outdated` / `snapshot_expired` now surface a reload-action toast
  (was: silent sync death). i18n keys `misc.app_update_needed` / `misc.local_data_expired` /
  `misc.reload` added to `en.json` (translators fill the rest).
- ✅ **Tombstone pruning** — the snapshot builder prunes source-db `deletes` older than
  `SNAPSHOT_EXPIRED_DAYS` (those clients 410-refetch anyway). Test added.
- ✅ **Tidies** — `untrack_dict` dead code removed; opfs-lru derives its dir from
  `DICT_DB_OPFS_PREFIX`; server `dictionary-db.ts` db_metadata writes now `ON CONFLICT DO UPDATE`.
- ✅ **New e2e: `tools/e2e/opfs-dict-heal.mjs`** — proves both the 404-fallback boot AND the
  corruption self-heal end-to-end (fabricates a throwaway dict; net-zero on server data; immune to
  the prod-R2 sweep via future `snapshot_uploaded_at`).

Verified: 392 vitest ✓ · tsc 0 · eslint 0 · svelte-check 0 errors · e2e smoke / editor / heal ALL PASS.

## P0 — operational (Jacob action)

- ✅ **Local dev pushes snapshots to the PROD R2 bucket.** RESOLVED 2026-06-11: Jacob flipped
  `R2_SNAPSHOT_BUILDER_ENABLED` off in local `site/.env`; dev server restarted and verified — no
  `[r2-snapshot-builder] Started` in the boot log (module-level gate in `hooks.server.ts`).
  Longer term a separate dev bucket or prod-only guard would remove the foot-gun class entirely.
  (The polluted prod `nukuoro.db.gz` was healed 2026-06-10.)

## Remaining (accepted/deferred)

- [ ] **Editor recovery UX for `snapshot_expired` with dirty rows** — auto-reset correctly refuses
  (would discard writes); the toast says "refresh needed" but there's no guided flow (e.g. "export my
  pending changes / discard & reset" buttons calling the `reset` RPC). Needs product thought.
- [ ] ⇄ **At-least-once exec across a REAL leader hand-off** — old leader dies after applying but
  before responding → new leader re-applies the re-sent exec. Plain INSERTs surface a UNIQUE error;
  UPDATEs idempotent. Accepted; revisit with op idempotency keys (persisted in-DB, same-txn) if it
  ever bites. *2026-06-11: the `dict_write` refactor briefly made insert-shaped ops fail-SILENT
  here (worker-generated ids → re-application created a fresh duplicate); fixed by client-stamping
  the primary row's id in the `DictLiveDb.writes` facade + `#insert`, restoring fail-loud parity.
  Unit tests cover the re-application collision.*
- ✅ **Move `operations.ts` worker-side as an atomic `dict_write` op** — DONE 2026-06-11 (see
  `.issues/dict-write-atomic-ops.md`): `dict-writes.ts` orchestrators run inside BEGIN/COMMIT under
  the op-mutex; `.insert()`/`.upsert()` also route through it, deleting the SAVEPOINT batches
  (the race) entirely. 14-test vitest suite + extended editor e2e prove it.
- [ ] **In-worker Orama (house's model)** — LD's per-tab index pulls the full bundle over the
  BroadcastChannel (structured-cloned to ALL tabs). Matters once big dicts meet multi-tab editors.
- ✅ **First-paint blocking `sync_now`** — DONE 2026-06-11: fire-and-forget for OPFS-backed boots
  (deltas fill reactively via `tables_changed`); MemoryVFS fallback still blocks (empty boot,
  pull-since-null is its only data source). Proof with `/changes` delayed 4s: first paint
  4819ms → 863ms. Smoke/editor/heal e2e all pass (heal's empty-OPFS backfill polls, so
  fire-and-forget is safe there too).
- [ ] **Media-byte orphan sweep** — hard-deleting a media row never deletes GCS bytes (also listed in
  `cutover.md` deferred backlog).
- [ ] **opfs-lru size staleness** (minor) — `size_bytes` only refreshed at open; a dict growing
  during a long session under-counts until next open.
