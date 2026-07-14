# Structured, entry-linked grammar — reuse the texts/sentences/audio model

Evolve the grammar page from a single opaque rich-text blob into a hierarchical, parallel-language,
entry-linked, tappable/listenable feature that **reuses** the existing corpus machinery (MultiString,
fractional-index ordering, junction write-ops, sentence tokens, media timings, sync).

**Status: SPEC-FIRST (2026-07-14).** No feature code. Sequence changed per Jacob: (1) audit the
design ✅, (2) document the ENTIRE new surface in the agent API (`openapi.json`) with everything
marked **draft** ✅, (3) Jacob's corpus agent reviews the spec ("does this cover what you need?"),
(4) once the shape is validated → build. The draft spec is the review artifact; the sections below
are the implementation design it maps to.

### Audit (2026-07-14) — design holds
- `grammar` blob confirmed in **shared.db** catalog (not dict.db); structured tables go in dict.db. ✅
- Self-referencing `grammar_sections.parent_id` hard FK is safe — sync-apply runs under
  `PRAGMA defer_foreign_keys = ON` (`sync/engine.svelte.ts`). ✅
- `entry_id`/`sense_id` = ON DELETE SET NULL (documentation outlives the entry); matches existing
  `sentences.text_id` precedent incl. the "FK SET NULL may not flip dirty" edge. ✅
- Reuse points verified: MultiString JSON cols auto-register in `DICT_JSON_COLUMNS`; junction pattern
  = `senses_in_sentences`; ordering = `initial_keys`/`key_between`. ✅
- No blockers found. One refinement: `usage_conditions` is just a 2nd MultiString-markdown field on
  the section (cheapest of the 5). Clause slots are the most-deferrable; kept in the draft for review.

### Draft API surface added to `openapi.ts` (all `x-status: draft`, `[DRAFT]`-prefixed)
Tag `grammar`: `PATCH …/grammar` (intro) · `GET/POST …/grammar/sections` · `GET/PATCH/DELETE
…/grammar/sections/{sectionId}` · `POST …/grammar/sections/{sectionId}/sentences` · `DELETE
…/grammar/sections/{sectionId}/sentences/{sentenceId}` · `GET/POST …/grammar/clause-slots` ·
`PATCH/DELETE …/grammar/clause-slots/{slotId}` · `GET …/entries/{entryId}/grammar` (reverse link).
Tag `texts` (draft): `GET/POST …/texts/{textId}/tags` · `DELETE …/texts/{textId}/tags/{tagId}`
(motif/genre/tale-type). Draft schemas incl. `SentenceDiscourseFieldDraft` (`discourse_role`) +
`SourceScriptFieldDraft` (`orthography`) documenting the two proposed columns on existing tables.

Convention introduced (no prior one existed): draft = `x-status: 'draft'` on the op/schema +
`[DRAFT]` summary prefix + a legend in `info.description`. Draft ops currently 404 (no handlers).
Auto-tagging extended (`tag_for_path` → `grammar`); `OPENAPI_TAGS` gains `grammar`. Existing
compile-time-locked input schemas (`SentencePatch`/`SourceInput`/…) were NOT touched — the two
proposed columns are documented as separate draft schemas instead.

**Verification:** `openapi.test.ts` green (15/15, incl. updated full path/method snapshot + new
draft-marker + tag tests); eslint clean; tsc clean on the changed files. Served-JSON artifacts
snapshotted for review under `/home/jacob/ld-grammar-openapi/` (full / `?tag=grammar` / `?view=index`).

### Corpus-agent review round (2026-07-14) — IGT / sentence-layer gap
Full candid write-up: `.issues/ld-igt-corpus-feedback-2026-07-14.md`. Raw feedback also in prod
shared.db thread `4d03ca88-…` (+ the original grammar suggestion `a951be30-…`; a SEPARATE
comparative-dialectology proposal `a6bbba74-…` is PARKED in `.issues/comparative-dialectology.md`).

