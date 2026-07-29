# Media duration/dimensions in the ledger + World Bank language-stats CSV

Request from a World Bank researcher (Low-Resource Language Index): per-language totals of
entries, words, entries-with-audio, and audio hours. We don't store duration anywhere — only
bytes in `media_objects`. Jacob wants duration (audio/video) + resolution (photos) tracked
permanently, shown on /admin/storage, and a re-runnable CSV generator.

## Decisions (Jacob, 2026-07-29)
- CSV scope: **public/listed dicts only** (221, 202 iso / 100% glottocode), one row per
  **glottocode** (merge multi-dict languages, add `dictionaries` count column). Bottom row for
  the **unlisted tier**: dict count + total entries + audio hours only. No entry-count cutoff —
  full table, they slice it.
- Columns: language name(s), glottocode, iso_639_3, dictionaries, total_entries, total_words,
  entries_with_audio, audio_hours, video_hours.
- **total_words** = whitespace-tokenized target-language tokens: lexemes + example sentences
  (+ text-corpus sentences), stated in methodology note.
- Duration capture going forward: client sends `duration_ms` in the presign request (seeds the
  ledger like `file_size`); weekly media sweep probes rows still missing duration via
  **music-metadata** (pure JS, streams from R2 — no ffprobe in prod image). Photos: width/height
  via sharp in /api/photo-upload.
- Backfill: probe all ~147k audio + 187 video + ~22k photo originals from mustang over the public
  CDN with ffprobe (verified ~0.3s/file, header-range reads), concurrency ~16 → JSONL → apply to
  prod shared.db in one transaction (dry-run + backup per database skill).
- /admin/storage: add per-dict + total duration columns (plain SUMs, fine live).
- Deliverable: CSV attachment + methodology summary in email body; generator committed in
  `scripts/` for re-runs.

## Grounding facts (prod, 2026-07-29)
- 1,290 dicts total; 221 public; 397 unlisted; conlang 490 / glossary 168 / delete 7 / secure 1.
- Entries: 589,873 all; 273,511 public; 506,385 public+unlisted.
- Audio: 146,986 originals, 29.1 GB (mp3 84k @ ~84kbps, wav 48k @ ~1411kbps → per-file probing
  matters, global bytes/hr constant would be way off). Video 187 (2.3 GB), photos 21,838 originals.
- `entry_count` on dictionaries catalog is trustworthy (mirror-maintained).
- Opening all 618 serve-bucket dict DBs on the VPS: ~11s.
- Audio upload = presigned PUT direct to R2 (server never sees bytes); photos POST bytes to
  server (sharp already in pipeline).
- No ffprobe on VPS host or container. ffprobe on mustang works over
  `https://media.livingdictionaries.app/{key}`.

