# Homepage v2 — map stack + word showcase decisions (2026-07-04)

**This IS the live homepage `/`** (swapped in from `/home-preview` on 2026-07-07; the old Mapbox
homepage + the `/globe` experiment + the whole old-home component cluster `$lib/components/home/`
were deleted in the same change). Code: `$lib/components/home-v2/`, root `routes/+page.svelte` +
`+page.server.ts` + `+page.ts`, `routes/admin/featured-words/`, `routes/api/homepage/export/`,
`routes/api/admin/featured-entries/`. The hero h1 + subline are i18n (`home_v2.headline` /
`home_v2.subline`); the SEO description/keywords stay hard-coded English (as before the swap).

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
- **Simplified interaction (2026-07-06)**: wheel/scroll zoom is **fully disabled** (the zoom
  filter returns false for wheel). No +/− buttons — the only control is the reset/collapse-all
  button, and it's **hidden at full-out** (`zoom_level <= 1.02`), shown once zoomed in. Zoom is
  **tap-driven**: clicking a country landmass OR a grouping (cluster) dot animates to fit that
  country's projected bounds (`geoContains` hit-test against countries-110m → `geoPath.bounds` →
  fitted transform, `zoom_to_country`); clicking an **individual** dot still opens its popover.
  Only one zoom depth is wired for now (world → country) — deeper levels + non-overlapping label
  layout (d3-force?) are a "see if we need it" follow-up. Touch still needs 2 fingers for pan
  (`touch-action: pan-x pan-y` keeps page scroll working); single-finger touch flashes the hint.
- **Antarctica + Hawaii trimmed (round 2, 2026-07-07)**: the projection fits to a `VISIBLE_WORLD`
  MultiPoint sample — lat −58..84 AND west-clamped to −145° at the equator (Hawaii out; the
  westmost public dot, Iñupiaq at −161.7°/64.9°N, stays well inside because Equal Earth pulls high
  latitudes toward center — re-check the clamp if a central-Pacific dict ever publishes). It's a
  MultiPoint, not a Polygon — a ring spanning all longitudes at a parallel encloses a pole and d3
  fills it back to full height. `fit_equal_earth` pins `clipExtent` to the fitted bounds so cropped
  land never paints into letterbox, and the hero `.map-frame` height follows the exported
  `WORLD_ASPECT` (~2.06, `aspect-ratio` capped by 58vh) — big monitors used to letterbox vertically
  and expose Antarctica. Applies to both the SSR SVG and the canvas so they line up.
- **Land derived, not shipped**: land silhouette = `topojson.merge(countries.geometries)` at both
  resolutions (canvas + SSR) — home-v2 imports the country topojson from
  `home-v2/map/data/countries-{110m,50m}.json` (moved there from the deleted `$lib/components/globe/`
  when /globe was removed; land-110m/land-50m are gone — /og keeps its own `routes/og/land-110m.json`).
  Zoom-tier data (countries-50m, admin1, cities) is idle-prefetched after load
  (`requestIdleCallback`), but draw only *uses* hi-res at k ≥ 2.5: the pulse ring keeps a rAF loop
  alive at k=1 and 110m is much cheaper per frame.
- **Zoom has 3 levels**: world → country fit → if a clicked country fit wouldn't move the view
  (new k ≤ current×1.15), a still-grouped cluster falls through to a ×2.2 `zoom_toward` step.
  A `zoom_depth` counter (0 world / 1 country / 2 the third step; reset by `reset_view`) drives
  declustering: at **depth ≥ 2 (and k ≥ 3), or k ≥ 8**, clustering turns fully OFF — every dot is
  its own labeled marker.
- **Label force-layout — no unlabeled dots at zoom (round 3, 2026-07-07)**: once labels are active
  (`zoom_depth ≥ 1` or k ≥ 3.5) a settled-view (debounced ~150ms after the last transform change)
  force layout places a name for every SINGLE dot — `layout_labels` in `view-helpers.ts` tries
  snug sides (right/left/above/below/corners) then rings outward, rejecting overlaps with placed
  labels + dot obstacles + the canvas edge; displaced boxes get a thin blue leader line dot→label.
  **Level 2** (clustered) runs it with `guarantee:false`: any single that can't be placed is folded
  into the nearest cluster (`apply_forced_merges`, ≤48px) so it shows as a `②`-style count instead
  of a nameless dot — Jacob's rule "a lone dot must show its name; if too tight, it's a cluster."
  **Level 3** (declustered) runs `guarantee:true`: everything is placed even if it must overlap
  (last resort). The layout is a plain `Map`/`Record` recomputed only when the view settles (keyed
  on transform+size), NOT per frame. Invariants proven live via the dev hook's `state()`: L2 India
  labels==singles (0 merges typical), L3 labels==clusters (fully declustered).
- **Mobile**: the map is full-bleed to the screen edge (HeroUnit zeroes `.hero-constrained`
  padding + `.map-frame` radius ≤640px).
- **Connector line (2026-07-07)**: ONE red line everywhere (desktop falloff set removed) — the
  strip-center or hovered/playing card; other visible cards' lines stay mounted at opacity 0 and
  are keyed by `card.id` (index-suffixed keys recreated elements and skipped the CSS transition —
  the old harsh mobile switching) so the 250ms crossfade runs on handoff.
- **Red connector LABEL is drawn on the canvas, not SVG (round 3)**: HeroUnit no longer floats an
  SVG `<text>` mid-line. It steps a smoothed per-dict alpha map (rAF, plain `Record` — SvelteMap
  would be wrong here) and passes `connector_labels: {dict_id, opacity}[]` to WorldMap. The canvas
  draws the connector dict's label FIRST (wins the collision contest) in the highlight red with a
  `· N entries` suffix, at the dict's own force-laid label position, suppressing the blue copy
  (crossfading blue↔red by `1-alpha`/`alpha`). If the dict is hidden inside a cluster (or at world
  zoom where no labels are laid out yet) the red label floats just above the cluster/dot the line
  points at. `--world-aspect` unchanged.
