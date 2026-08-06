# iPhone HEIC photo uploads — what actually decodes, and what it costs

*Established 2026-08-04, after a contributor on the Iipay Aa dictionary spent eighty minutes on four
rejected HEIC uploads (2026-08-03 log review §1.6). Code: `$lib/media/prepare-image-upload.ts`.*

## The three decoders, and which ones are lying to you

| Decoder | Verdict on a real HEVC-coded HEIC |
|---|---|
| Browser `createImageBitmap` | **Safari only.** Chrome (incl. Chrome for Android) throws `InvalidStateError` — measured in headless Chrome against a real `ftypheic` file. |
| The server's image library | **No.** Its HEIF support decodes only the `.avif` flavour, not HEVC-coded iPhone HEIC. The `/api/photo-upload` 415 is the *correct* answer, not a bug. |
| libheif compiled to wasm (`heic-to`) | **Yes.** Same headless Chrome, same file → a valid 640×480 `image/jpeg`, no page errors, ~1.9 s. |

So there is no server-side rescue to build; the only place a HEIC can become a JPEG for a non-Safari
user is **in their browser**.

## The size, measured on a real production build

The decoder is one lazily-imported chunk:

| | bytes |
|---|---|
| raw | 2,996,512 |
| **brotli (what a modern browser is served)** | **490,423** |
| gzip fallback | 730,048 |

Verified isolated: exactly one chunk in the client bundle references it, from inside the `import()`;
`grep -rl <chunk> build/server` is empty, so SSR never emits a `modulepreload` for it. **A JPEG
upload, and every Safari upload, downloads zero bytes of it.**

For scale: the four photos that triggered this were 0.7–3.7 MB each. The decoder is smaller than the
file it decodes, and it is a content-hashed immutable chunk, so it downloads once ever.

**A cheaper option exists if 479 KB is judged too heavy:** `libheif-js` ships a *separate* `.wasm`
(1,034,305 raw / 262,493 brotli) plus an 81 KB emscripten glue — **286 KB brotli total, ~41% less**
— because `heic-to` inlines its wasm as base64, which compresses worse than the binary. The cost is
wiring a non-ESM emscripten glue + a `?url` wasm asset through Vite by hand, and losing `heic-to`'s
handling of Live Photos / multi-image HEICs. Not taken; recorded so the trade is re-decidable.

## The rules the implementation follows

1. **Sniff bytes, not names.** `is_heic_bytes` on the file's first 64 bytes (the same server-side
   sniffer), with the declared type/extension only as a fallback — a HEIC saved as `.jpg` is
   otherwise invisible until the server rejects it.
2. **Native first, always.** Safari's `createImageBitmap` is free and is *more* reliable than server
   libheif on real HDR/Live-Photo files (they trip its iref security limit). The wasm rung is only
   reached when that throws.
3. **`import()` only after both (1) and (2).** This is the whole basis of the size argument above.
4. **Shrink to fit.** HEIC is ~2× denser than JPEG, so a legal 6 MB HEIC can transcode past
   `/api/photo-upload`'s 10 MB ceiling. The converted JPEG is re-encoded (quality, then a 2400px
   longest edge) if it lands over. This applies to the Safari path too, where it was already latent.

## The reason it took eighty minutes to fail

Not the 415 — the server sent *"This HEIC photo could not be converted. Please convert it to JPEG…"*
every time. `upload-media.ts` threw away the response body and showed
`Failed to upload file (status 415).` instead. **Both** halves are fixed: the body is surfaced to
the person, and `media_upload_failed` now carries a capped `server_message` separate from the
client's own `error_message` — before, the two were the same generic string, so the telemetry could
not tell a rejected format from a dead network.
