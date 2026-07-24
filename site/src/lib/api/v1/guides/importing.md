# Importing a dictionary: the orchestration guide

You are importing someone's language materials into a Living Dictionary through the
`/api/v1` API. This guide is the workflow; the format-specific guides
(`/api/v1/guides/spreadsheets`, `flex-lift`, `pdf-scans`) cover parsing.

## Before you write anything

1. `GET /api/v1/dictionaries/{id}` — learn the gloss languages, orthographies, and
   current entry count. If the source material uses a gloss language or writing
   system the dictionary doesn't have yet, add it first (`POST …/gloss-languages`
   with `{ "code": "fr" }` / the orthographies endpoint) or ask the requester.

### Orthographies vs dialects — the most consequential modeling fork

For multi-variety material, decide UP FRONT which model fits:

- **Same speech, different writing systems** (a romanization + a native script,
  competing spelling conventions): ONE entry per word, with each spelling stored
  under its own orthography key inside `lexeme` (`{ "default": "...", "sat-Olck": "..." }`).
  Register each writing system via the orthographies endpoint first.
- **Different speech varieties** (dialects that pronounce/word things differently):
  SEPARATE entries, each tagged with its `dialects: ["Coastal"]`, linked with a
  `dialectal_variant` relationship when they name the same concept.

Mixing these up is very costly to repair — when unsure, ask the requester.
2. `GET /api/v1/dictionaries/{id}/files` — the uploaded resources, each with the
   uploader's `import_instructions` (authoritative — follow them) and optional
   `source_note`. Download each via `GET …/files/{fileId}`.
3. Read `?view=index` of the OpenAPI spec, then pull the tags you need
   (`?tag=entries`, `?tag=texts`, …).

## Register a source for every import

**Every import gets a `sources` registry row** — even when the uploader gave no
citation and the material looks like an unpublished working file. Untraceable
data is a permanent cost; a best-effort source row is cheap and the dictionary's
manager can refine it later.

1. `POST …/sources` with a **simple, stable `slug`**. Prefer `author-year`
   (e.g. `smith-1979`) when known; with unknown provenance use something short
   and generic (e.g. `enxet-lexicon`). The slug is the permanent key stamped on
   every record, so keep it plain enough to still fit after the manager improves
   the citation. Include full `citation`, `abbreviation`, `author`, `year`,
   `type` (dictionary/wordlist/fieldwork/manuscript/video/grammar/phrasebook/
   hymnal/primer/corpus/other), and `orthography` if its forms use a specific
   script.
   - If the uploader's `source_note` is thin or absent, write a **best-effort
     citation from what you can observe** (title page, colophon, file format,
     language pair, uploading organization). Describing observed facts is not
     inventing data — but never guess authorship or publication details; write
     "author and publication details unrecorded" instead and let the manager
     iterate on it.
2. `PATCH …/files/{fileId}` with `{ "source_id": "<the new source's id>" }` so the
   original file lives permanently behind its source.
3. Stamp imported records: entry/sense/sentence/text `sources: ["smith-1979"]`, and
   use `citations: [{ "slug": "smith-1979", "locator": "p. 31" }]` on entries,
   sentences, and texts when you know the page/example number (for a scanned
   dictionary you always do — record it).

## Writing the data

- **Generate a UUID yourself for every entry** and send it as `id` — it is the
  idempotency key (re-POST of the same id is a safe no-op) and your handle for later
  `PATCH` fixes. Keep a local ledger mapping source-record → uuid.
- **Batch** `POST …/entries` with `{ "entries": [...], "import_id": "<slug>-2026-07" }`
  in batches of ≤1000 entries (and ≤~16MB per request). The `import_id` becomes a
  private tag so the whole batch can be found or cleaned up later.
- **Hard-fail any batch whose `results.length` differs from the chunk you sent.**
  A mismatch means the request didn't reach the endpoint as intended (a classic
  cause: an http→https or trailing-slash redirect silently turning your POST into
  a GET). Never mark such a chunk done.
- Numbered homographs in the source (caws1…caws6) are separate entries — carry the
  number in each entry's `homograph` field so they stay distinguishable.
- **Relationships batch too**: for cognate ledgers and other large relationship
  sets, `POST …/relationships` with `{ "relationships": [...] }` in batches of
  ≤1000 — same per-item `results` contract as entries (`created`/`exists`/`failed`
  in input order; retries are safe, re-POST only the `failed` ones).
- Connected texts (stories, example paragraphs) are NOT entries — use the
  `…/texts` endpoints; interlinear glossed text goes in sentence `tokens`.
  Text-level metadata (sources, `citations`, `summary`, `dialects`, `work_id` for
  parallel versions) lives on the TEXT — don't repeat it on every sentence.
