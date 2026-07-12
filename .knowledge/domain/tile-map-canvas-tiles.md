# Canvas + d3 Equal Earth + PMTiles vector tiles — tracer lessons

The `/tile-map` dev route (2026-07-05, `site/src/routes/tile-map/`) proved library-free zoomable
map tiles: canvas + d3-geo (Equal Earth) + PMTiles range reads + MVT decode. Verified headful at
dpr=2: zoom-sweep p50 7.4ms / p90 41ms, steady pan ≈1ms/frame; a full world→NYC browse transfers
~4.5 MB of the 43 MB local z6 archive. This page records what a future custom-tileset pass
(`.issues/future/tile-map-r2-tileset.md`) must not relearn. The architecture itself is readable
in the route's code (`tile-source.ts`, `tile-renderer.ts`, `map-style.ts`).

## Rendering model that finally felt smooth (round 2)
Per-frame vector Path2D drawing was the jank (repaint, NOT decode/projection — the densest tile,
Beijing 39k vertices, costs only ~9ms in geoPath). Fix: **raster-tile compositing** — each tile
rasterizes ONCE into an OffscreenCanvas at a power-of-two-quantized projection scale; frames just
blit bitmaps + draw labels vector-crisp on top. Interaction policy: while zooming/panning (<150ms
since last transform) NEVER rebuild stale bitmaps, paint ≤1 fresh tile/frame; at idle chew
through rebuilds time-budgeted (8ms/frame). Cap per-tile quantization by tile z or ancestor tiles
rasterize at 4096² (29ms + silent clipping at the canvas hard cap).

## Data/format gotchas (protomaps v4 basemap, pmtiles JS, d3)
- **pmtiles `FetchSource` requires true 206 + Content-Range** — vite static serving returns 200
  full-body, which the lib rejects; hence the dev `data/+server.ts` range endpoint. R2 does
  ranges natively but needs a CORS rule. The demo bucket (`demo-bucket.protomaps.com`) has NO
  CORS — extract locally via `~/go/bin/pmtiles extract … --maxzoom=6`.
- **Ring winding is inconsistent across layers/zooms** in `@mapbox/vector-tile` toGeoJSON output
  — d3 renders wrong winding as the spherical complement (globe-covering fills). Rewind EVERY
  ring by measured `geoArea` (exterior ≤ 2π, holes ≥ 2π).
- **Antimeridian buffers**: edge-tile geometry past ±180° normalizes to the far side of the world.
  Clamp line/polygon lons to ±179.999; DROP (don't clamp) out-of-range label points — clamping
  drew "New Zealand" at the map's left edge.
- **`landcover` (raster-derived) stops 0.0247°/side short of tile edges** → white gridlines when
  overzoomed. Real measured buffers per 4096 tile units: earth 128u, water 128u, landuse 64u,
  landcover 64u-but-short-REGIONALLY (buffered in Germany, 18u+ short in NY/Sahel). Fix: bitmap
  margins (24 path px) + same-color bleed stroke on landcover = 5% of tile span (2.5% still
  showed lines at dpr2; 0.7×k path-px was the earlier vector-mode value). A custom build should
  buffer landcover properly or drop the layer.
- **d3 adaptive resampling**: geometry projected once then magnified >2× shows chord artifacts —
  quantize projection scale to powers of two (residual ≤2×) per tile. `precision(1)` cuts dense
  geoPath cost ~30%.
- Layer facts at z6: earth/landcover/landuse/water/boundaries/roads/places/pois. Places props:
  kind, kind_detail, `min_zoom` (present up to 7 inside z6 tiles — enables overzoom label
  staging), population_rank; names local-script. water/earth include point features (label
  anchors) — filter by geom type; their polygons give full tile coverage so child-over-parent
  occlusion works with no clearing.
- `pbf` v5 renamed the default export: `import { PbfReader } from 'pbf'`.
- Zoom math: `display_z = log2(k · world_px / 256)`; `data_z = round(display_z)` clamped 0..6;
  z6 data reached at k≈18, holds to the k=40 cap (~view z7.5). Tiles clip at 85.05°S → small
  missing Antarctic cap in Equal Earth (custom build: add a cap polygon).

## Perf-measurement trap
**Headless Chrome composites canvas on CPU (SwiftShader)** — blits measured 19.3ms/frame headless
vs 0.2ms headful. Never tune canvas perf from headless numbers; use
`launch({ headless: false })` on tuf for real measurements.

## Sizes (2026-07-04 planet build, pmtiles --dry-run)
full basemap z0–6 = 45 MB · z0–7 = 186 MB · stripped custom estimate ~15–25 MB (z6) /
~60–90 MB (z7).
