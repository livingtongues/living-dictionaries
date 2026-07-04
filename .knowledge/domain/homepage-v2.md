# Homepage v2 — map stack + word showcase decisions (2026-07-04)

Lives at **`/home-preview`** until go-live (swap with `/` is a separate task; the old Mapbox
homepage + `/globe` experiment stay untouched until then). Code: `$lib/components/home-v2/`,
`routes/home-preview/`, `routes/admin/featured-words/`, `routes/api/homepage/export/`,
`routes/api/admin/featured-entries/`.

## Map stack — why canvas + d3-geo, not Mapbox/MapLibre/protomaps

Jacob's constraints: homepage must load instantly (Mapbox was the bottleneck), zoom only needs
to reach ~region level, labels (country/state/city) matter as you zoom.

- **Chosen**: flat **Equal Earth** canvas map — bundled world-atlas topojson (110m first paint,
  50m lazy at k>2.5), zoom/pan as a **screen-space transform of base-projected Path2Ds** (no
  re-projection per frame), Natural Earth label points as static JSONs (countries bundled 5KB;
  admin1 127KB + cities 33KB lazy-fetched from `/map-data/*` at zoom thresholds), greedy
  measureText collision placement (dictionary labels win), grid-bin dot clustering with
  cluster-click-zooms-in. ~60KB JS vs maplibre's ~230KB gz.
- **Rejected**: MapLibre + protomaps pmtiles on R2 — payload would match Mapbox's; it remains
  the upgrade path if street-level zoom is ever wanted (pmtiles z0–z8 world extract ≈ 1–2GB on
  R2 ≈ pennies/month). Mapbox stays on internal pages (coordinate pickers etc.).
- **First paint**: `+page.server.ts` inlines an **SSR SVG** (land path + all dots as one
  MultiPoint path, `geoPath().digits(1)`, module-cached land) that the canvas fades out after
  hydration — map visible in the HTML stream, no-JS fallback for free.
- **Cooperative gestures** (Mapbox-style): wheel zoom needs ctrl/⌘, touch needs 2 fingers
  (`touch-action: pan-x pan-y` keeps page scroll working); hint toast on blocked gestures.
- **Canvas theming**: hidden swatch divs styled with theme vars/color-mix → `getComputedStyle`
  → canvas colors; re-read on `<html>` class MutationObserver + prefers-color-scheme change.
  (Canvas can't resolve CSS vars itself.)

Regenerating label data: `node site/scripts/build-map-data.mjs` (downloads NE geojson to /tmp,
outputs are committed; eslint-ignored as generated).

## Word showcase (featured_entries)

- `shared.db.featured_entries` is **server-only** (like chat/i18n tables — API-reached, never a
  sync sector). Snapshot columns by design; curation re-runs refresh them.
- Curation: `.claude/commands/curate-featured-words.md` (agent harvests prod per-dict DBs →
  vision-checks lh3 thumbs → inserts `suggested`); Jacob approves at `/admin/featured-words`;
  **approved cards + stats ship via build-time bake** (`/api/homepage/export` →
  `scripts/fetch-homepage-baked.mjs` in the Dockerfile, i18n-bake pattern; committed seed =
  `src/lib/data/homepage-baked.json`). Deliberately NOT runtime-fetched — homepage speed wins,
  deploys are frequent.
- Curation pool reality (2026-07): 9,258 public entries with entry-audio + sense-photo across
  72 dicts (top: sibe 2592, gta 1180, northern-michif 655). Stats scan of all ~2,230 dict DBs
  takes ~15s on the VPS (cached in-process; only the bake fetch pays it).
- Vision-check rejects that actually occurred: watermarked stock (gettyimages), literal color
  squares for color words, clipart numerals, image-word mismatches, Wancho-script lexemes
  (font tofu on most devices).

## Gotchas that bit

- **Hovering an entry link preloads the whole dictionary DB** — SvelteKit hover preload on
  `/{dict}/entry/{id}` triggers the dict-layout snapshot download. Any homepage/strip link into
  a dictionary needs `data-sveltekit-preload-data="tap"`.
- **`scrollLeft` rounds to integers** — a rAF drift adding <1px/frame stalls forever; keep a
  float accumulator and assign, resyncing when the user scrolls manually.
- **Stats rounding rule** (Jacob): floor to tens for dictionaries/users, hundreds for
  entries/audio/photos/videos, locale separators + "+".
- 435 total videos — weak next to the other numbers; flagged to Jacob whether to keep showing.
