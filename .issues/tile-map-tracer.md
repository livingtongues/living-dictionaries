# Tile-map tracer bullet — canvas + d3 Equal Earth + PMTiles vector tiles

Goal: prove we can render seamless zoomable map tiles with NO mapping library —
canvas + d3-geo (Equal Earth) + PMTiles range reads + MVT decode. Zoom depth: cities
visible (z6 data). Follow-up pass (separate task): custom-styled minimal tileset on R2.

Decisions (Jacob, 2026-07-05):
- Vector tiles, not raster (raster mercator can't reproject to Equal Earth cheaply). ✅
- Tracer data: local planet extract `site/.data/tiles/planet-z6.pmtiles` (45 MB, gitignored),
  extracted via `~/go/bin/pmtiles extract https://demo-bucket.protomaps.com/v4.pmtiles ... --maxzoom=6`.
  demo-bucket has NO CORS headers → browser can't hit it directly; same-origin serving instead.
- Kitchen-sink styling for now: draw every layer the basemap offers (roads/rivers/landuse/etc);
  customization comes with the R2 pass.
- Simpler zoomable-map-tiles model (single target zoom + parent fallback), not the seamless
  cross-fade one — vector redraw is crisp at every scale so no blur to hide.

Measured sizes (pmtiles extract --dry-run of the 2026-07-04 planet build):
- full basemap z0–6 = 45 MB · z0–7 = 186 MB
- stripped custom build estimate: ~15–25 MB (z6), ~60–90 MB (z7)

## Architecture

- `site/src/routes/tile-map/` (side folder, self-contained):
  - `+page.svelte` — canvas host, d3-zoom, HUD (k / data-z / tile count)
  - `data/+server.ts` — serves the .pmtiles file with HTTP Range support (vite static
    serving may not honor Range; this endpoint is guaranteed; prod-irrelevant, dev tracer only)
  - `tile-source.ts` — pmtiles FetchSource → gunzip? (pmtiles lib handles) → @mapbox/vector-tile
    decode → per-layer GeoJSON (toGeoJSON(x,y,z) gives lon/lat)
  - `tile-renderer.ts` — coverage math, tile cache, Path2D building, draw order, parent fallback
  - `map-style.ts` — kitchen-sink style table (fills/strokes per layer/kind) + label rules
- Zoom model: base projection `geoEqualEarth().fitExtent(canvas)`. d3-zoom transform t is an
  exact affine of projected coords (scaling projection scale == scaling projected points).
  Per tile+display-level, build Path2D buckets (style_key → Path2D) projected at a scale
  quantized to the data zoom; per frame only residual setTransform + lineWidth/k. Avoids
  re-projecting geometry every frame AND avoids resampling artifacts from big magnification.
- Coverage: sample viewport grid → projection.invert → lon/lat → mercator tile x/y range at
  data z (clamped ±85.05°). Small k → all tiles at low z. data_z ≈ floor(log2(w*k/256)) clamped 0..6.
- Parent fallback: draw ready ancestors first (z asc), then ready target tiles on top —
  basemap tiles have full earth+water coverage so children fully occlude ancestors.
- Labels: places layer points, drawn last in screen space (unscaled text), greedy measureText
  collision, dedupe by name, stage by kind/min_zoom.
- Antarctica: tiles clip at 85.05°S — small missing polar cap in Equal Earth. Acceptable for
  tracer; custom build pass can add a cap polygon.

## Steps
- ✅ Probe demo bucket (206 range OK, no CORS) + dry-run sizes
- ✅ Extract z6 planet to site/.data/tiles/ (45 MB) — background
- ✅ Add deps: pmtiles, @mapbox/vector-tile, pbf
- ✅ Range-serving endpoint
- ✅ Tile source (decode) + introspect real layer names/props from extracted file
- ✅ Renderer + styles + labels
- ✅ Page + zoom + HUD
- ✅ Verify: puppeteer — world view, mid zoom, deep zoom w/ cities; console clean
- ✅ Dev server up on :3041 for Jacob (background task, keep alive)

## Round 2 (2026-07-05): Jacob reported "janky, slow, gaps between tiles" → rearchitected

Rendering moved from per-frame vector Path2D drawing to **raster-tile compositing**: each
tile rasterizes ONCE into an OffscreenCanvas at a power-of-two-quantized projection scale;
frames just blit visible bitmaps + draw labels vector-crisp on top.

- **Interaction policy**: while zooming/panning (<150ms since last transform), NEVER rebuild
  stale bitmaps (they display scaled); paint at most one fresh-loaded tile per frame. At idle,
  chew through rebuilds time-budgeted (8ms/frame), rAF chain until settled.
- **Per-tile quantization cap** (`desired_quantization`): ancestors shown at deep zoom would
  otherwise rasterize at the global quantization → 4096² bitmaps (29ms + silent clipping).
  Cap by tile z so bitmaps stay ~1-2k px; `pixel_scale` guard against the 4096 hard cap.
- **Seam fix generalized**: bitmap margins (24 path px) overlap neighbors (real data buffers:
  earth 128u, landcover 64u, landuse 64u, water 128u per 4096 tile units — measured), plus
  landcover bleed stroke = 5% of tile span (insets are REGIONAL: buffered in Germany, 18u+
  short in NY/Sahel; 2.5% still showed lines at dpr2, 5% clean). Hairline strokes on other
  fills removed (margins cover AA seams).
- Verified headful (real GPU) at dpr=2, 1500×880: **zoom-sweep p50 7.4ms, p90 41ms** (p90 =
  fresh dense-tile rasterization, bounded 1/frame); steady-state pan ≈ 1ms/frame. Console
  clean; eslint/tsc clean. Africa view (Jacob's complaint) seam-free.
- Perf traps found: **headless Chrome composites canvas on CPU (SwiftShader)** — blits
  measured 19.3ms/frame headless vs 0.2ms headful. Never tune canvas perf from headless
  numbers; `launch({ headless: false })` on tuf for real measurements.
- geoPath cost for the densest tile (Beijing, 39k vertices) is only ~9ms (precision(1) → 6.4);
  decode+rewind ~4ms — the original jank was per-frame REPAINT, not decode/projection.
- Future (if ever needed): decode+rasterize in a worker kills the remaining p90 hitches.
- Dev server left running on :3041 → http://localhost:3041/tile-map
  (drag pan, wheel zoom — no ctrl needed, dblclick zooms). ~4.5 MB transferred for a full
  world→Europe→deep→NYC browse session (of the 43 MB archive).

## Lessons / gotchas (for the R2 pass)
- pmtiles JS `FetchSource` sends `Range: bytes=a-b` — server must return 206 + Content-Range
  (vite's static server returns 200 full-body, which the lib rejects → hence data/+server.ts;
  R2 does ranges natively but needs a CORS rule).
- **Ring winding is INCONSISTENT across layers/zooms** in the v4 basemap output of
  `@mapbox/vector-tile`'s toGeoJSON — a z6 earth sample was d3-correct, but low-zoom ocean
  rings were inverted (d3 renders wrong winding as the spherical complement → globe-covering
  fills). Fix: rewind EVERY ring by measured `geoArea` (exterior ≤ 2π, holes ≥ 2π). Only
  legitimately-hemisphere-plus rings (z0) would break this; z0 is never displayed.
- **Antimeridian tile buffers**: edge-tile geometry past ±180° gets normalized by d3 to the
  far side of the world (streaks/wrapped fills). Clamp line/polygon lons to ±179.999; DROP
  (don't clamp) out-of-range label points — clamping drew "New Zealand" at the map's left edge.
- **`landcover` (raster-derived) stops 0.0247°/side short of tile edges** → white gridlines
  when overzoomed. earth/water/landuse have real buffers; landcover does not. Tracer fix:
  same-color stroke `0.7 * quantized_k` path-px on landcover fills knits tiles together
  (empirical: 0.16 insufficient, 0.4 faint lines, 0.7 clean, 1.0 overkill). Custom build
  should buffer landcover properly or drop the layer. Max zoom capped at k=40 (~view z7.5).
- Protomaps v4 layer names at z6: earth, landcover, landuse, water, boundaries, roads,
  places, pois (physical_line/physical_point/buildings/transit appear at other zooms/areas).
  Places props: kind (country/region/locality), kind_detail, min_zoom (present up to 7 inside
  z6 tiles — helps overzoom labeling), population, population_rank. Names are local-script.
- water/earth include point features (sea/island label anchors) — filter by geom type;
  earth+water polygons give full tile coverage, so child-over-parent occlusion just works.
- d3 adaptive resampling: geometry projected once then magnified >2× shows chord artifacts on
  long segments — quantize the projection scale to powers of two (residual ≤2×) per tile.
- pbf v5 renamed the default export: `import { PbfReader } from 'pbf'`.
- display_z = log2(k · world_px / 256); data_z = round(display_z) clamped 0..6; z6 data is
  reached at k≈18 and holds fine to the k=40 cap.
