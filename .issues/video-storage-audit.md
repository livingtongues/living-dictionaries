# Uploaded-video quality and storage audit

## Goal

Audit the largest uploaded R2 videos one by one to determine:

- whether the content is legitimate and matches its linked entry/sentence/text;
- whether it is visually usable rather than blank, broken, accidental, or otherwise junk;
- whether its stored bytes are proportionate to duration, resolution, frame rate, codec, and visible
  quality;
- how much storage a visually transparent transcode could save while copying the original audio
  stream unchanged.

This phase is read-only. Do not overwrite, delete, or transcode production objects until Jacob
reviews the findings and agrees on policy and targets.

## Audit method

1. Rank all uploaded video originals by R2 ledger byte size.
2. Join each video row to its dictionary and linked sense/entry, sentence, or text so the semantic
   label is visible during review.
3. Probe the source with `ffprobe`: container, codecs, duration, dimensions, frame rate, pixel
   format, rotation, video/audio bitrate, and stream integrity.
4. Inspect representative frames across the full duration, plus a short contact sheet or clip where
   motion/content cannot be judged from stills alone.
5. Compare the visuals with the linked lexeme/gloss/definition and classify content:
   legitimate match / plausible but uncertain / mismatch / junk or broken.
6. Trial-transcode audit candidates locally with original audio copied bit-for-bit. Compare output
   bytes, objective visual metrics where useful, and side-by-side representative frames.
7. Continue from largest downward until files are consistently modest and their bitrate/codec no
   longer offers material aggregate savings. Document the cutoff from evidence rather than choosing
   it in advance.

## Deliverable

A ranked report with per-video:

- dictionary, entry meaning, uploader/source context, duration and technical profile;
- content/quality judgment with evidence;
- source size, proposed target format/settings, trial size, and estimated savings;
- recommendation: keep original / safely transcode / investigate with manager / remove only after
  explicit approval.

Also recommend an ongoing upload policy (limits, server-side normalization, exemptions, and safe
replacement workflow) based on what the production corpus actually contains.

## Progress

- ✅ Audit scope and read-only safety boundary recorded.
- ✅ Ranked all 187 production videos and joined every object to its dictionary, linked semantic
  content, creator, speakers, and source fields.
- ✅ `ffprobe` inventory complete: 187/187 sources probed successfully.
- ✅ Audited the largest 30 individually (1.84 GiB / 83.7% of corpus); full-duration contact-sheet
  extraction decoded every source without error.
- ✅ Visual/semantic results: 16 exact, 11 plausible, 2 uncertain, 1 likely mismatch; 14 good and 16
  usable; 0 poor/junk/broken.
- ✅ Audio audit: 30/30 AAC streams decoded, none missing or effectively silent.
- ✅ Five dimensions-preserving H.264 CRF 20 trials with exact audio stream-copy. Savings were
  19–31% on four; the fine-detail bird source grew by 31%.
- ✅ Detailed ranked report and policy recommendation:
  `/home/jacob/video-quality-audit/report.md`.

## Current recommendation

- Do not bulk-rewrite the existing corpus under a strict no-visible-loss rule.
- Review the rank-11 Werikyana attachment (`wayamu`, tortoise gloss, fiber/cord video); confirm the
  gloss/content of ranks 12 and 29.
- Align upload enforcement: browser presign currently has no byte ceiling, v1 has 25 MiB, and UI
  prose says 100 MiB.
- Recommended future policy: 100 MiB hard server ceiling, review flag above 25 MiB/high bitrate,
  and human-approved candidate normalization only when savings clear an agreed threshold.
- Any accepted replacement must use a new R2 UUID key because the media CDN caches keys as immutable.

## Follow-up decisions (Jacob, 2026-07-24)

- ✅ Keep existing video bytes; no normalization system. Future audits are manual/on request.
- ✅ Video-only hard upload ceiling: 100 MiB.
- ✅ Videos above 25 MiB post a retry-safe System message in the admin Notifications room with
  uploader, size, dictionary, and a direct link to the entry/sentence/text. The existing daily
  digest summarizes these as large-video notifications; there is no immediate external ping.
- ✅ Keep audio at 25 MiB and photos at 10 MiB.
- ✅ Never normalize automatically.

## Upload-policy implementation

- ✅ Browser presigning requires a positive integer `file_size`, rejects video above 100 MiB and
  audio above 25 MiB, and signs `Content-Length` into the R2 PUT URL. A protocol-level presigner
  check confirmed `content-length;host` are the signed headers, so an approved URL cannot accept
  a larger object.
- ✅ Browser video notification fires only after the video row saves, through the existing
  thumbnail trigger; abandoned presigns cannot create false review notices.
- ✅ v1 media parsing uses medium-specific byte caps: audio 25 MiB, photo 10 MiB, video 100 MiB.
- ✅ Adapter-node gets 105 MiB of global multipart headroom, while `hooks.server.ts` retains the
  existing 16 MiB limit for every route except the three authenticated v1 video-upload routes.
- ✅ Large-video notification writes are best-effort and idempotent by dictionary + media UUID;
  chat failure can never turn a successful media upload into a 500.
- ✅ OpenAPI limit guidance and the audio/video picker validation agree with the server.

## Verification

- ✅ Focused upload/notification suite: 36 tests.
- ✅ Full Vitest suite: 1,975 passed, 3 skipped.
- ✅ TypeScript `tsc --noEmit`: clean.
- ✅ `svelte-check`: 0 errors.
- ✅ Full lint: clean.
- ✅ Production build: successful.
- ✅ Svelte analyzer: no issues on `SelectAudio` or `SelectVideo`.
- ✅ svelte-look: both picker stories inspected in light and dark mode.

## `wayamu` attachment discovery

The rank-11 video is already attached to the correct **entry**, but the wrong sense:

- entry `c0efc5c9-e927-4047-8632-2374ada487be`, lexeme `wayamu`
- current link: sense `7deb557f-b6d5-430a-a657-71b6c6a2cfa8` — `Jabuti tinga / Pakasa`
- likely target: sense `dc259d9b-945e-4358-95c8-4feb5a6fd162` — `tie on point of arrow /
  amarrar ponta da flecha`
- video `3c4b6687-14b4-4bde-94b5-a91ca0a8a8a7` visibly shows a thin shaft and cord being
  worked; the likely target sense currently has no video.

## `wayamu` production correction

- ✅ Jacob approved the relink.
- ✅ Read-only preflight reconfirmed exactly one junction
  `3c29f3c6-a557-4b40-bdf5-426a64373180`, the expected old/target senses on the same entry, and no
  target conflict.
- ✅ Hot-consistent backup created first:
  `/data/dictionaries/werikyana.db.bak-20260724T111233Z` (12,881,920 bytes).
- ✅ Guarded transaction moved video `3c4b6687-14b4-4bde-94b5-a91ca0a8a8a7` from sense
  `7deb557f-b6d5-430a-a657-71b6c6a2cfa8` to `dc259d9b-945e-4358-95c8-4feb5a6fd162`.
- ✅ Post-write verification: old link count 0, target link count 1, junction server sequence
  advanced 5 → 9793, and the dictionary/catalog cursor was mirrored at
  `2026-07-24T11:13:04.753Z`.
- The deployed image does not contain the documented manual snapshot runner; the normal primary
  snapshot-builder cron will publish the cursor-mirrored correction.
- ✅ Corrected the stale manual-runner references in the database skill and VPS backup/debug
  commands; they now document the builder's immediate startup pass and normal sweep accurately.
