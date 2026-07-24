# Auto-align timings (M6 of the corpus pipeline) — forced alignment for text/sentence audio

Follow-up to M5 (waveform timings editor) in `.issues/texts-sentences-pipeline.md`.
Interview complete 2026-07-23/24 — ALL decisions below are Jacob-approved. Building now.

## Decisions (final)

- **Model**: MMS_FA (Meta's multilingual forced aligner) — one model for all languages; vocab is
  26 ASCII letters + apostrophe, so every token needs a romanized `align_form`.
- **Infra**: LD-owned Modal app `ld-forced-aligner` — slim copy of tutor's
  (`~/code/tutor/alignment/src/align/…` core is only ~240 lines), living in a new top-level
  `alignment/` folder in THIS repo. Modal free $30/mo covers it. Modal creds exist on mustang.
- **The Modal app stays DUMB and stable**: `POST { audio_url, words: [{text, align_form}] } →
  { timestamped_words: [{text, start_ms, end_ms}] }`. Romanization NEVER lives in Modal (uroman
  distrusted for exotic scripts; Modal iterates slowly).
- **Dev = LOCAL CPU runner, no Modal**: the same `alignment/` package runs on any machine on CPU.
  A runner abstraction picks the backend: `MODAL_ALIGN_URL` set → HTTP to Modal (prod); else →
  local subprocess (`uv run` a stdin-JSON→stdout-JSON CLI). Dev audio is a local file path from
  the dev-media store — no URL fetch needed locally.
- **LD server is the smart fast-iterating layer**: derives `align_form`s per dictionary, rate
  limits, and is the ONLY caller of the aligner.
- **align_form derivation** — explicit per-dict primary source + automatic per-token cascade:
  config names the primary (`token_text` distill / a specific orthography from the linked entry's
  lexeme / entry `phonetic`); empty results fall through remaining sources; still-empty tokens are
  coverage gaps (reported, aligned around as untimed). Plus a **bespoke converter registry**
  (`converters.ts`, keyed by name in config) for scripts whose letters don't map to stereotypical
  a–z — expect one-off per-dictionary spaghetti we keep on OUR side, never shown to managers.
  White-glove feature: we assist each dictionary.
- **Config storage**: `align_config` JSON column ON the shared.db `dictionaries` row —
  `{ primary: 'token_text' | { orthography: code } | 'phonetic', converter?: string,
  auto_align?: boolean }`. Edited on the /admin dictionary page (local-first admin sync path).
  Invisible to managers.
- **Trigger**: manual "Auto-align" button, **manager-only** + admin-3 corpus preview gate.
  **Graduation switch**: `auto_align: true` (per-dict, admin-flipped once proven) → client fires
  the align endpoint automatically after audio attach to a text/sentence, no confirm.
- **Job shape**: fire-and-forget server job + server-only `align_jobs` table (shared.db,
  source_files pattern): POST returns job id instantly; server fetches audio → derives forms →
  runs aligner → writes timings via existing `update_media_timings`; client polls status
  endpoint; finished timings arrive via normal sync (karaoke lights up).
- **Rate limiting**: per-dict daily cap 20 + global daily cap 200, counted off `align_jobs`.
  Friendly "limit reached, try tomorrow" in UI + v1.
- **Re-align over existing timings**: confirm dialog ("replaces existing timings incl. manual
  adjustments"), no versioning.
- **v1 parity**: `POST /api/v1/dictionaries/{id}/texts/{textId}/audio/{audioId}/align` +
  sentence variant + job-status GET; openapi + guides.
- Tap-along manual timing is dead; humans only adjust aligner output in the M5 waveform editor.

## Key format facts (from M3/M5 code)

- `audio.timings` = `MediaTimings` map sentence_id → compact string `"offset,duration|…"`;
  parts align 1:1 with that sentence's `tokens.default` (default orthography); empty part =
  untimed token (punctuation); offsets chain across sentences in reading order (sort_key).
- Encode helper exists: `encode_token_spans` in `$lib/media/media-timings.ts` (pure, server-ok).
- Server write path exists: `update_media_timings` in `$lib/db/server/v1-media-write.ts`.
- Punctuation tokens: `status: 'ignored'` + `is_punctuation_form` (`$lib/corpus/tokenize-sentence`).
- Prod audio URLs are Modal-reachable: R2 public (`media.livingdictionaries.app/...`) or legacy
  public R2 media URL (`url_from_storage_path` logic, `$lib/utils/media-url.ts`).

## Build plan — DONE (2026-07-24, all gates green)

1. ✅ **`alignment/` Python package** (uv, provenance headers → tutor): `src/ld_align/{config,
   types,audio,core}.py`, `modal_app/align.py` (Modal app `ld-forced-aligner`),
   `scripts/align_words.py` CLI (stdin JSON→stdout JSON, CPU). CPU-only torch via a
   `pytorch-cpu` uv index. Verified locally: 9 words in 1.5s, byte-identical to Modal output.
2. ✅ **shared.db migration** `20260724a_align.sql`: `dictionaries.align_config` JSON column
   (+ drizzle `AlignConfig` in shared.types.ts, `JSON_COLUMNS`) + server-only `align_jobs` table
   (NOT in `SYNCABLE_TABLE_NAMES` — like `source_files`).
3. ✅ **Server align module** `$lib/db/server/align/`: `align-forms.ts` (`ascii_distill` NFD +
   per-token cascade), `converters.ts` (bespoke registry, empty), `align-runner.ts` (Modal HTTP
   vs local subprocess by `MODAL_ALIGN_URL`), `align-job.ts` (derive sync → `align_jobs` row →
   fire-and-forget: run → `build_media_timings` chained re-encode → `update_media_timings` →
   mirror cursor; rate limits + `AlignRequestError`). Unit-tested (derive cascade, chain
   re-encode w/ clamps, gap handling).
4. ✅ **Endpoints**: `$lib/api/v1/align-route-handlers.ts` backs `POST …/texts/{textId}/audio/
   {audioId}/align`, `POST …/sentences/{sentenceId}/audio/{audioId}/align`, `GET …/align-jobs/
   {jobId}`. Session-cookie (manager) OR API key both work via `load_v1_dictionary_context`.
   `_call.ts` at `…/[id]/align/`. openapi (`alignment` tag, `AlignJob`+`AlignCoverage` schemas,
   `align_start_op`, path-parity test) + importing guide.
5. ✅ **UI**: `AutoAlignButton.svelte` (reader + sentence page, manager + `align_enabled`),
   confirm-on-overwrite, poll + toasts via `auto-align.ts` `run_auto_align` (also the
   `auto_align` post-attach trigger in `AttachAudioModal`). `/admin/dictionaries`
   `AlignConfigCell.svelte` (primary source + converter + auto_align, Remove). Layout exposes
   `align_enabled`/`auto_align` presence flags ONLY; `align_config` stripped from the client
   catalog row in `+layout.server.ts`. 6 EN `timings.*` keys.
6. ✅ **Modal app deployed** `ld-forced-aligner` (jacob-8 account) →
   `https://jacob-8--ld-forced-aligner-forcedalignment-align.modal.run`; verified live.
   ⬜ **DEPLOY STEP (needs tuf — Jacob):** add `MODAL_ALIGN_URL=<that url>` to
   `vps-setup/secrets-decrypted/sveltekit-living.env`, `bin/sync living`, then push LD `main`.
   Until then prod align attempts fail cleanly (no dict has `align_config` in prod yet, so the
   button is hidden anyway). Dev needs NOTHING (local CPU runner via `alignment/`).
7. ✅ **Verification**: local CLI align; vitest **1944 passed**; tsc/eslint clean on the align
   surface; browser e2e `/tmp/ld-m6-e2e.mjs` **28/28** (config→sync→attach→auto-align→karaoke→
   editor→re-align confirm→sentence-level→v1 400/404/404/429→teardown, screenshot
   `/tmp/m6-editor-aligned.png`); Modal endpoint curl-verified byte-identical to local.

## Gotchas found while building

- Dev aligner subprocess runs with `cwd: alignment/`, so the dev-media audio path MUST be
  absolute — `resolve(dev_media_dir(), storage_path)`, not `join` (relative `.data/...` resolved
  against the wrong dir → ffmpeg "No such file"). Cost one e2e cycle.
- Modal script mode chokes on the package's relative imports — deploy with
  `modal deploy -m ld_align.modal_app.align` (module mode), not a file path.
- `mcli`/R2 creds for `livingdictionaries-media` aren't on mustang; used `poly-media`
  (media.poly.education) as a throwaway public host to verify the live Modal endpoint.

## Reference

- tutor's alignment knowledge: `~/code/tutor/.knowledge/architecture/alignment.md` (chunked
  emission windows, fp16-on-cuda, 20ms CTC frame floor).
- tutor align_form derivers: `~/code/tutor/site/src/lib/aligner/align-form.ts`.
- tutor Modal app: `~/code/tutor/alignment/src/align/modal_app/align.py`.
