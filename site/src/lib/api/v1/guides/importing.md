# Importing a dictionary: the orchestration guide

You are importing someone's language materials into a Living Dictionary through the
`/api/v1` API. **Always start here**, whatever the source format; the format guides
(`/api/v1/guides/spreadsheets`, `flex-lift`, `pdf-scans`) cover parsing details, and
`/api/v1/guides/api-basics` covers the mechanics every job shares (auth, multilingual
fields, generating your own ids, limits) if you haven't read it.

## The runbook

**Phase 0 — set up the job**

1. `PATCH …/conversations/{threadId}` with `{ "started": true }` — claims the job and
   freezes the uploader's resources as permanent record.
2. Download every resource; read the uploader's instructions (they are authoritative).
3. `POST …/sources` for the work, then `PATCH …/files/{fileId}` with its `source_id`
   — do this before any data work, so every record you write is traceable.

**Phase 1 — data preparation (no data writes)**

4. Inspect and profile the material.
5. Ask the human the linguistic questions inspection raises.
6. Stage everything locally, verbatim + cleaned, from a re-runnable pipeline.
7. Pore over the data by eye, in bulk; clean with auditable rules + manual passes.
   Fix what the reading finds as RULES, rebuild, then re-read the rebuilt output —
   two or three full passes, three when the dictionary already has content.
8. Render a human-readable preview from the final payload and get sign-off.
   If the dictionary already has content, §1.7 governs the overlap — that is where
   an import damages someone's work, and it needs its own pass.

**Phase 2 — API usage**

9. Write in idempotent batches under one `import_id`, with a resumable ledger.
10. Verify counts and spot-check content against the source.
11. Leave a `review` task on every entry a human still has to decide.
12. Put the work's prose where it belongs (about / grammar / cover photo), then file\n    the report and the questions on the conversation and say you are done.

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

### 0.2 Claim the job

Every uploaded batch has an **import conversation** — the page at
`/{dictionaryId}/import/{threadId}` where the manager who sent you the material can see
everything and talk to you. `GET …/conversations` lists them; the one you want is the
request whose resources you were given.

`PATCH …/conversations/{threadId}` with `{ "started": true }` **before you touch
anything else**. That stamp does two things: it tells the manager work has begun, and it
freezes the request — from then on the uploaded files, their instructions, and the request
note are permanent dictionary history that nobody can edit or delete. You are about to
build records that cite those files, so they must stop moving.

(Before you start it, the uploader can still fix their instructions or withdraw the
request. That window closes the moment you claim the job — so if the instructions look
wrong or incomplete, ask in the conversation FIRST, then start.)

### 0.3 Register the source, and file the resources under it

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
   and link each file to the right one. Filed resources stay under that source
   permanently, downloadable by dictionary managers from the Sources page.
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

- **Literal columns, or a real lexicographic pass?** Ask this whenever the
  instructions are rigid ("import exactly as laid out", "just map these columns").
  Follow the instruction — it is authoritative — but ask the question too, because an
  uploader who has only ever seen their own file is choosing between options they do
  not know exist. Material of any age was written for a page, not for a set of fields:
  alternate forms sit on their own rows, literal translations and usage notes are
  packed inside glosses, cross-references are prose, plurals and paradigm forms are
  filed as headwords, examples hide inside definitions. Left as typed, that content is
  text nobody can search, filter or browse on; moved into its own field it is what
  makes the dictionary work. A straight copy is rarely the best dictionary available
  from the same bytes — and the choice belongs to the owner, not to you.
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

#### Sizing the reading lanes

Budget by **the rendered bytes each lane must read**, not by row count, and size
the chunks only once the renderer exists: render one chunk, measure it, divide.

- A reading lane's peak context lands at roughly **4–5× the size of its chunk** —
  its own thinking, re-reads, and decision output dominate the material itself.
  **Target ~200 KB of rendered material per lane** (≈200–250K peak).
- **Fewer, fuller lanes beat more, thinner ones.** Every lane re-pays the same
  15–25K onboarding cost (taxonomy, calibration, tool definitions) before it reads
  a single row, and a lane that has read 600 rows recognises a recurring defect
  that a 250-row lane sees twice and treats as noise. Playing it safe at 100K per
  lane buys you double the lanes and worse pattern recognition.
