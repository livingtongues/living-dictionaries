# LD-MEDIA — media upload (legacy GCS) + service-worker 404 fix

Sub-session **LD-MEDIA** on `vps-migration`. Two tasks. Report via this file + ledger (no `horse send`).

## ✅ DONE (2026-06-05). check 0/16 · test 189 · build ✔ · e2e: achi-flow + dict-sync + dict-watch-2ctx + media-upload all PASS. Not pushed.

### What shipped
- **Task 1 — media upload wired to real auth + real GCS signing.** `api/upload/+server.ts` now uses
  `verify_auth_dict_role(event, dictionary_id, 'editor')` (was the M4-auth `getSession` JWT shim) and
  `api/gcs_serving_url/+server.ts` uses `verify_auth(event)`. `$lib/server/gcloud.ts` refactored to
  `$env/dynamic/private` (runtime creds, names UNCHANGED: `GCLOUD_MEDIA_BUCKET_ACCESS_KEY_ID/_SECRET_ACCESS_KEY`)
  + `gcs_is_configured()` → 503 when unset + lazy singleton; bucket = dev/prod split via `import.meta.env.DEV`
  (`talking-dictionaries-dev|alpha.appspot.com`). Dropped the dead `check-permission.ts` + `mode` import.
  Ported `server.test.ts` for both endpoints (11 tests: auth-gating, 503, happy path; signer mocked).
  The CLIENT pipeline (upload-image/audio/video → insert_photo/audio/video → wa-sqlite → sync) already
  existed from M4-write — only the two endpoints were stubbed.
- **Task 2 — service worker dropped** (matches example). Deleted `src/service-worker.ts` +
  `src/routes/PromptReloadOnUpdate.svelte` (+ its `+layout.svelte` use). Removed the SW pageerror filter
  from `e2e/{achi-flow,dict-sync,dict-watch-2ctx}.mjs`; all pass with `pageerror` empty (404 gone).
- **New `e2e/media-upload.mjs`** (`pnpm -F site test:media`): seeded manager uploads a PHOTO + AUDIO;
  fake GCS creds (getSignedUrl is local crypto) + puppeteer-intercepted GCS PUT + lh3, and a local
  PROCESS_IMAGE_URL stub returns an lh3 serving id — "all the image magic" mocked, nothing leaves the box.
  Asserts photo/audio rows + sense_photos + audio_speakers junctions persist to server SQLite and the
  photo renders in a fresh no-OPFS context.
- New vitest alias `$app/environment` → `src/lib/mocks/app-environment.ts` (the upload endpoint test
  transitively imports `resolve-admin-level` which imports `$app/environment`).

### THREE real bugs found + fixed (all runes-migration / M4 fallout, all blocked audio/media)
1. **SelectSpeaker `speaker_id` was `$derived`** → `bind:value` couldn't write it, so selecting a speaker
   never revealed the record/upload UI. Fixed to `$state(...)` (matches example). (+1 benign
   `state_referenced_locally` warning → baseline now 16.)
2. **EditAudio bound `undefined` $state to RecordAudio props with non-undefined `$bindable` fallbacks**
   (`permissionGranted=false`, `audioBlob=null`) → Svelte `props_invalid_value` runtime throw crashed
   the audio editor subtree. Fixed initializers to `$state(false)` / `$state(null)`.
3. **Sync engine cleared dirty with a blanket `UPDATE … SET dirty=NULL WHERE dirty=1`** in
   `#apply_response` → rows inserted AFTER `#build_request`'s snapshot but DURING the in-flight sync
   (e.g. insert_photo writes `photos` then `sense_photos`; a sync fires between) were marked clean
   without ever being pushed → junctions (sense_photos, audio_speakers, and by extension entry_tags etc.)
   silently never reached the server. Fixed to clear dirty ONLY by pushed row id (+ tombstones by key),
   matching the example engine. **This was a general M4-write-sync bug affecting all editor junctions.**

