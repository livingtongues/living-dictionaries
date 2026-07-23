# Dictionary buckets — consolidate `public` → `bucket` (Part 1 delete-execution DONE)

> **2026-07-23 status:** Part 1 is EXECUTED — prod `delete` bucket is down to 3 dicts (from 650);
> Jacob handled the deletions through July. Only Part 2 (the `public` → `bucket` consolidation
> design) remains live in this file. GCS media-byte orphan harvest now belongs to the media→R2
> migration issue.

Combined 2026-07-12 from `dictionary-buckets-cleanup.md` + `dictionary-public-vs-bucket-consolidation.md`.
Classification itself is DONE and live (2026-07-04): all 2,232 prod dicts carry
`dictionaries.bucket` (`public 221 · unlisted 396 · conlang 696 · glossary 269 · delete 650`),
reviewable in `/admin/buckets` + `/admin/dictionaries`. Tooling: `scripts/bucket-classification/`.

## Part 1 — execute the `delete` bucket (needs Jacob's go-ahead)

Back up a tarball → R2 first, then batch-drive the existing teardown endpoint
`DELETE /api/dictionaries/[id]` (admin-only; shared.db tombstones + dict.db + history.db + R2
snapshot; GCS media harvest deferred to `.issues/admin-media-storage-dashboard.md`). Safety check
on the 650 delete-bucket dicts: 629 entries · 124 audio · 157 photos · 4 videos total — nothing
of value; 111 have a few stray media files whose GCS bytes get orphaned at teardown.

Fresh-empty junk ("test test test") couldn't be deleted under the stale rule (≤3 entries + no
content activity ≥1yr) — bucketed `glossary`/`conlang` by intent; a NEXT sweep (re-run
`build-assignments.js` against fresh stats) graduates them to delete.

✅ **2026-07-12 conlang/glossary purge (Jacob-approved):** deleted 344 conlang/glossary dicts with
<10 entries AND no content edit (per-dict `MAX(updated_at)` across content tables) AND no member
`last_visit_at` within 6 months. Executed by batch-driving `DELETE /api/dictionaries/[id]` from
inside the container with a minted admin JWT; shared.db backed up first
(`shared.db.bak-20260712-105523`+). 344/344 succeeded, 344 `dictionaries` tombstones written.
Record: `scripts/one-off/2026-07-12-purged-conlang-glossary.csv`. Remaining conlang/glossary:
468 + 163 = 631 (253 of them still <10 entries but had recent activity — recheck in a future sweep).

### Notables for Jacob's in-app review before deleting
- **`river`** — 8,692 entries + 4,733 audio, kept `unlisted`; worth a look.
- **`tla-wilano`** — 1,034 entries + 704 audio, answered YES to conlang on the old form → `conlang`.
- Team/test dicts kept OUT of delete (fresh activity): `jacob-test2`, `test-004`,
  `example-v4-senses`, `test-language-x`, `test-german` → all `glossary`; hand-delete whenever.
  `sugtstun-test` kept `unlisted` (referenced in `DICTIONARIES_WITH_VARIANTS` constant!).
- Media-heavy conlangs (future media-squash targets): `leshing` (2,460 audio / 2,159 photos),
  `orich` (1,180 audio), `taharini` (806 audio).

## Part 2 — consolidate `dictionaries.public` → `bucket` (design, later)

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
- Related: `.issues/admin-media-storage-dashboard.md` (orphaned-media visibility feeds the GCS
  harvest), `.issues/sandbox-playground-dictionaries.md` (stops new junk at the source).
