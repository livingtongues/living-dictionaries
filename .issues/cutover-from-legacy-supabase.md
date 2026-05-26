# Cutover from legacy Supabase to new sqlite-backed site

Master plan for the one-day flip from `packages/old-site` (Supabase Postgres + PGlite) to `site/` (sqlite shared.db + dictionaries/{id}.db + R2 snapshots). Captures the operational sequence, the pause/resume points, and the rollback strategy.

> **Status**: stub. Will be filled out as we get closer to migration day.
>
> **Sibling issues**:
> - `.issues/port-db-sync-architecture.md` — the new architecture being cut over to
> - `.issues/migrate-supabase-users-to-new-site.md` — user-specific migration details
> - `.issues/port-shared-bones-from-house.md` — parent issue for the new site build

## Pre-cutover prep (over weeks, with old site still live)

- [ ] New VPS provisioned, code deployed, schema migrations applied.
- [ ] New-site auth fully built + tested in isolation.
- [ ] **Google Cloud Console** — add `https://new.livingdictionaries.app` to **Authorized JavaScript origins** for OAuth client `215143435444-fugm4gpav71r3l89n6i0iath4m436qnv.apps.googleusercontent.com` (so Google One-Tap works on the staging subdomain). Leave `https://livingdictionaries.app` in place. See `.issues/admin-backend-rollout.md` for click-through steps.
- [ ] **VPS `.env` populated** at `/opt/hosting/sveltekit/.env` with the values listed in `.issues/admin-backend-rollout.md` (Environment setup section). Both build-time and runtime read from this file.
- [ ] Migration script written: reads from PRODUCTION Supabase via service-role, writes into new VPS's `shared.db` + `dictionaries/{id}.db` files.
  - Idempotent — can be re-run safely to catch up deltas.
  - Preserves all UUIDs (users, dictionaries, entries, etc.) so FK references stay valid.
- [ ] R2 bucket created at `snapshots.livingdictionaries.app` (custom CNAME) with public read + CORS `*`.
- [ ] Snapshot builder code complete and tested locally.
- [ ] **Builder gated by env var** `R2_SNAPSHOT_BUILDER_ENABLED=false` initially.

## Cutover day sequence

### T-2 hours: First migration run (builder still off)
- [ ] SSH to new VPS, run migration script against production Supabase.
- [ ] Verify: spot-check 5 dicts load correctly, entry counts match, user counts match.
- [ ] Old site still serving production traffic; new VPS is offline to public.

### T-1 hour: Pre-warm R2 (builder still off)
- [ ] Run `bin/build-all-snapshots.ts --concurrency=4 --all` on new VPS.
- [ ] Throttled to 4 concurrent uploads to avoid VPS uplink saturation.
- [ ] Takes ~30-60 min for ~500 dicts × ~50 MB. Watch logs.
- [ ] Verify: a sample of R2 URLs return valid `.db.gz` blobs (one popular dict, one tiny dict, one private dict).

### T-30 min: Final catch-up migration (builder still off)
- [ ] Re-run migration script to capture any Supabase writes that happened during R2 prep.
- [ ] Re-run snapshot builder for only the changed dicts (`bin/build-all-snapshots.ts --since=<last-run-time>`).

### T-0: DNS cutover
- [ ] Switch DNS for `livingdictionaries.app` → new VPS.
- [ ] DNS propagation typically <5 min via Cloudflare.
- [ ] Old site instantly becomes irrelevant for new visitors. (Keep it running read-only as fallback for ~1 week.)

### T+5 min: Turn builder ON
- [ ] Set `R2_SNAPSHOT_BUILDER_ENABLED=true` on new VPS.
- [ ] Restart SvelteKit process (or hot-reload env). Cron starts firing every 30 min.
- [ ] First post-cutover cron tick: should find 0-few dicts changed since last pre-warm; very fast pass.

### T+15 min: Verification
- [ ] Visit production site, log in, edit something, verify it persists.
- [ ] Visit production site as anonymous user, view a public dict.
- [ ] Spot-check a few users can sign in via email OTP + Google One Tap.
- [ ] Check VPS logs for any errors in the cron, sync engine, or auth.
- [ ] Check R2 dashboard for upload activity.

## Rollback plan

If something is catastrophically broken in the first 24h:
- [ ] DNS rollback to old VPS — old site immediately resumes serving traffic.
- [ ] Any edits made on new site during the broken window are stranded on new VPS — need a reverse-migration script if we'd want to forward them to old-site Supabase. Likely just write them off (small window).

If broken issues are found after old-site fallback decommissioned (>1 week):
- [ ] Forward-fix on new site. No going back.

## Post-cutover cleanup (week +1)

- [ ] **Google Cloud Console** — REMOVE `https://new.livingdictionaries.app` from **Authorized JavaScript origins** for OAuth client `215143435444-fugm4gpav71r3l89n6i0iath4m436qnv.apps.googleusercontent.com`. Confirm `https://livingdictionaries.app` is still listed. (The `new.` subdomain stops serving anything after DNS cuts over; keeping the origin around is just noise.)
- [ ] Decommission old-site VPS.
- [ ] Archive `packages/old-site/` in repo (or remove entirely).
- [ ] Cancel Supabase project (after grace period, after backups confirmed).
- [ ] Update DNS records to remove old-site references.

## Operational notes

- **The `R2_SNAPSHOT_BUILDER_ENABLED` env var** is the kill switch. Set to `false` to halt the cron without restarting the app. Useful if R2 is having an outage or we discover a bug in the builder mid-day.
- **The `bin/build-all-snapshots.ts` script** is the manual fallback. It accepts:
  - `--all` — build every dict regardless of `snapshot_uploaded_at`
  - `--since=<ISO timestamp>` — build only dicts updated since
  - `--concurrency=N` — parallel uploads (default 4)
  - `--dict-id=X` — single dict only (for debugging)

## Open questions for cutover day

- [ ] What's our acceptable downtime window? (DNS propagation < cron-warm time, so 0 visible downtime should be possible.)
- [ ] Do we go on a Tuesday morning or a Saturday morning? (Tradition: Saturday for "less traffic"; modern wisdom: Tuesday for "people awake to fix it.")
- [ ] Communications plan — email blast before flip? Banner on old site warning of brief maintenance? Or silent?
