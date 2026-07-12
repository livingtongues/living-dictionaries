# Fix "active last 30 days" admin-users filter (only ever showed admins)

## The bug
`/admin/users` "active last 30 days" reads `users.last_visit_at`. That column was
bumped in exactly ONE place — the admin **shared.db** sync engine
(`$lib/db/sync/engine.svelte.ts`, once/day via `update_last_visit`, written in
`sync-helpers.ts`). Only admins run that engine, so `last_visit_at` was populated
for admins and nobody else. Prod: 3 users had it set (the 3 admins) vs **102**
distinct authenticated users active in the last 30 days per `client_logs`.

## Fix (approved by Jacob 2026-07-12)
- **Q1 layout**: forward-going write in root `+layout.server.ts`.
- **Q2 yes**: one-time backfill from `client_logs`.
- **Q3 remove**: deleted the admin sync-engine ping (single source of truth).

## Changes ✅
- ✅ `$lib/server/bump-last-visit.ts` — throttled once/UTC-day guarded UPDATE (+ tests).
- ✅ `routes/+layout.server.ts` — calls `bump_last_visit` after session-cookie verify.
- ✅ Removed admin ping: `engine.svelte.ts` (`update_last_visit`, `#user_id`,
  `should_ping_last_visit`/`record_last_visit_ping`), `sync/types.ts`
  (`update_last_visit` field), `server/sync-helpers.ts` (ping block + dead `user_id`
  in `apply_sync`), deleted `$lib/db/sync/last-visit-ping.ts`.
- ✅ Updated callers/tests: `routes/admin/+layout.ts`, `engine-convergence.svelte.test.ts`.
- ✅ Doc comment on `schemas/shared.ts` `last_visit_at`.
- ✅ Backfill script `scripts/one-off/2026-07-12-backfill-last-visit-from-logs.cjs`.

## Verify ✅
- `pnpm check` → 0 errors. Touched-file lint clean (4 pre-existing engine warnings left for another lane).
- Sync/engine/layout tests pass.

## TODO — run the backfill on prod (after deploy)
The trigger already exists in prod, so it can run anytime, but back up first:
```
ssh living 'sudo cp /opt/hosting/data/shared.db /opt/hosting/data/shared.db.bak-$(date -u +%Y%m%d-%H%M%S)'
DRY=1 preview:  ssh living 'docker exec -i -e DRY=1 sveltekit_blue node' < scripts/one-off/2026-07-12-backfill-last-visit-from-logs.cjs
apply:          ssh living 'docker exec -i sveltekit_blue node' < scripts/one-off/2026-07-12-backfill-last-visit-from-logs.cjs
```
Expected: ~102 users updated. Admin clients pull the new `last_visit_at` on next sync
(the `users_after_last_visit_at_bump_updated_at` trigger bumps `updated_at`).
