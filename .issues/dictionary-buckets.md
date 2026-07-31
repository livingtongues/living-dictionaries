# Dictionary buckets Part 2 — consolidate `dictionaries.public` → `bucket` (design, later)

> Part 1 (classification + delete-bucket execution) is DONE — full record in git history of this
> file. All prod dicts carry `dictionaries.bucket`; the `delete` bucket was executed through July
> (650 → ~3, plus a 344-dict conlang/glossary purge, record:
> `scripts/one-off/2026-07-12-purged-conlang-glossary.csv`). One leftover sweep idea: re-run
> `scripts/bucket-classification/build-assignments.js` against fresh stats to graduate the
> fresh-empty junk (~253 conlang/glossary dicts <10 entries that had recent activity in July).

Jacob (2026-07-06): treat **`bucket`** as the single source of listing/visibility truth and drop
the boolean `public` column eventually, but KEEP the first-went-public signal —
`dictionaries.public_at` already exists (trigger `stamp_dictionary_public_at` stamps on first
publish); preserve or re-home it when `public` goes away.

Why it's non-trivial:
- `public` is used widely: sync sector visibility, the public index query (`WHERE public = 1`,
  `idx_dictionaries_public`), homepage/footer counts, dictionaries list, private-dict gating,
  the settings publish toggle, and the `public_at` trigger keys off `UPDATE OF public`.
- `bucket` is admin-curated and deliberately NOT auto-coupled to `public` (the /admin/buckets
  area surfaces mismatches). Making bucket authoritative means deciding how the settings publish
  toggle writes bucket, and backfilling the unclassified/NULL dicts (new creates since 07-04).
- Requires a migration + updating every `public = 1` read across server + client, and
  re-pointing the `public_at` trigger at bucket changes.

Two call sites to revisit when this lands: the homepage/footer counts read `public` (col) for the
public number and `bucket = 'unlisted'` for unlisted.

## Gotchas
- Bulk `updated_at` bumps on dictionaries rows are restamp events — activity signals avoid
  catalog `updated_at`.
- Related: `/admin/storage` (orphaned-media visibility for the R2 reconcile),
  `.issues/sandbox-playground-dictionaries.md` (stops new junk at the source).
