# Importing a dictionary: the orchestration guide

You are importing someone's language materials into a Living Dictionary through the
`/api/v1` API. **Always start here**, whatever the source format; the format guides
(`/api/v1/guides/spreadsheets`, `flex-lift`, `pdf-scans`) cover parsing details.

## The runbook

**Phase 0 — set up the job**

1. Download every resource; read the uploader's instructions (they are authoritative).
2. `POST …/sources` for the work, then `PATCH …/files/{fileId}` with its `source_id`
   — do this before any data work, so every record you write is traceable.

**Phase 1 — data preparation (no data writes)**

3. Inspect and profile the material.
4. Ask the human the linguistic questions inspection raises.
5. Stage everything locally, verbatim + cleaned, from a re-runnable pipeline.
6. Pore over the data by eye, in bulk; clean with auditable rules + manual passes.
7. Render a human-readable preview from the final payload and get sign-off.

**Phase 2 — API usage**

8. Write in idempotent batches under one `import_id`, with a resumable ledger.
9. Verify counts and spot-check content against the source.
10. Leave a `review` task on every entry a human still has to decide.
11. Report, and leave a reply the requester can be sent.

Rushing to phase 2 is the classic failure mode: an import can be technically
flawless and still wrong because the data wasn't understood. This is someone's
real language; agent time is cheap and human review time is precious — spend
yours generously so theirs is spent only on decisions.

---

## Phase 0 — Set up the job

### 0.1 Get the material

`GET …/dictionaries/{id}/files` lists the uploaded resources, each with the
uploader's `import_instructions` (**authoritative — follow them**) and an optional
`source_note`. Download each via `GET …/files/{fileId}`.

### 0.2 Register the source, and file the resources under it

**Every import gets a `sources` registry row** — even when the uploader gave no
citation and the material looks like an unpublished working file. Untraceable data
is a permanent cost; a best-effort source row is cheap and the dictionary's manager
can refine it later. Do it now, not at the end: the slug has to be stamped on every
record from your first write, and filing the file signals that the job is underway.

1. `POST …/sources` with a **simple, stable `slug`**. Prefer `author-year`
   (e.g. `smith-1979`) when known; with unknown provenance use something short and
   generic (e.g. `enxet-lexicon`). The slug is the permanent key stamped on every
   record, so keep it plain enough to still fit after the manager improves the
   citation. Include `citation`, `abbreviation`, `author`, `year`, `type`
   (dictionary/wordlist/fieldwork/manuscript/video/grammar/phrasebook/hymnal/
   primer/corpus/other), and `orthography` if its forms use a specific script.
   - If the uploader's `source_note` is thin or absent, write a **best-effort
     citation from what you can observe** (title page, colophon, file format,
     language pair, uploading organization). Describing observed facts is not
     inventing data — but never guess authorship or publication details; write
     "author and publication details unrecorded" and let the manager iterate.
2. `PATCH …/files/{fileId}` with `{ "source_id": "<source id>" }` for **every file
   in the request**, not just the main data file. This does not move or publicize
   the bytes — the object keeps its existing private storage key. It records the
   permanent association and shows the manager that the import is in progress.
   If one request contains materials from different works, create a source per work
   and link each file to the right one.
3. Later revisions of the same work (a corrected export sent mid-job) become
   **additional files under the same source** — never overwrite the original.

Then stamp what you write: `sources: ["smith-1979"]` on entries/senses/sentences/
texts, plus `citations: [{ "slug": "smith-1979", "locator": "p. 31" }]` on entries,
sentences, and texts whenever you know a page/line/example number (for a scanned
dictionary you always do — record it).

---

## Phase 1 — Data preparation (before you write any data)

### 1.1 Inspect the resource

- **Never trust the file extension.** A "`.db`" may be a Toolbox SFM text file,
  not SQLite; a "`.csv`" may be tab-separated. Check magic bytes / run `file`,
  then read the head yourself.
- Detect the **encoding** (UTF-8 vs legacy codepages, mojibake, NFC/NFD
  normalization of diacritics) before parsing anything. Watch **CRLF + trailing
  whitespace**: a `$`-anchored grep silently misses annotations hidden behind
  `\r` or trailing spaces — normalize line endings before profiling.
- **Profile the structure**: which markers/columns exist, how often each occurs,
  which are always empty, which repeat within a record, min/max/median value
  lengths, records per structural shape. Empty-looking fields and outliers are
  where surprises live.
- Profile markers **inline as well as line-initial** — compilers typo a marker
  mid-line and a line-initial-only parser will glue it into the previous field as
  if it were word-wrap. Those strays are hand-typed treasure: scientific names,
  variant forms, POS, examples.
- Inspect the **headword column itself**, not just the definition side: POS tags,
  IPA transcriptions, and even fragments of the next record leak into it.
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
- **Provenance**: who compiled this, when, from what — improves the source row.
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
- the record's **deterministic id** (uuid5 of a stable RAW source key) — assigned
  here, not at POST time, and never re-keyed on a value your cleanup can change