- Guard the tail: a lane that exhausts its context mid-chunk loses everything it
  has not yet written. Require lanes to **append to their decisions file as they
  go**, never to save it all for the end.

#### How to read a row

The mechanics matter as much as the checklist above.

- **Give the reader a self-contained block per row** — the verbatim source value,
  the record you propose to write from it, and any existing data the write will
  touch. A reviewer who has to go look something up stops looking it up around
  row 40.
- **Never truncate the existing material in that block.** Clipping the target
  record's notes to a preview length produced a confident ruling to narrow a
  gloss whose full note said the opposite ("the most general word for *to
  cut*"). Show every field of the record you are about to touch, in full — that
  is the material the verdict is made of.
- **Lead with the two or three domain facts that decide most rows, not with
  rules.** "In this language statives are verbs, so a gloss like *bitter* is a
  verb" and "this dictionary's entries are one-per-recording, so five identical
  copies of a headword are intentional" retire more errors than a page of
  instructions.
- **Every verdict a reader can write must have a mechanical consequence.** If your
  pipeline can silently ignore a ruling, it will — rulings that land in a code
  path which has already decided otherwise disappear without a trace. After
  applying the decision files, **diff every ruling against the final payload and
  hard-fail on any ruling that changed nothing.** Structurally, apply every
  pass's verdicts in ONE authoritative layer that runs last and that nothing
  above it can return early from: both ruling-loss bugs in a recent import were
  an early `continue` sitting above that layer.
- **Key a verdict to the record it changes, not to the source row.** Where
  several rows fold into one entry, a ruling replayed per row hits the same sense
  list twice and duplicates the content it was meant to fix.
- **Require a per-lane `summary.md`** — counts per verdict, patterns seen, and
  anything the lead should fix once. This is how pipeline bugs surface: a bug
  reads as the same correction thirty times in one lane's summary.
- **Treat a reader correction as a bug report about your pipeline, not a row
  patch.** Before applying the corrections, ask which of them a rule change would
  have prevented, fix those globally, and re-render. The rows nobody flagged carry
  the same bug.
- **Generalize the cause, never the blast radius.** A fix must do exactly what the
  verdict said and no more: "don't add the first of these two meanings" becoming
  "write nothing for this row" quietly threw away 15 real meanings, and nothing in
  a diff of what you *will* write can show it.
- **Calibrate a proposed rule before you adopt it.** Readers hand back confident
  generalizations; treat each as a hypothesis. Count the rows it would touch,
  sample them, and check it against the manager's own practice — two rules
  proposed in a recent run scored *worse* than what they replaced (one was
  contradicted by 92 existing entries) and were rejected on the numbers. Same for
  any field you machine-assign that the source doesn't carry (part of speech,
  semantic domain): score your proposals against the manager's own labels on the
  words you both cover, and put the measured accuracy in the preview so their
  sign-off is informed.

#### Read the FINAL payload, not the proposal

Readers read a render; the lead then fixes the bugs the readers found and rebuilds.
**The text that rebuild produced is now unread** — and it is the text that will be
written. This is the one class of error that survives every earlier check.

**A reviewer must approve composed output text, never the rule that composes it.**
"Extend this gloss" is a decision; `"sometimes, sometime"` is what the dictionary's
owner will actually read. If a rule composes human-visible prose, a human-equivalent
reviewer has to see the prose.

So after the final rebuild, re-render and re-read **every row whose written output
changed since it was last read**. When the import edits content a human authored,
budget a **full second pass over the final payload**: the first pass reads a
proposal, the second reads the outcome.

#### How many passes: two or three, not one

The first reading finds the errors it was told to hunt. The passes after it find
the errors your pipeline made *while fixing those* — a different and more
dangerous class, because by then everything looks approved. Budget **two full
audit passes over the rebuilt payload after the first reading, three when you are
writing into a dictionary that already has content.** Agent time is cheap; the
manager's dictionary is not.

