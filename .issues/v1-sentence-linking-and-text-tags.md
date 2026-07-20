# v1 sentence linking correctness + standalone sentences + text tags in reads

Source: agent feedback threads (prod shared.db, marked resolved 2026-07-19 — this issue is the tracking):
- `df173af2-605d-4f75-84c2-1026b1b2e86e` (文山话 / Poly Tutor importer, 2026-07-18) — findings 1 + 2
- `cf6809b0-1c26-495d-8c61-9cb3b41fb003` (River, 2026-07-18) — gap 13 (standalone sentences)

## Direction statement (Jacob, 2026-07-19 — the model this work serves)

> "In the future I don't want to have any sentence text ever inside of a sense table row. Every
> sentence, whether you call it a sentence or an example sentence, is just a sentence. If it also
> serves as an example, then it's linked by ID. The data itself never lives inside a sense row."

Storage already conforms (`sentences` table + `senses_in_sentences` junction; senses hold no sentence
content) — this work makes the API honor it: **linking an existing sentence by id must be a
first-class, reliable operation**, and sentences must be creatable without smuggling them in through a
sense or a text.

## 1. Fix the id-only link SILENT DROP (bug — the trigger for this issue)

`PATCH /entries/{id}` with `senses[].example_sentences: [{ id: "<existing-sentence-uuid>" }]` (no
content fields) is **silently discarded** and the PATCH still returns 200. Cause:
`build_sentence_rows` (`$lib/db/server/v1-entry-write.ts:97`) returns `null` when
`!text && !translation && !sources && !tokens`, and both call sites (create ~line 135, patch ~line 511)
skip null without error. The importer's workaround was re-sending the identical text so the field-merge
path linked it.

**Fix (Jacob decision: support id-only linking, don't 400 the valid case):**
- If the ref's `id` matches an existing `sentences` row in this dict → create the
  `senses_in_sentences` link (dedupe: skip if the link already exists). No content re-write.
- If the ref has an id NOT found and NO content fields → **fail that item loudly** (400 semantics via
  the per-item `results` error, matching how other item failures surface) — never silently drop.
- Same behavior in POST create + PATCH paths. If content fields ARE present alongside a known id, the
  existing upsert/field-merge semantics stay.
- Tests: id-only link of existing sentence (created via a text) → junction row exists; unknown-id-only
  → item failed with clear message; re-send idempotent (no dup junction).

## 2. Standalone sentence create

Grammar sections attach existing sentences ONLY (`POST …/sections/{id}/sentences` takes
`{ sentence_id }`); today a sentence can only be born inside a sense (`example_sentences`) or a text.
Free-floating grammar examples get smuggled in as fake sense examples or a container text.

- New `POST /api/v1/dictionaries/{id}/sentences` accepting `SentenceInput` (full IGT fields: text,
  translation, tokens, citations, example_label, discourse_role, sources). `sort_key`/`text_id` stay
  NULL (the schema already documents "NULL for standalone example sentences").
- Returns the sentence record; agent then links it wherever (sense via #1, grammar section via the
  existing attach, text NOT — text sentences stay text-owned).
- `GET /sentences/{sentenceId}` already exists (surgical endpoints); confirm it reads standalone rows.
- This makes inline-SentenceInput-at-grammar-attach unnecessary — do NOT add that (one way to do it).
- openapi + guides ("creating grammar examples" flow: create sentence → attach to section).

## 3. Text tags in text reads + tag filtering

`text_tags` exist and are writable (`POST …/texts/{id}/tags`) and readable ONLY via the dedicated
`GET …/texts/{id}/tags`. The importer needed tag-based filtering (marking one text `sensitive-cn` for
their China app) and ended up hardcoding a text id in their pull script.

- Include `tags` on text reads: `GET /texts` list items + `GET /texts/{textId}` full record
  (`list_text_tags` exists in `v1-texts.ts:428`; batch the list-view query — one query for all page
  items, pattern = entries `include=senses`). Present only when non-empty (v1 convention).
- Add `tag` query filter to `GET /texts` (match by tag name, case-insensitive, same normalization as
  `tag_name_key`): `?tag=sensitive-cn` → only texts carrying it.
- openapi: TextSummary/TextFull `tags`, list `tag` param; note in the texts guide.

## Acceptance
- `pnpm test` (new tests per section) / `tsc` / `pnpm lint` / `pnpm check` clean.
- Live dev smoke: create standalone sentence → id-only link it to a sense → attach to a grammar
  section → tag a text → filter list by tag (api-endpoint skill flow).
- `.knowledge/api/v1-write-api.md`: document id-only linking semantics + standalone sentences.
