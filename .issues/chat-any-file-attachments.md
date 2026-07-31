# Chat: drop anything and everything in, and it plays

Admins (and any chat member) should be able to drag ANY file — a 200 MB screenshare, a PDF, a zip —
into a chat room in **both LD and house**, have it land in that app's private attachments bucket, and
have video/audio play inline. Today all three legs are broken.

## Today's blockers (verified 2026-07-31)

| Blocker | Where |
|---|---|
| 20 MB per-file cap | `$lib/chat/constants.ts` `MAX_CHAT_ATTACHMENT_BYTES` + `/api/chat/upload/+server.ts` |
| Bytes go through the VPS and are fully buffered (`Buffer.from(await file.arrayBuffer())`), and `BODY_SIZE_LIMIT=105M` caps the request anyway | `/api/chat/upload/+server.ts`, `Dockerfile` |
| No drop handler anywhere; paste only accepts images | `$lib/chat/chat-composer.svelte` |
| Non-images serve `Content-Disposition: attachment`, no Range support, and render as a download chip — never play | `/api/chat/attachments/[id]/+server.ts`, `chat-message-item.svelte` |

Both repos are near-identical here (same constant, same private `R2_ATTACHMENTS_BUCKET`, same serving
route, same composer modulo small drift), so this is one design ported twice.

## Locked decisions (Jacob, 2026-07-31)

1. **Presign → browser PUTs straight to R2 → commit row.** Mirrors `/api/upload`. Retire the
   multipart chat-upload path entirely (not a hybrid).
2. **500 MB** per-file ceiling. 10 files per message stays.
3. **Video + audio get real players** (needs Range → 206). PDFs/everything else stay file chips.
4. **Whole-room dropzone overlay** + paste of any file type.
5. **Build in LD, port to house in the same push**, guarded by a `PARITY.md` + `parity.test.ts`
   modelled on `house/site/src/lib/db/worker/parity.test.ts`.
6. **Record true size at commit via HeadObject; never write a row for bytes that aren't there.**

## Design

### Storage keys — "a correct home"
Today every attachment (email + chat) is a bare UUID at the bucket root. New chat objects get
`chat/{room_id}/{uuid}.{ext}`. Existing rows keep their bare-uuid `storage_key` and still serve
fine (serving always reads `storage_key` from the DB) — no migration.

### `POST /api/chat/upload/presign`
- `gate_chat` + `is_member({ room_id })`.
- Body `{ room_id, files: [{ filename, mimetype, size_bytes }] }` → `{ uploads: [{ storage_key, upload_url, dev_mock? }] }`.
- Rejects >500 MB, >10 files, empty files. `expiresIn` 1 h (a 500 MB upload on a slow uplink is slow).
- Presigns with `ContentLength` so the declared size is cryptographically bound.
- **Dev fallback:** no R2 creds → `upload_url = /api/dev-media/{storage_key}` + `dev_mock: true`,
  reusing the existing dev-media PUT/GET store (present in BOTH repos).

