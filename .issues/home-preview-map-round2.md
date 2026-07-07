# /home-preview map round 2 (2026-07-07)

## Status: ✅ all done — verified via vitest (full suite 1301 pass), pnpm check, eslint,
and headless puppeteer on live dev (desktop/mobile × light/dark, zoom clicks, preload network audit).

Jacob's batch + what landed:

1. ✅ **Antarctica + Hawaii trim** — `projection.ts`: `VISIBLE_WORLD` west clamp −145° at the
   equator (Hawaii out, Iñupiaq at −161.7/64.9°N — the westmost public dot per prod query —
   stays ~100px inside; Equal Earth pulls high lats inward). `fit_equal_earth` now pins
   `clipExtent` to the fitted world bounds so cropped land never paints into letterbox.
   `WORLD_ASPECT` (~2.06) exported; HeroUnit `.map-frame` uses `aspect-ratio: var(--world-aspect)`
   + `max-height: 58vh` instead of a fixed height (root cause: big monitors letterboxed
   vertically and exposed Antarctica). Unit test asserts Iñupiaq-in/Hawaii-out.
   natural_height(960) 420 → 466.
2. ✅ **Single connector line everywhere** — HeroUnit: removed the desktop distance-falloff
   (FALLOFF/center_falloff/is_mobile gone); center-nearest (or hovered/playing) card gets
   opacity 1, all other visible cards stay MOUNTED at 0. Harsh mobile switching was unstable
   keys (`card.id-index` changed between loop copies → element recreated → CSS transition
   skipped); now keyed by `card.id`, labels always rendered, 250ms ease crossfade (verified by
   sampling intermediate computed opacities).
3. ✅ **3rd zoom level** — WorldMap `on_click`: `country_transform()` computed first; if it
   wouldn't move the view (`new k ≤ current k × 1.15`) a still-grouped cluster falls through to
   `zoom_toward()` (×2.2 step, capped MAX_ZOOM). Verified: repeated grouped-cluster clicks
   always change the view; never dead-ends.
4. ✅ **Land-file diet** — land silhouette now `topojson.merge(countries.geometries)` in
   WorldMap (110m + 50m) and ssr-map; land-110m/land-50m no longer imported by home-v2
   (~22KB gz off initial, ~184KB gz off zoom tier). Files kept — old `/globe` Globe.svelte and
   `/og` still import them.
5. ✅ **Idle prefetch** — WorldMap onMount `requestIdleCallback` (timeout 8s; setTimeout
   fallback) warms countries-50m + admin1.json + cities.json. Draw only *uses* hi-res at
   k ≥ 2.5 — the pulse ring keeps a rAF loop alive at k=1 and 110m is much cheaper per frame.
6. ✅ **"Downloading dictionary" leak** — WordCards strip → `data-sveltekit-preload-data="off"`
   (was "tap", which preloads on MOUSEDOWN — opening the lightbox already started the snapshot
   pull). Fullscreen viewer keeps "tap". Verified: card click = zero dict requests; mousedown
   on Open entry starts the preload.
7. ✅ **Fullscreen dict title → link** to `/{dict_url}` (white, hover underline, tap preload).
8. Button smash — dropped by Jacob.

## Notes for future sessions
- Prod check used: westmost public dict dot is Iñupiaq (−161.7); if a Hawaii/central-Pacific
  dictionary ever gets published, the −145° west clamp must be revisited.
- cities.json still contains Honolulu etc; invisible (labels only draw k ≥ 5.5 and pan can't
  reach cropped area).
