# Dictionary buckets — classification DONE; execute the `delete` bucket (remaining)

All 2,232 prod dictionaries are classified into `dictionaries.bucket`
(`public | unlisted | secure | conlang | glossary | delete`) and reviewable/reassignable in
`/admin/buckets` + `/admin/dictionaries`. **The one remaining piece of work is executing the
`delete` bucket teardown** (a later session, on Jacob's go-ahead).

## What's already shipped (2026-07-04, applied to prod)
- Migration `20260704a_featured_entries_pivot_and_dictionary_buckets.sql`: `bucket` + `public_at`
  columns + `stamp_dictionary_public_at` trigger. Drizzle schema + `DICTIONARY_BUCKETS` constant.
- Classification applied to prod (2,232 rows): **public 221 · unlisted 396 · conlang 696 ·
  glossary 269 · delete 650**. Conlang-field cleanup (nulled stale `con_language_description` on
  210 kept-bucket non-conlang dicts, real substance appended to `author_connection`).
- `/admin/buckets` review UI + `/admin/dictionaries` bucket filter/column + editable conlang-desc
  (only when `bucket === 'conlang'`).
- Classification tooling lives in `scripts/bucket-classification/` (`build-assignments.js`,
  `apply-assignments.js`, `bucket-assignments.csv`).

## REMAINING — execute the delete bucket (later session, Jacob's go-ahead)
Back up a tarball → R2 first, then batch-drive the existing teardown endpoint
`DELETE /api/dictionaries/[id]` (admin-only; shared.db tombstones + dict.db + history.db + R2
snapshot; GCS media harvest is deferred to the storage-dashboard story). Safety check on the
650 delete-bucket dicts: 629 entries · 124 audio · 157 photos · 4 videos total — nothing of value;
111 have a few stray media files whose GCS bytes get orphaned at teardown (harvest deferred).

Fresh-empty junk ("test test test", keyboard-mash) couldn't be deleted under the stale rule (≤3
entries + no content activity ≥1yr) — bucketed `glossary`/`conlang` by intent; a NEXT sweep
(re-run `build-assignments.js` against fresh stats) graduates them to delete.

## Notables for Jacob's in-app review before deleting
- **`river`** — 8,692 entries + 4,733 audio, kept `unlisted`; worth a look.
- **`tla-wilano`** — 1,034 entries + 704 audio, answered YES to conlang on the old form → `conlang`.
- Team/test dicts kept OUT of delete (fresh activity): `jacob-test2`, `test-004`,
  `example-v4-senses`, `test-language-x`, `test-german` → all `glossary`; hand-delete whenever.
  `sugtstun-test` kept `unlisted` (referenced in `DICTIONARIES_WITH_VARIANTS` constant!).
- Media-heavy conlangs (future media-squash targets): `leshing` (2,460 audio / 2,159 photos),
  `orich` (1,180 audio), `taharini` (806 audio).

## Notes / gotchas
- Bucket is NOT auto-coupled to the `public` column; the review UI surfaces mismatches. See
  `.issues/dictionary-public-vs-bucket-consolidation.md` for the direction to make bucket the single
  visibility truth.
- Bulk `updated_at` bumps on dictionaries rows are restamp events — the activity signal avoids
  catalog `updated_at`.
- Side-quests spun off: `.issues/admin-media-storage-dashboard.md`,
  `.issues/sandbox-playground-dictionaries.md`.
