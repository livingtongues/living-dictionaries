# Legacy Google media storage — final teardown at the 2026-08-24 audit

> The R2-only cutover is DONE and deployed (full audit + runbook in git history of this file):
> site assets moved to content-addressed R2 keys, legacy serving-url fields dropped, GCS
> endpoint/client/env plumbing removed, `PUBLIC_STORAGE_BUCKET` + `PROCESS_IMAGE_URL` removed
> from the deployed VPS env. What remains is the deliberately-scheduled one-month safety window.

## Remaining — at the 2026-08-24 audit, with Jacob's explicit confirmation

- [ ] One local follow-up that predates the window: make the matching canonical tuf env edit and
      run `vps-setup/bin/sync living --env-only` so a future sync cannot restore
      `PUBLIC_STORAGE_BUCKET` / `PROCESS_IMAGE_URL`.
- [ ] Run the final zero-old-path query and R2 + locked-backup parity checks.
- [ ] Remove the private HMAC env entries and revoke the credentials.
- [ ] Delete both LD prod/dev GCS storage buckets.
- [ ] Do **NOT** decommission `anet-photo.appspot.com` — house still uses that proxy; App Engine
      teardown belongs to house's eventual R2 migration.
- [ ] Old poly R2 `backups-rolling/mirror/gcs-living/` is redundant with
      `livingdictionaries-backups/media/`; delete when retention allows.
- [ ] Remove the media-sweep cron's stale "legacy GCS paths are ignored" comment once old rows
      are eliminated.

## Gate

Do not deploy, remove living production env variables, revoke HMAC credentials, or delete any GCS
object/bucket without a new explicit instruction from Jacob.
