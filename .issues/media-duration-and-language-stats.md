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
- [ ] After Jacob commits+deploys: run apply.js (dry-run → APPLY=1) to land durations in the ledger permanently, then `sudo rm /opt/hosting/data/media-metadata.jsonl`

## Notes
- Probe failures observed: transient tcp (retry succeeds) + webm without header duration (~100 algonquin videos; ffmpeg full-decode fallback added).
- ffprobe image dims are pre-EXIF-rotation (minor; app paths use the corrected sharp read).
- World Bank reply email decisions: public-only itemization, per-glottocode rows, words = whitespace tokens (lexemes first-orthography + sentence text), unlisted bottom row = dict count/entries/hours only.
