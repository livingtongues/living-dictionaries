# Comparative-dialectology surface (PARKED — corpus-agent suggestion 2026-07-14)

**Status: PARKED / not started.** Captured from agent feedback so it isn't lost; **out of scope** for
the structured-grammar work. Separate feature. Revisit after grammar/IGT lands.

Source: agent feedback thread `a6bbba74-a900-4834-be28-2ea7a3102a09` (prod shared.db, "Agent feedback:
River", 2026-07-14 05:54). Additive proposal building on what already exists (dialects with areal
geometry, entry↔dialect assignment + filtering, per-entry coordinates, cognate/dialectal-variant
`entry_relationships` carrying sources, the map components).

For a dictionary built from a **comparative dialect survey** (dozens of surveyed localities, pairwise
mutual-intelligibility scores, lexical-similarity / phonetic-distance tables, proto-reconstructions, a
gazetteer with coordinate precision + provenance), five gaps:

1. **Dialect↔dialect relationships (highest-value).** Entry↔entry relationships exist; dialects have
   none. Mirror `entry_relationships` → a `dialect_relationships` model:
   `{ from_dialect, to_dialect, type, value (number), symmetric?, note, sources[] }` with a typed
   vocab (`intelligibility`, `lexical_similarity`, `phonetic_distance`). **Directed/weighted** —
   intelligibility is asymmetric. Enables intelligibility networks, distance matrix / MDS / dendrogram,
   similarity-colored maps.
2. **Entry-level comparison / isogloss view.** Plot ONE concept's forms across localities (classic
   dialect-atlas / isogloss). The cognate/variant graph already defines the set; show each variety's
   form at its locality, tappable → entry + audio.
3. **Coordinate precision + provenance on a point.** A point is just lng/lat/label/color today. Add
   optional per-point `precision` (exact / village / township / county / region) + `source`
   (a `sources.slug` ref, like audio/sentences) + optional uncertainty radius → distinguish
   confident vs approximate points, keep coordinates traceable.
4. **Richer surveyed-dialect metadata.** A field variety carries more than name+region: an
   autonym/**endonym** (often ≠ catalog name), the specific **elicitation locality** (a labeled point,
   distinct from the areal region), a fieldwork **source** ref, and a sample descriptor (speaker, N).
   Add optional `endonym` + `sources[]` on dialects; document the "point = elicitation locality,
   region = areal extent" convention.
5. **Parallel texts as versions of one story across dialects.** A common survey artifact. A text↔text
   "version-of" link (or shared `work_id`) + per-text dialect/place/teller metadata → align + map the
   same narrative across varieties.

Mostly small + additive: a `dialect_relationships` table (mirrors an existing one), two nullable point
fields, a couple nullable dialect fields, a text version-link, and views over data the
map/relationship/dialect models already hold. Payoff: a per-variety dictionary becomes a
comparative-dialectology + mapping surface (intelligibility networks, distance maps, isogloss views)
for both learners (hear a word across varieties) and researchers (measure + map divergence with
provenance intact).

**Note:** overlaps `.knowledge/domain/related-entries-model.md`, `mapbox-usage.md`, the dialects
manager (settings), and `entry_relationships`. When picked up, decide the tag/API grouping (likely a
`dialects` v1 expansion + a new `dialect-relationships` surface).
