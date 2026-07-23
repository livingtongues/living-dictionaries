# Media serving URLs (R2 + legacy GCS + App Engine Images magic URLs)

How a stored media `storage_path` / `serving_url` becomes a real URL. The builders live in
`site/src/lib/utils/media-url.ts` (with tests) — this page captures the *external* R2 / GCS / App
Engine Images behavior those builders assume, which you can't infer from the code alone.

## Audio / video — R2 (since 2026-07-23)
Audio/video bytes were migrated GCS→R2 (`livingdictionaries-media` bucket, LD CF account). A
new-convention path `{dict}/{audio|video}/{row_uuid}.{ext}` serves as
`https://media.livingdictionaries.app/{path}`. Serving is dual-read: any path NOT matching the
new convention (see `is_r2_media_path` in `site/src/lib/utils/media-path.ts`) falls back to the
legacy GCS URL below. As of the migration all live rows are new-convention; the GCS fallback
exists for stale clients + the one dead test object. GCS stays up as failsafe — don't tear down.

## Legacy audio / video (and raw photo bytes) — Firebase Storage download URL
An old-convention storage path is served from the legacy GCS bucket as:

```
https://firebasestorage.googleapis.com/v0/b/${storage_bucket}/o/${encodeURIComponent(path)}?alt=media
```

e.g. `audio/mandarin-practice/…_1630105846753.wav` →
`…/o/audio%2Fmandarin-practice%2F…_1630105846753.wav?alt=media`. Drop `?alt=media` to get the
object's metadata JSON instead of the bytes. Prod bucket: `talking-dictionaries-alpha.appspot.com`
(`PUBLIC_STORAGE_BUCKET`).

## Photos — App Engine Images "magic" serving URL (the resize trick)
Photos are not served from the storage bucket directly. On upload, a path is passed through the
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
**real** photo hashes (incl. pulled-dict photos) still go to the public lh3 CDN, so they load
without a bucket. Audio/video in dev 302 to a bundled dummy via `/api/dev-media`.
