# Homepage v2 — fast flat-map + word showcase + marketing sections

New homepage at **`/home-preview`** (side route until go-live). Goals: instant load (no Mapbox),
fast "find our dictionary" via search + map, and sections that sell the platform. Great on
desktop + mobile, light + dark.

## Decisions (interviewed 2026-07-04)

- **Map**: flat map, **canvas + d3-geo**, bundled topojson (110m first paint, 50m when zoomed),
  lazy-loaded Natural Earth label data (countries / admin-1 / cities) at deeper zooms. NO Mapbox,
  NO protomaps/maplibre (logged as future upgrade path if street-level ever needed).
- **Projection**: **Equal Earth**. Whole world default view; zoom capped at ~region level (k≈12).
- **First paint**: **SSR inline SVG** (land silhouette + dict dots as one MultiPoint path) served
  in the HTML; canvas takes over invisibly on hydration. No-JS/SEO fallback for free.
- **Search**: express lane — picking a result **navigates straight to the dictionary page**.
  Map dot clicks show a preview card with Open button instead.
- **Word showcase**: horizontal scroll strip **docked directly under the map** (one integrated
  hero unit). Slow auto-drift, pauses on hover/touch, shuffled per visit. **Connection lines**
  (faded red, strong on card hover/focus + dot pulse) from card top to the dictionary's dot.
  Map zoom/pan (debounced) refilters strip to viewport dicts (fallback fill when < ~8).
- **Stats band** below the hero unit; then features grid, agent-API diagram, CTA band, footer.
- **Both stats AND cards are build-baked** (fetch-from-live-site Dockerfile pattern, like i18n
  bake). Committed seed JSON is the dev/fallback. Fresh cards require a deploy — accepted, we
  deploy often. Homepage = 1 HTML request, no runtime data fetches.
- **Stats rounding**: floor to **tens** for dictionaries + users, **hundreds** for entries /
  audio / photos / videos; locale separators + "+" (e.g. "2,230+", "555,000+").
- **Curation**: slash-command/script run by agent — scans per-dict DBs on VPS for public entries
  with photo+audio, vision-checks images (lh3 URLs), balances ~half EN glosses / half varied,
  prefers global geographic spread + larger dictionaries (sprinkle small ones), inserts
  `status='suggested'` rows into new shared.db `featured_entries` → Jacob approves/rejects at
  new **/admin/featured-words** page (inline audio + photo).
- **Agent-API graphic**: code-built inline SVG/CSS (docs pile → AI agent → read+write key → LD →
  read key → learning app + print PDF), subtle animated flow pulse, theme-var driven.
- Don't copy the old buggy dots code (`/globe` route, `$lib/components/globe/`) — fresh start.
  Existing `/globe` route + Mapbox homepage stay untouched until go-live swap (separate task).

## Prod facts (validated 2026-07-04 via VPS queries)

- **221 public** dictionaries (216 with coordinate points) — map dots are LIGHT.
- 2,232 total dictionaries · 555,071 entries (sum entry_count) · 5,335 users.
- Media (full per-dict scan, **15.5s** — fine for bake-time endpoint w/ in-memory cache):
  145,691 audio · 21,643 photos · **435 videos (weak number — flag to Jacob whether to display)**.
- Curation pool: **9,258 entries with entry-audio + sense-photo across 72 public dicts**.
  Top: Manchu/sibe 2592, GtaɁ/gta 1180, Northern Michif 655, Mam 517, Werikyana 347, Iquito 315…
- `dictionaries` catalog already has `entry_count` (auto-recounted) + `coordinates.points[].coordinates.{latitude,longitude}` + `gloss_languages` + `location` + `alternate_names`.

## Architecture

### Data flow
- `+page.server.ts` (`/home-preview`): slim public dict list straight from shared.db
  (`{ id, url, name, lat, lng, entry_count, gloss_languages, location, alternate_names }` — 221
  rows, tiny) + SSR SVG path strings (module-cached). `my_dictionaries` comes from root layout.
- `src/lib/data/homepage-baked.json` (committed seed) — `{ generated_at, stats, featured_entries }`.
  Overwritten at Docker build by `site/scripts/fetch-homepage-baked.mjs` hitting
  `GET /api/homepage/export` on the still-running old container (i18n-bake pattern, never fails
  the build). Statically imported by the page → zero runtime cost.
- `GET /api/homepage/export` (public, no auth): stats (per-dict scan, module-memory cached) +
  approved featured_entries. `_call.ts` per convention.

### New shared.db table (server-only, NOT in SYNCABLE_TABLE_NAMES)
`shared-migrations/20260704a_featured_entries.sql` + Drizzle `shared.ts` entry:
```sql
CREATE TABLE IF NOT EXISTS featured_entries (
  id TEXT PRIMARY KEY,
  dict_id TEXT NOT NULL, entry_id TEXT NOT NULL, sense_id TEXT, photo_id TEXT, audio_id TEXT,
  lexeme TEXT NOT NULL, gloss TEXT, gloss_language TEXT,
  photo_serving_url TEXT NOT NULL, audio_storage_path TEXT NOT NULL,
  dict_name TEXT NOT NULL, longitude REAL, latitude REAL,
  status TEXT NOT NULL DEFAULT 'suggested',  -- suggested | approved | rejected
  agent_note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_featured_entries_dict_entry ON featured_entries (dict_id, entry_id);
```
Snapshot columns (lexeme/gloss/urls) are intentional — homepage bakes anyway; re-running curation refreshes.
Admin surface is **server-authoritative via API** (like /translate), NOT LiveDb — avoids sync-engine changes.