## Plan
- ✅ Shared migration `20260729_media_object_metadata.sql`: `media_objects` + `duration_ms`, `width`, `height` (verified against a dev shared.db copy)
- ✅ `record_media_object`/`_by_key` accept the new fields (COALESCE keeps existing); new `set_media_object_metadata`
- ✅ Presign endpoint takes client `duration_ms`; `upload_media` browser-decodes via new `$lib/media/probe-duration.ts` (3s timeout, Infinity→null; mocked in upload-media.test)
- ✅ `/api/photo-upload` + v1 photo uploads record width/height via new `$lib/server/photo-dimensions.ts` (EXIF-orientation-corrected)
- ✅ Media sweep: `media-metadata-probe.ts` (music-metadata, cap 500/run, weekly after reconcile). Dep `music-metadata` added to site dependencies.
- ✅ /admin/storage: duration in totals cards + missing-count note + per-dict "Audio time" column (svelte-look verified light+dark; stories updated)
- ✅ Backfill scripts in `scripts/media-metadata-backfill/` (dump-keys works pre-migration; probe.mjs resumable, CONCURRENCY env, ffmpeg full-decode fallback for headerless webm; apply.js dry-run/APPLY=1)
- ✅ Tests (116 files server suites), `pnpm check` 0 errors, eslint clean on touched files
- 🔄 Backfill probe RUNNING on mustang: `/tmp/media-keys.json` (169,011 keys) → `/tmp/media-metadata.jsonl`, log `/tmp/media-probe.log`, ~15/s ≈ 3h (concurrency didn't help — per-file latency bound). On finish: re-run once to retry transient tcp failures, then scp JSONL → living `/opt/hosting/data/media-metadata.jsonl`.
- ✅ `scripts/language-stats/language-stats.js` — verified on prod (216 language rows + unlisted aggregate); reads ledger durations, falls back to `/data/media-metadata.jsonl` pre-deploy
- ✅ Probe complete: 168,977/169,011 (34 unresolvable: 33 animated webp — sharp in the sweep will fill post-deploy — + 1 corrupt mp3 `siletz-dee-ni/audio/698218aa…`). 313 header-only 44-byte WAVs (broken uploads, zero audio) recorded as duration_ms=0. JSONL shipped to living `/opt/hosting/data/media-metadata.jsonl`.
- ✅ Final CSV generated (216 languages, all-fields-escaped after prod iso/glottocode values with embedded commas broke rows 80/85): `~/reports/living-dictionaries-language-stats-2026-07-29.csv` (mustang). Totals — public: 221 dicts / 273,554 entries / 555,212 words / 94,380 entries-with-audio / 56.9 h audio / 0.6 h video; unlisted: 397 dicts / 232,877 entries / 28.5 h audio. Platform-wide probed audio: 93.3 h.
- ✅ Reply email drafted: `~/reports/world-bank-reply-draft.md`
- ✅ DEPLOYED + BACKFILLED (2026-07-29). Prod ledger: audio 146,986 objects / **93.31 h** / 0 missing duration; video 187 / **0.93 h** / 0 missing; photos 21,846 with dimensions, 33 missing (animated WebP — the sweep's sharp probe fills these). Staged JSONL removed from /opt/hosting/data.
- ✅ Final CSV regenerated post-cleanup: `~/reports/living-dictionaries-language-stats-2026-07-29.csv` — 216 languages / 221 dicts / 273,583 entries / 555,242 words / 94,341 entries-with-audio / 56.9 h audio / 0.6 h video; unlisted row 397 dicts / 232,877 entries / 28.45 h. Medians: 424 entries, 606 words, 86 entries-with-audio.

## Empty-recording cleanup + prevention (2026-07-29)
The duration probe surfaced **313 header-only WAVs** — each exactly 44 bytes, `RIFF`/`WAVE`
with a `data` chunk of declared size **0** (verified by downloading and parsing ALL 313, not
sampling). Zero audio samples, i.e. permanently broken players.
- ROOT CAUSE: `RecordAudio.svelte` records via RecordRTC `StereoAudioRecorder` with
  `mimeType: 'audio/wav'` — WAV is encoded IN THE BROWSER, so a mic yielding no data emits a
  bare 44-byte header, and nothing checked the blob. Spread over 2018→2026-06, 14 dictionaries,
  8 unrelated users (galadagon 177/281 = 63%, dogon 60/94, dymetris 28/44) — an ongoing leak,
  not legacy cruft.
- ✅ DELETED via `scripts/media-metadata-backfill/delete-empty-audio.js` (tombstones, APPLY=1).
  Backups first at `/opt/hosting/data/backups-20260729-050717/` (shared.db + all 14 dict DBs).
  Verified after: 0 empty rows remain, 0 orphan `audio_speakers`, `integrity_check` ok on all 14.
  R2 objects intentionally left — the sweep orphans them, deletes after the 30d grace (backup
  mirror holds 1 year).
- ✅ PREVENTION (both layers): new `$lib/media/empty-audio.ts`
  (`wav_data_chunk_is_empty` walks the chunk list — LIST/fact chunks can precede `data` — and
  only claims "empty" when it POSITIVELY finds a zero-size/truncated data chunk; a header stub
  is inconclusive, which keeps the existing 12-byte WAV test fixture valid). Wired into:
  RecordAudio `stop()` → shows `audio.no_audio_captured` and refuses the blob;
  `/api/upload` presign → 400 below `MIN_AUDIO_UPLOAD_BYTES` (45) for `kind: 'audio'` only;
  `validate_media_bytes` → rejects empty-data WAV on the v1/byte paths.
- NOT corrupt after all: `siletz-dee-ni/audio/698218aa…mp3` — ffprobe misdetects it as H.264;
  forced as mp3 it's a clean 3.66 s / 128 kbps clip with real signal (mean −25 dB), served as
  `audio/mpeg`, plays fine. Duration set manually to 3657 ms. The 33 dimension-less photos are
  animated WebP (browsers render them fine).
- Verified: full suite 319 files / 2354 tests green, `pnpm check` 0 errors, eslint clean,
  svelte-look screenshot of the new error state (light + dark).

## Notes
- Probe failures observed: transient tcp (retry succeeds) + webm without header duration (~100 algonquin videos; ffmpeg full-decode fallback added).
- ffprobe image dims are pre-EXIF-rotation (minor; app paths use the corrected sharp read).
- World Bank reply email decisions: public-only itemization, per-glottocode rows, words = whitespace tokens (lexemes first-orthography + sentence text), unlisted bottom row = dict count/entries/hours only.
