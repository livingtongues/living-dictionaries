# Media serving URLs (R2 + legacy GCS + App Engine Images magic URLs)

How a stored media `storage_path` / `serving_url` becomes a real URL. The builders live in
`site/src/lib/utils/media-url.ts` (with tests) — this page captures the *external* R2 / GCS / App
Engine Images behavior those builders assume, which you can't infer from the code alone.

## ALL media — R2 (audio/video + photos, since 2026-07-23)
All media bytes were migrated GCS→R2 (`livingdictionaries-media` bucket, LD CF account). A
new-convention path `{dict}/{audio|video|photo}/{row_uuid}.{ext}` serves as
`https://media.livingdictionaries.app/{path}`. Photo size requests map to pre-generated WebP
variants — `{original minus ext}_{thumb|w900|w1600}.webp` (thumb = 400 square crop); lh3-style
size specs are mapped onto that fixed set by `variant_for_size_spec` (`s0` = untouched original).
Serving is dual-read: any path NOT matching the new convention (see `is_r2_media_path` in
`site/src/lib/utils/media-path.ts`) falls back to the legacy GCS/lh3 URLs below. As of the
migration all live rows are new-convention; the fallback exists for stale clients + the one dead
test object. GCS stays up as failsafe — don't tear down. During the photo migration, HEIC/broken
originals (38) were standardized to JPEG via the lh3 `=s0` transcode — the bucket contains NO
HEIC by policy.

### Bucket CORS (bit us 2026-07-24)
The bucket's CORS policy is NOT repo-managed — it lives on the bucket (LD CF account → R2 →
livingdictionaries-media → Settings → CORS). Two rules: `media-public-get` (GET/HEAD from
`https://livingdictionaries.app`, maxAge 86400) and `media-uploads` (PUT from app + localhost:3041,
for presigned uploads). The GET rule was MISSING post-migration, which broke every client-side
`fetch()` of media bytes (`/export` media downloads, `Waveform.svelte`) with `TypeError: Failed to
fetch` — `<img>` tags don't need CORS, so photos *displayed* fine and the gap was invisible until
someone exported. Changing CORS needs the `cfut_` admin token (Jacob-held; the app's Object R/W
token gets AccessDenied on Get/PutBucketCors) — and after a CORS change you must **purge the CF
edge cache** (`purge_cache` with `{"hosts":["media.livingdictionaries.app"]}` — hostname purge
works on this zone) because already-cached objects keep serving their old headers for up to the
1-year `max-age`. Objects serve `cache-control: public, max-age=31536000, immutable` (safe: keys
are UUIDs, a new upload = a new key), so browsers/edge never re-download unchanged media; the CORS
`maxAgeSeconds` only caches the preflight handshake, not bytes.

## Legacy audio / video (and raw photo bytes) — Firebase Storage download URL
An old-convention storage path is served from the legacy GCS bucket as:

```
https://firebasestorage.googleapis.com/v0/b/${storage_bucket}/o/${encodeURIComponent(path)}?alt=media
```

e.g. `audio/mandarin-practice/…_1630105846753.wav` →
`…/o/audio%2Fmandarin-practice%2F…_1630105846753.wav?alt=media`. Drop `?alt=media` to get the
object's metadata JSON instead of the bytes. Prod bucket: `talking-dictionaries-alpha.appspot.com`
(`PUBLIC_STORAGE_BUCKET`).

## LEGACY photos — App Engine Images "magic" serving URL (the resize trick)
(Pre-2026-07-23 mechanism — retained as the dual-read fallback + the `=s0` transcode source the
migration used. New photos never touch this.) Photos were not served from the storage bucket
directly. On upload, a path was passed through the
App Engine Images `get_serving_url()` service (`PROCESS_IMAGE_URL` endpoint) which returns an
`lh3.googleusercontent.com/<hash>` URL. We store just the hash (`serving_url`) and rebuild the
`src` client-side as `https://lh3.googleusercontent.com/<hash>=<size-spec>`.

The `=<size-spec>` suffix is what makes dynamic resizing free — same hash, any size, no extra
stored files, served from Google's cookieless image CDN (the same infra as Google Photos):

| Suffix | Result |
|---|---|
| `=s512` | scale longest side to 512px (default cap if omitted is ~512) |
| `=sXX` | scale longest side to `XX` (0–2560; docs historically said max 1600 — verify if it matters) |
| `=sXX-c` | scale **and crop** to an `XX`×`XX` square |
| `=wXX` | scale by width |
| `=s0` | original image, unmodified |

There's **no charge** for the resizing/caching — you pay only to store the one original. This is why
the app never stores multiple image sizes.

## Dev (no GCS bucket)
In dev there's no bucket, so `media-url.ts` reroutes: freshly uploaded bytes use a `dev-local:` hash
served from the local `/api/dev-media` store; an empty hash renders `/dev-placeholder-image.svg`;
**real** media (incl. pulled-dict photos) still loads without local creds — new-convention paths hit
the public `media.livingdictionaries.app`, legacy hashes the public lh3 CDN. Audio/video dummies in
dev 302 via `/api/dev-media`.
