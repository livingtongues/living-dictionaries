# v1 API quick wins — small additive fields, enums, endpoints, docs

## Progress (2026-07-19 session)
- ✅ 1. Source type enum widening (constants + schema comment + openapi derives from constant + EN i18n; EditSource select iterates the constant)
- ✅ 2. `homograph` — migration + schema + v1 write/patch/read + openapi (UI display pending below)
- ✅ 3. `homophone` relationship type (constants + EN labels; UI/openapi derive from constant)
- ✅ 4. Entry citations — migration + v1 write/patch + slug validation + integrity sweep + openapi (UI pending)
- ✅ 5. Sense sources — migration + v1 + sweep + openapi (UI pending)
- ✅ 6. Text metadata — migration (citations/summary + text_dialects table w/ triggers) + v1 create/patch/read + openapi
- ✅ 7. Parallel texts — `texts.work_id` + `parallel_texts` read + openapi (reader UI pending)
- ✅ 8. EntrySummary sources (+ homograph) unconditionally
- ✅ 9. Gloss-language endpoints — `$lib/db/server/gloss-languages.ts` + POST/DELETE routes + openapi + tests (delete guarded by usage scan)
- ✅ 10. Guide tips — importing.md (pagination gotcha, repair/re-sync, batch-length hard-fail, orthographies-vs-dialects, verifying-an-import, homograph, tag-unlink surfaced) + openapi description notes + feedback maxLength 4000
- ✅ 11. Snapshot docs fixed ("every dictionary except secure") on landing + openapi; new `guides/snapshot.md`
- ✅ New tests: v1-entry-write quick-wins fields, v1-texts.test.ts (new file), gloss-languages.test.ts; updated openapi.test inventories + v1-sources counts
- ✅ UI displays: homograph superscript (list + entry page + CSV column), entry citations locators on the sources chips, sense sources block (editable, reuses EntrySource), text reader summary (markdown) + dialect chips + "Other versions" links; svelte-look verified (new stories: ListEntry HomographNumberSuperscript, EntrySource WithCitationLocators); fixed pre-existing dark-mode-unreadable EntrySource chip (hardcoded blue-100 → theme-aware)
- ✅ tsc / lint / check / full vitest clean; live dev smoke on `achi` (source w/ hymnal type, entry w/ homograph+citations+sense sources, summary+detail reads, parallel texts w/ dialects, gloss-languages add/reject/remove, homophone relationship, snapshot guide, remove_from_all sweeping citations+senses) — all verified then cleaned up
- ✅ Knowledge updated: `.knowledge/api/v1-write-api.md` (2026-07-19 section + snapshot-scope correction)

**DONE 2026-07-19.** Not committed.

Notes for resuming: integrity sweep now also strips `citations` arrays (entries/sentences/texts)
and counts them in `count_source_references` (new `senses` + `citations` keys — sources page
usage query updated to match). `text_dialects` added to DICT_SYNCABLE_TABLES + dict-writes
JUNCTION_TABLES + delete cascade re-declared in the 20260719 migration.

Source: agent feedback threads (prod shared.db, all marked resolved 2026-07-19 — this issue is the tracking):
- `700caf98-9e2f-4953-b2a9-d3c7a9a4a45a` (文山话 / Poly Tutor importer, 2026-07-17) — source type enum
- `cf6809b0-1c26-495d-8c61-9cb3b41fb003` (River corpus agent, 2026-07-18) — items 1, 4, 5, 6, 7, 10, 11, 12 + guide tips
- `f160d92d-942e-4261-bcc7-748919549f3b` (River, 2026-07-18) — `homophone` relationship type

Everything here is small, additive, and independently shippable. Verified missing against the codebase
2026-07-19. Related-but-separate: `.issues/v1-sentence-linking-and-text-tags.md`, `.issues/v1-bulk-ops.md`,
`.issues/media-by-reference.md`, `.issues/cognate-sets.md`, `.issues/snapshot-edge-cache.md`.

**Jacob's decisions (2026-07-19, don't re-ask):** extend the closed source-type enum (no free text);
group work as packaged here; snapshots are the bulk-read answer (no JSONL endpoints).

