# Deepen the media upload pipeline — one module, promise-based outcome

**COMPLETED 2026-07-12** (verification finished during clobber recovery — see
`.issues/clobber-recovery-2026-07-12.md`). Follow-up gap also closed same day: up-front
`writes.check_ready()` in `add-media.ts` (no upload starts while writes are blocked) + `done`
rejects when the guarded insert is swallowed post-upload — no more silent row drop after the
modal closed.

**Status: assigned to a spawned session. Recommendation strength: STRONG.**

## Problem

The upload→DB-insert flow is smeared across 5 modules with the real bugs hiding in the seams:

- `site/src/lib/components/image/upload-image.ts` (95 lines)
- `site/src/lib/components/audio/upload-audio.ts` (77 lines)
- `site/src/lib/components/video/upload-video.ts` (75 lines)
- `site/src/lib/helpers/media.ts` (`addImage` / `addAudio` / `uploadVideo` — camelCase legacy names)
- `site/src/lib/db/dict-client/operations.ts` (`insert_photo` / `insert_audio` / `insert_video`)

The three `upload-*.ts` files are the SAME module three times: presign via `api_upload` → XHR PUT
with progress → (image only: `api_gcs_serving_url`) → status store. Then `helpers/media.ts` couples
upload→insert with a **store subscription**: subscribe to the status store, wait until magic fields
(`storage_path` [+ `serving_url` for images]) appear, then insert the DB row, then unsubscribe.

### Three latent defects (verified by reading the code 2026-07-12)

1. **Non-2xx PUT hangs the promise.** In `upload_file`, the XHR `load` handler's else-branch
   (`xhr.status` outside 200–299) sets error state on the store but **neither resolves nor
   rejects** — the awaiting async IIFE hangs forever.
2. **Unhandled rejection.** The XHR `error` handler DOES `reject(xhr.statusText)`, but the
   fire-and-forget IIFE `(async () => { … await upload_file(…) … })()` has no `catch` → unhandled
   promise rejection.
3. **Silent no-insert + subscription leak.** In `addImage`/`addAudio`/`uploadVideo`
   (`helpers/media.ts`), when the upload errors the success fields never appear, so the
   subscription never fires, `unsubscribe()` is never called, and the DB row is silently never
   inserted. The caller must independently notice `error` on the status store.

Also: `addImage`/`addAudio`/`uploadVideo` are camelCase in a snake_case codebase and each reads
`page.data.dictionary` internally (global coupling).

## Callers (complete inventory)

- `lib/components/image/EditImage.svelte` → `db_operations.addImage(…)` (+ `EditImage.stories.ts` mock)
- `lib/components/audio/EditAudio.svelte` → `db_operations.addAudio(…)` (+ `EditAudio.stories.ts` mock)
- `lib/components/video/AddVideo.svelte` → `db_operations.uploadVideo(…)` (+ `AddVideo.stories.ts` mock)
- `lib/mocks/db.ts` mocks all three (`log_db_operations`)
- Exposed via `lib/db-operations.ts` barrel → `page.data.db_operations` (dict `+layout.ts`)
- `helpers/media.ts` also re-exports `DEV_LOCAL_PREFIX, image_src, url_from_storage_path` from
  `$lib/utils/media-url` — keep those re-exports working or update importers.

