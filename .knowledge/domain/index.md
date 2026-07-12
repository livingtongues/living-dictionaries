# domain/ — app-domain knowledge

Durable knowledge about the Living Dictionaries *domain* and external services it leans on —
the stuff you can't learn by reading one file. The data model itself lives in `AGENTS.md`
("Domain data model") and the schemas in `site/src/lib/db/schemas/`.

## Pages
- [related-entries-model.md](./related-entries-model.md) — why related entries use flat
  parent/child/sibling references instead of nested sub-entries, and the per-type editing rules.
- [orthographies-model.md](./orthographies-model.md) — the alternate-writing-system registry:
  immutable `code` keys, why `lexeme.default` stays the primary, the Keyman dataset (and the live-API
  subset gotcha), custom-code rules, and human/agent parity.
- [media-serving-urls.md](./media-serving-urls.md) — how GCS storage paths become image/audio
  URLs, and the App Engine Images `lh3` magic-URL resize/crop spec the photo pipeline depends on.
- [dictionary-import-process.md](./dictionary-import-process.md) — the human + script process for
  importing a dictionary from the Google Sheets template (dev dry-run → prod → make public).
- [change-history.md](./change-history.md) — the server-side per-dict audit log (entry/text/sentence
  edit timelines): where capture hooks in, the separate `{id}.history.db` + owners-index shape, how it
  survives schema drift, the entry≠text attribution boundary, and the red-phase correctness bugs.
- [parts-of-speech-i18n.md](./parts-of-speech-i18n.md) — canonical lowercase POS abbrevs + v1
  normalization, the river data repair, and the gotcha that `ps/psAbbrev/gl/sd` locale files are
  regenerated from a Google Sheet (hand-edits need a sheet row too).
- [media-attribution.md](./media-attribution.md) — why audio/video require speaker AND/OR a strict
  `sources.slug` registry ref (never fake speakers), why photo `source` stays free-text caption,
  the legacy-data evidence, the cutover 3-rule name resolution, and the river prod backfill record.
- [homepage-v2.md](./homepage-v2.md) — the `/home-preview` rebuild: why canvas+d3 Equal Earth beat
  Mapbox/MapLibre/protomaps, SSR-SVG first paint, the featured_entries curation pipeline + build-time
  bake, and the preload/scrollLeft gotchas.
- [mapbox-usage.md](./mapbox-usage.md) — the Referer-restricted public token (server fetches must
  spoof it), the 30-day static-image caching proxy (`/api/map-static`) that keeps every dict-home +
  entry map on the free tier, `is_dark_mode()` for light/dark variants, and where each map lives.
- [tile-map-canvas-tiles.md](./tile-map-canvas-tiles.md) — the library-free zoomable vector-tile
  tracer (`/tile-map` dev route): raster-tile compositing model, PMTiles/protomaps format gotchas
  (winding rewind, antimeridian, landcover seams), and the headless-canvas perf trap. Feeds
  `.issues/future/tile-map-r2-tileset.md`.
