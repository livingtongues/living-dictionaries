# Mapbox usage — static proxy, tokens, and where each map lives

How LD uses Mapbox and how it keeps the free tier sustainable. The interactive editing/viewing
components (`$lib/components/maps/mapbox/*`) and the static-image proxy
(`routes/api/map-static/`) are the source of truth for behavior — this page is the "why" and the
non-obvious gotchas.

## The public token is Referer-restricted

`PUBLIC_mapboxAccessToken` (the same `pk.…talkingdictionaries…` token that ships in every browser
bundle) is **URL-restricted to `livingdictionaries.app` at Mapbox** — Mapbox enforces it by
checking the HTTP `Referer`. Consequences:

- Browser `mapbox-gl` / client-side Static Images requests work anywhere the page origin is the
  restricted host (and on localhost dev they 403 the *telemetry* endpoints harmlessly, but the map
  still renders because the tile requests carry a Referer).
- **Any SERVER-side fetch to Mapbox must send `referer: https://livingdictionaries.app/`** or it
  gets a 403. This is why `routes/api/map-static/+server.ts` sets that header. There is no separate
  server token by default — the proxy reuses the public token + referer. (You *can* set
  `MAPBOX_ACCESS_TOKEN` in the server env to use an unrestricted token instead; the proxy prefers
  it over the public one.)
- To test the proxy locally you need the real token, not the dev `dummy`: it's public by design —
  pull it straight from the live site (`curl https://livingdictionaries.app/` → grep `pk\.`), then
  run `MAPBOX_ACCESS_TOKEN=… PUBLIC_mapboxAccessToken=… pnpm dev`. (The sandbox blocks writing
  `site/.env`, hence env-var injection.)

## The static-image proxy — 30-day disk cache

`GET /api/map-static` (public, `_call.ts` = `map_static_url()` URL builder, NOT a fetch wrapper —
callers use the URL as an `<img src>`) is a caching proxy in front of the Mapbox Static Images API:

- Params: `points`/`regions` (JSON, validated + capped), `w`/`h` (clamped 50–1280), `mode`
  (`light`→`outdoors-v12` / `dark`→`dark-v11`), `zoom` (single-point only). Always `@2x`,
  `logo=false`.
- Overlay geometry comes from the shared `shapeGeoJson(points, regions)` (same helper the
  interactive components use).
- Cache file = sha256 of the normalized request under `DATA_DIR/cache/map-static/<hash>.png`.
  Fresh (<30 days, the Mapbox TOS caching allowance) → served from disk; expired → refetch and
  rewrite; **Mapbox unreachable but a stale copy exists → serve stale** (only a cold miss + failure
  returns 502). Browser gets `cache-control: public, max-age=30d, immutable`, and because the
  coordinates are in the URL, an edit busts the browser cache naturally.
- Net effect: **~1 Mapbox request per unique (dictionary, size, mode) per month**, not per visitor.
  This is what makes putting a map on every dict-home + every geotagged entry sustainable on the
  free tier.
- Dev `dummy`/missing token → the endpoint 404s and `MapboxStatic.svelte` shows a gray placeholder.

## `is_dark_mode()` — reactive color mode for image variants

`$lib/state/color-mode.svelte.ts` exposes `is_dark_mode()` (matchMedia + `<html>` class
MutationObserver, html-class override winning over system, same resolution order as theme.css).
`MapboxStatic.svelte` reads it to pick the `mode=light|dark` variant, and re-renders the `<img>`
when the user flips the theme. It's browser-only — SSR can't know the visitor's mode, and a
light→dark swap after hydration would double-hit the server cache.

## Where each map lives (as of 2026-07-10)

- **Homepage `/`** — the bespoke canvas + d3 Equal Earth map (NOT Mapbox). See `homepage-v2.md`.
- **Dict home `/{dict}/home`** (`MapPanel.svelte`) — cached static image; click opens a Modal:
  visitors get a read-only interactive `mapbox-gl` map (markers + region polygons + nav, fit to
  bounds); managers get the `WhereSpoken` editor (same wiring as settings). Manager empty-state
  tile opens the same modal. `WhereSpoken` gained a `show_title` prop so the modal heading isn't
  duplicated.
- **Entry page** (`EntryMedia.svelte`) — geotag tile uses the same `MapboxStatic` → same cached
  proxy. Editing still goes through `GeoTaggingModal`.
- **Settings + create-dictionary** — `WhereSpoken` interactive editor (unchanged). Settings keeps
  its copy until dict-home goes live for everyone, then it can be removed there.

## Gotcha: `Map.svelte` fitPoints raced the map instance

`fitPoints()` originally called `map.fitBounds(...)` directly, which threw
"Cannot read properties of null (reading 'fitBounds')" when the `pointsToFit` effect fired before
`new mapboxgl.Map()` resolved. Fixed by routing through the component's existing `fitBounds()`
queue helper (`EventQueue`), which buffers commands until the map starts.
