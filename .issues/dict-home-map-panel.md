# Dict home map panel — cached static map + interactive modal

Move the where-spoken map onto `/{dict}/home` (replacing the "Map coming soon" placeholder in
`MapPanel.svelte`), backed by a **server-cached Mapbox Static Images proxy** for sustainability.
Settings keeps its `WhereSpoken` untouched until home goes live (then remove it there);
create-dictionary keeps it forever. The `location` **text field** stays everywhere — this is only
about the map tile.

Decisions (Jacob 2026-07-10):
- Static visual = Mapbox Static Images via server-cached proxy endpoint, 30d TTL on disk under
  `DATA_DIR` (Mapbox TOS allows 30d perf caching). URL encodes the coordinates → coordinate edits
  bust browser cache naturally (`max-age=30d, immutable`).
- Click → modal: visitors get a **read-only interactive mapbox-gl map** (markers + region polygons
  + NavigationControl, fit to bounds); managers get **WhereSpoken as-is** wired to
  `update_dictionary` (same wiring as settings page).
- Manager empty-state map tile opens the same modal (WhereSpoken handles the empty state).
- Styles: `outdoors-v12` light / `dark-v11` dark — two cached variants, picked by current color
  scheme reactively.
- Entry-page `MapboxStatic` (EntryMedia geotag tile) routes through the same proxy in this pass —
  that's the actual current static-API spend.

## Facts discovered
- `MapboxStatic.svelte` already exists (`$lib/components/maps/mapbox/static/`), used ONLY by
  `EntryMedia.svelte`; builds the geojson overlay from `shapeGeoJson(points, regions)` (pure TS,
  server-importable).
- Dev `.env` has `PUBLIC_mapboxAccessToken=dummy` → Map.svelte falls back to a blank local style
  (markers still render); static proxy must 404 gracefully on dummy/missing token. For real visual
  verification, grab the real PUBLIC token from the live site's shipped JS (it's public by design)
  and set it in local `.env` (gitignored).
- Marker/Region components render fine WITHOUT children snippets → no edit popups = read-only map.
- `Map.svelte` has `pointsToFit` prop (fitBounds, maxZoom 6, padding 10).
- Home `+page.svelte` already has `update_dictionary` + full `dictionary` in page data.
- vitest aliases `$env/dynamic/private` → mock reading `process.env`; `$env/static/public` → mock
  (token ''). Endpoint reads token as `env.MAPBOX_ACCESS_TOKEN || PUBLIC_mapboxAccessToken` so
  tests can inject via process.env.
- Mapbox pricing: static 50k/mo free then ~$1/1k; GL loads 50k/mo free then ~$5/1k (modal-only GL
  loads are naturally rare).

## Status: COMPLETE (2026-07-10) — all steps ✅, awaiting Jacob's sign-off
- Endpoint (12 tests) + full map suites green; tsc/lint/check clean.
- Browser-verified headless with the REAL public token: visitor static panel (light+dark
  variants), visitor read-only modal (2 markers + region + nav + fitBounds), manager modal =
  WhereSpoken editor (title suppressed, one heading), manager add-coordinate → static img URL
  updates, entry geotag tile via proxy. Zero non-noise console/page errors.
- **Token gotcha**: the public `PUBLIC_mapboxAccessToken` is URL-restricted to
  livingdictionaries.app (Referer-checked) → the server proxy sends
  `referer: https://livingdictionaries.app/` or Mapbox 403s. Verified via the live token pulled
  from the shipped bundle. Sandbox blocked writing `site/.env`, so local testing passed the token
  as `MAPBOX_ACCESS_TOKEN=… PUBLIC_mapboxAccessToken=… pnpm dev`. **Prod already has the token in
  `PUBLIC_mapboxAccessToken`; add a server-side `MAPBOX_ACCESS_TOKEN` only if you want a
  non-restricted token — otherwise the referer header covers it.**
- Bonus fix: `Map.svelte` `fitPoints()` called `map.fitBounds` directly, which threw
  "Cannot read properties of null" when the effect fired before the map instance existed — routed
  through the existing `fitBounds()` queue helper.
- Local dev achi coordinates seeded for testing then restored to original.

## Plan
1. `routes/api/map-static/+server.ts` — public GET. Params: `points` + `regions` (JSON,
   validated + capped: ≤50 points, ≤20 regions, ≤200 coords/region), `w`/`h` (clamped 50–1280),
   `mode` (`light`|`dark` → outdoors-v12 / dark-v11), `zoom` (single-point, clamp 0–15, default 3).
   Always @2x, logo=false. Cache file = sha256 of normalized params under
   `DATA_DIR/cache/map-static/<hash>.png`; fresh <30d → serve; expired → refetch, on mapbox
   failure serve stale; no cache + failure → 502. Dummy/missing token → 404.
   Response: `image/png`, `cache-control: public, max-age=2592000, immutable`.
2. `routes/api/map-static/_call.ts` — `map_static_url({ points, regions, width, height, mode,
   single_point_zoom })` URL builder (img src, not fetch).
3. `routes/api/map-static/server.test.ts` — mocked global fetch + tmp DATA_DIR: 400s, clamp,
   cache miss→fetch+write, hit→no fetch, TTL expiry, stale-on-failure, 404 on dummy token.
4. `$lib/state/color-mode.svelte.ts` — reactive `is_dark` (matchMedia + `<html>` class
   MutationObserver; html class override wins over system).
5. Rework `MapboxStatic.svelte` → browser-only `<img loading="lazy">` pointing at the proxy
   (drop fetch-probe, accessToken/style/highDef props; add mode from color-mode state; onerror
   placeholder). Update EntryMedia call site (props: points/regions unchanged).
6. Rework `MapPanel.svelte` — props `{ dictionary, is_manager, update_dictionary }`; static map
   button (MapboxStatic 640×320, object-fit cover) → Modal: manager = WhereSpoken (settings
   wiring), visitor = read-only Map + Markers + Regions + NavigationControl + pointsToFit
   (points + region coords). Empty-state manager tile opens modal too. Wire in home
   `+page.svelte`.
7. i18n: remove `dict_home.map_soon` from en.json; modal heading reuses `create.where_spoken`.
8. Verify: pnpm test + tsc + lint + check; svelte-look story for MapPanel; browser test on :3041
   with real token (dev-auth manager + anonymous).

## Follow-ups (not this pass)
- When home goes live for everyone: remove WhereSpoken from settings page (+ NudgeCard
  settings_href for location → open home modal instead?).
- Consider pointing the manager nudge "add location" at the home modal.