**Verdict:** the grammar-SECTION layer covers everything they need — no changes. The gap is one layer
DOWN, in the `sentences` model sections reference: it can't hold **interlinear glossed text (IGT /
Leipzig glossing)** — the aligned GLOSS line (object line ✅ = `sentences.text`; free translation ✅ =
`sentences.translation`; the morpheme-by-morpheme gloss line has NOWHERE to go), and `tokens` aren't
writable (auto-matched server-side only). ~1050 real examples are in exactly this format.

**Folded into the draft spec (all `x-status: draft`):**
- Per-token **`gloss` (MultiString)** + optional **`morphemes`** on the token shape
  (`SentenceTokenInputDraft`/`SentenceTokenFull`, `MorphemeDraft`). Lives INSIDE `sentences.tokens`
  JSON → **no migration** for the column; just the type + write path.
- **Writable `tokens`** on sentence create/patch (`SentenceIgtWriteDraft` documents the proposed
  additions to `SentenceInput`/`TextSentenceInput`/`SentencePatch`; auto-match stays as the fallback).
- **Glossing-abbreviations legend** — new dict.db table + draft resource
  `…/grammar/glossing-abbreviations` (`{code, name:MultiString, category?}`; mirrors `clause_slots`).
- **Citation locus** (`SourceCitationDraft` `{slug, locator}`) + **`example_label`** + `discourse_role`
  on the sentence-write draft.

**My additions (beyond the 6 asks) — flagged for the agent to validate against real data:**
1. **Token input offsets OPTIONAL/derived** — importer POSTs ordered `{form, gloss}` rows; server
   derives `start`/`end` by walking forms against `text`. Their data is `rows:[[word,gloss]]` (no
   offsets), so this is the difference between a trivial import and a blocked one.
