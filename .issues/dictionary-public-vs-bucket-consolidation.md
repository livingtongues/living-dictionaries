# Consolidate `dictionaries.public` → `bucket`, keep a "went public" timestamp

Raised by Jacob (2026-07-06) while wiring the /home-preview + footer counts.

## Idea
The `public` integer column and the curated `bucket` column (`public`/`unlisted`/
`secure`/`conlang`/`glossary`/`delete`) partly overlap. Jacob: "Is there a way to
update things in the database to just pull from `bucket`, so the `public` column
isn't needed — but it would be nice to know when things go public for the first
time."

So the direction is:
- Treat **`bucket`** as the single source of listing/visibility truth
  (`public` = publicly listed, `unlisted` = URL-reachable-but-not-listed, etc).
- Drop the boolean `public` column eventually.
- KEEP a first-went-public timestamp — `dictionaries.public_at` already exists
  (trigger `stamp_dictionary_public_at` stamps it on first publish). Preserve that
  signal (or re-home it) when `public` goes away.

## Why it's non-trivial (scope notes)
- `public` is used widely: sync sector visibility, the public index query
  (`WHERE public = 1`, indexed by `idx_dictionaries_public`), the home-preview
  server load, footer, dictionaries list, private-dict gating, the settings
  publish toggle, and the `stamp_dictionary_public_at` trigger keys off
  `UPDATE OF public`.
- `bucket` is admin-curated and currently NOT auto-coupled to `public` (the
  /admin/buckets area deliberately surfaces mismatches). Making bucket
  authoritative means deciding how the settings-page publish toggle writes bucket,
  and backfilling bucket for the ~2000 NULL/unclassified dicts.
- Requires a migration + updating every `public = 1` read across server + client,
  and re-pointing the public_at trigger at bucket changes.

## For now
The /home-preview + footer counts (2026-07-06 task) still read `public` (col) for
the public number and `bucket = 'unlisted'` for unlisted — matches the current
data. Revisit those two call sites when this consolidation lands.
