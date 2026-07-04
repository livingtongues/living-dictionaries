# Admin media-storage dashboard — bytes total / by type / by dictionary / by bucket

## Goal

Admin visibility into GCS media storage: total bytes, split by media type (audio / photos /
videos), by dictionary, and by dictionary bucket (`dictionaries.bucket` — landed 2026-07-04, see
`.issues/dictionary-buckets-cleanup.md`). The conlang+glossary slice is the KPI for the
"squash tolerated-bucket media to zero over time" campaign (we can't delete people's data
without warning them, but we can watch it and turn off NEW uploads — separate story). Also
surfaces ORPHANED media (objects whose dict no longer exists — grows as the delete bucket is
executed, since the teardown endpoint defers GCS harvest).

## Data source — full GCS listing sweep

- Media rows in dict DBs have `storage_path` but **no byte sizes** → sizes must come from GCS.
- The VPS already holds S3-interop HMAC creds (`GCLOUD_MEDIA_BUCKET_ACCESS_KEY_ID/SECRET`,
  `$lib/server/gcloud.ts`), bucket `talking-dictionaries-alpha.appspot.com`.
- `ListObjectsV2` (1,000 keys/page) over the whole bucket; keys are prefixed `<dict_id>/…` with
  type inferable from the path segment (`/audio/`, `/images/`, `/video/`) with extension
  fallback. **Verify segment conventions against a real listing before building** (legacy
  variations likely).
- Even ~500k objects ≈ 500 list calls — trivial as a nightly job.

## Current row counts (2026-07-04 classification, DB rows not bytes)

| bucket   | dicts | audio  | photos | videos |
|----------|-------|--------|--------|--------|
| public   | 221   | 94,108 | 12,536 | 62     |
| unlisted | 396   | 41,687 | 5,418  | 138    |
| conlang  | 696   | 8,775  | 2,640  | 49     |
| glossary | 269   | 1,054  | 894    | 182    |
| delete   | 650   | 124    | 157    | 4      |

(Notable single offenders: `leshing` conlang with 2,460 audio + 2,159 photos; `orich` 1,180
audio; `taharini` 806 audio.)

## Design

1. **Table** (server-only, not synced): `dict_media_stats`
   - `dictionary_id TEXT` (may reference a DELETED dict — that's the orphan signal; also a
     literal `'_unrecognized'` row for keys that match no dict-id-shaped prefix)
   - `media_type TEXT` ('audio' | 'image' | 'video' | 'other')
   - `object_count INTEGER`, `total_bytes INTEGER`
   - `computed_at TEXT`
   - PK (dictionary_id, media_type). Full rebuild per sweep (DELETE + INSERT in one txn).
2. **Sweep job**: `$lib/server/media-stats-sweep.ts` — piggyback the existing cron mechanism the
   R2 snapshot builder uses; nightly. Plus `POST /api/admin/media-stats/refresh` for a manual
   refresh button (admin level 3, long-running → fire-and-forget with status row in
   `db_metadata`).
3. **UI**: `/admin/storage` (or a panel on the admin dashboard):
   - headline total + by-type split (bar)
   - by-bucket split (join `dictionaries.bucket`; orphaned shown as its own slice) — this is the
     squash-KPI chart; consider keeping a tiny history table (`media_stats_daily`: day, bucket,
     bytes) so the trend line shows progress toward zero
   - top-N dictionaries by bytes (link to dict + its bucket badge)
   - orphans: count + bytes + "these belong to deleted dictionaries" note (feeds the future GCS
     harvest story)
4. **Serving**: admin page reads via a small `/api/admin/media-stats` GET (server-only table —
   NOT part of admin browser sync).

## Follow-on stories this unlocks (not in scope)

- Disable new media uploads for `conlang`/`glossary` buckets (upload endpoints check bucket).
- GCS orphan harvest for executed deletes (list is already in `dict_media_stats`).
- Warn-then-purge campaign for tolerated-bucket media.