## 1. Source type enum widening
`SOURCE_TYPES` (`$lib/constants.ts:49`) is `dictionary/wordlist/fieldwork/manuscript/other`. Add:
**`video`, `grammar`, `phrasebook`, `hymnal`, `primer`, `corpus`** (keep closed enum, `other` stays catch-all).
- Touch: `constants.ts`, schema doc-comment (`dictionary.ts` ~427), openapi source schemas, the
  `/[dictionaryId]/sources` page type select + its stories, i18n `type_*` keys (EN files ONLY — other
  locales come from the DB/translators).
- No migration: column is plain text; the enum is code-level validation. Existing `other` rows stay.

## 2. `homograph` field on entries
Printed dictionaries number homographs (caws1…caws6 as separate entries); today they render as identical
bare headwords, indistinguishable from accidental duplicates. Add nullable `homograph` (text, short —
holds "1", "2", also "a"/"b" if a source uses letters).
- dict.db migration (new date-prefixed `.sql`) + `dictionary.ts` schema + `dictionary.types.ts`.
- v1: `EntryInput`/`EntryPatch` + openapi (entry input, EntrySummary, EntryFull).
- Display: superscript after the lexeme in the entries list item + entry page header (`<sup>`); include
  in CSV export columns. Search/Orama: display-only (no index change needed).
- Also feeds the homophone-set UX in `.issues/media-by-reference.md` (members = same lexeme+dialect,
  distinct homograph numbers).

## 3. `homophone` global relationship type
Add to `RELATIONSHIP_TYPES` (`$lib/constants.ts:106`): `homophone: { symmetric: true, inverse_slug: 'homophone' }`.
Fundamental, symmetric, orthogonal to `spelling_variant` (same word/different spelling vs different
words/same sound); can join DIFFERENTLY-spelled entries that sound identical (which the homograph field
cannot express). No migration (slugs stored as strings). Touch: constants, openapi relationship enum
(check whether it derives from the constant), relationship display label i18n (EN only), dedupe/
canonicalization is automatic for symmetric types.

## 4. Entry-level citations
Sentences already carry `citations: SourceCitation[]` (`{slug, locator}` — page/example number);
entries only have bare `sources[]` slugs, so per-entry page numbers (always known for scanned
dictionaries) have nowhere to live.
- dict.db migration: `entries.citations` (JSON, `SourceCitation[]` — same shape/validation as sentences:
  slugs must exist in the sources registry).
- v1: `EntryInput`/`EntryPatch.citations` (reuse `to_citations` + `assert_known_source_slugs` from
  `v1-entry-write.ts`), read shapes, openapi.
- Display: entry page sources block shows `slug:locator` (locator after the source link, muted).

## 5. Sense-level sources
Create-vs-enrich merges senses from several sources onto one entry, but `SenseInput` has no `sources` —
per-sense provenance is lost.
- dict.db migration: `senses.sources` (JSON string[], slug refs, same no-FK + write-validation +
  integrity-sweep-on-source-delete convention as entries/sentences — find the sweep in the source-delete
  path and add senses to it).
- v1: `SenseInput`/`SensePatch.sources`, `include=senses` read shape, openapi.
- Display: minimal — sense block shows source slugs like entry does.

## 6. Text-level metadata
`texts` has `title` + `sources[]` (sources column EXISTS but is NOT writable/readable via v1 —
`TextCreateInput` is id/title/sentences only). Feedback: importers repeat metadata per sentence or drop it.
- Make `sources` writable/readable on text create/patch (validated slugs).
- dict.db migration: `texts.citations` (SourceCitation[]) + `texts.summary` (MultiString) + new
  `text_dialects` junction (`text_id`, `dialect_id`, timestamps, dirty/server_seq — mirror
  `entry_dialects`/`text_tags` conventions).
- v1: `TextCreateInput`/`TextPatchInput` gain `sources`, `citations`, `summary`, `dialects` (dialect
  names found-or-created, like entries). Reads expose all four. openapi.
- Display: reader page header shows summary (rich-text-safe MultiString render) + dialects chips.