### Jacob's remaining step
Set real GCS env (`GCLOUD_MEDIA_BUCKET_ACCESS_KEY_ID`, `GCLOUD_MEDIA_BUCKET_SECRET_ACCESS_KEY`,
`PROCESS_IMAGE_URL`) on the VPS env, then eyeball a real upload at :3041 (agent can't reach GCS).


## KEY FINDING — scope is small (most of Task 1 is already done)
The client media pipeline + metadata persistence already shipped with **M4-write**:
- `lib/components/{image,audio,video}/upload-*.ts` — full 3-step presigned-PUT flow (POST `/api/upload`
  → XHR PUT bytes → images also POST `/api/gcs_serving_url`). NOT stubbed.
- `lib/helpers/media.ts` `addImage/addAudio/uploadVideo` — on upload success call
  `insert_photo/insert_audio/insert_video` (+ `assign_speaker`) in `lib/supabase/operations.ts`,
  which write to **wa-sqlite** (`dict_db.<table>.insert`) → sync → server SQLite. The M4 path.
- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` already in `dependencies`.

So the ONLY stubbed piece is the **two server endpoints**, still on the M4-auth real-JWT
`locals.getSession` shim:
- `routes/api/upload/+server.ts` — `getSession` + `check_can_edit(supabase,…)` + `mode`-based bucket
  via `GCLOUD_MEDIA_BUCKET_S3` (`$lib/server/gcloud.ts`, `$env/static/private`).
- `routes/api/gcs_serving_url/+server.ts` — `getSession` + `PROCESS_IMAGE_URL` (`$env/static/private`).

The real-auth helpers already exist (`lib/auth/verify.ts` `verify_auth`, `lib/auth/verify-dict-role.ts`
`verify_auth_dict_role(event, dict_id, 'editor')` — admin bypass + fresh `dictionary_roles` check).

## Task 1 plan — wire the two endpoints to real auth + real GCS signing
- [ ] `api/upload/+server.ts`: replace the `getSession`/`check_can_edit`/`admin_metadata` block with
      `await verify_auth_dict_role(event, dictionary_id, 'editor')`. Validate body fields. Sign a
      presigned PUT.
- [ ] `api/gcs_serving_url/+server.ts`: replace `getSession` with `await verify_auth(event)`.
- [ ] GCS signing module: adopt the example's `$lib/server/gcs.ts` shape — `$env/dynamic/private`,
      `gcs_is_configured()` → **503** when unset (feature dormant, not a crash), singleton S3Client @
      `storage.googleapis.com`. (DECISION Q1/Q2 below: env names + single-bucket.)
- [ ] Drop now-unused `mode`/`check_can_edit`/`$lib/server/gcloud.ts` imports.
- [ ] Port the example's `server.test.ts` for both endpoints (mock the signer; assert auth-gating +
      503-when-unconfigured + happy path).
- [ ] All three media kinds are the SAME endpoint (`/api/upload` is type-agnostic; serving_url only for
      images) → wiring "all three" is free.

## Task 2 plan — drop the service worker (match the example)
The example has **no** `service-worker.*` and **no** `PromptReloadOnUpdate.svelte`.
- [ ] Delete `src/service-worker.ts` (SvelteKit auto-registration only fires when this file exists →
      deleting it stops registration entirely; no `kit.serviceWorker` override needed).
- [ ] Delete `src/routes/PromptReloadOnUpdate.svelte` + remove its use in `src/routes/+layout.svelte`
      (it only reacts to SW `controllerchange`; dead without the SW).
- [ ] Remove the `ServiceWorker|service-worker.js` pageerror filter from the 3 e2e harnesses that have
      it: `e2e/achi-flow.mjs`, `e2e/dict-sync.mjs`, `e2e/dict-watch-2ctx.mjs`. Confirm they still PASS.

## Verification plan
- New `e2e/media-upload.mjs` (DECISION Q3/Q4): boot `node build` with **fake** `GCS_*` env (getSignedUrl
  is pure local crypto — no network), puppeteer-intercept the `storage.googleapis.com` PUT → 200, log in
  as seeded manager `achi-manager@example.com` (dev OTP), upload audio → assert wa-sqlite row + server
  `.data/dictionaries/achi.db` row + fresh-context reload renders it. `pageerror` empty.
- `pnpm --filter=site check` 0 · `test --run` green · `build` + boot · `achi-flow` + `dict-sync` PASS.
- Jacob eyeballs a REAL upload at :3041 with real creds (agent can't reach GCS).
- Commit verified phases on `vps-migration` (Co-Authored-By trailer); don't push.

## Decisions (Jacob, 2026-06-05)
- **Q1 env — easiest with existing keys:** KEEP LD's env names `GCLOUD_MEDIA_BUCKET_ACCESS_KEY_ID` /
  `GCLOUD_MEDIA_BUCKET_SECRET_ACCESS_KEY` (no re-keying). Refactor `$lib/server/gcloud.ts` to read them
  via `$env/dynamic/private` (runtime) + a lazy singleton + `gcs_is_configured()` → **503** when unset.
- **Q2 bucket — KEEP the dev/prod split** (Jacob reconsidered: image resizing/serving_url needs media
  to actually live in a GCS bucket, can't be done locally). bucket = `dev ? talking-dictionaries-dev
  .appspot.com : talking-dictionaries-alpha.appspot.com` via `dev` from `$app/environment` (drops the
  `$lib/supabase` `mode` import). Real dev uploads → dev bucket; the e2e uses fake creds + intercept so
  nothing leaves the machine.
- **Q3:** new dedicated `e2e/media-upload.mjs`.
- **Q4:** audio + photo, **mock all the image magic** — a local PROCESS_IMAGE_URL stub server returns an
  lh3 serving id, and the GCS PUT is puppeteer-intercepted → 200. Drive via real file inputs
  (photo: EditImage→ImageDropZone; audio: EditAudio→SelectSpeaker seeded speaker + SelectAudio file).
