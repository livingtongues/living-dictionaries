# Importing a dictionary: the orchestration guide

You are importing someone's language materials into a Living Dictionary through the
`/api/v1` API. **Always start here**, whatever the source format; the format guides
(`/api/v1/guides/spreadsheets`, `flex-lift`, `pdf-scans`) cover parsing details.

The work has two phases, in strict order:

1. **Data preparation** — inspect, question, stage locally, review by eye, clean,
   get human sign-off. **No API writes happen in this phase.**
2. **API usage** — register the source, write in idempotent batches, verify,
   repair, report.

Rushing to phase 2 is the classic failure mode: an import can be technically
flawless and still wrong because the data wasn't understood. This is someone's
real language; agent time is cheap and human review time is precious — spend
yours generously so theirs is spent only on decisions.

---

## Phase 1 — Data preparation (before you touch the API)

### 1.1 Inspect the resource

- **Never trust the file extension.** A "`.db`" may be a Toolbox SFM text file,
  not SQLite; a "`.csv`" may be tab-separated. Check magic bytes / run `file`,
  then read the head yourself.
- Detect the **encoding** (UTF-8 vs legacy codepages, mojibake, NFC/NFD
  normalization of diacritics) before parsing anything.
- **Profile the structure**: which markers/columns exist, how often each occurs,
  which are always empty, which repeat within a record, min/max/median value
  lengths, records per structural shape. Empty-looking fields and outliers are
  where surprises live.
- Read the resource's own front/back matter and first records — compiled
  dictionaries often open with prose about the alphabet, orthography, and
  abbreviation conventions that decodes the rest of the file.

### 1.2 Ask the human the linguistic questions inspection raises