### Admin
- `/api/admin/featured-entries` GET (list, optional status filter) + POST (set status, single or
  bulk). Admin-gated. Vitest per api-endpoint skill (real JWT, in-memory shared.db).
- `/admin/featured-words` page: status tabs (suggested/approved/rejected), card grid w/ photo
  (lh3 `s300-p`), audio play, lexeme/gloss/language, dict link, approve/reject buttons. Nav link
  in admin `+layout.svelte`.
- `.claude/commands/curate-featured-words.md`: harvest SQL (docker exec pattern), vision-check
  via lh3 thumbs, balance rules, insert suggested rows, ping Jacob to review.

### Map internals (`$lib/components/home-v2/`)
- `map/ssr-map.ts` (server): land-110m → Equal Earth path `d` + dots MultiPoint `d`,
  viewBox 960×477ish, rounded coords, module-level cache.
- `WorldMap.svelte`: SSR svg → canvas overlay on mount. Base projection fitted once; zoom/pan as
  **screen-space transform** (translate+scale of base-projected geometry, line widths / k).
  d3-zoom behavior: drag pan, wheel/pinch/dblclick zoom, scaleExtent [1, 12], zoom +/− & reset
  buttons. 50m land/borders lazy-swap at k > 3 (reuse existing data files under globe/data —
  fine to import those JSONs, just not the components).
- Dots: grid-bin cluster at low k (bin ~8px, dot grows slightly w/ count), separate as k grows.
  Dict name labels appear with zoom (priority = entry_count, greedy collision via measureText).
  Hit-test: nearest within ~12px → preview popover (name, location, entry count, Open btn).
- Labels: `static/map-data/` compact JSONs generated by `site/scripts/build-map-data.mjs`
  (committed): country-labels (centroids from countries-110m, largest-ring), admin1-labels +
  cities (Natural Earth 10m, filtered/rounded). Lazy-fetched at zoom thresholds.
- Theme: canvas colors read from CSS vars (getComputedStyle), re-read on body class change
  (MutationObserver) + prefers-color-scheme matchMedia.

### Hero + strip
- `HeroSearch.svelte`: big input, instant dropdown (221 items; match name > alternate_names >
  location/iso; prefix beats substring), keyboard nav, Enter/click → `goto('/' + (url ?? id))`.
  My-dictionaries chips beneath for signed-in users. "Browse all dictionaries" link.
- `HeroUnit.svelte`: map + `WordCards.svelte` + shared SVG line overlay (card top-center →
  projected dot; only cards visible via IntersectionObserver; base red opacity ~0.15, hover 0.85
  + canvas dot pulse; respects prefers-reduced-motion).
- `WordCard.svelte`: square card, `image_src(serving_url, 's340-p')`, bottom black-fade gradient,
  lexeme bold + gloss clamp in white (left-bottom), circular play overlay (bottom-right, single
  shared HTMLAudioElement, GCS url via `url_from_storage_path`), card click → entry page.
- Strip drift: rAF translate on duplicated track, seamless loop, pause on hover/pointer/focus,
  off under reduced-motion. Shuffle per visit. Viewport coupling: parent passes debounced map
  bbox; filter when k ≥ 2, fallback-fill to ≥ 8 cards.

### Other sections
- `StatsBand.svelte`: 5–6 stats, count-up on scroll-into-view (reduced-motion → static),
  `round_stat` helper (+ unit tests): tens for dicts/users, hundreds for the rest, Intl format + "+".
- `FeaturesGrid.svelte` (~6 cards, mdi icons, copy drafted for Jacob to edit): multimedia entries,
  multilingual glossing, custom keyboards, collaboration roles, import/export, free forever.
- `AgentApiDiagram.svelte`: inline SVG, animated flow dots (SMIL/offset-path, reduced-motion off).
- `CtaBand.svelte`: Create a dictionary (btn-primary) + Browse all dictionaries.
- Existing `Header`/`Footer`/`SeoMetaTags` reused. New EN i18n keys in `en.json` only (flow to
  /translate automatically).

## Verification
- svelte-look stories per component + `_page.stories.ts` (light + dark rendered automatically);
  csr stories for map/strip interactions.
- browser-tools against dev :3041 — pan/zoom/click-dot/search/audio/lines.
- Vitest: endpoints (featured-entries admin, homepage export), round_stat, search ranking,
  cluster/label helpers.
- `pnpm test`, `tsc`, `pnpm lint`, `pnpm check`.

## Task list

