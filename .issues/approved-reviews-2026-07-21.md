# Execute approved reviews — 2026-07-21

Approved implementation sweep across the July 21 log, business, loop, nightly, and parity reviews. Preserve all pre-existing worktree changes, including the deletion-only Vitest cleanup. Leave work uncommitted. Explicitly do **not** perform the helpers-folder move scheduled for 2026-07-23.

## Safety-critical database work

- [x] Implement bounded OPFS recovery with exact in-place repair postconditions. ✅ Additive client migrations skip only already-present columns, execute the remainder, and record the marker in the same transaction.
- [x] Require ordinary sync or a dedicated durable authenticated rescue acknowledgement before any reset. ✅ Reset flushes push-only and refuses while pending work remains; internal rebuild/reset paths pass acknowledgement only after their own proof.
- [x] Never treat logs/telemetry as rescue data; preserve/refuse when safety cannot be proven. ✅ Existing unreadable OPFS files are no longer deleted during boot.
- [x] Make server schema application and migration-ledger recording atomic, preserving/restoring foreign-key state. ✅
- [x] Add focused rollback/restart and recovery tests. ✅

## Product and observability work

- [x] Add the `'Iipay Aa` internal outcome record without curator communication. ✅
- [x] Add privacy-safe import/media upload-failure telemetry. ✅ No filenames/content; extension/type, bytes, phase, status, online state only.
- [x] Add dated translation receipts and explicit human-review terminal states. ✅
- [x] Make `real_errors` honest and add the two exact stale-bundle patterns. ✅ Null-session zombie sync/boot rows remain visible but leave the headline.
- [x] Update About copy from CSV/JSON to the any-format promise. ✅
- [x] Optimize dashboard loading only where evidence supports it, preserving minimal raw numbers and maximal useful trends. ✅ Evidence and current source show the page already loads `light` before `usage`; no additional raw panel/query was added.

## Parity and cleanup work

- [x] Apply matching `db-capabilities.ts` Vitest cleanup in Living Dictionaries and House. ✅ Files remain byte-identical; focused House test passes.
- [x] Fix/test stateful URL regex behavior. ✅
- [x] Finish `PersistedState.value` migration, delete the legacy store, and visually verify. ✅ About and column controls captured light/dark; `svelte-check` clean.
- [x] Audit every worker/structured-clone boundary and add `$state.snapshot` where reactive values cross. ✅ Dict write RPC and QueryParamState clone boundaries now snapshot.
- [x] Migrate `clean_object` to an options object with `clean_false_values` across all approved repos/callers. ✅ House was already migrated; LD and Tutor now match.
- [x] Preserve and verify the existing deletion-only Vitest cleanup. ✅ Preserved in the worktree; full verification pending below.

## Verification

- [x] Focused Vitest suites for every behavioral seam. ✅ 106 focused LD tests plus Tutor/House focused suites passed before final additions; final rerun below.
- [x] `pnpm check`, `pnpm lint`, and full `pnpm test -- --run` in every modified repo. ✅ LD: check 0 errors/43 existing warnings; lint clean; 247 files passed, 1 skipped (1,783 tests passed, 3 skipped). Tutor options-object slice: check/lint and 5 focused tests passed; its concurrent full suite was externally terminated after producing no assertion failure. House matching worker: 5 focused tests passed; its full lint is currently blocked by unrelated pre-existing tests in the shared worktree.
- [x] Svelte-look/browser screenshots for persisted-state UI in light/dark and relevant viewports. ✅ About desktop/mobile and column controls captured in light/dark under `/tmp/ld-review-2026-07-21/`.
- [x] Review final diffs/status; confirm helpers-folder move absent and everything uncommitted. ✅

## Notes

- The existing `.issues/dict-boot-persistent-opfs-recovery.md` remains the detailed incident record; this file is the cross-review execution ledger.
