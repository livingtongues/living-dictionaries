# domain/ — app-domain knowledge

Durable knowledge about the Living Dictionaries *domain* and external services it leans on —
the stuff you can't learn by reading one file. The data model itself lives in `AGENTS.md`
("Domain data model") and the schemas in `site/src/lib/db/schemas/`.

## Pages
- [related-entries-model.md](./related-entries-model.md) — why related entries use flat
  parent/child/sibling references instead of nested sub-entries, and the per-type editing rules.
- [orthographies-model.md](./orthographies-model.md) — the alternate-writing-system registry:
  immutable `code` keys, why `lexeme.default` stays the primary, the per-orthography `characters`
  search tap-buttons, the Keyman dataset (and the live-API subset gotcha), custom-code rules, and
  human/agent parity.
- [media-serving-urls.md](./media-serving-urls.md) — R2 object conventions, photo/video variants,
  immutable site assets, bucket CORS, storage ledger, orphan sweep, and locked backup.
- Imports are agent-driven now: managers upload resources on `/{dict}/import` → a request
  message reaches the team → an agent imports via `/api/v1` following the guides at
  `/api/v1/guides` (the old Google-Sheets template + `scripts/import/` CLI are retired).
- [import-workflow.md](./import-workflow.md) — the team-only wrapper around an import: where the
  kickoff brief comes from, why the API guides stay the source of truth, how to fetch the uploaded
  file from R2, mint a per-dict API key (admin attribution gotcha), back up, verify via direct DB
  reads, and hand the finished job back to Jacob (draft reply → he sends → he resolves the thread,
  which is what clears the manager's Import page). Also: **what belongs in the review queue** — the
  two Ponca cuts (694 → 375 → 38), why a POS difference is never a review item, and the structured
  `review.comparisons` diff banner that replaced "describe the difference in prose".
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
- [secure-dictionary-mode.md](./secure-dictionary-mode.md) — `bucket='secure'` decisions: why
  admin levels 1-2 are deliberately blocked, the no-existence-leak rule, accepted media/metadata
  leaks, no invite exemption (manual back-end setup; river is the one prod case), and the
  "contributor = editing tier" server-gate fix (prod has zero 'editor' rows).
- [grammar-page-navigation.md](./grammar-page-navigation.md) — why the grammar TOC is a RIGHT rail
  (the left one is taken), read-mode-first with one Edit toggle, the untitled-section-is-a-preface
  numbering rule, Ponca's flattened root, the document-order scroll-spy model (and why
  IntersectionObserver failed), and why a parent body renders above its children — so an import
  must give every table group its own subsection.
- [forced-alignment.md](./forced-alignment.md) — auto-timings (M6): the dumb-Modal-endpoint /
  smart-LD-server split, why romanization + the bespoke per-dict converter registry live server-side
  and admin-only, the two-runtime (Modal prod / local-CPU dev) aligner, the per-token align_form
  cascade, the `auto_align` graduation switch, job/rate-limit mechanics, and deploy/dev gotchas.
