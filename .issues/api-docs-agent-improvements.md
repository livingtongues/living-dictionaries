# Agent-friendly Write API docs: improvements from a real black-box import

Source: an agent built a full PDF→API import using ONLY `/api/v1` + `/api/v1/openapi.json`
(no source access). These are the friction points it hit and the brief PDF guide it wishes had
existed. Apply to the served docs (the openapi.json generator + the `/api/v1` landing HTML) so the
NEXT agent succeeds from docs alone.

## A. What already worked well (keep)
- Landing page → `openapi.json` pointer; the 5-step import workflow; `import_id` private-tag tagging;
  `elicitation_id` dedupe; `external_id` echo for id-mapping; multilingual `string | {locale:text}`.
- These were followed verbatim and worked.

## B. Doc gaps to fix (ranked by how much they bit the agent)

1. **Document the GET/response shape (biggest friction).** The spec defines INPUT (`EntryInput`)
   thoroughly but not the **read** shape. `GET /entries/{id}` returns:
   ```json
   { "entry": { "main": { "lexeme": {"default":"…"}, "phonetic":null, "sources":[…],
                          "elicitation_id":"…", … },
                "senses": [ { "id":"…", "glosses":{"en":"…"}, "definition":null,
                              "parts_of_speech":null,
                              "sentences": [ {"id":"…","text":{"default":"…"},
                                             "translation":{"en":"…"},"text_id":null,
                                             "sort_key":null,"ends_paragraph":null} ] } ],
                "tags":[{"id","name","private"}] } }
   ```
   Add an `EntryFull` / `EntryResponse` schema to `components.schemas` and reference it from the 200s
   of `GET /entries/{id}` and `PATCH /entries/{id}`. Call out the **field-name asymmetry**: you POST
   `senses[].example_sentences` but you READ them back as `senses[].sentences`; scalars you POST at
   the top level come back nested under `entry.main`. (This broke the agent's verifier until it
   reverse-engineered the shape.)