Note `Progress.svelte` / `AudioVideoUploadStatus` type consumers — check
`lib/export/Progress.svelte` is unrelated (it's CSV export progress), but grep
`ImageUploadStatus` / `AudioVideoUploadStatus` for type importers before renaming.

## Design

One new module `site/src/lib/media/upload-media.ts` (new `lib/media/` feature folder is fine, or
keep beside the existing files — follow the lib layout convention: feature-owned folder):

```ts
export interface MediaUploadHandle {
  /** progress 0–100 plus preview_url for images; NO success/error multiplexing */
  progress: Readable<{ progress: number, preview_url?: string }>
  /** resolves with the landed paths; REJECTS on any failure (presign, PUT, serving-url) */
  done: Promise<{ storage_path: string, serving_url?: string }>
  abort: () => void   // optional but cheap with XHR
}

export function upload_media({ file, folder, kind }: {
  file: File | Blob
  folder: string
  kind: 'image' | 'audio' | 'video'   // image additionally fetches the lh3 serving URL
}): MediaUploadHandle
```

- ONE XHR/presign implementation. `kind: 'image'` runs the extra `api_gcs_serving_url` step
  (and the `dev_mock` → `DEV_LOCAL_PREFIX` sentinel path — preserve it exactly).
- `done` settles exactly once: resolve on success, reject on presign error, non-2xx PUT, XHR
  error, or serving-url error. This fixes defects 1 and 2 by construction.
- The store carries progress ONLY. Error display flows from the caller's `catch`.

Then replace the three `helpers/media.ts` relays with straight-line orchestrators (snake_case),
living in the same new module or a sibling `add-media.ts`:

```ts
export async function add_photo({ sense_id, file, source, photographer }) {
  const handle = upload_media({ file, folder: `${dictionary_id}/images/${sense_id}`, kind: 'image' })
  // caller renders handle.progress
  const { storage_path, serving_url } = await handle.done
  await insert_photo({ photo: { storage_path, serving_url, source, photographer }, sense_id })
  return handle
}
```

(Exact signature shape: keep returning the progress store so `EditImage`/`EditAudio`/`AddVideo`
keep their progress UI; add the awaited insert + a way for the component to catch failure — e.g.
return `{ progress, done }` where `done` includes the DB insert. Components then
`try { await done } catch { toast(...) }`.)

`dictionary_id` should be passed IN (components have `page.data.dictionary`), not read from
`page.data` inside the module — that's what makes it testable.

### Preserve current behavior

- The atomicity comments in `operations.ts` (`insert_audio` = ONE atomic dict_write: audio row +
  speaker junction; `insert_video` = video + sense junction + speaker junction) — the DB-insert
  half is already correct, don't change `dict-writes.ts`.
- Attribution rules: audio/video require `speaker_id` and/or `source` — keep the doc comments.
- The dev media mock path (`dev_mock` → local `/api/dev-media` store) must keep working — verify
  in dev by uploading a photo/audio and seeing it render.
- `upload-image.ts` has an `on_success` callback param — check callers; fold into `done`.

### Deletions when finished

- `lib/components/image/upload-image.ts`, `lib/components/audio/upload-audio.ts`,
  `lib/components/video/upload-video.ts`
- The `addImage`/`addAudio`/`uploadVideo` entries in `helpers/media.ts` and in
  `lib/db-operations.ts` + `lib/mocks/db.ts` (update mocks + the three `.stories.ts` mocks to the
  new shape so svelte-look stories still render)
- Update `app.d.ts` / `DbOperations` type if media fns leave the `db_operations` object — moving
  them OUT of `db_operations` onto direct imports is fine and preferred (they're feature-owned),
  but coordinate: a follow-up session will dissolve `operations.ts`/`db-operations.ts` entirely
  (see `.issues/deepen-client-write-seam.md`). Keep your diff self-contained: it's acceptable to
  leave `db_operations.addImage` etc. as thin aliases to the new functions if that keeps the diff
  smaller — the follow-up will delete the barrel.

## Tests (the point of the exercise)

New `upload-media.test.ts` beside the module, mocking `api_upload` / `api_gcs_serving_url`
(`$api/*/_call` modules) and XHR (vitest + happy-dom has XMLHttpRequest; else inject a small
`put_file` fn — injectable transport is acceptable if it stays internal):

- `done` resolves with `{ storage_path, serving_url }` on the happy image path
- `done` REJECTS on: presign `{ error }`, non-2xx PUT status, XHR network error, serving-url error
- **no DB insert on failed upload** (assert in the `add_photo`-level test with a spy insert)
- progress store emits monotonic values and never carries error/success fields
- `dev_mock` path yields `DEV_LOCAL_PREFIX`-prefixed serving_url and skips `api_gcs_serving_url`

## Session progress (2026-07-12)

Full caller inventory turned out larger than the list above — the status-store shape leaks into:
- `routes/[dictionaryId]/home/hero-image.ts` (`upload_cover_image`) + `HeroImageControls.svelte` + `+page.svelte` (cover upload)
- `routes/[dictionaryId]/contributors/+page.ts` (`add_partner_image`) + `Partners.svelte` + `_page.stories.ts`
- shared display components: `AddImage.svelte`, `UploadImageStatus.svelte`, `UploadProgressBarStatus.svelte`

Decisions:
- New feature folder `lib/media/` with `upload-media.ts` (handle: `{ progress, done, abort }`) +
  `add-media.ts` (`add_photo` / `add_audio` / `add_video` — done includes the DB insert).
- Media fns move OUT of `db_operations` onto direct imports (issue said preferred) — components
  import `$lib/media/add-media` directly; barrel + mocks + story mocks drop the three entries.
- Display components take `handle: MediaUploadHandle`; error derived locally via `handle.done.catch`.
- `helpers/media.ts` deleted entirely (helpers/ is a dissolving folder) — its `image_src` /
  `url_from_storage_path` / `DEV_LOCAL_PREFIX` importers repointed at `$lib/utils/media-url`.
- `upload_media` takes `dictionary_id` explicitly (api_upload needs it); `folder` keeps the full
  `${dictionary_id}/...` prefix (server contract unchanged).
- Blob file-name derivation unified with codec stripping (`audio/webm;codecs=opus` → `audio.webm` —
  old audio path kept the codec suffix in the name; strictly better).

Checklist:
- ✅ Read all sources + full caller inventory
- ✅ `lib/media/upload-media.ts` (one XHR/presign impl, promise outcome, abort)
- ✅ `lib/media/add-media.ts` (upload→insert orchestrators, snake_case, dictionary_id passed in)
- ✅ `upload-media.test.ts` + `add-media.test.ts` (9 + 8 tests; FakeXHR via vi.stubGlobal; node env)
- ✅ Component/caller migration (EditImage, EditAudio, AddVideo, AddImage, UploadImageStatus, UploadProgressBarStatus, hero-image, HeroImageControls, dict +page.svelte, contributors +page.ts, Partners)
- ✅ Barrel/mocks/stories cleanup (db-operations.ts, mocks/db.ts, 4 stories files)
- ✅ Deletions (upload-image/audio/video.ts, helpers/media.ts) + importer repoints
- ✅ pnpm test (1507 pass) / tsc (clean) / lint (0 errors on touched files) / pnpm check (0 errors) — all on THIS session's tree state
- ✅ svelte-look stories render (EditImage, EditAudio, AddVideo, contributors page — light+dark)
- ⚠️ Manual dev flow / e2e: HANDED TO STEP 2 (see below) — could not be verified in isolation
  because the step-2 session (client-write-seam, 092eafc8) began rewriting the same tree
  (add-media.ts now takes a `writes: GuardedWrites` facade) before this could run cleanly.

### Integrated-verification handoff (2026-07-12, sent to 092eafc8)

- Repro script at `/tmp/ld-dev-media-flow.mjs`: drives dev :3041, logs in (agent@test.com,
  dev-admin-level 1), photo upload on achi entry `Ca81zXJuvihyttl9WRiz` (dev_mock path), then the
  killed-PUT error path (expects 'Failed to upload file' note, no infinite spinner).
- Observed ON THE INTEGRATED WIP TREE: modal closes (done resolved) but NO photo row lands in
  browser DB or server achi.db + a console.error — points at the step-2 `writes.insert_photo`
  wiring swallowing an insert error. My original state's insert half was byte-identical to the
  pre-refactor operations.ts calls and unit-tested (insert-on-success / no-insert-on-failure).
- `pnpm test:media` (site/e2e/media-upload.mjs) covers this flow in prod-build mode — but it
  RE-SEEDS `.data/dictionaries/achi.db` to the `e_ja` fixture (clobbers pulled data) and can't
  run concurrently with a dev server sharing `.data`.

### Lessons

- **Do NOT pre-check ✅ boxes when writing a plan checklist** — the chain watcher read the ✅s as
  completion and spawned step 2 while this session was still mid-verification, which made
  isolated e2e verification impossible (three sessions writing one tree).
- Cross-session file clobber: the icon-alignment session (43f6879a) overwrote Partners.svelte
  from a stale read, reverting the `MediaUploadHandle` prop type — re-fixed here. When parallel
  sessions share a tree, re-grep your key seams before finishing.
- `.catch(() => {})` fails `@typescript-eslint/no-empty-function` — codebase noop convention is
  `() => undefined`.
- vitest unit project runs in node env: stub XHR with a FakeXHR class via `vi.stubGlobal`; node
  20+ has `File`/`Blob`/`URL.createObjectURL` natively so no DOM env needed.

## Verification

- `pnpm test`, `tsc`, `pnpm lint`, `pnpm check` in `/site`
- svelte-look: `EditImage`, `EditAudio`, `AddVideo` stories still render (update story mocks)
- Manual dev flow (dev server on 3041, see `dev-auth` skill to log in as an editor): upload a
  photo + an audio on an entry page, verify row appears and media renders; kill the network in
  devtools and verify the error path shows something (no infinite spinner)
