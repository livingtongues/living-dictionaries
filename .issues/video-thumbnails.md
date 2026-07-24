# Video thumbnails — generate for all uploaded videos + auto on new uploads

## Context (what already shipped, commit 318f621f)
- `video_thumb_src(video)` in `media-url.ts`: `hosted_metadata.thumbnail_url` (YouTube/Vimeo — no
  generation needed) → R2 `{dict}/video/{uuid}_thumb.webp` (uploaded videos — **needs generating**)
  → `null` (hosted-only video → icon chip).
- Render side is done: `ListEntry.svelte` shows `<img onerror>` → `play-overlay` icon fallback.
- **Nothing generates the `_thumb.webp` for uploaded videos yet.** That's this task.

## Scale (prod ledger, 2026-07-24)
- **187 uploaded video originals**, ~2.3 GB total (avg ~12 MB).
- ✅ **187 thumbnails uploaded to R2 on 2026-07-24.**

## The generator contract (`.knowledge/domain/media-serving-urls.md`)
Write a square-crop webp at `{key minus ext}_thumb.webp` — identical spec to the photo `thumb`
variant (400px, `fit: cover`, `withoutEnlargement`, webp q80). Nothing else to update.
Proven locally: `ffmpeg -ss 1 -i video -frames:v 1 frame.png` → `sharp(...cover 400...).webp()`.

## Key facts about the two upload paths
- **Browser upload = presigned PUT** (`/api/upload` → XHR PUT browser→R2). **Server never sees the
  bytes** — can't generate in-process at upload time. Needs either a post-upload trigger or the sweep.
- **v1 agent upload** (`media-route-handlers.ts`) — bytes ARE in-process (`store_bytes`), so we can
  fire generation right there like photos do at line 286 (`store_photo_variants_in_background`).
- ffmpeg is NOT in the Docker image today (node:24-alpine). Must add it.

## Plan

### 1. `$lib/server/video-thumbnails.ts` (mirrors `photo-variants.ts`)
- `generate_video_thumbnail({ bytes, file_type })` → temp file → ffmpeg extract frame (seek ~1s,
  fallback first frame) → sharp 400 cover webp q80 → Uint8Array. Cleans temp.
- `generate_and_store_video_thumbnail({ original_key, bytes? })` — bytes optional; if absent,
  GetObject from R2. Stores at `photo_variant_key({ original_key, variant: 'thumb' })` via
  `store_media_bytes({ r2_key })` + `record_media_object_by_key`.
- `store_video_thumbnail_in_background(...)` — fire-and-forget, logs on failure.

### 2. Dockerfile — add ffmpeg to the runner stage (`apk add --no-cache ffmpeg`).

### 3. media-sweep-cron.ts
- **BUG FIX (must ship with generation):** `live_keys_for_dict` only adds photo variant keys to the
  live set. A video `_thumb.webp` would be seen as an orphan and DELETED after 30d. Add the thumb
  variant key for video paths too.
- **Self-heal loop:** find video originals (new-convention, non-variant) in the R2 listing missing
  their `_thumb.webp` sibling → download + generate + store (capped per run). Ongoing safety net for
  the browser crash-gap + slow backfill.

### 4. Fast-path auto-generation on new uploads  (DECISION Q3)
- v1 agent: fire `store_video_thumbnail_in_background({ original_key, bytes })` in-process (bytes on hand).
- Browser: new `POST /api/video/generate-thumbnail { dictionary_id, storage_path }` fired after
  `insert_video` in `add_media.ts` `add_video` (contributor-gated, downloads from R2, generates).

### 5. Immediate backfill of the 187
- Run from mustang before deploy: download public originals, extract several candidate frames,
  ask `gpt-5.6-sol` to select the best, and render through the shared photo-thumb pipeline.
- Upload from inside the prod container with its LD R2 credentials. No permanent admin endpoint is
  needed; the weekly self-heal is the durable recovery path.

## Verification
- Unit test `generate_video_thumbnail` against `static/dev-placeholder-video.mp4` fixture → asserts webp out.
- `pnpm test` / `tsc` / `lint` / `check`.
- Post-deploy: hit the backfill endpoint; confirm thumbs appear in entry lists + /admin/storage variant bytes.

## Decisions (Jacob, 2026-07-24)
- Q1 A: `apk add ffmpeg` in Dockerfile runner stage. ✅
- Q2 A: seek 1s (fallback first frame), 400 square webp q80 — for the AUTOMATIC path. ✅
- Backfill: extra effort — compare several candidate frames and let **gpt-5.6-sol** (codex vision)
  pick the best; keep looking if none suitable; fall back to mid-frame. Run NOW from mustang.
- Q3 A: `POST /api/video/generate-thumbnail` fired after the row saves. ✅

## Progress
- ✅ `$lib/server/video-thumbnails.ts` (+ test) — ffmpeg frame → `generate_photo_variant('thumb')`.
- ✅ Dockerfile runner: `apk add --no-cache ffmpeg`.
- ✅ media-sweep-cron: `live_keys_for_dict` now whitelists the video `_thumb.webp`; added video
  self-heal loop (cap 40/run) + summary fields.
- ✅ `POST /api/video/generate-thumbnail` (+ `_call`, + server.test) fired from `add_media.add_video`.
- ✅ v1 `media-route-handlers`: fires `store_video_thumbnail_in_background` with bytes on hand.
- ✅ tsc 0 errors / svelte-check 0 errors / lint clean / 249 tests green.
- ✅ BACKFILL COMPLETE: `gpt-5.6-sol` selected frames for all 187 originals. One 0.73-second clip
  needed an exhaustive review of all 12 frames after the normal sampler rejected its candidates.
- ✅ Production upload from inside `sveltekit_blue`: `{ ok: 187, fail: 0, total: 187 }`.
- ✅ Public verification: all 187 `media.livingdictionaries.app/*_thumb.webp` responses are
  byte-for-byte SHA-256 matches for the generated files. 179 are 400×400; 8 retain a smaller source
  dimension because the shared variant contract deliberately uses `withoutEnlargement`.

## ⚠️ Deploy dependency
The `live_keys_for_dict` video-thumb fix MUST deploy within ~30 days of the backfill upload, else the
weekly reconcile orphans the new thumbs (30-day grace protects them until then; a post-deploy
reconcile un-orphans). Ships in the same PR — just push.

## Backfill artifacts (NOT committed — machine-specific, uses codex)
`~/video-thumb-backfill/{generate.mjs,build-payload.mjs,uploader.cjs,worklist.json,staging/}`