2. **Morpheme `separator` field** (`-`=`~`.`) so the gloss line renders in faithful Leipzig notation
   (their ask #3 gave `{form,gloss,entry_id}` only).
3. **Legend does DOUBLE DUTY → no per-token "grammatical?" flag.** A gloss code present in the
   glossing-abbreviations legend renders SMALL CAPS + tap-to-expand automatically (membership = the
   signal). Importers maintain ONE list.
4. **Shared-token-index invariant (the architectural linchpin).** `gloss` (line 2), `entry_id`
   (tap→entry), and `audio.timings` (tap→play) ALL key off the SAME default-orthography token list
   (`MediaTimings` already aligns 1:1 to it). Making tokens writable+glossable is what unifies the big
   vision in one gesture. Enforce/document: when tokens are supplied, the default-orthography count
   defines the alignment timings must match.
5. **Keep `entries.interlinearization` distinct** — that's headword-level morphology, NOT the
   per-example gloss (which lives on sentence tokens). Don't conflate/reuse it.
6. **Neutral gloss key for category codes** — lexical glosses are per-analysis-language
   (afraid/怕); grammatical codes (`3PL`) are language-neutral Leipzig notation → store under one
   key so they don't duplicate across locales.
7. *(optional)* **Import-time auto-register** unknown category codes into the legend (seeded from
   Leipzig names) so the legend fills itself from the corpus.

**DB implications (build phase):** JSON-shape only (no DDL) for `gloss`/`morphemes` on tokens. New
migrations: `glossing_abbreviations` table; `sentences.example_label`, `sentences.citations`,
`sentences.discourse_role` columns; `sources.orthography`, `tags.kind`/`tags.code`. **Open decision:**
citation locus as a separate `sentences.citations` JSON column (recommended — keeps the shared
`sources[]` slug path untouched) vs. overloading `sources` into a `(string|{slug,locator})[]` union.

**Minor/future (agreed, out of v1):** inline entry-link markdown (`[[entry_id]]`) to make section
BODY prose tappable (only referenced example sentences are tappable in v1); clause-level (not just
sentence-level) discourse tagging.

**Original design decisions (still the build target):**
**Gate: admin-3 preview** (same as texts) until the data shape is stable, then graduate to all
managers + public. Old `dictionaries.grammar` blob stays visible to everyone as intro/fallback the
whole time.

---

## Decisions locked (interview 2026-07-14)

- **Build the WHOLE proposal as one feature** — core (sections tree + entry/sense link +
  sentence-reference examples + body prose) PLUS all 5 "small optional fields". Not phased.
- **Sentence-references are built NOW**, not deferred. A corpus will exist imminently (Jacob's
  corpus agent supplies texts/sentences + word→entry matching + media timings on its side). Grammar
  sections still **stand alone** (their own MultiString body carries the documentation); referenced
  sentences are an *enhancement* layered on when the corpus is present.
- **Content model = MultiString-of-markdown**: each language value is a markdown string, rendered
  through the existing `render_markdown_to_html` + `sanitize_rich_text`. Parallel-language AND rich
  text.
- **Admin-3 preview gate** for all new structured surfaces; release to everyone at the tail once the
  shape is frozen (avoid shipping a shape people write data into that we then have to migrate).
- **I'm the sole editor of this LD repo.** Jacob's "corpus agent" is a *separate* personal agent that
  imports dictionary/grammar/corpus data into its OWN project — a data source + domain expert (it
  authored this very suggestion), NOT a co-editor here. No codebase/migration coordination needed. I
  query it only when a schema-shaping choice would genuinely benefit from its real data.

---

## Architecture reality (grounded in the code)

- **`grammar` today** is a plain markdown **string** on `shared.db` `dictionaries.grammar` (catalog
  metadata), edited via `/api/dictionaries/[id]/catalog` (`api_dictionaries_catalog({ grammar })`),
  rendered sanitized. Sibling of `about` / `citation`. **Not** per-language, **not** in the content DB.
- **Structured content** (entries, senses, sentences, texts, junctions, media) lives in per-dict
  **`dictionaries/{id}.db`** (`schemas/dictionary.ts`), synced by the leader-worker sync engine.
  Grammar sections MUST live here because they FK to entries/senses/sentences.
  → So "keep the blob as intro" = shared.db string stays; new tables go in dict.db. Two stores, fine.
- **Reuse inventory (verified):**
  - `MultiString = Record<locale,string>`; JSON columns auto-register in `DICT_JSON_COLUMNS`
    (derived from the Drizzle schema) — no manual parse/stringify wiring for new `$type<MultiString>()`
    columns.
  - Fractional index: `$lib/api/v1/fractional-index.ts` — `initial_keys(n)`, `key_between(a,b)`.
    Already orders `sentences.sort_key` and `featured_entries.sort_key`.
  - Junction pattern: `senses_in_sentences` (id / sense_id / sentence_id / dirty / audit) is the exact
    template for `section_sentences`. Junction link/unlink write-ops: `link_junction_local` /
    `unlink_junction_local` (atomic check-then-insert; unlink via `deletes` tombstone).
  - Per-language field UI: **no tab component** — the pattern is a *stack* of one editor per
    language (see `text/[textId]/SentenceEditPanel.svelte`: iterate `orthographies.all` +
    `glossing_languages`, one `EntryField` each). We mirror this with a MarkdownEditor per language.
  - `sentences`: `text`/`translation` MultiString, `text_id`+`sort_key`, `ends_paragraph`, `sources[]`,
    `tokens` (`SentenceTokens` = per-orthography `SentenceToken[]` w/ `entry_id`/`sense_id`/
    `candidates`/`status`). `audio`/`videos`: `timings` (`MediaTimings` = sentence_id → compact
    word-timing string).
  - Sync-apply runs under `PRAGMA defer_foreign_keys = ON` (`sync/engine.svelte.ts`,
    `dictionary-sync-helpers.ts`), so a **self-referencing `parent_id` hard FK** is safe (children may
    arrive before parents in a batch).
- **What's schema-ready but NOT built yet** (corpus agent's side): the text reader currently taps
  *whole sentences* (opens a Slideover), not word→entry tokens; word→entry **matching** (M3) and
  word-level **karaoke** (M5) UIs are unbuilt. So examples-by-reference is correct now, but its
  "tappable words / word-level audio" payoffs light up as the corpus agent lands tokens + timings.
  We build the **reference plumbing** now and render progressively as that data appears.

---

## Data model (all in `dictionaries/{id}.db`, syncable)

### Core

**`grammar_sections`** — the hierarchical tree.

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | client-generated UUID |
| `parent_id` | TEXT → `grammar_sections(id)` ON DELETE CASCADE | NULL = top-level; self-FK safe under deferred FKs |
| `sort_key` | TEXT NOT NULL | fractional index, ordering **among siblings** (same `parent_id`) |
| `number_label` | TEXT | optional explicit label ("2.2.1.1"); when NULL, **derive** from tree position. Stored form lets an imported grammar keep its own numbering |
| `title` | TEXT JSON `MultiString` NOT NULL | per-language, markdown-capable (usually short) |
| `body` | TEXT JSON `MultiString` | per-language **markdown** — the main documentation |
| `usage_conditions` | TEXT JSON `MultiString` | per-language markdown — "when to include vs omit", **field #4b**, distinct from body |
| `slot_id` | TEXT → `clause_slots(id)` ON DELETE SET NULL | **field #1**, clause-template position (nullable) |
| `entry_id` | TEXT → `entries(id)` ON DELETE SET NULL | **core #2**, the headword this section documents |
| `sense_id` | TEXT → `senses(id)` ON DELETE SET NULL | narrow to a specific sense (nullable) |
| `dirty` / `server_seq` / `created_*` / `updated_*` | | standard sync + audit |

- `entry_id`/`sense_id` are **SET NULL** (documentation survives the entry's deletion) — same policy
  as `sentences.text_id`. Note the known "FK-triggered SET NULL may not flip `dirty=1`" edge (shared
  with `sentences.text_id`); follow existing precedent / integrity sweep.
- Bidirectional flow from this one FK: entry page shows "Grammar notes" (sections where
  `entry_id = this entry`); a section pulls the entry's lexeme/phonetic/audio.

**`section_sentences`** — examples as references (NOT re-typed copies), **core #3**. Mirrors
`senses_in_sentences` exactly + ordering.

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | |
| `section_id` | TEXT → `grammar_sections(id)` ON DELETE CASCADE | |
| `sentence_id` | TEXT → `sentences(id)` ON DELETE CASCADE | |
| `sort_key` | TEXT | order examples within a section (fractional) |
| audit/sync | | |
| UNIQUE(`section_id`,`sentence_id`) | | |

One sentence then serves reading (in a text), grammar evidence, AND a sense's example at once —
inheriting the sentence's tokens (tappable), media timings (listenable), and source citation for free.

### The 5 small fields

| # | field | home | shape |
|---|---|---|---|
| 1 | positional clause slot | **`clause_slots`** (new dict.db vocab table, like `tags`/`dialects`) + `grammar_sections.slot_id` FK | `clause_slots`: id / `sort_key` / `name` MultiString / `code` TEXT. Ordered slot list = the clause template; UI renders a template diagram and orders particles by slot |
| 2 | usage-condition prose | `grammar_sections.usage_conditions` (above) | MultiString-markdown |
| 3 | discourse / salience tag on sentences | **`sentences.discourse_role`** TEXT (nullable) | controlled vocab `DISCOURSE_ROLES` in `constants.ts` (storyline / backgrounded / flashback / setting …); grammar sections can point at the role a particle signals |
| 4 | motif / genre / tale-type on texts | reuse **`tags`** + new **`text_tags`** junction (mirrors `entry_tags`); add optional `tags.kind` (NULL=plain \| 'motif' \| 'genre' \| 'tale_type') + optional `tags.code` (ATU/Thompson codes) | cross-text tagging + a real motif index |
| 5 | per-source script/orthography | **`sources.orthography`** TEXT (nullable, an orthography `code` from `dictionaries.orthographies`) | which script a source's forms use, so multiple romanizations/scripts aren't conflated |

Fields **#3** and **#5** are plain `ALTER TABLE ADD COLUMN`s on existing tables — I own them like any
other column here. Fields **#1, #2, #4** are new tables/columns. No external coordination.

---

## Language axis (decision)

Grammar prose is *meta-documentation about* the language, normally written in analysis/national
languages, not the object-language orthography. So `title` / `body` / `usage_conditions` MultiStrings
are keyed by the dictionary's **gloss/analysis languages** (same axis as glosses & sentence
translations), NOT the object-language orthographies. Object-language forms enter via the **linked
entry** (lexeme/phonetic) and **referenced sentences** (which carry their own per-orthography text).
Clean separation; reuses `order_entry_and_dictionary_gloss_languages` / `gloss_languages`.

## Rendering model

Each MultiString value is markdown → `render_markdown_to_html` + `sanitize_rich_text`, per active
language. Grammar page picks which language(s) to show (like the reader's orthography/gloss toggle).
Editing = a **stack of MarkdownEditors, one per gloss language** (mirror SentenceEditPanel's
per-language `EntryField` stack, swapping in `MarkdownEditor`).

---

## UI / routes

- **`/[dictionaryId]/grammar`** rewritten:
  - Optional **intro** at top = the existing `dictionaries.grammar` blob (unchanged edit path).
  - **Section tree**: numbered, collapsible/nestable. Each section renders title + body (+ usage
    conditions), the **linked entry** (lexeme + phonetic + inline audio pulled from the entry), and
    **referenced example sentences** (reuse sentence display; progressively tappable/karaoke as the
    corpus agent lands tokens/timings), and a **slot** badge.
  - **Editor/manager editing** (admin-3 gate for now): add / reorder (fractional) / nest sections;
    per-language MarkdownEditor stack for title/body/usage; link entry+sense (entry search picker);
    attach/detach + order example sentences (sentence picker / link-junction); set clause slot.
  - **Clause-template diagram**: render ordered `clause_slots` with particles (their sections/entries)
    placed per slot.
- **Entry page** (`entry/[entryId]`): a **"Grammar notes"** block listing sections where
  `entry_id` = this entry (or `sense_id` ∈ this entry's senses), each linking into the grammar page
  section. A "document in grammar" affordance creates/links a section from the entry (realizes the
  bidirectional flow).
- **Texts** (list + `text/[textId]`): motif/genre/tale-type **tag chips** + filter (field #4).
- **Text reader** (corpus side): foreground/background rendering from `sentences.discourse_role`
  (field #3) — mostly corpus-agent territory; grammar just references the role.
- **SideMenu**: grammar item stays; structured mode shielded admin-3 (same treatment as Texts).

## Server / v1 parity (human ⇄ agent)

Per the parity direction, route writes through a shared server module **`$lib/db/server/grammar-sections.ts`**
backing BOTH a `/api/v1/*` surface and the UI:
`create_section` / `update_section` / `reorder_section` / `set_section_entry` /
`attach_section_sentence` / `detach_section_sentence` / clause-slot CRUD / text-tag link.
Add to `openapi.json`. This also gives the **corpus agent a clean API** to populate grammar for
validation, instead of poking the DB.

---

## Touch-point checklist (per new syncable table)

1. Drizzle table in `schemas/dictionary.ts` (`$type<MultiString>()` JSON cols auto-register in
   `DICT_JSON_COLUMNS`).
2. New migration `schemas/dictionary-migrations/20260714_structured_grammar.sql`: `CREATE TABLE`s +
   indexes (`sort_key`, `updated_at`, FK lookup cols) + per-table **bump-lmod** insert/update triggers
   + **re-declare `process_delete_cascade`** DROP+CREATE including every new table.
   ALTER-ADD `usage`/`slot`/etc are on new tables; `sentences.discourse_role`, `sources.orthography`,
   `tags.kind`, `tags.code` are ALTERs on existing tables.
3. Register in `DICT_SYNCABLE_TABLES` (FK-safe order): `clause_slots` (no deps, near vocab tables) →
   `grammar_sections` (after entries/senses/clause_slots) → `section_sentences` (after
   grammar_sections+sentences) → `text_tags` (after tags+texts).
4. Junctions (`section_sentences`, `text_tags`) → `JUNCTION_TABLES` in `dict-writes.ts`.
5. Optional atomic orchestrators in `dict-writes.ts` (e.g. `insert_section` minting sibling
   `sort_key`; generic `insert_rows`/`upsert_rows` + `link_junction` cover the rest).
6. Update the hardcoded `DICT_JSON_COLUMNS covers core dict tables` test (new tables + new `sentences`
   col if we add one that's JSON — `discourse_role` is plain TEXT, so no).
7. Live-db reactive collections: auto (proxy over `dict_schema`); verify each new table is queryable
   as `dict_db.<table>`.
8. Server: `$lib/db/server/grammar-sections.ts` + v1 endpoints + `openapi.json`; server sync helpers
   already generic over `DICT_SYNCABLE_TABLES`.
9. i18n: EN keys only (`grammar.*`, `section.*`, `clause.*`, `discourse.*`, `motif.*`).
10. Admin-3 preview guard on new UI (reuse `corpus-preview-guard.ts` pattern).
11. svelte-look stories + screenshots for new components (GrammarSection, SectionEditPanel,
    ClauseTemplateDiagram, entry "Grammar notes").

---

## Corpus-agent data contract (external — informs the shape, no code coordination)

The corpus agent lives in a DIFFERENT project; it just supplies real dictionary/grammar/corpus data.
Relevance to this schema:

- **Read contract** grammar renders against (produced upstream, populated into a real dict):
  `sentences.tokens` (`SentenceTokens`) → tappable word→entry; `audio.timings`/`videos.timings`
  (`MediaTimings`) → word-level karaoke. Shapes are fixed in `schemas/dictionary.types.ts`; grammar
  renders progressively as they populate — no hard dependency.
- **A real dict that exercises the feature end-to-end** should contain: a few **texts→sentences**;
  sentences with **confirmed word→entry tokens**; ≥1 **audio with timings** on a sentence; several
  **grammatical-particle entries** (aspect/classifier/negator/relativizer) to link sections to;
  **sources in differing scripts**; ideally sentences tagged with a **discourse_role** and a text with
  **motif tags**. If Jacob points me at such an imported dict I can validate against live data;
  otherwise I seed one.
- **Open data-shape questions for the corpus agent** (ask only if they'd change the schema; none are
  currently blocking because the vocabularies are per-dict/editable and the extra fields are optional):
  does the source grammar ship its own section numbering? what discourse-salience taxonomy does the
  real corpus use? is there a standard motif index (ATU/Thompson codes) in play? how many distinct
  scripts per source?

---

## Open decisions (recommended defaults; veto welcome)

- `number_label`: **stored-optional, derived when NULL** (supports imported numbering + auto).
- `clause_slots` as a table vs JSON on the catalog: **table** (MultiString labels + ordering + sync,
  matches `tags`/`dialects`). Most-deferrable of the 5 if we want to trim.
- Motif tags: **reuse `tags` + `text_tags` + optional `kind`/`code`** vs a separate table. Reuse.
- Discourse vocab: **global constant set + custom escape** vs per-dict vocab. Global for now.
- Language axis: **gloss/analysis languages** for grammar prose (above).

## Milestones

1. **Schema + migration + sync wiring** (grammar_sections, section_sentences, clause_slots, text_tags,
   ALTERs) + tests.
2. **Server module + v1 endpoints** (gives the corpus agent the write API).
3. **Grammar page rewrite**: tree render + per-language markdown + section editing + reorder/nest.
4. **Entry↔grammar link** both directions + entry "Grammar notes" block.
5. **Sentence-reference examples** (attach/detach/order; progressive tappable/karaoke render).
6. **Clause-template diagram** + slot assignment.
7. **Texts motif/genre tagging** (text_tags UI + filter).
8. **Discourse-role** consumption in grammar (field owned/populated corpus-side).
9. svelte-look screenshots, headless e2e (mirror the texts pipeline's 29-check e2e), i18n.
10. Freeze shape → lift admin-3 gate → GA.

## Validation plan

- Unit: fractional reorder/nest, section CRUD, junction link/unlink, cascade delete of a subtree,
  MultiString-markdown round-trip, entry-delete → `entry_id` SET NULL.
- svelte-look stories for every new component (screenshot verify).
- Headless e2e on a seeded dict (the data the corpus agent stuffs) — build a section tree, link an
  entry, attach a sentence, confirm tappable/karaoke render when tokens/timings exist.
- `pnpm test` / `tsc` / `pnpm lint` / `pnpm check`.
