# Media upload (legacy GCS, presigned PUT) — LD-MEDIA

Wiring the last real LD feature: editors add audio/photos/video; **bytes go to the LEGACY Google Cloud
Storage bucket (NOT R2 — R2 deferred), metadata rides the M4 write/sync path** (wa-sqlite → server
SQLite). Plan/status: `.issues/media-upload-and-sw-fix.md`.

## What was actually missing (scope was small)
The whole CLIENT pipeline already shipped with M4-write and was untouched:
`components/{image,audio,video}/upload-*.ts` do the 3-step presigned-PUT flow; `helpers/media.ts`
(`addImage`/`addAudio`/`uploadVideo`) calls them then `insert_photo`/`insert_audio`/`insert_video`
(+ `assign_speaker`) in the dict-client operations module, which write to **wa-sqlite** (`dict_db.<table>.insert`).
The ONLY stubbed pieces were the **two server endpoints**, still on the M4-auth real-JWT `getSession`
shim. So the task was just: swap those endpoints to real auth + finalize the signing module.

## The mechanism (S3-interop, NOT @google-cloud/storage)
GCS's S3-compatible **interoperability** API with **HMAC keys** via `@aws-sdk/client-s3` +
`@aws-sdk/s3-request-presigner` (already in `dependencies`). `lib/server/gcloud.ts`:
`S3Client({ endpoint: 'https://storage.googleapis.com', region: 'us', credentials: {HMAC} })`, lazy
singleton, `gcs_is_configured()`. Three steps:
1. `POST /api/upload {folder, dictionary_id, file_name, file_type}` → presigned PUT url + `object_key`
   (`${folder}/${Date.now()}.${ext}`). Editor-gated by `verify_auth_dict_role(event, dict_id, 'editor')`.
2. client XHR-PUTs bytes to the presigned url.
3. **images only:** `POST /api/gcs_serving_url {storage_path}` → server fetches the GAE images service
   (`PROCESS_IMAGE_URL`) → lh3 `serving_url` id. Audio/video store `storage_path` only.

## Decisions (Jacob, 2026-06-05)
- **Env names kept** (least friction — creds already exist): `GCLOUD_MEDIA_BUCKET_ACCESS_KEY_ID`,
  `GCLOUD_MEDIA_BUCKET_SECRET_ACCESS_KEY`, `PROCESS_IMAGE_URL`. Read via `$env/dynamic/private` (runtime
  → VPS env_file sets them with no rebuild). Unset → endpoints return **503** (feature dormant), never
  crash. (The example renamed these to `GCS_*`; LD deliberately did not.)
- **Bucket kept as a dev/prod split** (`talking-dictionaries-dev|alpha.appspot.com`), chosen by
  `import.meta.env.DEV` (NOT `$app/environment` — that doesn't resolve in the `site:unit` vitest
  project; the codebase already uses `import.meta.env` this way). Rationale: the image-resizing/
  serving-url service only works on media that actually lives in a GCS bucket, so dev needs the dev
  bucket — you can't keep dev media purely local.

## Testing the upload without touching GCS
- **Unit:** `api/upload/server.test.ts` + `gcs_serving_url/server.test.ts` (ported from the example,
  env names adapted): real `verify_auth*` against an in-memory `shared.db`, `getSignedUrl` / `fetch`
  mocked. Assert 401/403/400/503/200. Bucket assertion accepts either dev/prod name (DEV varies).
- **e2e (`e2e/media-upload.mjs`, `pnpm -F site test:media`):** seeded manager uploads a photo + audio.
  `getSignedUrl` is pure local crypto, so **FAKE** `GCLOUD_MEDIA_BUCKET_*` creds yield a valid signed
  URL with no network. Puppeteer intercepts the `storage.googleapis.com` PUT (+ its CORS preflight —
  answer OPTIONS with permissive CORS headers or the real PUT is blocked) and the `lh3` image GET; a
  tiny local http server stands in for `PROCESS_IMAGE_URL` returning `http://lh3.googleusercontent.com/
  <id>`. Asserts photo/audio rows + `sense_photos`/`audio_speakers` junctions reach the server SQLite
  and the photo renders in a fresh no-OPFS context. The presigned URL is **path-style**
  (`storage.googleapis.com/<bucket>/<key>`), bucket has dots.
