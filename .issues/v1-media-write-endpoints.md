# v1 media write endpoints (audio / photos / videos)

Add public `/api/v1` WRITE endpoints so an agent (bulk import) can attach / replace / delete media.
Feedback: read API exposes `entry.audios[]` / `sense.photos[]` but there's no write path.

## Decisions (from interview)
- **Q1 call shape:** ONE atomic call per (owner, medium) — upload/url + create row + link (+ speaker) → returns the media object (incl. id).
- **Q2 transport:** multipart/form-data file upload **AND** JSON `{ url }` (server fetches). Size-capped.
- **Q3 caption:** no caption column. Photos accept optional `source` (+ `photographer`) — these already render as the on-image caption.
- **Q4 idempotency:** accept client-supplied media `id` (re-POST = no-op) + `replace: true` (removes existing media of that medium on that owner first).
- **Q5 speaker:** `speaker_id` only, OPTIONAL; when given it MUST exist (else 400).
- **Q6 scope:** ALL 8 owner→media cells.
- **Video transport:** `hosted_elsewhere` (YouTube/Vimeo link, no bytes) AND direct file/url upload (same size cap). Reuse `parse_hosted_video_url` for a raw `hosted_url`.

## The 8 cells
| medium | owner | link | folder | speaker |
|--------|-------|------|--------|---------|
| audio | entry | column `entry_id` | audio | ✓ audio_speakers |
| audio | sentence | column `sentence_id` | audio | ✓ |
| audio | text | column `text_id` | audio | ✓ |
| photo | sense | junction `sense_photos` | images | – |
| photo | sentence | junction `sentence_photos` | images | – |
| video | sense | junction `sense_videos` | videos | ✓ video_speakers |
| video | sentence | junction `sentence_videos` | videos | ✓ |
| video | text | column `text_id` | videos | ✓ |

## Key facts verified in code
- Media tables in `schemas/dictionary.ts`: `audio`(storage_path NOT NULL, entry_id/sentence_id/text_id, source), `photos`(storage_path+serving_url NOT NULL, source, photographer), `videos`(storage_path NULLABLE, hosted_elsewhere JSON, source, videographer, text_id). Junctions: `sense_photos`, `sentence_photos`, `sense_videos`, `sentence_videos`, `audio_speakers`, `video_speakers`. All in `DICT_SYNCABLE_TABLES`.
- `HostedElsewhere` = `{ type: 'youtube'|'vimeo', video_id, start_at_seconds? }`. Only JSON col on videos.
- Photos need `serving_url` (lh3 hash) via `PROCESS_IMAGE_URL` after upload; dev-mock uses `dev-local:<key>` sentinel (`DEV_LOCAL_PREFIX`).
- Writes go through `merge_dict_row` (stamps audit/dirty, LWW, history) + `delete_dict_row`/`run_tombstone_delete`; then `mirror_dictionary_cursor`. Pattern = `v1-sub-resources.ts` / `v1-entry-write.ts`.
- Auth via `load_v1_dictionary_context({ event, access: 'write' })`.
- Upload infra: `$lib/server/gcloud.ts` (`gcs_is_configured`, `get_gcs`), presign route `api/upload`, serving-url route `api/gcs_serving_url`, dev store `api/dev-media/[...path]`.
- v1 endpoints have NO `_call.ts` (external API) — don't add.

## Build plan
1. **constants.ts** — `MAX_MEDIA_UPLOAD_BYTES` (25MB), `MEDIA_FETCH_TIMEOUT_MS`.
2. **`$lib/server/dev-media-dir.ts`** — extract `dev_media_dir()`; refactor `api/dev-media` route to use it.
3. **`$lib/server/media-storage.ts`** — `store_media_bytes({folder,file_name,file_type,bytes})` → `{storage_path,bucket,dev_mock}` (GCS PutObject / dev-media write / 503); `fetch_serving_url({storage_path})` (reuse from gcs_serving_url route → refactor route to use it).
4. **`$lib/api/v1/media-request.ts`** — `parse_media_request(event)` → `{bytes,file_name,file_type,fields}` (multipart OR json+url; http/https guard, size cap → 413/400).
5. **`$lib/db/server/v1-media-write.ts`** — `MEDIA_CELLS` config; `attach_media(...)`, `delete_media(...)`, `read_media_record(...)`. Owner-exists → found:false; idempotent id; replace; speaker validation; junction-or-column link; speaker junction.
6. **`$lib/api/v1/media-route-handlers.ts`** — `make_media_attach_handler(cell)`, `make_media_delete_handler(cell)` factories.
7. **16 route files** (8 POST + 8 DELETE), each 2 lines exporting the factory result.
8. **openapi.ts** — schemas (AudioFull/PhotoFull/VideoFull), 8 path groups, flip "Scope (v1) does not cover media" prose + the read-shape "No v1 write endpoint" notes.
9. **Tests** — unit test attach/delete over all 8 cells (in-memory dict_db); route tests (mock media-storage) for multipart/url/hosted, auth 403, 404 owner, 400 speaker, replace, idempotency.

## Verify
`pnpm test`, `tsc`, `pnpm lint`, `pnpm check`. Fetch `/api/v1/openapi.json` sanity.

## Status: ✅ COMPLETE

### Done
- ✅ constants: `MAX_MEDIA_UPLOAD_BYTES` (25MB), `MEDIA_FETCH_TIMEOUT_MS`.
- ✅ `$lib/server/dev-media-dir.ts` extracted; `api/dev-media` route refactored to use it.
- ✅ `$lib/server/media-storage.ts` — `store_media_bytes`, `resolve_photo_serving_url`, `fetch_serving_url`, `MediaStorageNotConfiguredError`. `api/gcs_serving_url` route now reuses `fetch_serving_url`.
- ✅ `$lib/api/v1/media-request.ts` — multipart / JSON+url parse, http(s) guard, size cap (413).
- ✅ `$lib/db/server/v1-media-write.ts` — `MEDIA_CELLS` (8), `attach_media`, `delete_media`, `read_media_record`.
- ✅ `$lib/api/v1/media-route-handlers.ts` — `make_media_attach_handler` / `make_media_delete_handler` factories.
- ✅ 16 route files (2-liners each).
- ✅ openapi.ts — media schemas + 8 path groups + prose flip (Scope/read-shape notes/Media section/Limits).
- ✅ Tests: `v1-media-write.test.ts` (15, all 8 cells) + `media-route-handlers.test.ts` (13, full wiring). `openapi.test.ts` path set updated.
- ✅ Full verify: `pnpm check` 0 errors, eslint clean, 897 vitest pass.

### Lessons / gotchas
- `@stylistic/operator-linebreak`: multi-line `type X =` must put `=` at the START of the continuation line (`type X\n  = | 'a' | 'b'`), matching `parse-hosted-video-url.ts`.
- `parse_dict_row` returns `Record<string, unknown>` → cast to `Record<string, any>` before building a typed record (non-strict TS still rejects unknown→string).
- `openapi.test.ts` snapshots the EXACT path→methods map — add new v1 paths there.
- Route factory pattern works: `export const POST = make_media_attach_handler('audio:entry')` type-checks against SvelteKit's generated `$types` (generic `RequestHandler` is assignable).
- Orphan-upload avoidance: handler pre-checks owner/idempotent-id/speaker BEFORE storing bytes.
- No `caption` column — photos use `source` + `photographer` (which ARE the on-image caption). No migration added (per Jacob).