### `POST /api/chat/upload/commit`
- `gate_chat`; caller must be the message author.
- For each `{ storage_key, filename, mimetype }`: **key must match `chat/{room_id_of_message}/{uuid}.{ext}`**
  (so a member can't commit an arbitrary object), then HeadObject for the TRUE size. Object missing
  → no row (orphan presigns simply never become attachments).
- Inserts via the existing `add_chat_attachment`; returns the same `{ attachments }` shape the
  client already consumes.

### Serving — `/api/chat/attachments/[id]`
- Parse `Range`, pass through to R2 `GetObjectCommand`, return **206 + `Content-Range` + `Accept-Ranges: bytes`**.
  Without this Chrome can't seek and Safari refuses to play at all.
- `inline` disposition for a SAFE set: raster images, `video/*`, `audio/*`. Everything else `attachment`.
- **Security fix (pre-existing bug):** `image/svg+xml` currently matches `is_image_mimetype` and is
  served `inline` from the same origin → stored XSS in an app where chat includes non-admin partners.
  SVG is forced to `attachment`. Inline `<img>` thumbnails keep rendering (an `<img>` ignores
  Content-Disposition), only direct navigation changes.
- Dev fallback: stream from the dev-media dir when R2 isn't configured.

### Client
- New `$lib/chat/chat-upload.ts`: `upload_files({ room_id, files, on_progress })` → presign, then
  **XHR** PUT per file (fetch has no upload progress), returning committed keys.
- **Send order flips**: upload bytes FIRST (progress in the composer), then `api_chat_send`, then
  commit. Otherwise a message sits attachment-less for minutes while a 200 MB video uploads.
- Composer: per-file progress bars + cancel; paste accepts any file.
- ChatPage: full-panel "Drop files to attach" overlay on dragenter.
- `chat-message-item.svelte`: `<video controls preload="metadata">` for `video/*`,
  `<audio controls>` for `audio/*`, chips for the rest.

## Verification
- `server.test.ts` for presign + commit: 401 / 400 / 413 / 403-not-a-member / wrong-author /
  orphan-key-not-committed / happy path asserting the `chat_attachments` row.
- Unit tests for the Range parser + the inline/player mimetype helpers.
- svelte-look stories: message item with video + audio + chip, composer mid-upload, drop overlay.
- **Real E2E**: upload the actual ~150 MB `~/Videos/2026-07-31-combined.mp4` into a local room via
  puppeteer, then scrub the resulting `<video>` to prove Range works.

## Progress
- ✅ Blockers verified in both repos; design locked
- ✅ LD: presign + commit endpoints + tests (21 endpoint tests)
- ✅ LD: serving Range + disposition + SVG fix
- ✅ LD: client upload lib, composer progress, dropzone, players
- ✅ LD: E2E with the real 164 MB file — see results below
- ✅ Port to house + `site/src/lib/chat/PARITY.md` + `parity.test.ts` in both repos (19 assertions,
  verified to actually fail on injected drift)
- ✅ house E2E through the **dev-media fallback** (R2 creds unset) — the branch LD's live test
  couldn't reach: presign returned `dev_mock`, 164 MB PUT landed on disk, commit read the true
  171,533,384 bytes, and a range at offset 100,000,000 `cmp`-matched the source
- ✅ Knowledge written: `.knowledge/admin/chat-large-attachments.md` (+ house's
  `.knowledge/architecture/`), both indexes updated

## Status: COMPLETE — not yet committed

Both repos: `pnpm lint`, `pnpm check`, `pnpm test` all green (LD 2438 tests, house 3390).

## E2E results (2026-07-31, real R2, real 164 MB file)

`~/Videos/2026-07-31-combined.mp4` (171,533,384 bytes, 82 min) through the whole pipeline:

| Step | Result |
|---|---|
| presign → PUT direct to R2 | HTTP 200 in **71 s** (~2.4 MB/s), never touched the app server |
| commit HeadObject | recorded `size_bytes: 171533384` — exact, from storage not the client |
| serve, no range | 200 + `Accept-Ranges: bytes` + `inline` |
| serve, `bytes=100000000-100000099` | 206 + `Content-Range: bytes 100000000-100000099/171533384`, and the bytes **`cmp`-match the source file** at that offset |
| suffix `bytes=-50` | 206 `bytes 171533334-171533383/171533384` |
| `bytes=999999999999-` | 416 + `Content-Range: bytes */171533384` |
| SVG carrying `<script>` | `Content-Disposition: attachment` (was `inline` — the XSS fix) |
| Browser (`<video>` in the room) | metadata `duration 4938.7s / 1920×1080`, seek to 3704 s landed instantly, played 2.46 s from there, zero page errors |

**Gotcha found and cleared:** the presigned URL carries `x-amz-checksum-crc32=AAAAAA==` (the AWS SDK's
empty-body checksum). It is NOT in `X-Amz-SignedHeaders` (`content-length;host`), so R2 ignores it and
the PUT succeeds. Don't "fix" it with `requestChecksumCalculation` — verified working as-is.

All E2E objects were deleted from the real attachments bucket afterwards (`chat/` prefix listed empty)
and the local test rows removed from `.data/shared.db`.

## Side note
The task that surfaced this: combining 4 OBS screenshares (2026-07-31, 82 min total) into
`~/Videos/2026-07-31-combined.mp4` — x264 CRF 35 veryfast, 64k mono AAC, `+faststart`.
Text stays legible at CRF 35; SVT-AV1 preset 8 was *worse* per byte on this screen content.