- **e2e hygiene:** the achi fixture seeds `audio` (reset each run) but NOT `photos`, so uploaded photos
  accumulate across runs — the harness `DELETE`s `photos`/`sense_photos` before boot and asserts
  run-specific (the photo carrying THIS run's `serving_url`), not `photos[0]`.

## Three runes/sync bugs that BLOCKED audio/media (all fixed; details elsewhere)
Driving the audio UI headlessly surfaced real bugs (not test artifacts) that broke audio upload for
actual users post-M2c/M4:
1. **SelectSpeaker `speaker_id` was `$derived`** → `bind:value` on the speaker `<select>` couldn't write
   it, so picking a speaker never revealed the record/upload UI. Fixed to `$state(...)` (matches example).
   Trade-off: a benign `state_referenced_locally` warning (init-from-prop) — baseline warnings 15→16.
2. **EditAudio bound `undefined` `$state` to RecordAudio props with non-undefined `$bindable` fallbacks**
   (`permissionGranted=false`, `audioBlob=null`) → Svelte 5 `props_invalid_value` runtime throw crashed
   the audio editor subtree (no record/upload UI). Fixed initializers to `$state(false)`/`$state(null)`.
   **General lesson: a parent's bound `$state` must be initialized to match the child `$bindable(x)`
   fallback — `$state()` (undefined) against `$bindable(false|null|…)` throws at mount.**
3. **Sync engine dirty-clear race** (junctions never synced) — see `m4-write-sync.md` (third sync bug).

## Service worker dropped (resolved the deep-link 404)
Deleted `src/service-worker.ts` + `src/routes/PromptReloadOnUpdate.svelte` (SW-only) + its layout use,
matching the example (which has neither). SvelteKit only auto-registers the SW when `src/service-worker.*`
exists, so deletion stops registration — no `kit.serviceWorker`/`paths` override. Removed the
`ServiceWorker|service-worker.js` pageerror filter from the 3 e2e harnesses. See `.issues/service-worker-404.md`.

## Jacob's remaining step
Set the real GCS env on the VPS, then eyeball a real upload at :3041 (the agent can't reach GCS).

## Dev media mock — local upload + serve, no bucket (added 2026-06-05)
So media works on dev with **no GCS bucket** (plan: `.issues/dev-media-mock.md`). Gated on
`import.meta.env.DEV && !gcs_is_configured()` — **prod-without-creds still returns the dormant 503**
(the dev branch compiles out of a prod build). Mirrors house's dev-mock idea but goes further on two
points house doesn't have:
- **LD's client PUTs the bytes** (house POSTs them to the server). So on dev `/api/upload` returns
  `{ dev_mock:true, presigned_upload_url:'/api/dev-media/<object_key>', … }` and the client XHR-PUTs to
  **our own** `api/dev-media/[...path]` endpoint (vs a presigned GCS url).
- **Jacob chose store-local-and-serve-back** (not house's discard+placeholder): `api/dev-media` PUT writes
  `<DATA_DIR>/dev-media/<path>`; GET serves it back, or **307-redirects to a bundled dummy when the file
  isn't local**. That redirect is the elegant bit — existing pulled-dict audio/video (whose bytes live in
  the bucket we don't have) automatically fall back to `static/dev-placeholder-{audio.mp3,video.mp4}`,
  while a file you just uploaded plays back for real. No env check needed in the serve path.
- **Photos stay real on dev:** `image_src()` (in `$lib/helpers/media-url.ts`) sends real serving_url hashes
  to the **public lh3 CDN** (works with no bucket), maps the `dev-local:<key>` sentinel (set by a dev image
  upload) to `/api/dev-media/<key>`, and empty hashes to `static/dev-placeholder-image.svg`. So pulled-dict
  photos display for real; only dev-uploaded/empty ones use the local store/placeholder.
- **Why `media-url.ts` is its own file:** the pure URL builders (`image_src`, `url_from_storage_path`,
  `DEV_LOCAL_PREFIX`) were split out of `media.ts` because `media.ts` imports the dict-client `operations`
  (→ `$app/stores`), which can't resolve in the `site:unit` vitest project — so an in-source test there
  fails the suite. `media.ts` re-exports them, so import sites are unchanged.
- **Prod `talking-dictionaries-alpha` photos are publicly lh3-served**, so the pulled dicts' real photos load
  on dev. Audio/video need the bucket → dummy on dev. (Media *files* aren't part of a data pull.)
