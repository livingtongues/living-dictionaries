# Chat attachments: presigned direct-to-R2 uploads (LD ⇄ house)

Landed 2026-07-31. Replaced the 20 MB multipart chat upload with a **presign → browser PUTs
straight to R2 → commit** pipeline (500 MB ceiling), inline `<video>`/`<audio>` playback, and a
room-wide dropzone. The mechanics are all readable in the code and in
`site/src/lib/chat/PARITY.md`; this page holds only what the code can't tell you.

## Why presigned, not "raise the limit"

Not a preference — three hard walls:
- adapter-node's `BODY_SIZE_LIMIT` is **105 MB** in both repos' Dockerfiles.
- The old endpoint did `Buffer.from(await file.arrayBuffer())` per file, i.e. the whole upload in
  heap on a 2-vCPU box, next to the SQLite writer and the event loop everything else shares.
- Cloudflare caps a proxied request body at 100 MB anyway (house learned this on video uploads and
  went to 25 MB chunks — see its media notes).

Presigning sidesteps all three: the bytes never enter the Node process, in either direction of the
size ceiling. A 164 MB file measured **71 s** at ~2.4 MB/s straight to R2.

## Decisions that look arbitrary but aren't

- **The room id is IN the object key** (`chat/{room_id}/{uuid}.{ext}`). Presign and commit are two
  requests, so commit must decide whether the caller may turn a key into a row. Encoding the room
  lets it re-derive the answer from the message — no pending-upload table, no expiry sweeper, no
  extra state. The random uuid makes keys unguessable and HeadObject proves the bytes exist.
- **Commit records HeadObject's size, never the client's claim.** The presign's `ContentLength` is
  signed, so R2 already rejects a size-mismatched PUT; recording the real size means the row can't
  disagree with storage even if that ever changed.
- **Upload happens BEFORE the message is posted.** The obvious order (post, then upload) leaves a
  message visibly attachment-less for minutes on a big file, and needs a compensating delete when
  the upload fails — house actually had that `api_chat_delete` cleanup. Uploading first deletes the
  whole class of problem: no bytes, no message.
- **Files upload sequentially, not in parallel.** Parallel PUTs share one uplink, so every progress
  bar crawls and the batch finishes no sooner. Sequential = honest per-file ETAs.
- **XHR, not fetch.** `fetch` still has no upload-progress event. This is the only reason the
  upload path isn't using the repo's normal `post_request` helper.

## Two gotchas worth remembering

- **`x-amz-checksum-crc32=AAAAAA==` in the presigned URL is harmless.** The AWS SDK v3 computes a
  checksum over the (empty) body at presign time and appends it. It is NOT listed in
  `X-Amz-SignedHeaders` (which is just `content-length;host`), so R2 ignores it and a real PUT
  succeeds — verified against both buckets with a real 164 MB file. Do not "fix" this with
  `requestChecksumCalculation`; you'd be solving a non-problem.
- **house needs pnpm overrides that LD doesn't.** `@aws-sdk/s3-request-presigner` resolves NEWER
  transitive `@aws-sdk/core` / `@smithy/core` / `@smithy/types` than `@aws-sdk/client-s3@3.1062.0`
  pulls, which lands two copies of the `Client` class and makes `getSignedUrl(client, …)` a type
  error. house pins the trio in `pnpm-workspace.yaml` (NOT package.json — its own lint rule
  enforces that, because a package.json `pnpm` block silently overrides the workspace file and
  breaks Docker installs). LD needs no pin: its lockfile had already resolved one consistent set.

## The SVG hole this closed

`is_image_mimetype` matched `image/svg+xml`, and the serving endpoint gave every image
`Content-Disposition: inline` — so a chat member (which in LD includes non-admin partners) could
attach an SVG carrying `<script>` and hand anyone a same-origin XSS by link. `is_inline_safe_mimetype`
now excludes SVG. Thumbnails still render, because an `<img>` ignores `Content-Disposition`
entirely; only direct navigation changed, and it downloads.

## Range support is not optional for media

Without `Accept-Ranges` + 206 responses, Chrome can only play from the start and **Safari refuses to
play the URL at all**. The endpoint passes the range straight through to R2's `GetObjectCommand`, so
scrubbing a 500 MB recording never pulls more than the requested window through the Node process.
Rows written before this work can have a null `size_bytes`, which is why a ranged request for one
does a HeadObject first.

## Verification that exists

`site/src/lib/chat/parity.test.ts` (both repos) byte-asserts the shared files and fails if the old
multipart endpoint reappears in either repo. Beyond unit/endpoint tests, the flow was proven twice
end-to-end with a real 164 MB / 82-minute video: once against **live R2** (LD) and once against the
**dev-media fallback** with credentials unset (house), each time checking that a mid-file range at
offset 100,000,000 `cmp`-matches the source, and in a real browser that the player seeks to 62
minutes and plays.