What the extra passes actually caught in one 4,048-row merge import — all of it
on material that had already been read and signed off row by row:

- **Pass 2**, fresh lanes over the final payload: 430 findings, **292 of them on
  rows pass 1 had passed clean**, plus the systemic cause pass 1 could not see —
  the merge was comparing incoming wording only against the target's gloss and
  ignoring the notes the manager had written.
- **Pass 3**, over the rows whose output changed *and* every row the pass-2 rules
  had newly stopped writing: 15 real meanings a too-broad suppression fix was
  discarding, and 12 more homograph collisions.
- **Pass 4**, a different model over everything: a code path that had been
  silently dropping the later passes' verdicts, and review notes phrased as
  instructions to the importer rather than questions for the manager.

How to run them:

- **Vary the model between passes.** Parallel lanes of one model converge on the
  same blind spots; a different model finds a different class of defect.
- **Every pass must also read what the previous pass's rules STOPPED writing.**
  Suppression is invisible in a diff of what you will write.
- **Stop when a pass yields only isolated row-level items and no systemic class.**
  While passes are still naming *causes* rather than rows, you are not done.
- **Track the payload's shape across passes** — records created, existing records
  edited, rows written off, review flags. Converging numbers are the evidence that
  a sign-off means something; a late pass that still moves them a lot is a pass
  that would otherwise have shipped damage. Put that table in the report.

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

When the import touches a dictionary that already has content (§1.7), two more
sections carry the sign-off and neither is optional: **every edit to an existing
record shown as the WHOLE record will read afterwards** — all of its meanings in
order, marking which ones you added and which you reworded, not just the one field
you touched — and **a sample of the rows you are NOT writing** next to the existing
record each was judged redundant against.

That whole-record view is worth insisting on: a `was → becomes` line for one field
looks reasonable even when the edit landed on the wrong sense, while the same edit
shown in place — an entry whose only meaning suddenly reads "puts on hat" — is
obvious at a glance. Four of one import's entries had their primary meaning
replaced this way, through five review passes, and the whole-record card caught all
four on sight.

Give it a **table of contents at the top with jump links, and make every section
collapsible** (`<details>`) — same structure as the report (§2.8). At import scale
these documents are navigated, not scrolled: a reader wants to collapse everything,
open the one section they care about, and find it instantly.

The human reviews meaning and correctness; your job is to make that effortless.

### 1.6 Get sign-off, in batches

Two natural checkpoints: the inspection questions (§1.2) up front, and the
cleanup rules + preview review before writing. Batch questions rather than
trickling them; propose a recommended answer for each. Only after the human signs
off on the preview do you enter phase 2.

### 1.7 Importing into a dictionary that already has content

Most imports land in an empty dictionary. When they don't, **the overlap is the
job** — it is harder than the parse and it is where the damage happens, because
you are writing into someone's finished work. One rule governs all of it: **the
manager's curation is the record; you may add to it, never overwrite it.**

