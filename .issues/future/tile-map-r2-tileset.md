# Tile map pass 2 — custom-styled minimal tileset on R2

Follow-up to the tile-map tracer (2026-07-05, retired issue). The tracer proved the whole model —
canvas + d3 Equal Earth + PMTiles range reads + raster-tile compositing — and lives at
`site/src/routes/tile-map/` (dev-only). **Read
`.knowledge/domain/tile-map-canvas-tiles.md` first** — all the hard-won format/perf gotchas
(winding rewind, antimeridian, landcover seams, headless-GPU trap, quantization) are recorded
there.

Remaining work to make it real:
- Build a custom stripped tileset (~15–25 MB at z6, ~60–90 MB z7) with only the layers we style;
  buffer `landcover` properly (or drop it) so the 5% bleed-stroke hack can go; add an Antarctic
  cap polygon.
- Host the `.pmtiles` on R2 with a CORS rule allowing range reads from the app origin(s)
  (R2 supports ranges natively — no proxy endpoint needed in prod).
- Replace the kitchen-sink `map-style.ts` with a deliberate minimal style (Jacob's taste pass).
- Decide the integration target (homepage Equal Earth canvas map currently uses static land
  polygons — this would make it zoomable; possibly also the dict where-spoken surfaces someday).
- If deep-zoom p90 hitches ever matter: move decode+rasterize into a worker.
