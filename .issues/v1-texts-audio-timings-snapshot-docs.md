# v1 API: audio in text reads, writable timings, snapshot docs tip

Requirements source: Poly Tutor import agent feedback (prod thread `3eb63b49-fc74-42c1-93a2-8e28be13bdea`,
"Agent feedback: 文山话", filed 2026-07-17 via POST /api/v1/…/feedback — live e2e test of that channel)
+ Jacob's prompt. Tutor-side tracking: tutor/.issues/agent-tools-and-wiki-notes.md (phase 2).
**Do NOT commit/push. Prod must deploy before Tutor's importer can write timings.**

## 1. Audio in text reads ✅ plan
- `get_text` (`$lib/db/server/v1-texts.ts`) gains: `text.audio` (text-level audio rows),
  `sentences[].audio` (sentence-level), `text.speakers` (deduped FULL speaker records for all
  referenced speakers). Arrays present only when non-empty (v1 convention).
- Audio read shape = AudioMedia + `timings` + `download_url`.
- `download_url` → new redirecting endpoint `GET /api/v1/dictionaries/{id}/media/{...path}`
  (auth read scope; verifies the storage_path belongs to a media row in THIS dict; 302 to
  `url_from_storage_path` — firebasestorage in prod, /api/dev-media in dev). Rationale: stable
  URL that hides the storage backend, works in dev, and respects key scoping for private dicts.
- Decoration helper `add_media_download_urls` called from texts routes (POST, GET/PATCH textId)
  with base `${origin}/api/v1/dictionaries/{dict_id}/media`.

## 2. Timings writable ✅ plan
- `MediaFieldInput`/`MediaRecord` gain `timings` (audio only); attach accepts optional `timings`
  (JSON object, or JSON string in multipart); lenient validation = plain object of string→string.
- `PATCH …/texts/{textId}/audio/{audioId}` + `…/sentences/{sentenceId}/audio/{audioId}` with
  `{ timings }` (null clears) — new `update_media_timings` in v1-media-write +
  `make_media_timings_patch_handler` in media-route-handlers. Entry audio deliberately skipped
  (timings are sentence-keyed).

## 3. Snapshot tip (docs only) ✅ plan
- Landing (`routes/api/v1/+server.ts`) + openapi info description: public AND unlisted dicts have
  `https://snapshots.livingdictionaries.app/dictionaries/{id}.db.gz`, rebuilt within ~30 min of
  any edit (30-min sweep, only when content changed; Cache-Control max-age=120). No API field.

## Checklist — ALL DONE ✅
- ✅ v1-media-write: timings in field input/record/columns/read + update_media_timings
- ✅ media-route-handlers: parse_timings on attach (audio-only, 400 otherwise) + make_media_timings_patch_handler
- ✅ audio [audioId] routes: PATCH exports (texts + sentences)
- ✅ v1-texts: audio + speakers in get_text + add_audio_download_urls (called from texts POST/GET/PATCH routes)
- ✅ media/[...path] redirect route + server.test.ts (302/404/401; added ResponseCodes.FOUND=302)
- ✅ openapi.ts: AudioMedia.timings/download_url, TextFull/TextSentenceFull audio+speakers,
      SpeakerFull + MediaTimings schemas, audio request timings, PATCH ops, media path,
      snapshot tip in info; PATH_SEGMENT_TAGS media
- ✅ openapi.test.ts path/method inventory updates
- ✅ tests: media-route-handlers.test.ts (attach timings ×4, patch ×3), texts server.test.ts (full audio read)
- ✅ landing HTML snapshot tip
- ✅ pnpm test (1704 pass) / tsc clean / lint clean / pnpm check 0 errors
- ✅ live dev-server smoke: landing tip + openapi?tag=media slice show everything
- ✅ .knowledge/api/v1-write-api.md — new "Text audio reads, writable timings, media download URLs" section

**NOT committed/pushed** per instructions. Awaiting Jacob review + deploy (prod deploy
gates Tutor's importer writing timings). Feedback thread deliberately NOT replied to.
