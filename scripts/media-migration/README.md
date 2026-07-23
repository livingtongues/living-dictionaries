# GCS → R2 media migration driver (audio + video + photos)

Plan + decisions: `.issues/media-r2-migration.md`. Run from mustang (needs fleet SSH to
`living` + the rclone `[r2]` poly remote). State lives in `state.db` (gitignored) — every stage
is restartable and the whole pipeline is idempotent (a re-run IS the post-flip sweep).

Order matters:

1. `pnpm tsx media-migration/pull-manifest.ts` — audio/video read-only prod scan → state.db
   `pnpm tsx media-migration/pull-manifest-photos.ts` — photos + partner logos +
   featured_images (photo objects with no storage_path get an `lh3:{hash}` source)
2. `pnpm tsx media-migration/copy.ts` — additive object copy into `livingdictionaries-media`;
   photo-kind rows also get the three WebP variants (sharp on mustang, recorded in `variants`)
3. `pnpm tsx media-migration/verify.ts` — per-dict count+byte check (originals + variants) →
   `dicts.verified_at`
4. **Deploy the dual-read serving + upload flip** (site code) — REQUIRED before stage 5
5. `pnpm tsx media-migration/rewrite.ts --confirm-dual-read-deployed` — sync-safe prod
   rewrites: dict.db audio/videos/photos storage_paths + snapshot cursor bumps, shared.db
   partner logos + featured_image JSON (dirty=1), featured_entries.photo_storage_path backfill
6. Re-run 1→5 later as the post-flip sweep (catches uploads that landed on GCS mid-window)

`objects.status`: pending → copied → rewritten, or `missing` (source object gone from both the
poly mirror and GCS — row keeps its old path, triage list = `SELECT * FROM objects WHERE
status='missing'`), or `error` (retried on next copy run; a sharp failure on a corrupt photo
lands here too — the row keeps serving via lh3).

Photo state tables: `objects.tbl` ∈ photos | partner_logos (row_id = partner id, fresh-uuid
key) | featured_image (row_id = dict id, fresh-uuid key); `variants` holds the WebP renditions.
