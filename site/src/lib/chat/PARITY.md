# Chat attachment-upload cross-repo parity manifest

The "drop anything into chat" upload pipeline lives in **two repos** and is kept in sync by
**copy-paste-and-adapt** — same decision as the OPFS leader-worker harness (see
`house/site/src/lib/db/worker/PARITY.md`), for the same reason: a shared package would have to
abstract over two different auth models, two different composers and two different room vocabularies
to save a few hundred lines.

- **LD:** `site/src/lib/chat/`, `site/src/lib/r2/`, `site/src/routes/api/chat/upload/` ← source of truth
- **house:** the same paths

`parity.test.ts` (next to this file) enforces the table below: it byte-asserts the `identical` files
and requires every file listed to exist in both repos. It **skips gracefully** when `../house` isn't
checked out, so CI never breaks. When you change a file, update BOTH repos — or move it to a lower
tier here if a divergence becomes intentional.

## Parity tiers

| File | Status | Why |
|---|---|---|
| `chat/storage-key.ts` | 🟢 identical | `chat/{room_id}/{uuid}.{ext}` key format + validation. App-agnostic. |
| `chat/chat-upload.ts` | 🟢 identical | Presign → XHR PUT with progress → commit orchestration. App-agnostic. |
| `chat/chat-upload-progress.svelte` | 🟢 identical | The progress panel (per-file bar, rate, ETA, cancel). Pure theme vars. |
| `utils/http-range.ts` | 🟢 identical | `Range:` parser for byte-serving media. App-agnostic. |
| `utils/paste-files-from-clipboard.ts` | 🟢 identical | Any-file clipboard paste. App-agnostic. |
| `components/ui/FileDropZone.svelte` | 🟢 identical | Drag-depth-counted dropzone + overlay. App-agnostic. |
| `r2/attachment-storage.ts` | 🟢 identical | Presign / HeadObject / ranged GET, with the dev-media fallback. |
| `routes/api/chat/upload/presign/+server.ts` | 🟢 identical | Both repos gate with `gate_chat` + `is_member`. |
| `routes/api/chat/upload/commit/+server.ts` | 🟢 identical | Both repos use `own_message_room_id` + `add_chat_attachment`. |
| `routes/api/chat/upload/*/_call.ts` | 🟢 identical | Thin `post_request` wrappers. |
| `routes/api/chat/attachments/[id]/+server.ts` | 🟢 identical | Ranged, membership-gated serving + the SVG-not-inline rule. |
| `chat/constants.ts` | 🔴 divergent | Only the three upload constants are shared (500 MB / 10 files / 1 h TTL / `chat` prefix); the rest is each app's room vocabulary. |
| `chat/attachments.ts` | 🔴 divergent | Same `is_video_/is_audio_/is_inline_safe_mimetype` logic, but house re-exports `is_image_mimetype` from `$lib/utils/`. |
| `chat/chat-composer.svelte` | 🔴 divergent | Already divergent pre-2026-07 (house has bindable `html` + drafts, LD has its own lightbox). Both gained `stage_external_files`, the `uploads` prop and any-file paste. |
| `chat/ChatPage.svelte` | 🔴 divergent | Already divergent. Both gained the same upload-FIRST send order, `FileDropZone` wrapper and `cancel_or_dismiss_upload`. |
| `chat/chat-message-item.svelte` | 🔴 divergent | Already divergent (LD `ImageLightbox` vs house `FullscreenImage`). Both gained the `<video>`/`<audio>` branches with identical CSS. |
| `server/dev-media-dir.ts` | 🟡 near-identical (LD-only helpers) | LD's copy is the original; house's adds nothing but sits beside a much richer `media-storage.ts`. Not byte-enforced — house may fold it in. |
| `routes/api/dev-media/[...path]/+server.ts` | 🔴 divergent | Both take a DEV-only `PUT`; the GET halves serve very different media topologies. |

**Tiers:** 🟢 **identical** = byte-for-byte, patch both together. 🟡 **near-identical** = same intent,
small enumerated differences allowed, not byte-enforced. 🔴 **divergent** = intentionally different.

## Non-obvious things to preserve when editing

- **Upload BEFORE post.** Both `send()`s upload bytes, then create the message, then commit. Flipping
  back to post-then-upload reintroduces the attachment-less-message window (and, in house, the
  compensating `api_chat_delete`).
- **The key carries the room id.** Commit re-derives the expected prefix from the message's room, which
  is what makes a pending-upload table unnecessary. Don't "simplify" the key to a bare uuid.
- **SVG must never be `inline`.** `is_inline_safe_mimetype` excludes `image/svg+xml` deliberately —
  it's same-origin stored XSS otherwise. Thumbnails still render because `<img>` ignores the header.
- **`x-amz-checksum-crc32=AAAAAA==` in a presigned URL is fine.** The AWS SDK adds an empty-body
  checksum, but it isn't in `X-Amz-SignedHeaders`, so R2 ignores it. Verified with a real 164 MB PUT.
  Don't add `requestChecksumCalculation` to "fix" it.
- **house pins `@smithy/types` / `@smithy/core` / `@aws-sdk/core`** in `pnpm-workspace.yaml`. The
  presigner otherwise resolves a newer core than `@aws-sdk/client-s3@3.1062.0`, giving two `Client`
  classes and a type error at `getSignedUrl`. LD needs no pin — its lockfile already resolved one set.