The staging store is the single source of truth for everything downstream: the
preview (§1.5) and the API payloads are both generated from it, never hand-edited.
Keep the whole pipeline **re-runnable from the original file**; run it twice and
diff — byte-identical output is your proof that no manual fix-up crept in.

**Re-check identity after cleanup.** Transformations that touch headwords create
collisions that didn't exist in the source (stripping a POS tail can turn two
distinct rows into the same `(lexeme, homograph)` pair). Finalize homograph
numbering as the LAST step, after all headword cleanup, and keep the ids stable.

### 1.4 Pore over the data — by eye, in large amounts

This is the longest step and the reason phase 1 exists. Do not sample five records
and declare victory: **read hundreds of records, scan thousands**, sorted and
grouped different ways (by length, by punctuation, by rare characters, by
structural shape). You are looking for errors, corruption, inconsistencies, and
structure hiding in prose. Classes worth hunting, because only bulk eyeballing
finds them:

- A **second language hiding inside another field** — glosses in a third language
  embedded in the definition string, with no marker or column to flag them.
- Separator and markup noise (trailing `;` on thousands of values), word-wrap
  overflow glued to the wrong field.
- **Structured data hiding in prose**: plural forms, person/gender paradigm tags,
  literal-translation asides, etymologies and usage examples packed into a
  definition — each belongs in its own API field, not left as noise inside a gloss.
- The **headword leaking into its own gloss/definition**.
- Cross-references ("see X", "variant of X") that should become entry
  relationships, not prose.
- Senses wrongly split or merged by the source's own line formatting.
- **Truncated values**: entries ending in `:`, "for example", or a dangling
  connective — the source lost content there. Flag and report them; never guess a
  completion.
- **Records the parser silently ate**: reconcile your record count against a count
  taken a different way (raw headword-pattern grep, file size per record). A
  defect in the source's own structure can hide dozens of entries inside their
  neighbours.

Two judgment rules that recur in gloss-vs-definition work:

- For **polysynthetic languages** a long phrase is usually still a GLOSS: a whole
  clause can be the translation equivalent of one verb. Definition means
  *describes instead of translating* ("type of plant with...", "person who...",
  "verbal prefix that..."). Judge content, not length or shape.
