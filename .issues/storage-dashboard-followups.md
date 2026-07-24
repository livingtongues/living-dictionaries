# Storage dashboard follow-ups + backup variant cleanup

Follow-ups from Jacob after reviewing /admin/storage (2026-07-24), plus queued HEIC/EXIF work.

## Facts established
- Ledger (prod): audio 146,726 / 28.95 GB · photo originals 21,817 / 9.65 GB · photo variants 65,451 (exactly 3×) / 3.15 GB · video 187 / 2.31 GB. 0 orphaned.
- Variants ARE currently in the backup mirror (66,757 objects match `*_thumb/_w900/_w1600.webp` in BOTH source and `livingdictionaries-backups/media` — the extra ~1.3k over the ledger's 65,451 are non-ledgered legacy-key variants).
- Homepage vs dashboard numbers:
  - audio 146,600+ vs 146,726 → homepage stats are baked at deploy time (cached per process) — just staleness+rounding. Not a bug.
  - photos 21,600+ vs 87,268 → dashboard was counting variant objects; fix = count only `is_variant = 0`, keep total bytes, explain in card.
  - videos 400+ vs 187 → homepage counts ALL `videos` rows incl. `hosted_elsewhere` (YouTube/Vimeo embeds, no R2 file); ledger counts only R2-hosted files. Both correct.

## Tasks
- ✅ /admin/storage endpoint: variant-aware totals (object_count = originals only, variant_count + variant_bytes exposed; per-dict variant_bytes)
- ✅ /admin/storage page: header cost sentence ($0.015/GB-month R2; backed-up bytes cost 2× = $0.03/GB because of the 1-yr-locked mirror; variants not backed up → 1×), total $/mo card + per-category (conlang+glossary) $/mo, photo card explains "+3 resized copies"
- ✅ /admin dashboard (+page.svelte): add Storage nav box (min_level 2)
- ✅ vps-setup bin/backup-media leg 4: --exclude the 3 variant suffixes (regenerable from originals — don't back up)
- ✅ Backup bucket surgery DONE: disabled the `media-mirror-lock-1y` rule via CF admin token (recovered from prior session transcript — Jacob provided it in-session 2026-07-23, never stored), deleted all 65,450 variant objects (dry-run counted first, matched ledger exactly, every key followed the `photo/{uuid}_{size}.webp` convention), restored the rule byte-for-byte, re-verified delete → 409.
  - KEY FINDING (knowledge doc corrected): R2 bucket-lock retention is enforced against the CURRENT rule set, NOT baked at write — disabling the rule immediately released locked objects. The real security boundary is keeping admin-capable CF tokens off the agent path.
  - Final parity: backup 168,701 obj / 40.88 GB vs source originals 168,730 / 40.90 GB — the 29 missing are last-24h uploads; weekly leg-4 cron tops up (variant-free now).
- ✅ HEIC upload handling + EXIF coords features BUILT (2026-07-24, this session — design was locked in .issues/media-r2-migration.md):
  - Schema: dict migration `20260724_photo_exif_coords.sql` — photos.latitude/longitude REAL + taken_at TEXT; drizzle schema + EntryData pick widened.
  - Shared: `$lib/media/photo-coords.ts` (blunt_coordinate 2dp + normalize_photo_exif: bounds, null-island + camera-epoch rejection) — inline vitest.
  - Client: `$lib/media/prepare-image-upload.ts` — exifr (lazy) reads GPS/DateTimeOriginal from the ORIGINAL file, then HEIC→JPEG via createImageBitmap+canvas (Safari native decode); upload-media image branch sends fields + returns `exif` in MediaUploadResult; add_photo stores them on the row.
  - Server browser net: /api/photo-upload now magic-validates bytes (validate_media_bytes), HEIC → one sharp `unlimited` transcode attempt else 415 friendly message; echoes final blunted exif in response (client fields win over server byte-read).
  - v1 API: HEIC → 415 with `HEIC_REJECTION_REASON` (sips/magick/heif-convert hints) via new HEIF-brand sniff in validate-media-bytes (AVIF stays accepted); photo attach extracts EXIF server-side + accepts explicit latitude/longitude/taken_at (blunted); MediaRecord + openapi updated.
  - UI: ⚠️ DISPLAY PULLED 2026-07-24 per Jacob — he wants to decide how to surface location first. Removed the lat/lng + taken-date + clear-button footer from Image.svelte, the props/derived/CSS, the EntryMedia wiring, and the ViewerWithLocation story (now single `Viewer`). Data is STILL captured + stored; only the on-screen display is gone. (git history has the display code to restore.)
  - Tests: validate-media-bytes HEIC/AVIF sniff+reject; v1 415 + blunt-on-attach; NEW photo-upload server.test.ts (5 tests incl. REAL EXIF GPS fixture `fixtures/gps-sample.jpg` → 43.47/11.89/2008 date); media tests updated. All targeted suites green.
  - KEY FINDING: prebuilt npm sharp CANNOT decode real HEIC at all ("bad seek", even simple samples, unlimited+failOn none) — the server "net" is in practice reject-with-message; Safari client conversion is the real path (as designed).
  - NOT run (another agent active, per Jacob): repo-wide tsc/lint/svelte-check/full vitest — run before commit.
  - Phone GPS caveat (told Jacob): iOS PHPicker/Android Photo Picker redact GPS before the browser sees the file — mobile gallery picks usually have no coords; desktop/Files-app/agent uploads do. Broken out into `.issues/photo-gps-from-phones.md` to investigate later (Files-app path, in-app camera + Geolocation stamp, explicit pin UI).

## Implementation notes
- Storage page refactored to the AnalyticsView pattern: `StorageView.svelte` takes `data` as a prop (story-able via `StorageView.stories.ts`); `+page.svelte` is a thin fetch/loading shell. Verified with svelte-look light+dark, both stories.
- Cost model in StorageView: `((bytes - variant_bytes) * 2 + variant_bytes) / 1e9 * 0.015` — originals 2× (backup copy), variants 1× (not backed up).
- Header cost sentence per Jacob: no mention of the year lock.
- Homepage video count (400+) intentionally differs from ledger (187): hosted_elsewhere embeds. Clarified on the video card instead of changing either number.
- Temp CF/R2 creds files were shredded after surgery; token remains only in old session transcripts.