2. **`entry_count` is eventually-consistent.** After importing 660 entries, `GET /dictionaries/{id}`
   still returned `entry_count: 0`. The import workflow says "note entry_count" — agents will use it
   to verify and be confused. Either document the lag ("updated asynchronously; for live counts
   paginate `/entries`") or update it on write.

3. **PATCH merge semantics — spell out the limits.** It's stated that example sentences append and
   tags/dialects are add-only, but make explicit: there is **no endpoint to edit or delete an
   individual sentence / tag / dialect**. An agent fixing an OCR typo in one example sentence cannot
   do so surgically (only scalar fields + lexeme + sense glosses are patchable). Consider adding
   sentence edit/delete, or at least document the limitation.

4. **List endpoint specifics.** Note `limit` max (500), default order (`updated_at ASC`), and that
   `has_more` drives offset pagination — handy for bulk dedupe (paginate once, build the
   `elicitation_id` set) vs. one `?elicitation_id=` query per entry.

5. **Scope note.** State that v1 covers entries/senses/sentences/speakers/tags/dialects but **not
   media** (audio/photo/video) — agents importing text won't go hunting.

6. **Clients.** (Edge block now fixed.) A one-liner: "any standard HTTP client works; sending a
   descriptive `User-Agent` is good practice." Removes doubt for urllib/requests users.

## C. Add a short "Import from a scanned/printed source" section to the landing page
Keep it BRIEF and tool-agnostic (tech changes fast) — just point agents the right way:

> **Importing from a PDF / scanned dictionary**
> 1. **Pages → images** at ~300 dpi (e.g. PyMuPDF/pdftoppm).
> 2. **OCR with a layout-aware vision-language model** (a DeepSeek-OCR-style document-parsing VLM
>    handles multi-column dictionaries well; pick a current one — they change fast). Where glyphs/diacritics look wrong on a
>    page, fall back to direct image inspection.
> 3. **Structure** the text into the entry shape: identify headwords (often numbered homographs;
>    in many orthographies they're short/monosyllabic), separate the vernacular phrase from the
>    gloss, and attach usages as `example_sentences`.
> 4. **Respect orthography** — validate tokens against the language's spelling rules; never
>    transliterate or "clean up" diacritics. Flag low-confidence OCR as a private tag (e.g.
>    `needs-review`) instead of inventing data.
> 5. **Import idempotently**: stable `elicitation_id` per source entry, `import_id` for the run,
>    batch ≤1000, read per-item `results`, re-send only failures, dedupe via `?elicitation_id=` (or
>    paginate `/entries`). Spot-check with `GET /entries/{id}`.

## STATUS (docs-only pass complete — 2026-06-30)

Implemented in `site/src/lib/api/v1/openapi.ts` + `site/src/routes/api/v1/+server.ts`:
- ✅ B1 — Added `EntryResponse`/`EntryFull`/`EntryMain`/`SenseFull`/`SentenceFull` read-shape
  schemas to `components.schemas`; referenced `EntryResponse` from the 200s of GET + PATCH
  `/entries/{id}`. Asymmetry (POST `example_sentences` → READ `sentences`; top-level scalars → READ
  under `entry.main`) called out in the schemas, the endpoint descriptions, and the workflow prose.
- ✅ B2 (docs only) — `entry_count` eventual-consistency documented on the dictionary endpoint, in
  workflow step 1, and on the landing page. (Actually updating the count = product decision, see below.)
- ✅ B3 (docs only) — PATCH limits spelled out: no edit/delete of an individual sentence/tag/dialect.
  (Adding sentence edit/delete endpoints = product decision, see below.)
- ✅ B4 — List endpoint: limit default 100 / max 500, order `updated_at ASC`, `has_more` pagination
  + bulk-dedupe hint. Verified against the real server constants/SQL.
- ✅ B5 — Scope note: v1 = entries/senses/sentences/speakers/tags/dialects, NOT media.
- ✅ B6 — Clients one-liner (any HTTP client; descriptive User-Agent).
- ✅ C — "Importing from a PDF / scanned dictionary" section added to the `/api/v1` landing page.

Verification: `openapi.test.ts` passes (5/5); `build_openapi_spec` output JSON.parses (25.2 KB) with
all new schemas + the two `EntryResponse` refs present; eslint clean on both files. Live fetch of
`new.livingdictionaries.app` deferred until deploy (dev server wasn't running locally).

### ⚠️ FLAGGED FOR JACOB — product decisions:
- **Actually update `entry_count`** on write → **REJECTED by Jacob** (2026-06-30): editors get live
  counts from the dictionary's search-tool totals; no need to maintain `entry_count` eagerly. Keep
  the eventual-consistency docs.
- **Add sentence/tag/dialect edit + delete endpoints** → **APPROVED by Jacob** (2026-06-30). See the
  implementation section below.

Not committed (awaiting Jacob's go-ahead).

## E. Surgical edit/delete endpoints (APPROVED — in progress 2026-06-30)

Jacob approved the **full set** (flat URLs by id). All editor-gated, all routed through the same
`merge_dict_row` (update) / `deletes` tombstone (delete) path as a human edit, so sync + history +
the shared.db `updated_at` mirror behave identically.

New endpoints (all under `/api/v1/dictionaries/{id}`):
- `PATCH /sentences/{sentenceId}` — field-merge `text` / `translation` (the core OCR-typo fix).
- `DELETE /sentences/{sentenceId}` — tombstone the sentence (FK cascade sweeps the `senses_in_sentences` junctions).
- `PATCH /tags/{tagId}` — rename / set `private` (affects every linked entry); name-collision guarded.
- `DELETE /tags/{tagId}` — delete the tag globally (cascade unlinks `entry_tags` everywhere).
- `PATCH /dialects/{dialectId}` — rename (string or MultiString); collision guarded.
- `DELETE /dialects/{dialectId}` — delete the dialect globally.
- `DELETE /entries/{entryId}/tags/{tagId}` — unlink ONE tag from ONE entry (tag survives elsewhere).
- `DELETE /entries/{entryId}/dialects/{dialectId}` — unlink ONE dialect from ONE entry.
- `DELETE /senses/{senseId}` — delete one sense (refuses the entry's LAST sense → use entry DELETE).

Implementation pieces:
- ✅ `delete_dict_row` primitive in `dictionary-sync-helpers.ts` (tombstone + cascade, returns a
  `delete` HistoryEvent). `apply_entry_delete` refactored onto it.
- ✅ `run_tombstone_delete` + `SingleWriteResult` orchestration in `v1-entry-write.ts` (txn +
  history + cursor), reused by both `v1-entry-write.ts` and `v1-sub-resources.ts`.
- ✅ `apply_sentence_update` / `apply_sentence_delete` / `apply_sense_delete` in `v1-entry-write.ts`.
- ✅ `apply_tag_update` / `apply_tag_delete` / `apply_dialect_update` / `apply_dialect_delete` /
  `unlink_entry_tag` / `unlink_entry_dialect` in `v1-sub-resources.ts`.
- ✅ `SentencePatch` input shape added to `entry-input.ts`.
- ✅ 6 new route files + `server.test.ts` coverage.
- ✅ OpenAPI spec: new paths + `SentencePatch` schema; "Edits & deletes" prose rewritten (no longer
  a limitation). Landing page "Editing & cleanup" section added.

### Verification (2026-06-30) — all green
- `pnpm vitest` v1 suites: **70 passed** (18 new tests across 6 new `server.test.ts` files +
  openapi schema/path-inventory assertions updated).
- `pnpm check` (svelte-check): **0 errors**, 0 warnings in touched files. ESLint clean.
- Live dev-server (`:3041`) smoke test: all 9 new routes resolve to their handlers (no-auth → **401**
  against a real local dict id); precision controls pass (PATCH on `/senses/{id}` → **405**; missing
  route → **404**). Served `/api/v1/openapi.json` lists all 6 new path entries with correct methods +
  `SentencePatch` schema and parses (32 KB); landing page shows the new "Editing & cleanup" section.

NOT committed (awaiting Jacob's go-ahead).

## D. Apply
A doc-improvement session can implement B+C in the openapi spec generator + landing template, then
verify the live `/api/v1` + `/api/v1/openapi.json` reflect them. Don't change request/response
behavior — docs only (except the optional `entry_count` / sentence-edit items, which are product
decisions for Jacob).
