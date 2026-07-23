# GCS → R2 media migration driver (audio + video)

Plan + decisions: `.issues/media-r2-migration.md`. Run from mustang (needs fleet SSH to
`living` + the rclone `[r2]` poly remote). State lives in `state.db` (gitignored) — every stage
is restartable and the whole pipeline is idempotent (a re-run IS the post-flip sweep).

Order matters:

1. `pnpm tsx media-migration/pull-manifest.ts` — read-only prod scan → state.db
2. `pnpm tsx media-migration/copy.ts` — additive object copy into `livingdictionaries-media`
3. `pnpm tsx media-migration/verify.ts` — per-dict count+byte check → `dicts.verified_at`
4. **Deploy the dual-read serving + upload flip** (site code) — REQUIRED before stage 5
5. `pnpm tsx media-migration/rewrite.ts --confirm-dual-read-deployed` — sync-safe prod
   storage_path rewrites + snapshot-builder cursor bumps
6. Re-run 1→5 later as the post-flip sweep (catches uploads that landed on GCS mid-window)

`objects.status`: pending → copied → rewritten, or `missing` (source object gone from both the
poly mirror and GCS — row keeps its old path, triage list = `SELECT * FROM objects WHERE
status='missing'`), or `error` (retried on next copy run).