1. ✅ Interview + prod validation queries
2. ✅ Plan written
3. ✅ `build-map-data.mjs` + generated (`static/map-data/admin1.json` 127KB + `cities.json` 33KB lazy;
   `map/data/country-labels.json` 5KB bundled)
4. ✅ SSR map module + `/home-preview` scaffold: hero search (reuses `score_record` + diacritic fold),
   SSR SVG (land + MultiPoint dots, cached land path), StatsBand w/ count-up, FeaturesGrid, CtaBand
5. ✅ Canvas map: Path2D screen-space transform zoom/pan (cooperative gestures: ctrl+wheel /
   2-finger), grid-bin clustering w/ count badges + cluster-click-zooms-in, dict/country/admin1/city
   labels w/ greedy collision (dict labels win), 50m lazy swap at k>2.5, popover, theme swatch
   system (hidden divs → getComputedStyle → canvas colors, MutationObserver re-read). VERIFIED in
   headless browser: search ranking, zoom labels, dark mode, no page errors. Local dev DB seeded
   with the 221 prod public catalog rows (FK-nulled user refs).
6. ✅ `featured_entries` migration (`20260704_featured_entries.sql`, server-only table — NO Drizzle
   entry, following the chat/i18n convention) + `$lib/db/server/featured-entries.ts` + admin API
   (`/api/admin/featured-entries` GET/POST + tests) + `/admin/featured-words` review page (tabs,
   photo, inline audio, approve/reject/reset) + admin nav link. Verified in browser w/ real OTP auth.
7. ✅ `/api/homepage/export` (public; stats via ~15s per-dict scan, process-cached) + `_call` +
   tests + `scripts/fetch-homepage-baked.mjs` + Dockerfile RUN line (i18n-bake pattern)
8. ✅ Seed: harvested 6 samples × 72 candidate dicts from prod, picked 38 balanced, vision-checked
   the contact sheet, kept 26 (14 en / 12 other-gloss) → committed `homepage-baked.json` + local
   dev featured_entries rows (approved). Rejected: watermarked stock, literal color squares,
   clipart, mismatches, Wancho tofu-font lexeme.
9. ✅ Word strip: WordCards (shuffle/visit, rAF drift w/ FLOAT accumulator — scrollLeft rounds to
   ints and stalls sub-pixel steps, pause on hover/touch/focus/audio/hidden, seamless loop via
   doubled track, viewport bbox filter debounced 400ms w/ ≥8-card fallback, shared Audio element)
   + HeroUnit (bezier connection lines overlay via rAF + project_point + card anchors; faded
   light-dark red, strong on hover/play, dot pulse). GOTCHA fixed: card links MUST have
   `data-sveltekit-preload-data="tap"` — hover-preload starts downloading the whole dict DB.
10. ✅ FeaturesGrid, AgentApiDiagram (CSS-animated flow pulses, key badges, doc pile), CtaBand,
    ~45 EN i18n keys under `home_v2.*`, SeoMetaTags
11. ✅ Mobile (56vw map height), dark (canvas swatch re-read works), reduced-motion (drift/pulse/
    count-up all gated). RTL: logical margins used; deep RTL pass deferred to go-live.
12. ✅ `.claude/commands/curate-featured-words.md`
13. ✅ pnpm check 0 errors · lint clean · 1222 tests pass (12 new) · headless browser passes:
    search ranking, cluster-zoom, popover, labels, dark, drift, hover lines, admin review flow

## Verification evidence (2026-07-04 session)
Screenshots in /tmp on mustang: final-light-full.png, final-dark-full.png, final-mobile-dark.png,
strip-hover.png (strong line + pulse), interact-zoomed.png (labels), admin-featured-approved.png.

## Follow-ups / open items for Jacob
- **videos stat = 435** — looks weak next to the others ("400+ videos"). Keep, or drop to 5 stats?
- **Prod migration not yet deployed** — `featured_entries` table + endpoints go live on next push
  to main; then run `/curate-featured-words` for the first big batch (target 100–200 approved).
  The 26 seed cards are ALREADY baked into the committed JSON, so the strip works on deploy.
- **Go-live swap** (separate task): move `/home-preview` → `/`, delete Mapbox homepage components,
  `/globe` route + `$lib/components/globe/` (keep `globe/data/*.json` topojson — home-v2 imports it).
- Search: my_dictionaries chips render only when signed in; Enter opens top result directly.
- Non-Latin lexemes (Devanagari etc.) render tofu in HEADLESS screenshots only (missing fonts on
  mustang) — real devices are fine; Wancho-script was excluded because real devices lack that font.

## Notes / gotchas
- d3 + topojson-client are devDependencies (pure JS — fine, adapter-node bundles them; only
  native modules must be in dependencies).
- Audio in dev 302s to bundled dummy via `/api/dev-media` (media-url helpers) — strip playback
  works locally without GCS.
- `coordinates` JSON: `{ points: [{ coordinates: { latitude, longitude } }], regions: [...] }`.
- Don't touch `/` (current homepage), `/globe`, or Mapbox components — go-live swap is separate.
- lh3 size spec: use `s340-p` (~2× card display size, `-p` = smart crop).