- When one value holds BOTH an equivalent and a description ("church; place where
  people gather"), **split it**: equivalent → `glosses`, description →
  `definition`. Never duplicate the same text into both.

Method: when you find an issue, **quantify the class across the whole dataset**
(query the staging store), decide a rule, and mass-apply it. Whatever doesn't fit
a pattern gets a **manual pass, item by item** — no shortcuts, and no cheap
proxies (string length does NOT distinguish a gloss from a definition; read the
content and judge each value). Record every rule and every manual decision in the
staging rows so the cleanup is auditable and re-runnable from the original.

For a large dataset, **parallelize the reading with sub-agent sessions** instead
of skimping: first read a meaningful slice yourself to crystallize the taxonomy,
then hand the remaining chunks to spawned sessions with (a) that written taxonomy
with worked examples, (b) an exceptions-only decision-file contract keyed by stable
refs, and (c) the anomaly flags to hunt for. The lead agent then audits: spot-check
each reader's decisions against the raw chunk, and personally re-verify every item
a reader marked unsure. Chunks sorted by value text make patterns cluster and read
faster.

### 1.5 Render a human-readable preview

Before any write, generate a **`preview.html`** (or equivalent) **from the final
payload** — not from an intermediate staging file, or its counts and text will
disagree with what you actually import. It is a designed, readable
dictionary-entry view, never a raw JSON dump, showing:

- the payload's own counts (entries, senses, and how many entries will get the
  API's default empty sense),
- a **diverse sample** (~20–40 entries) covering every structural shape: single-
  and multi-sense, homographs, empty/minimal records, the longest values, the
  weirdest,
- **every flagged or manually-decided case**, and lifted/relocated data made
  visible (notes, plural forms, cross-references), so the human can see where
  things will land,
- the exact final `review.category` + `review.note` for every queued entry (§2.3),
  displayed as the editor will see it.

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
2. Re-check that the uploader's instructions haven't changed since phase 0.
3. Read `?view=index` of the OpenAPI spec, then pull the tags you need
   (`?tag=entries`, `?tag=texts`, …).
4. **Write down the numbers you expect** — entries, senses, entries carrying each
   review category — so verification is a comparison, not a vibe. Note that an
   entry sent without `senses` is created with one default empty sense, so expected
   DB senses = data-bearing senses + entries with no senses.

### 2.2 Writing the data

- **Generate a UUID yourself for every entry** and send it as `id` — it is the
  idempotency key (re-POST of the same id is a safe no-op) and your handle for later
  `PATCH` fixes. Use the deterministic ids from your staging store (§1.3).
- **Batch** `POST …/entries` with `{ "entries": [...], "import_id": "<slug>-2026-07" }`
  in batches of ≤1000 entries (and ≤~16MB per request). The `import_id` becomes a
  private tag so the whole batch can be found or cleaned up later.
- Drive it from a **runner, not ad-hoc calls**: validate the payload before the
  first write, stop on the first failure, and persist a ledger (bound to a hash of
  the payload) after every batch so an interrupted run resumes instead of
  double-writing.
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
- After attaching text/sentence audio you can either PATCH karaoke `timings`
  you computed yourself, or have the server force-align them:
  `POST …/audio/{audioId}/align` (see the `alignment` tag — requires the
  dictionary's romanization to be configured by the Living Dictionaries team).
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
  empty rather than guessing.

### 2.3 The human review queue (`review`)

**Flag anything you had to guess, salvage, split, or truncate and could not fully
resolve** — set the entry's `review` field: `{ "category": "...", "note": "..." }`.
This is EDITOR-ONLY (never shown to the public — it's stripped from non-editor
reads, same bar as a private tag) and gives the dictionary's manager a real review
queue: the entries list has a "Needs review" filter + a per-category facet, and the
entry page shows a banner with your `note` and a "Resolve" button that clears it.
Prefer this over burying caveats in your final report. Clear one by PATCHing the
entry with `"review": null` — the same thing the human's "Resolve" button does.

**Your importer flags are not the review queue.** A flag records what you noticed;
`review` means *a real question is still unresolved after the final cleanup*.
Re-evaluate every flagged row after all repairs have run, and drop findings the
pipeline resolved. Never ask a human to re-approve deterministic cleanup just to
preserve your audit trail.

- `category` is a free bucket label that drives the facet — reuse a small,
  consistent vocabulary across the import. Good buckets from real imports:
  `truncated` (value cut off in the source), `headword_in_gloss` (the headword
  leaked into its own gloss/definition), `language_split` (you separated content in
  another language into its own gloss field), `uncertain_gloss` (the
  gloss/definition call needs a linguist's eye), `dropped_text` (you dropped
  stray/unparseable text — say what), `missing_gloss` (vernacular-only, no gloss
  found), `other` (freeform — the note carries it).
- `note` is a **self-contained editorial task**, shown verbatim to a dictionary
  manager who has only the entry page in front of them:
  - Answerable from the entry page alone. Name the sense when useful, explain what
    changed, include the **complete original and imported values** needed to
    decide, and end with a concrete question.
  - Plain language, using the labels a human sees in the UI ("Spanish
    translation", "definition", "Notes", "plural form"). Never expose code paths
    like `glosses.gn`, internal flag names, parser terminology, or JSON/DB
    vocabulary.
  - If text was omitted, quote the exact omitted text plus enough surrounding text
    to place it. Never say only "text was dropped" and send them hunting.
  - Keep provenance OUT of the note — the source slug + locator belong in the
    entry's `citations`, which the editor UI shows separately under collapsed
    Source details. Never tell a human reviewer to open or compare the source file.

  A good language-split note reads like:
  `"Sense 1: I put “ñakyra’i” in the Guaraní translation instead of the Spanish text.\nOriginal text: “cigarra pequeña, chicharra, ñakyra’i.”\nSpanish translation: “cigarra pequeña, chicharra”\nIs “ñakyra’i” Guaraní, and are both translations now correct?"`

### 2.4 Verifying an import

- Compare against the numbers you wrote down in §2.1 — entries, senses, and the
  per-category review counts.
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
- Send an explicit `null` to clear a nullable field; omitting it leaves the old
  value. Read the row back after the first one to confirm the field really cleared.
- Deterministic ids (uuid5 of your source key) make re-syncs address the same
  rows every time — the repair path stays surgical instead of delete-and-reimport.
- There is **no batch PATCH** — corrections are one request per entry. Budget for
  that, and don't rewrite fields (like citation locators) across a whole import for
  cosmetic reasons.

**A corrected revision of an already-imported source** is a reconciliation job, not
a re-import. Build an identity map between the old and new records first, then
audit the differences: a "fixed" export routinely repairs some records while
damaging others (lost spaces, newly truncated values). Keep the better wording per
field, accept genuine sense splits/merges, delete the senses the correction really
dropped, and re-audit your review queue against the new text. File the corrected
export as an additional resource under the same source.

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

Tell the requester, in their language not yours: what was imported and how much,
the decisions you made (cleanup rules applied, anything skipped, the source you
registered), how many entries are waiting in their review queue and how to work
through them, and anything still unresolved. Keep the `import_id` and your ledger
in the technical record for whoever maintains the import.

The resources you filed under their source in §0.2 stay there permanently, and a
dictionary manager can download them from the Sources page.
