# Nightly report fixes — 2026-08-01 batch

Approved by Jacob in the morning debrief. Sources: `.cron/log-reviews/2026-07-31.md` (LD log lane)
and `~/code/horse/.cron/overnight-briefs/2026-07-31.md`. **All changes uncommitted — Jacob owns every
commit (push = deploy).**

## Items

1. ✅ **Server side: `handleError` "never writes a crash row".** Investigated against production: it
   has always written (32,871 rows), and zero `crash` rows is the *correct* answer because no server
   5xx render has ever happened. Added an `error_id` join key so the question can never be ambiguous
   again. Full write-up + evidence: <File path=".issues/ssr-500-has-no-server-side-record.md" />.
2. ✅ **Client side: no `hooks.client.ts` at all.** Added, plus `$lib/debug/last-client-error.ts` and
   the `+error.svelte` wiring, so the ~403 browser-raised "Internal Error" pages finally carry a
   cause, a stack and an `origin`. Same write-up. Deliberately **no** recovery action in the hook.
3. ✅ **R2 store counters never emitted.** `og_store_state` now rides the existing prune snapshot
   (`routes/og/card-store.ts` → `remote_store_state()`), carrying `remote_gets` / `remote_puts` /
   `remote_faults` / `breaker_open` / `absent_keys` alongside the disk tier's `kept`/`bytes`/
   `removed`. Ported from house's fix on the consecutive night — same message name, same shape.
4. ✅ **Daily digest could re-mail everyone up to 16×/day.** `notification-digest-cron.ts` now claims
   the Pacific day in `db_metadata` **before** the send loop, and isolates each recipient in a
   try/catch that logs `notification_digest_send_failed`. `notify` is injectable so the failure path
   is testable; new test asserts a failed first send still leaves the day claimed and the next tick
   sends nothing. **Note:** house carries the same bug (LD's cron was ported there 2026-07-31) — not
   touched here, it's a different repo.
5. ✅ **INVESTIGATED (no code):** the two humans stuck below the reload-once floor.
   <File path=".issues/stuck-old-bundle-escape-hatch.md" /> — the finding is that Evelyn's tab has
   no reachable UI at all (only its worker still speaks), the in-bundle update toast already exists
   in both stuck bundles and works, and the only lever that reaches her is an email. Needs Jacob's
   decision before anything is built.

## Verification run

- `pnpm test` (site) — 2,489 passed / 4 skipped, 333 files.
- `pnpm exec tsc --noEmit` — clean. `pnpm check` — 0 errors. `pnpm lint` — clean.
- Both error hooks driven end-to-end in a headless browser against `pnpm dev`, with the resulting
  `client_logs` rows read back out of `.data/logs.db` (transcripts in the ssr-500 issue). The two
  temporary `_boom_*` routes used for that were deleted.

## Explicitly not done (per instructions)

- No second stale-build recovery mechanism — the data-layer one stays the only one.
- No "Test this key" button on the API-key page (declined by Jacob).
