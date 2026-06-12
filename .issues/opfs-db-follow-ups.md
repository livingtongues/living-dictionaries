# OPFS leader-worker dict DB — follow-ups (remaining items)

Single surviving OPFS/dict-db issue. The 2026-06-11 hardening pass (transport re-send, SAH leak,
wasm re-register, corrupt-file self-heal, snapshot-404 fallback, `snapshot_expired` auto-reset,
sentinel toasts, tombstone pruning, non-blocking first-paint sync, atomic worker-side `dict_write`
ops) is **landed + committed**; durable design notes live in
`.knowledge/migration/opfs-leader-worker-dict-db.md`.

> The four harness files in `dict-client/worker/` (`opfs-sah-vfs.js`, `opfs-connection.ts`,
> `leader-election.ts`, `transport.ts`) are **byte-identical with house** — patch both repos
> together. House twin: `~/code/house/.issues/opfs-db-follow-ups.md` (shared items marked ⇄).

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
- [ ] **In-worker Orama (house's model)** — LD's per-tab index pulls the full bundle over the
  BroadcastChannel (structured-cloned to ALL tabs). Matters once big dicts meet multi-tab editors.
  **Full plan with pros/cons, ride-along checklist, and phased Jacob checkpoints:
  `.issues/in-worker-orama.md`** (post-cutover; trigger conditions listed there).
- [ ] **Media-byte orphan sweep** — hard-deleting a media row never deletes GCS bytes (also listed in
  `cutover.md` deferred backlog).
- [ ] **opfs-lru size staleness** (minor) — `size_bytes` only refreshed at open; a dict growing
  during a long session under-counts until next open.
- [ ] **Dev-bucket / prod-only guard for the R2 snapshot builder** — local dev once pushed snapshots
  to the PROD bucket (flag is now off in local `site/.env`, and the cutover runbook re-uploads all
  snapshots anyway); a separate dev bucket or prod-only gate would remove the foot-gun class entirely.
