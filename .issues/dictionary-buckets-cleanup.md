# Dictionary buckets — weed out junk, classify everything

Jacob wants the 2,232 production dictionaries classified into buckets so we can (a) delete
explorer-junk, (b) tolerate-but-contain conlangs/glossaries (media storage off for them later),
and (c) know who we actually serve.

## Decisions (interview 2026-07-04)

- **One new `dictionaries.bucket` column** (shared.db, syncable): `public | unlisted | secure | conlang | glossary | delete`
  - `public` = real + listed (all current public dicts are known-good)
  - `unlisted` = real private dictionaries we desire to serve
  - `secure` = FUTURE: key-code-locked dictionaries (no rows yet, reserved value)
  - `conlang` / `glossary` = tolerated cruft (media storage will be turned off for these — separate story)
  - `delete` = queued for teardown (mostly explorers who moved on)
- **Plus `public_at`** — when the dict first went public. No historical data → NULL backfill,
  stamped going forward (trigger on first publish).
- **Delete rule**: ≤3 entries AND no content activity for ≥1 year ("What's three entries from
  years ago? Not a dictionary"). Content activity only — a member's recent site login does NOT
  protect an empty dict. Stale 4–10-entry dicts get judged individually (obvious junk → delete).
- **NO deletion this round** — produce the list, review, delete in a later session (Q3=C).
- **Claude hand-classifies everything** (no LLM API calls) — judgment over name, conlang
  description, author_connection, sample lexemes/glosses, iso/glottocode/coordinates signals.
- **Review UI**: small /admin page to review + reclassify bucket assignments in-app (built this
  round). Jacob reviews there, then a later session executes the delete bucket.
- **Storage dashboard** (media bytes by dict/type/bucket): ISSUE ONLY this round → `.issues/admin-media-storage-dashboard.md`
- **Playground/sandbox** (let people play without creating junk): ISSUE ONLY → `.issues/sandbox-playground-dictionaries.md`

## Production findings (data pulled 2026-07-04)

- 2,232 dicts total; 221 public; 2,011 private.
- `con_language_description` non-empty ≈ self-declared conlang (create form checkbox fills
  `Source: … Use: …`). 1,038 have it — but false positives exist (e.g. Northern Michif import
  "This is not a conlang…", real Chiapas dict "No es artificial") → rescue skim needed.
- `updated_at` polluted by bulk re-stamps: 499 dict.db content rows on **2025-05-13**, 794
  catalog rows 2025-03. Composite activity signal instead:
  `max(dict created_at, entry created_at range, content writes AFTER 2025-05-14)`.
- Preliminary split (private): **630 delete** (≤3 entries + stale ≥1yr; 111 have stray media),
  **764 conlang-marked**, **617 gray** (mix of real gems — Ainu, Algonquin, Ancient Aramaic,
  A'ingae, Awakateko — unmarked conlangs, classroom glossaries).
- Existing teardown endpoint: `DELETE /api/dictionaries/[id]` (admin-only; shared.db tombstones +
  dict.db + history.db + R2 snapshot; GCS media harvest deferred).
- GCS media: S3-interop HMAC creds on VPS (`GCLOUD_MEDIA_BUCKET_ACCESS_KEY_ID/SECRET`), bucket
  `talking-dictionaries-alpha.appspot.com`, objects keyed `<dict_id>/...` → ListObjectsV2 sweep
  can aggregate bytes by dict/type (dashboard issue).
- Working data: `/tmp/dict-stats.jsonl` on mustang (per-dict counts, activity, samples) built by
  `/tmp/collect-dict-stats.js` run inside `sveltekit_blue` on living.

## Plan

1. ✅ Interview + data collection
2. ✅ Migration `20260704a_featured_entries_pivot_and_dictionary_buckets.sql`: `bucket` TEXT + `public_at` TEXT on
   `dictionaries`; `stamp_dictionary_public_at` trigger (UPDATE-only — an INSERT twin would
   mis-stamp historical public dicts during a client's initial sync). Drizzle schema +
   `DICTIONARY_BUCKETS` constant updated. Verified: all migrations apply + trigger behavior
   (first publish stamps; re-publish keeps; server stamp wins).
3. ✅ Classification → `scripts/bucket-classification/bucket-assignments.csv` (2,232 rows) built
   by `build-assignments.js` (deterministic rules + hand-review override lists, all reviewed by
   Claude across ~1,500 rows on 2026-07-04). Final counts:
   **public 221 · unlisted 396 · conlang 696 · glossary 269 · delete 650**.
   - KEY FINDING: `con_language_description` non-empty ≠ conlang for OLD-form dicts — the legacy
     form stored the answer text even when it was a denial ("No.", "Not a conlang…"). 66 real
     dictionaries rescued (Kalenjin 31k entries, the Dargwa dialect series, Tseltal, Garifuna,
     Biloxi, Tillamook…). NEW-form (`Source: … Use: …` template) = trustworthy self-declaration.
   - Stale 4–10-entry junk hand-moved to delete (18 dicts: hebreo, kabardian, test1234…).
4. ✅ Apply script `scripts/bucket-classification/apply-assignments.js` (runs in the container via
   ssh stdin; requires the migration deployed first; bumps updated_at ONLY — setting `dirty`
   server-side would echo rows back through admin client push).
5. ✅ /admin/buckets review UI (`site/src/routes/admin/buckets/`): per-bucket filter pills +
   counts, unclassified + mismatch views (bucket↔public disagreement), search, entry/member/
   iso/glottocode signals, conlang-desc snippet, one-click reassign via
   `db.dictionaries.update()`. Nav link added (compact). Stories + svelte-look verified
   light/dark incl. filter-click interactions. NOTE: filter is local $state initialized from
   `?bucket=` (goto try/caught — story harness has no router).
6. ✅ Side-quest issues: `.issues/sandbox-playground-dictionaries.md` +
   `.issues/admin-media-storage-dashboard.md`.
7. Ask Jacob → commit/push (deploy migration + UI) → run backfill (steps in apply script header)
   → he reviews in /admin/buckets.
8. LATER SESSION: execute delete bucket (backup tarball → R2 first, then batch-drive the
   existing teardown endpoint `DELETE /api/dictionaries/[id]`; GCS orphan sweep comes with the
   storage story).

## Notables for Jacob's in-app review

- **`river`** — 8,692 entries + 4,733 audio, created 2026-07, private, glosses look like a bulk
  import ("Exclamatory initial particle" ×many). Kept `unlisted`; worth a look.
- **`tla-wilano`** (Oli'ichi Tla Wilano, Ivanhoe VA) — 1,034 entries + 704 audio, answered YES
  to conlang on the old form → `conlang`; flag if you know better.
- Team/test dicts kept out of delete (fresh activity): `jacob-test2`, `test-004`,
  `example-v4-senses`, `test-language-x` (MELD sandbox, m7), `test-german` → all `glossary`;
  hand-delete whenever. `sugtstun-test` kept `unlisted` (referenced in
  `DICTIONARIES_WITH_VARIANTS` constant!).
- Media-heavy conlangs (squash targets): `leshing` (2,460 audio / 2,159 photos), `orich`
  (1,180 audio), `taharini` (806 audio).
- 111 of the 650 delete-bucket dicts have a few stray media files — GCS bytes get orphaned at
  teardown (harvest deferred to the storage story).
- Fresh-empty junk ("test test test", keyboard-mash) couldn't be deleted under the stale rule —
  bucketed `glossary`/`conlang` by intent; the NEXT sweep graduates them to delete. Re-run
  `build-assignments.js` against fresh stats then.

## Delete-bucket media totals (safety check)

650 dicts · 629 entries · 124 audio · 157 photos · 4 videos — nothing of value.

## Notes / gotchas

- Bucket is NOT auto-coupled to the `public` column for now; the review UI should surface
  mismatches (bucket='public' but public≠1 and vice versa). UI-level coupling when toggling.
- Mass updated_at bump on dictionaries rows = another restamp event (2026-07) — activity signal
  already avoids catalog updated_at, but note it here for posterity.