## 7. Parallel texts (asked TWICE: River #7 + comparative-dialectology item 5)
Same text in two DIALECTS (hymnal/scripture — each needs its own wording + audio). Options considered:
- (a) pairwise `text_relationships` table — mirrors entry_relationships but overkill for grouping N versions
- (b) **`texts.work_id`** (nullable text, agent-supplied or minted) — texts sharing a `work_id` are
  versions of one work. **Recommended**: one nullable column, no junction, groups N≥2 naturally.
- Reads: text detail includes `parallel_texts: [{id, title, dialects}]` (siblings by work_id).
- v1 writable on create/patch. UI: reader page "Other versions" links (side-by-side reading is future).
- With #6's `text_dialects`, per-version dialect metadata is covered.

## 8. Entries list: sources on summaries
`EntrySummary` omits `sources`; agents do per-entry detail fetches just for provenance checks.
Simplest fix (recommended): include `sources` (slug array, small) in EntrySummary UNCONDITIONALLY —
cheaper than plumbing an `include=sources` flag; it's one column already selected in the row. Update
openapi EntrySummary schema + note in the changelog section of the description.

## 9. Gloss-language add endpoint
No API path to add a gloss language — a French-glossed source into an en/zh dictionary needs out-of-band
admin first. Mirror the orthographies pattern (per AGENTS.md human/agent parity: shared server module
backs both surfaces — see `$lib/db/server/orthographies.ts` + `routes/api/v1/…/orthographies/`):
- `POST …/gloss-languages` `{ code }` (+ maybe `DELETE …/gloss-languages/{code}` — only if the dict-home
  UI supports removal; check what the human surface allows and match it).
- Validates against `glossing-languages-list.json`; writes `dictionaries.gloss_languages` (shared.db
  catalog — set `dirty=1`, bump `updated_at`).
- Manager+ (write key). openapi + landing cheat-sheet mention.

## 10. Docs / guide tips (all docs-only, from River's "learned the hard way" list)
- Entries list caps at 500 regardless of `limit` — guides should say "paginate by RETURNED length while
  `has_more`" (a hardcoded `len < limit` break silently truncates when limit > 500).
- PATCH is field-merge and never deletes — add a "repair & re-sync semantics" section to the import
  guide (stale tags/senses must be DELETEd explicitly; point at the surgical-cleanup endpoints).
- Recommend hard-failing any batch whose `results.length != chunk length` (catches redirects turning
  POST into GET).
- An "ORTHOGRAPHIES vs DIALECTS" note: same speech one entry MultiString keys, vs separate entries +
  relationships — the most consequential modeling fork for multi-variety dictionaries.
- A "verifying an import" guide: exact-match lookups, `updated_since` diffs, per-import_id counts.
- Feedback endpoint: document the 4000-char max in the openapi spec.
- Entry tag UNLINK already exists and is documented (`DELETE …/entries/{entryId}/tags/{tagId}`) — the
  07-18 feedback claiming it's missing was wrong; no work, but consider surfacing it in the guides'
  repair section since an active agent missed it.

## 11. Snapshot docs corrections (Jacob-confirmed)
The landing page (`routes/api/v1/+server.ts:53`) and openapi (`openapi.ts:940`) both say snapshots exist
for "public and unlisted" dictionaries. WRONG — the builder (`r2-snapshot-builder.ts:127`) snapshots
**every dictionary except `bucket='secure'`**. Fix both texts: "every dictionary except secure ones".
Additionally (Jacob directive): **the API docs should TEACH agents how to load their snapshot** — add a
guide (`$lib/api/v1/guides/`, e.g. `snapshot.md`, listed at `/api/v1/guides`) covering: URL shape (dict
id, not slug), gunzip, open read-only with sqlite, the key tables (entries/senses/sentences/
senses_in_sentences/texts/audio/speakers/dialects/tags/sources + junctions), that it's a read mirror
(never write), freshness semantics (~30-min sweep, only-on-change; 120s CDN cache — after
`.issues/snapshot-edge-cache.md` lands), and that secure dicts must paginate the API instead.

## Acceptance
- `pnpm test` / `tsc` / `pnpm lint` / `pnpm check` clean; openapi.test.ts inventories updated.
- New columns reach clients via normal migration flow (server + admin/dict clients run the same .sql).
- `.knowledge/api/v1-write-api.md` updated with the new fields/endpoints.
- Live dev-server smoke of one write+read per new field (see api-endpoint skill).