Initial inspection always surfaces questions only a human (the requester, or the
dictionary's manager) can settle. **Batch them** — present each with the evidence
and your recommended answer, and don't proceed on the consequential ones without
an answer. Typical questions:

- Which **gloss/translation languages** does the material actually contain, and do
  they match the dictionary's configured gloss languages?
- What do **unknown markers, columns, or abbreviation conventions** mean?
- How does the source mark **homographs**, and should its numbering carry over?
- **Provenance**: who compiled this, when, from what — feeds the source row (§2.2).
- **Orthographies vs dialects** — the most consequential modeling fork for
  multi-variety material; decide UP FRONT which model fits:
  - **Same speech, different writing systems** (a romanization + a native script,
    competing spelling conventions): ONE entry per word, with each spelling stored
    under its own orthography key inside `lexeme`
    (`{ "default": "...", "sat-Olck": "..." }`). Register each writing system via
    the orthographies endpoint first.
  - **Different speech varieties** (dialects that pronounce/word things
    differently): SEPARATE entries, each tagged with its `dialects: ["Coastal"]`,
    linked with a `dialectal_variant` relationship when they name the same concept.

  Mixing these up is very costly to repair — when unsure, ask.

### 1.3 Stage everything locally

Parse the whole resource into a local staging store you can query and re-generate
from — **JSONL rows** for flat data, a **local SQLite db** when the data is
relational (entries + senses + examples + texts, or cross-references between
records). One row per source record, carrying:

- the **verbatim original** (so nothing is ever lost and every cleanup is diffable)
- the cleaned/parsed fields and their **proposed API field mapping**
- **flags** for anything odd, and a note of which cleanup rules touched the row
- a **source locator** (line number, page, record id) for tracebacks
- the record's **deterministic id** (uuid5 of a stable source key) — assigned here,
  not at POST time

The staging store is the single source of truth for everything downstream: the
preview (§1.5) and the API payloads are both generated from it, never hand-edited.

### 1.4 Pore over the data — by eye, in large amounts

This is the longest step and the reason phase 1 exists. Do not sample five records
and declare victory: **read hundreds of records, scan thousands**, sorted and
grouped different ways (by length, by punctuation, by rare characters, by
structural shape). You are looking for errors, corruption, inconsistencies, and
structure hiding in prose. Real catches that only bulk eyeballing finds:

- A **second language hiding inside another field** — one import assumed a source
  held only Spanish glosses; reading records in bulk revealed Guaraní equivalents
  embedded inside the Spanish definition strings (`… guaraní "¡haley!"`). No
  marker, column, or heuristic flagged it.
- Separator and markup noise (trailing `;` on thousands of values), word-wrap
  overflow glued to the wrong field.
- **Structured data hiding in prose**: plural forms (`pl amyepeyk`), person/gender
  paradigm tags (`2/3PMS`), literal-translation asides (`lit "…"`), etymologies
  and usage examples packed into a definition — each belongs in its own API field,
  not left as noise inside a gloss.
- The **headword leaking into its own gloss/definition**.
- Cross-references (`véase X`, `variante de X`) that should become entry
  relationships, not prose.
- Senses wrongly split or merged by the source's own line formatting.

Method: when you find an issue, **quantify the class across the whole dataset**
(query the staging store), decide a rule, and mass-apply it. Whatever doesn't fit
a pattern gets a **manual pass, item by item** — no shortcuts, and no cheap
proxies (string length does NOT distinguish a gloss from a definition; read the
content and judge each value). Record every rule and every manual decision in the
staging rows so the cleanup is auditable and re-runnable from the original.

### 1.5 Render a human-readable preview

Before any write, produce a **`preview.html`** (or equivalent): a designed,
readable dictionary-entry view — never a raw JSON dump — showing:

- a **diverse sample** (~20–40 entries) covering every structural shape: single- and
  multi-sense, homographs, empty/minimal records, the longest values, the weirdest,
- **every flagged or manually-decided case** (the full list when it's small),
- lifted/relocated data made visible (notes, plural forms, cross-references), so
  the human can see where things will land.

The human reviews meaning and correctness; your job is to make that effortless.

### 1.6 Get sign-off, in batches

Two natural checkpoints: the inspection questions (§1.2) up front, and the
cleanup rules + preview review before writing. Batch questions rather than
trickling them; propose a recommended answer for each. Only after the human signs
off on the preview do you enter phase 2.

---

## Phase 2 — API usage

### 2.1 Before you write anything

1. `GET /api/v1/dictionaries/{id}` — confirm gloss languages, orthographies, and
   current entry count against what phase 1 established. If the material uses a
   gloss language or writing system the dictionary doesn't have yet, add it first
   (`POST …/gloss-languages` with `{ "code": "fr" }` / the orthographies endpoint).
2. `GET /api/v1/dictionaries/{id}/files` — the uploaded resources, each with the
   uploader's `import_instructions` (authoritative — follow them) and optional
   `source_note`. Download each via `GET …/files/{fileId}`. (You did this in
   phase 1; re-check instructions haven't changed.)
3. Read `?view=index` of the OpenAPI spec, then pull the tags you need
   (`?tag=entries`, `?tag=texts`, …).

### 2.2 Register a source for every import

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

### 2.3 Writing the data

- **Generate a UUID yourself for every entry** and send it as `id` — it is the
  idempotency key (re-POST of the same id is a safe no-op) and your handle for later
  `PATCH` fixes. Use the deterministic ids from your staging store (§1.3).
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

### 2.4 Verifying an import

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

### 2.5 Repair & re-sync semantics

`PATCH` is **field-merge and never deletes**. Re-syncing a corrected source over an
earlier import updates the fields you send but leaves stale data behind:

- A sense/sentence dropped from your corrected source is NOT removed by re-PATCHing
  the entry — `DELETE …/senses/{id}` / `DELETE …/sentences/{id}` explicitly.
- `dialects`/`tags` in a PATCH are ADDITIVE. Unlink a wrong one from a single entry
  with `DELETE …/entries/{entryId}/tags/{tagId}` (or `…/dialects/{dialectId}`) —
  these unlink routes exist and the tag/dialect survives elsewhere.
- Deterministic ids (uuid5 of your source key) make re-syncs address the same
  rows every time — the repair path stays surgical instead of delete-and-reimport.

### 2.6 Recovering from a bad import

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

### 2.7 Report

Reply to the requester with: what was imported, counts, the `import_id`, decisions
you made (cleanup rules applied, skipped sections, source rows created), and
anything needing human review.