- **Snapshot the live dictionary first** (§2.4's snapshot guide) and resolve
  against the snapshot, not against live reads — otherwise the dictionary moves
  under you and the run stops being reproducible.
- **Profile their house style before you design a single record, and match it.**
  Count what the existing entries actually do: which fields are always filled,
  which are never used at all, the part-of-speech vocabulary and how it is
  applied, how notes are phrased, whether qualifying parentheticals stay inside
  the gloss, whether a word with several meanings is one entry with several senses
  or several entries. This is a measurement, not an impression — "0 of 4,642
  senses use the definition field" and "92 glosses keep a parenthetical" each
  decided a design question outright. Records that ignore house style read as
  foreign matter in someone's dictionary and undo years of consistency; where
  their convention differs from what you would have chosen, follow theirs and say
  so in the report.
- **Copy the conventions, not the mistakes.** A typo repeated three times, a
  truncated gloss, a note left mid-sentence: those are defects to flag for review,
  not practice to imitate. Convention is what they do deliberately and
  consistently — if you cannot tell which it is, ask.
- **The unit of decision is the sense, not the row.** One source row routinely
  holds one meaning they already have and one they don't.
- Four verdicts per sense: *already covered* (write nothing) · *same meaning, ours
  says more* · *a genuinely different meaning of the same word* · *a different
  word that merely shares a spelling*.
- **Choose the target entry by MEANING, not by age.** Attaching to the oldest
  matching headword silently lands on the wrong homograph; use creation order only
  as a tie-break between true equals.
- **Homograph guard.** Same spelling is not same word. If the incoming meaning is
  implausible as a sense of the existing entry — *waterfall* onto "throat",
  *juniper* onto "bird", *pine pitch* onto "cattail" — it is a separate entry.
  When a merge is a stretch, split; a spurious extra entry is visible and
  fixable, a meaning welded onto the wrong word is neither.
- **Never overwrite.** Fill a field only when theirs is empty. Append to a gloss
  only when the addition is a *meaning* they lack, not a rewording of one they
  have — "sometimes" + "sometime", "clothes" + "cloth", "waits for" + "waits on"
  are how a mechanical merge disfigures someone's dictionary. When your wording is
  simply more precise than theirs, that is a **rewrite of the one gloss**, not a
  second gloss and not a second sense.
- **A replacement may only ever keep their words and say more.** Check it
  mechanically: if the new wording drops most of the content words of the wording
  it replaces, it is not a rewording of that meaning at all — it is a *different*
  meaning that landed on the wrong sense, and it belongs beside theirs instead.
  This is how "barters, trades, swaps, exchanges" silently became "switches
  places". Assert it in your verifier; a human reading rulings will not catch it.
- **Target an edit by the wording it restates, never by position.** "Reword this"
  applied to "the first sense that matches an existing one" will eventually hit the
  wrong sense on a multi-sense row. Pick the sense whose own words the ruling
  overlaps most, and decide from there whether it edits theirs or adds yours.
- **Compare against everything they wrote, not just the field you are patching.**
  Editors put detail in notes. If the target's notes already say *can also mean
  "handcuffs someone"*, appending "handcuffs" to its gloss adds nothing and reads
  as though nobody looked.
- **A normalized "same meaning" test is a filter, not a verdict.** Lemmatizing and
  stripping parentheticals is what makes "mouth, lip, beak" match "mouth, beak,
  lips" instead of dumping 300 trivial wording differences on a reviewer — and it
  is also what silently discards `(bell)`, `(like piano)`, `(long hard object)`,
  `(with -m)`. **Anything the normalizer dropped must be reported, never assumed
  redundant.**
- **Count and sample what you are NOT writing.** In a merge import the skipped
  rows carry the risk: a dropped row is the one thing the owner cannot discover by
  browsing their own dictionary. The skip count, the reasons, and a sample belong
  in the preview and in the report.
- **Ask what a duplicate MEANS in this dictionary before de-duplicating.** Where
  every entry is one speaker's recording, five identical headwords are intentional
  and merging them destroys the design. Elsewhere they are a defect. Ask.

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
  double-writing. Keep that ledger and the `import_id` in the technical record —
  after you're gone they are the only handle anyone has on the batch.
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
  - **Text your reading lanes wrote is a draft, never a note.** Rulings come back
    in the imperative — "Move *no e* out of the gloss", "Replace the malformed
    note" — because they were addressed to *you*. Shipped verbatim they put
    engineering chatter on a manager's entry page. Re-read every queued note in
    the manager's voice and rewrite it as a question they can answer, and drop the
    ones that were only ever instructions to yourself.

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
  `GET /api/v1/guides/consume` (rebuilt within ~30 min of an edit, so use API reads
  to verify writes you made moments ago).
- Spot-check ~10 imported entries against the source (diacritics intact, glosses on
  the right senses, examples attached to the right entries).
- For grammar examples, verify the standalone sentence via
  `GET …/sentences/{sentenceId}` after creating and attaching it.

### 2.5 Repair & re-sync semantics

`PATCH` **field-merges at the level of whole fields**: a field you omit is
untouched, a field you send is taken as authoritative. Re-syncing a corrected
source over an earlier import updates the fields you send but leaves stale data
behind:

- A sense/sentence dropped from your corrected source is NOT removed by re-PATCHing
  the entry — `DELETE …/senses/{id}` / `DELETE …/sentences/{id}` explicitly.
- **Provenance accumulates; content is replaced.** That is the seam every PATCH
  field falls on:
  - `sources`, `citations`, `dialects` and `tags` **MERGE** with what is already on
    the row (deduped, existing first). You cannot delete another contributor's
    attribution by patching a row you did not create.
  - **Multi-language fields overlay key by key** — `lexeme`, `glosses`,
    `definition`, `notes`, `linguistic_history`, `plural_form`, `variant`, a text's
    `title`/`summary`, a sentence's `text`/`translation`. PATCHing
    `glosses: { "en": "…" }` leaves an existing Spanish gloss untouched.
  - `parts_of_speech`, `semantic_domains`, `write_in_semantic_domains`,
    `scientific_names` and every scalar are **REPLACED** — they state what the word
    *is*, and correcting one means saying the new value outright.
- **To remove rather than add**: send `null` to clear a whole field, or `""` for a
  single language key to drop just that language. Unlink one dialect/tag with
  `DELETE …/entries/{entryId}/tags/{tagId}` (or `…/dialects/{dialectId}`) — the
  tag/dialect survives elsewhere. Read the row back after the first clear to
  confirm the field really emptied.
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

### 2.6 The material that isn't entries

A published work is more than its headwords, and most of what surrounds them has a home:

| In the source | Where it goes |
|---|---|
| Preface, acknowledgements, contributor/elder biographies, bibliography | `about` — `PATCH …/dictionaries/{id}` with markdown |
| Grammar sketch / "notes on pronunciation and grammar" | the grammar section tree (`…/grammar/sections`), one section per heading, nested; see the `corpus` guide |
| Abbreviation/gloss legend | `…/grammar/glossing-abbreviations`, so every code in a gloss line becomes tappable |
| A photograph of the community or its place | `POST …/cover-image` (multipart `file` or `{ url }`) |
| How the work asks to be cited | `citation` |

Two rules for this material specifically:

- **Attribute it, don't absorb it.** A preface written by a named author stays that
  author's preface — introduce it (“From the preface by …”) rather than reprinting it in
  the dictionary's own voice. The same goes for elder biographies: they are the most
  human thing in most of these books and they deserve their names attached.
- **Ask before you publish someone else's photograph.** A book jacket, a plate, or a
  portrait carries rights that the person who sent you the file may not hold. Ask on the
  conversation who to credit — a community photo they own is nearly always the better
  cover anyway.

`public` and `print_access` are deliberately NOT writable through the API. Whether a
dictionary goes live is the community's decision; if you think it's ready, say so on the
conversation and let a human click it.

### 2.7 Recovering from a bad import

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

### 2.8 Report back to the human

The preview (§1.5) is what the human approves; the **report** is what they keep. After
the write, generate a `report.html` — same designed, readable HTML as the preview, with
the same table of contents + collapsible sections — and hand it to the person whose
material you imported. An import is not finished when the rows land; it is finished when
the human knows what happened to their language data and what you need from them.

**Put every question the import raises at the TOP, before any statistics.** This is the
one artifact in the whole workflow with room to explain a question properly. A `review`
note (§2.3) has to fit on an entry page and be answerable from that page alone; a chat
message gets skimmed. The report can show the original rows, the record you produced from
them, and why you hesitated — so do that, and do not compress a question into a one-liner
just because the review note had to be one:

- **One question per case**, in plain language, ending in an actual question.
- **Show the evidence**: the source row(s) verbatim, and the record as it now exists.
- **Link each question to the live entry** it concerns —
  `https://livingdictionaries.app/{dictionaryId}/entry/{entryId}`. The entries exist by
  now; a reader who can click through and fix the word while reading about it will.
- **EVERY headword printed anywhere in the report is a link to its live entry** — in the
  samples, in the before/after lists, in the review index, in the table of rows you did
  not write, in a rule's worked example. Not just the questions. The report is read
  beside the dictionary itself, and a word the reader cannot click is a word they have to
  go search for; after the second search they stop checking. You already know the id of
  every row you wrote, and for a row you skipped you know the existing entry you measured
  it against — so link that one.
- **Separate whole-import questions from per-entry ones.** Provenance, an unexplained
  symbol that recurs in dozens of forms, whether dialect labels should exist at all — one
  answer to any of those can be applied in bulk, so they earn the top of the document. The
  per-entry questions (your review queue, expanded) come after them.
- Report a question **even when you resolved it by a defensible rule**, if a speaker could
  overrule the rule. State what you did and why; that is not the same as leaving it open.
- Say plainly what you did NOT import and why — a row you dropped is the one thing a human
  cannot discover by browsing their own dictionary.

Then, in this order: **what was imported** (the counts you verified in §2.4 against the
live dictionary, not your staging numbers, and a statement that every source record is
accounted for), **the decisions you applied** with a worked example of each rule, **the
review queue** with how to work it (the "Needs review" filter and the Resolve button), and
**what is still unresolved**.

Write it for the dictionary's owner, not for another engineer: no field names, no code
paths, no JSON, no internal ids, no talk of batches or endpoints. Say "meaning" and
"alternate spelling", not `glosses` and `variant`. Keep the machine-facing facts (source
slug, `import_id`, dates) to one small section at the end, for whoever picks the job up
next.

**Say each thing once.** A question explained at the top must not be re-explained in the
per-entry list or used again as a rule's worked example — repeat the item so it stays
findable, but point back ("explained in question 3 above") instead of restating it. A
report that says the same thing three times reads as though nobody proofread it.

#### Filing it

`POST …/conversations/{threadId}/artifacts` with `{ "kind": "report", "html": "…",
"import_id": "…", "stats": { … } }`. The report is stored and rendered on the manager's
conversation page and stays there permanently, so it outlives any inbox. `stats` becomes
the summary line above it (`{ "entries": 1827, "senses": 2018 }` → "1,827 entries · 2,018
senses").

**Reports are rendered with JavaScript disabled** — served under
`Content-Security-Policy: default-src 'none'` because the HTML is yours, not ours, and it
runs on our origin. Build it out of `<details>`/`<summary>` sections and anchor links; a
scripted "expand all" button will silently do nothing. Inline your CSS in a `<style>` tag
(`style-src 'unsafe-inline'` is granted); external stylesheets, fonts, images, and scripts
are all blocked, so keep the document self-contained.

Two consequences worth designing for up front: any `<details>` an anchor points INTO must
be `open` by default (without script you cannot rely on a jump expanding a collapsed
section), and every internal link should target **the specific item**, not the section
heading it lives under — give each write-up its own `id`. An index of 28 rows whose links
all land at the top of one section is an index that does not work.

#### Then file the questions as answerable objects

The whole-import questions from the top of the report also go in as **real objects the
manager can answer in the app** — `POST …/conversations/{threadId}/questions`:

```json
{ "questions": [
  { "kind": "text", "title": "Who compiled this list, roughly when, and from what?",
    "body_html": "Even “a 1990s class handout” lets us cite it properly.",
    "report_anchor": "#q-provenance" },
  { "kind": "choice", "title": "Is the raised dot a morpheme break or vowel length?",
    "options": [ { "value": "morpheme", "label": "Morpheme break" },
                 { "value": "length", "label": "Vowel length" },
                 { "value": "unsure", "label": "Not sure — please investigate" } ],
    "report_anchor": "#q-raised-dot" }
] }
```

Keep `title` short and `body_html` to a sentence or two — the long form is already in the
report, and `report_anchor` (an `id` in your HTML) links straight to it. Use `choice` /
`multi_choice` whenever the useful answers are enumerable; always give an escape option so
"not sure" is answerable. Per-entry questions stay in the `review` queue (§2.3) — do NOT
duplicate 30 of them here.

Finally, `POST …/conversations/{threadId}/messages` with a few warm sentences saying the
import is in and pointing at the report and the questions. That is the manager's
notification: it emails them a link back to the conversation. Do not write the report's
contents into the message.
