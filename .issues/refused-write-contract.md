# Refused-write contract: two live bugs + the sync-rejection contract port

**Part of the cross-repo cluster** coordinated from `~/code/horse/.issues/refused-write-contract-cluster.md`.
Jacob-approved contract (2026-08-05 debrief): **a write the server refused becomes (a) a typed,
countable telemetry event and (b) a visible message to the person who wrote it.**
**Everything stays UNCOMMITTED** — Jacob commits.

LD owns the reference implementation of the property (the guarded write facade in
`site/src/lib/db/dict-client/guarded-writes.ts` logs `write_blocked` + routes failures to a toast) —
and two brand-new bulk actions route around it, which is item 1.

## Item 1 — bulk actions bypass the guarded write facade (live bug, do first)

Source: `~/code/horse/.cron/nightly-reviews/2026-08-04.md` item 🟡2 (read it).
`site/src/routes/[dictionaryId]/entries/table/BulkActionBar.svelte` (~line 83, commit 62b7324d):
`bulk_add_source` and `bulk_review` — unlike their four guarded siblings — (1) mutate the
on-screen entry BEFORE awaiting the write and never roll back, (2) let a rejection escape as an
unhandled promise rejection (no toast, no telemetry, loop abandons the remaining entries), and
(3) `dict_db?.` makes a MISSING database resolve as success for every selected entry.

Fix per the review: add `set_sources` / `set_review` to the guarded writes module as thin
`guard(...)` wrappers; route both actions through them like their siblings; move the
`entry.main.… =` optimistic assignment to AFTER a successful write; keep the continue-on-failure
loop the facade provides. Remove the optional chain on the db handle.

## Item 2 — null field kills the save silently (live bug)

Source: `.cron/log-reviews/2026-08-04.md` §1.2 (read it). A SQLite NULL (`fields?.phonetic`)
sails through three `= ''` defaults (defaults only fill `undefined`) into `value.trim()` in
`site/src/lib/components/entry/EditField.svelte` (~line 39) — save throws BEFORE the update and
before the dialog closes; a Kayan Baram contributor clicked Save 6 times in 7 minutes across 3
entries with zero feedback. Fix all three halves per the review:
1. normalize at the boundary — `value ?? ''` where `EntryField` hands the value down;
2. make `save()` itself null-proof;
3. include the `field` name in the error context (the existing guard `inputEl?.value || value || ''`
   on the line above means the binding read-back is not fully explained — the field name settles it).
And per the contract: the failure path must reach a toast + telemetry, not an unhandled rejection.

## Item 3 — port the sync-rejection contract (the settled spec — implement, don't redesign)

Parity evidence: `~/code/horse/.cron/parity-reviews/2026-08-04.md` — LD's server computes
`skipped_orphans?: { table_name, id, parent_table }[]` and the client worker-engine logs it into a
`log_tail` string nothing reads.

1. **Server** (LD's sync helpers): add to the sync response, additively (KEEP `skipped_orphans`
   for old clients):
   ```ts
   rejected_rows?: { table_name: string, id: string, reason: 'tombstoned' | 'orphan' | 'unauthorized' | 'duplicate' }[]
   ```
   Populate from every path that drops/reverts a pushed row: tombstone guard (if LD has one),
   FK-orphan skip, any authorization echo, UNIQUE-duplicate skip. Only add reasons whose code
   paths actually exist in LD — don't invent paths.
2. **Client engine**: when `rejected_rows` (or legacy `skipped_orphans`) is non-empty, emit
   **`sync_push_rejected`** at **error** level: `{ engine, sector, reason, table_name, count, ids }` —
   one event per (sector, reason, table) per round trip, not per row — through LD's remote-log
   path, replacing nothing (keep the log_tail line).
3. **Visible message**: raise a toast from the client when a push is rejected:
   *"N of your changes couldn't be saved — <reason phrase>"*. Wire worker→tab via whatever
   callback channel the engine already uses for repeated-failure surfacing.

NOT in scope for LD (house-only for now; the nightly parity sweep evaluates porting later):
local quarantine of refused rows, server `rejected_pushes` ledger, editor-open tombstone guard,
forced full resync for stale cursors, page reload watermark.

## Implementation notes (filled in as work proceeds)

Reason paths that ACTUALLY exist in LD (item 3 step 1 — nothing invented):

| reason | shared.db (`sync-helpers.ts`) | dict.db (`dictionary-sync-helpers.ts`) |
|---|---|---|
| `orphan` | FK-recovery skip in `process_sync` | FK-recovery skip in `process_dict_changes` |
| `duplicate` | natural-key owner adoption in `merge_row` (loser id tombstoned) | `deduped_losers` in `merge_dict_row` |
| `tombstoned` | tombstone-resurrection guard in `merge_row` | ✗ no such guard — NOT emitted |
| `unauthorized` | pushed rows for a `READONLY_TABLES` table (`users`) | `is_editor === false` → the whole push is dropped |

The dict `unauthorized` case must ALSO be computed on the endpoint's fast-bail branch
(`has_push = is_editor && …`, so a non-editor push bails before `process_dict_changes` ever runs).

## Verification

- ✅ Vitest suite green (`pnpm test` in `/site`); `tsc` / `pnpm check` clean on touched files.
- ✅ New/updated unit tests: bulk actions route through the facade (a failing item toasts +
  continues), EditField save with a NULL field value, engine emits `sync_push_rejected` on a
  response carrying `rejected_rows` (and on legacy `skipped_orphans`).
- ✅ Follow LD repo norms (snake_case, options objects, few comments). Everything left uncommitted.
- ✅ Completion report at `.issues/refused-write-contract-report.md`.

**ALL THREE ITEMS DONE (2026-08-05)** — see the report for details, including the throttle added to
the rejection reporting (an `unauthorized` refusal never clears, so it recurs every 30s) and the
unrelated `seed-dev-fixture.ts` idempotency bug fixed so `pnpm test:sync` could run at all.