- A sentence is a first-class row, not content stored inside a sense. For a
  free-standing grammar example, `POST …/sentences` with the full sentence/IGT
  payload, then attach the returned `sentence.id` to a grammar section with
  `POST …/grammar/sections/{sectionId}/sentences`. If the same sentence is also
  an example for a sense, link it by PATCHing that sense with
  `example_sentences: [{ "id": "<sentence-id>" }]`; this does not copy or rewrite
  the sentence. Re-linking is idempotent, and an unknown id-only reference fails.
- Text classification tags created through `POST …/texts/{textId}/tags` are
  included directly in both text list and detail reads. Use
  `GET …/texts?tag=sensitive-cn` for an exact, case-insensitive tag-name filter;
  this avoids hardcoding text IDs in downstream consumers.
- Never invent data. If glosses/POS are ambiguous in the source, leave the field
  empty rather than guessing, and note it in your report.

## Verifying an import

- **Live counts / full sweeps**: paginate `GET …/entries` (`updated_at` ASC).
  `limit` is silently capped at 500 — advance `offset` by the number of entries
  RETURNED while `has_more` is true, never by your requested limit (a
  `returned < limit` break-condition silently truncates). Do NOT use the
  dictionary's `entry_count` to verify a fresh import — it is eventually-consistent
  and lags (it can read 0 right after a bulk POST).
- **Exact-match lookups**: `GET …/entries?lexeme=<word>&match=exact` finds an entry
  by any orthography's exact spelling; `?elicitation_id=` for word-list ids.
- **Diffs since a timestamp**: `?updated_since=<ISO>` (exclusive) lists what changed —
  handy for confirming exactly what your run touched.
- **Per-import counts**: your `import_id` is a private tag on every imported entry —
  `POST …/entries/batch-delete` with `{ "import_id": "…", "dry_run": true }` returns
  the batch's live count without deleting anything.
- **Big-import verification**: instead of paginating the whole dictionary, download
  its gzipped SQLite snapshot and run COUNT/spot-check queries locally — see
  `GET /api/v1/guides/snapshot` (rebuilt within ~30 min of an edit, so use API reads
  to verify writes you made moments ago).
- Spot-check ~10 imported entries against the source (diacritics intact, glosses on
  the right senses, examples attached to the right entries).
- For grammar examples, verify the standalone sentence via
  `GET …/sentences/{sentenceId}` after creating and attaching it.

## Repair & re-sync semantics

`PATCH` is **field-merge and never deletes**. Re-syncing a corrected source over an
earlier import updates the fields you send but leaves stale data behind:

- A sense/sentence dropped from your corrected source is NOT removed by re-PATCHing
  the entry — `DELETE …/senses/{id}` / `DELETE …/sentences/{id}` explicitly.
- `dialects`/`tags` in a PATCH are ADDITIVE. Unlink a wrong one from a single entry
  with `DELETE …/entries/{entryId}/tags/{tagId}` (or `…/dialects/{dialectId}`) —
  these unlink routes exist and the tag/dialect survives elsewhere.
- Deterministic ids (uuid5 of your source key) make re-syncs address the same
  rows every time — the repair path stays surgical instead of delete-and-reimport.

## Recovering from a bad import

When a whole batch is wrong (mis-mapped columns, wrong dictionary, duplicated run),
don't issue thousands of single DELETEs — remove the batch by its `import_id`:

1. **Dry-run first**: `POST …/entries/batch-delete` with
   `{ "import_id": "<the one you used>", "dry_run": true }` →
   `{ count, sample_entry_ids }`, no writes. Sanity-check both against your ledger.
2. **Arm the real run** by echoing that count:
   `{ "import_id": "…", "confirm_count": <count> }`. A mismatch with the live count
   is rejected (409) — the batch changed since your dry-run, so re-check before
   deleting. This stops a stale script from nuking a re-imported batch.
3. Deletes are sync-safe tombstones: each entry's senses and links cascade, and the
   emptied private `import_id` tag is removed too. **Orphaned standalone example
   sentences created by the import are left in place** — delete any that matter via
   `DELETE …/sentences/{sentenceId}`.
4. Re-import with the SAME deterministic ids — your ledger keeps addressing the
   same rows.

**Full reset**: a dictionary is fully emptied by batch-deleting each `import_id`
you used. If content predates your imports (or you've lost the ids), ask a Living
Dictionaries admin to reset the dictionary instead.

## Report

Reply to the requester with: what was imported, counts, the `import_id`, decisions
you made (skipped sections, source rows created), and anything needing human review.