- **Dev-only zoom hook** (`import.meta.env.DEV`, tree-shaken from prod): WorldMap's onMount exposes
  `window.__ld_worldmap = { zoom_to({lng,lat,k,depth}), state(), reset() }` for deterministic e2e
  (pixel-hunting the tap-driven canvas is flaky; `state()` returns `{k,depth,labels,merged,clusters}`).
- **Canvas theming**: hidden swatch divs styled with theme vars/color-mix → `getComputedStyle`
  → canvas colors; re-read on `<html>` class MutationObserver + prefers-color-scheme change.
  (Canvas can't resolve CSS vars itself.)

Regenerating label data: `node site/scripts/build-map-data.mjs` (downloads NE geojson to /tmp,
outputs are committed; eslint-ignored as generated).

## Homepage hero extras (round 3, 2026-07-07)

- **Strip narrows to in-view dicts** (`WordCards`): once the map is zoomed (`map_view.k ≥ 2`,
  debounced 400ms) the card strip shows STRICTLY the featured cards whose dict falls in the
  viewport bbox; **zero in view → the full shuffled strip** (no pad-to-N with misleading
  out-of-view cards — that behavior was removed). The bbox is Equal-Earth-approximate (corner+edge
  samples) so a far-Pacific card can occasionally leak into a wide continental view — acceptable.
- **Quick-jump pills** (`QuickJump.svelte`, under `HeroSearch` on the homepage `/`): logged-in users
  with dictionaries see "My Dictionaries" (their `$my_dictionaries`); everyone else sees "Recently
  viewed" from a new `visited_dictionaries` localStorage list (`$lib/state/visited-dicts.ts`,
  most-recent-first, cap 10, written from the `[dictionaryId]/+layout.svelte` open effect). Up to 3
  pills + a `+N more` pill that expands the rest inline. Replaced the old rough
  `my_dictionaries.slice(0,5)` row (which also showed 5 random big dicts for no-history visitors —
  dropped since the map now covers discovery).

## Word showcase (featured_entries)

- `shared.db.featured_entries` is **server-only** (like chat/i18n tables — API-reached, never a
  sync sector). Snapshot columns by design; curation re-runs refresh them.
- **Bucket pivot (2026-07-04)**: the table is now the shared candidate BUCKET with a `source`
  column — `'agent'` (curate-command harvests, fill goal ~5/public dict) and `'editor_star'`
  (per-dict starred entries swept from the server dict DBs by the curate command;
  `starred_at` = the dict-db star `created_at`, MAX per dict acts as the sweep watermark).
  Editor stars are a signal, never an automatic homepage placement. NOT the same table as the
  dict.db `featured_entries` (per-dict, synced, feeds `/{dict}/home`).
- **Card tap → fullscreen** (`FeaturedEntryFullscreen`, replaced the old `FeaturedEntryModal`
  2026-07-06): a plain left-click opens the photo fullscreen (like the glossary image lightbox)
  with the dict name top-left, lexeme+gloss bottom-left, and audio + "Open entry" buttons
  overlaid bottom-right — NOT navigation, which would kick off that dictionary's snapshot
  download. The `Open entry` link (and the whole overlay) is `data-sveltekit-preload-data="tap"`
  so no snapshot pull happens until it's actually tapped. Modified/middle clicks keep the native
  open-in-new-tab. (The richer modal — phonetic, all glosses, speaker, example sentence — was
  dropped in favor of this more visual view; those snapshot columns are still baked on the card
  if the modal is ever wanted back.)
- Curation: `.claude/commands/curate-featured-words.md` (agent harvests prod per-dict DBs →
  vision-checks lh3 thumbs → inserts `suggested`); Jacob approves at `/admin/featured-words`
  (source badges distinguish agent vs editor-star rows);
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
  `/{dict}/entry/{id}` triggers the dict-layout snapshot download. And **"tap" preloads on
  MOUSEDOWN**, so a link whose click handler cancels navigation (the word-card → lightbox
  pattern) still started the download — the strip is `preload="off"` now (2026-07-07); "tap"
  belongs only on links that really navigate (fullscreen Open entry + dict title, map popover).
- **`scrollLeft` rounds to integers** — a rAF drift adding <1px/frame stalls forever; keep a
  float accumulator and assign, resyncing when the user scrolls manually.
- **Stats rounding rule** (Jacob): **dictionaries is shown EXACT + "+"** (a small curated
  number, the "+" nods at gems buried in conlang/glossary); users floors to tens; entries/audio/
  photos/videos floor to hundreds; locale separators + "+" throughout (`round-stat.ts`).
- **Dictionaries stat = public + unlisted** (`public` col = 1 OR `bucket = 'unlisted'`), computed
  in `compute_homepage_stats`. It also bakes a separate `public_dictionaries` (public col only) for
  the footer. Both are build-time baked into `homepage-baked.json` — the footer reads them from
  that JSON too, NOT a per-visitor query (the only per-request DB touch on `/` is the
  single `map_dicts` SELECT for the dots/search). Consolidating `public` col → `bucket` is a
  logged follow-up (`.issues/dictionary-public-vs-bucket-consolidation.md`).
- **Agent/API diagram** ("Turn archives into living data") is **admin-level-3 only** for now
  (still being iterated) — gated in the homepage `+page.svelte` on `auth_user.admin_level >= 3`.
- 435 total videos — weak next to the other numbers; flagged to Jacob whether to keep showing.
