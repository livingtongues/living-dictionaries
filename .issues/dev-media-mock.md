# Dev media mock — local upload + serve, dummy fallback (no storage bucket)

Goal: on **dev** (no GCS creds), media upload + loading works without a storage bucket.
Mirrors house's dev-mock pattern, extended for LD's audio/video + LD's client-direct-PUT flow,
with Jacob's two choices:
- **Existing pulled media:** real photos load (lh3 = public Google CDN); audio/video → dummy.
- **Uploads:** store bytes locally under `.data/dev-media/` and serve them back (see/playback your real upload).

Gate: `import.meta.env.DEV && !gcs_is_configured()`. Prod-without-creds keeps the existing 503
(feature dormant) — the dev branch is compiled out of a prod build (`import.meta.env.DEV` false).

## Design / seams
- `gcs_is_configured()` (`$lib/server/gcloud.ts`) = both HMAC env vars present. Unset on dev.
- Upload: client `upload-{image,audio,video}.ts` POST `/api/upload` → presigned GCS PUT url, XHR-PUTs
  bytes, (images also) POST `/api/gcs_serving_url`. Display: images build `lh3.googleusercontent.com/
  ${serving_url}=${size}` (Image.svelte/Image2.svelte + PrintEntry inline); audio/video/download go
  through `$page.data.url_from_storage_path(path)` (`$lib/helpers/media.ts`, firebasestorage URL).

## Changes
- ✅ `static/dev-placeholder-image.svg` + `dev-placeholder-audio.mp3` (440Hz tone) + `dev-placeholder-video.mp4`
  (testsrc pattern) — rasterized + eyeballed.
- ✅ `api/dev-media/[...path]/+server.ts` — DEV-only. PUT writes `.data/dev-media/<path>`; GET serves it
  (content-type by ext+folder) or 307-redirects to the matching dummy when the file isn't local
  (→ existing pulled a/v degrade to dummy automatically). Path-traversal guarded.
- ✅ `api/upload/+server.ts` — when `!gcs_is_configured()`: if `import.meta.env.DEV` return `{ dev_mock:true,
  object_key, item_id, presigned_upload_url:'/api/dev-media/<object_key>', bucket:'' }`; else 503 (unchanged).
- ✅ `api/upload/server.test.ts` — "503 when not configured" → "200 dev_mock" (vitest runs DEV).
- ✅ `components/image/upload-image.ts` — on `dev_mock`: still PUT (stores locally), SKIP `gcs_serving_url`,
  set `serving_url='dev-local:'+object_key`. (audio/video clients unchanged — their PUT stores locally.)
- ✅ Pure URL builders split into `$lib/helpers/media-url.ts` (`image_src`, `url_from_storage_path`,
  `DEV_LOCAL_PREFIX` + in-source tests) — separated from `media.ts` so they're unit-testable without pulling
  `$app/stores` via `operations`; `media.ts` re-exports them so all import sites are unchanged.
- ✅ `Image.svelte`, `Image2.svelte`, `PrintEntry.svelte` — route lh3 builds through `image_src`.

## Verify
- ✅ `pnpm -F site check` → 0 NEW errors (18 warnings). The lone error is a PRE-EXISTING concurrent-WIP
  issue in `src/lib/email/send-raw-email.ts` (`new Error(msg, { cause })` vs ES2020 target) — not mine.
- ✅ `pnpm -F site test --run` → 337 passed (+4 media-url/upload). ✅ eslint clean on changed files.
- [ ] Jacob eyeballs :3041 — pulled dict photos real, a/v show dummy; upload an image/audio/video on achi,
      see/playback the real upload.

## Notes
- e2e `media-upload.mjs` sets FAKE creds → `gcs_is_configured()` true → real flow, dev branch skipped (unaffected).
- VPS `/opt/hosting/data/files` is unrelated; dev media uses `.data/dev-media/` (DEV-only, never created in prod).
