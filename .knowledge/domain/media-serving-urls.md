# Media serving and R2 operations

All Living Dictionaries media bytes and site-owned image assets live in Cloudflare R2. The public
media bucket is `livingdictionaries-media`, served through
`https://media.livingdictionaries.app`.

## Object conventions

Database rows store an object key, never a URL:

- originals: `{dictionary_id}/{audio|video|photo}/{row_uuid}.{extension}`
- photo variants: `{original_without_extension}_{thumb|w900|w1600}.webp`
- uploaded-video poster: `{original_without_extension}_thumb.webp`
- site assets: `site/{asset_name}/{source_content_hash}/{variant_filename}`

Original media and derivatives use immutable cache headers because every replacement gets a new
UUID or content-hash namespace. `url_from_storage_path()` builds original URLs and `photo_src()`
accepts an explicit `thumb`, `w900`, `w1600`, or `original` variant. In local development both
builders point at `/api/dev-media`.

The `site/` namespace is intentionally outside the per-dictionary media parser and storage ledger:
site assets are code-versioned infrastructure, not user media and not orphan-swept.

## Photo variants

`photo_variant_for_dimensions()` helps responsive components choose from the finite R2 set:

- square/thumbnail requests → `_thumb.webp` (400px cover crop)
- widths through 900px → `_w900.webp`
- larger width requests → `_w1600.webp`
- no requested dimension → the original

**`_thumb.webp` is NOT guaranteed square.** Its sharp resize carries `withoutEnlargement: true`,
so an original smaller than 400px on a side keeps its own aspect ratio instead of being cropped to
a square — legacy dictionaries are full of 288×216 … 288×351 thumbs (Iquito, 2026-07-27). Never
let CSS/JS assume a 1:1 thumbnail; give the box its size and `object-fit: cover` into it. Letting
a thumb's natural aspect drive layout is what caused the entries-list row quiver (see
`svelte/layout-measure-feedback-loops.md`).

HEIC/HEIF uploads are rejected with conversion instructions. For accepted formats, the original is
stored first, then variants are generated in-process. The weekly media reconcile repairs missing
derivatives.

## Bucket CORS

The bucket's CORS policy is external configuration in the Living Dictionaries Cloudflare account.
It has a public GET/HEAD rule for `https://livingdictionaries.app` and an upload PUT rule for the app
plus local development. Client-side `fetch()` consumers such as media export and waveforms require
the GET rule even though ordinary `<img>` rendering does not.

Changing CORS requires Jacob's `cfut_` admin token; the app's Object R/W token cannot read or write
bucket CORS. Purge the Cloudflare cache for `media.livingdictionaries.app` after a CORS change,
because cached objects retain their old response headers under the one-year immutable policy.

## Video thumbnails

Uploaded videos use the derived `_thumb.webp` key with no schema column. `video_thumb_src()` chooses
a cached YouTube/Vimeo thumbnail first, then the R2 derivative, then `null` for hosted-only videos.
Every video thumbnail `<img>` keeps an `onerror` icon fallback because generation is asynchronous.

`$lib/server/video-thumbnails.ts` uses ffmpeg to extract a frame and the same 400px WebP pipeline as
photo thumbnails. Browser upload, v1 upload, and the weekly reconcile can trigger generation. The
reconcile live-key set includes video thumbnails so the orphan pass does not delete them.

## Storage ledger and backup

`shared.db.media_objects` records per-dictionary user-media objects and
`media_storage_daily` stores rollups for `/admin/storage`. The weekly R2 reconcile lists the bucket,
adopts missing ledger entries, repairs variants, marks unreferenced media orphaned, and deletes only
after the 30-day grace period.

The separate locked R2 backup mirrors originals under `livingdictionaries-backups/media/` with
one-year retention. Site assets are also covered by the whole-bucket backup path.
