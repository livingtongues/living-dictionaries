# Share cards lost their photo — satori can't decode the WebP variant

**Filed 2026-07-26 from the daily log review. ✅ FIXED 2026-07-27 (uncommitted — Jacob owns the
commit; a push deploys). See "What shipped" at the bottom.**

## What's broken

Every Open Graph share card for a page that has a photo has been rendering **without the photo**
since **2026-07-23 10:38 UTC** (commit `e4a9dfb4`, the photo→R2 WebP migration).

Production evidence (24h to 2026-07-26 21:10 UTC): **111 failed renders / 222 `og_render_failed`
rows**, all `reason: "image_fetch"`, all with the same stack:

```
Error: Can't load image https://media.livingdictionaries.app/tutelo-saponi/photo/f648f1ee-…_w1600.webp:
  Unsupported image type: image/webp
    at satori@0.0.44/dist/index.js
```

Daily rows: `07-20: 1 · 07-21: 1 · 07-22: 0 · 07-23: 66 · 07-24: 184 · 07-25: 282 · 07-26: 199`
— a clean step change on the migration date.

## Chain

1. `site/src/lib/components/SeoMetaTags.svelte` (~L63) builds the card photo URL:
   `photo_src({ photo, variant: 'w1600' })`.
2. `site/src/lib/server/photo-variants.ts` writes all three variants (`_thumb`/`_w900`/`_w1600`) as
   **WebP** q80 since 07-23.
3. `satori` 0.0.44 (`site/src/routes/og/component-to-png.ts`) supports JPEG/PNG/GIF/SVG only and
   throws `Unsupported image type: image/webp`.
4. `site/src/routes/og/+server.ts` catches, logs, and re-renders **without** `image_url` — so
   scrapers get a valid text-only card, never a 500.

The degrade chain and the `classify_og_failure` labelling (both from the 2026-07-08 review) worked
exactly as designed — that's why this was a one-query diagnosis and not an outage.

## Cost

- Every Facebook/Slack/WhatsApp/X share of a dictionary or entry page with a photo shows a
  photo-less card — the pages communities share most.
- Each failure renders the card **three times** (dynamic-font attempt → static-font retry →
  text-only fallback), so it's also ~3× the CPU per affected scrape.

## Fix options

**A — point the card at the original file (smallest change, recommended first).**
In `SeoMetaTags.svelte` use `photo_src({ photo, variant: 'original' })` for `og_photo_url` only.
Originals are whatever was uploaded (JPEG/PNG in the overwhelming majority), which satori decodes.
- Cost: the original can be several MB, fetched server-side per distinct card render (`withCache`
  memoizes by markup hash, so repeat scrapes are free).
- Residual: a WebP/HEIC **original** still fails — and still degrades safely to the text-only card.

**B — generate an OG-sized JPEG variant (most correct).**
Add an `_og.jpg` (1200 px, q80, JPEG) to `PHOTO_VARIANTS` in `photo-variants.ts` and point the card
at it. Needs a backfill for existing photos, or a fall-through to option A when `_og.jpg` is absent.

**C — decode WebP before handing it to satori.**
`sharp` is already a dependency; fetch the variant server-side, transcode to a PNG/JPEG data URI,
pass that as `image_url`. Keeps the small WebP download but adds a decode per uncached render.

Recommendation: **A now** (restores the photo today, ~1 line), **B when photo variants are next
touched** (right-sized bytes, no per-render transcode).

## Verification

- Local: render `/og?props=…` for an entry with a photo and confirm a PNG containing the photo.
- Production after deploy: `og_render_failed` with `reason:"image_fetch"` should drop to ~0/day
  (the handful of `reason:"font"` rows are a separate, benign known class).

## Guard against recurrence

Any future media-format migration (WebP → AVIF, etc.) must check the share-card path. Consider a
unit test asserting the OG photo URL does **not** end in a format satori can't decode.
</content>


---

## What shipped (2026-07-27)

**The version check came first, as instructed — and the answer was NO.** Measured on this machine,
not assumed:

| chain | `data:image/jpeg` | `data:image/webp` |
|---|---|---|
| satori **0.0.44** (LD today) + `@resvg/resvg-js` 2.2.0 | renders | blank / `Unsupported image type` on a remote URL |
| satori **0.29.0** (latest) + resvg-js **2.6.2** (latest) | renders | **still blank** |

satori ≥ 0.26 does parse WebP (it's in `ALLOWED_IMAGE_TYPES` and it sizes the file), so it stops
throwing — but satori only ever emits `<image href="…">` into an SVG. The rasterizer is
`@resvg/resvg-js`, and **2.6.2 — the newest release — cannot decode WebP**: a direct
`<image href="data:image/webp…">` renders fully transparent. A bump would have turned a loud failure
into a silent one (no `og_render_failed` row at all). Version left alone; the deps-review backlog item
should record this reason.

**So: option C, and it's now the permanent shape of the path** — `/og` is format-agnostic.

- **`site/src/routes/og/card-image.ts`** (new): `is_decodable_by_card_renderer()` (pure, unit-tested,
  extension-based) + `card_image({ image_url, width, height })`. A decodable URL passes straight
  through (no fetch, no CPU). Anything else — WebP today, AVIF/HEIC tomorrow — is fetched once with a
  6 s timeout (satori's own fetch has none), sharp-transcoded to a JPEG **cover-cropped to the exact
  card size**, and returned as a data URI plus its dimensions. Failure → `null` + an
  `og_image_transcode_failed` warn, and the card degrades exactly as before. 25-entry memo keyed by
  `WxH|url`, 20 MB source ceiling.
- **`/og/+server.ts`**: runs `card_image` before rendering. An unobtainable photo now goes straight to
  the globe card instead of burning two doomed renders on the way to the text-only fallback.
- **`OpenGraphImage.svelte`**: new optional `image_width`/`image_height` rendered as `<img>`
  attributes. **satori cannot measure a data URI** ("Image size cannot be determined") — this is why
  the first attempt still produced a photo-less card *after* a successful transcode. Also replaced the
  photo's `width/height: 100%` with explicit px: satori resolves percentages against the parent's
  CONTENT box, so the photo had always stopped 96×72 px short of the card edges (a pre-existing
  cosmetic bug, visible the moment the photo came back).

**Verified end to end** against a running dev server: `/achi/entry/e_ja` → the real `og:image` URL
from its HTML → a 1200×630 PNG with the photo full-bleed behind the title. Unit tests cover the
extension rules (including "the WebP variant that broke every share card"), the pass-through
no-fetch path, the fetch-failure degrade, the intrinsic-dimension contract, and the size ceiling.

**Still to verify after deploy:** `og_render_failed` with `reason:"image_fetch"` should drop to ~0/day
(the `reason:"font"` handful is separate known noise), and `og_image_transcode_failed` should stay at
0.
