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

### V2 validation round (2026-07-14) — corpus agent ran the numbers on all 1,072 real examples
Candid write-up: `.issues/ld-igt-corpus-feedback-2026-07-14.md` (Round 2 section). **Verdict: V2
nails it, no blockers, no structural/schema changes** — the shape is validated on real data and ready
to build. Empirical highlights: derived offsets succeed **97.6%** (1046/1072) via an L→R cursor walk;
**28%** of sentences repeat a token form (→ cursor, not global find); **61%** have ≥1 multi-word token
(the one-span design is the norm); **68%** of gloss lines mix category codes + lexical glosses across
tokens (per-token gloss handles it); morpheme sub-structure is **<1%** (correctly optional).

**V3 spec pins folded in (2026-07-14, DESCRIPTION-ONLY — no new schemas/paths, no test-snapshot
change; tests 15/15, tsc + lint clean):**
1. **Neutral gloss-key convention LOCKED** — `SentenceTokenInputDraft.gloss`: store language-neutral
   category codes (`3PL`/`PFV`/`CLF`) under the reserved **`default`** key; per-language LEXICAL
   glosses under language codes; readers see `gloss[selected] ?? gloss.default`. (A code stored under
   `en` would vanish on a switch to `zh` — bites trilingual sources.) This is convention #6 above, now
   pinned in the spec text so the build + import follow it.
2. **Offset-derivation contract documented** — `SentenceTokenInputDraft`: derivation is a LEFT-TO-RIGHT
   cursor consuming each match in turn (a global search collides on the 28% repeated forms); each
   `form` must be an exact substring of `text`, in order (surface forms byte-identical — don't strip
   footnote/tone/OCR artifacts from one but not the other).
3. **Text-less source fallback** — `SentenceIgtWriteDraft.tokens`: when `text` is omitted but tokens
   are supplied, the server builds `text = join(form, ' ')` (serves the rows-only source class → makes
   derivation total).
4. **Legend small-caps is a SUBSTRING match** — `GlossingAbbreviationInput` + the gloss field: a
   legend code found anywhere within a gloss cell highlights (portmanteaux like `eat PFV` / `can/ATT`,
   ~2% of cells), not whole-cell only.

**Corpus agent's OWN extraction TODO** (their side, not an API issue — logged so it's not lost): strip
footnote/tone artifacts (`Tsov26`, `ATT28,29`) + OCR line-break hyphens from surface forms so tokens
reconstruct text; lift `(a)/(b)` labels into `example_label`; map their `cite` field →
`citations[].locator`.

**Loop status:** design loop SETTLED from the corpus agent's side ("ready for them to build"). Next
gate = Jacob's go to (a) deploy V3 spec pins + (b) start the build.

---

## BUILD (2026-07-14) — green-lit by Jacob (deploy V3 ✅ pushed `595e9128`, build ✅ go)

Citation storage = **separate `sentences.citations` JSON column** (Jacob's default). Whole feature
built as one; admin-3 gated until shape frozen.

### Milestone 1 — dict.db schema + migrations + sync wiring
Grounded machinery (verified in code): dict migrations auto-discover via `import.meta.glob` on BOTH
server (`dictionary-db.ts`) and client (`dict-migrations-bundle.ts`); `LATEST_DICT_MIGRATION`
auto-derives (last-sorted file) — no constant to bump. JSON columns auto-derive from Drizzle
(`dictionary-json-columns.ts`). New syncable table needs: (a) Drizzle table, (b) CREATE TABLE + indexes
+ bump-lmod ai/au triggers + server_seq ai/au triggers (`WHEN NEW.server_seq IS OLD.server_seq` on au)
+ re-declared `process_delete_cascade`, (c) `DICT_SYNCABLE_TABLES` (FK-safe order), (d) junctions →
`JUNCTION_TABLES` in `dict-writes.ts`. Sync-apply runs under `PRAGMA defer_foreign_keys = ON` → self-FK
safe. Migration runs FK-OFF wrapped in BEGIN/COMMIT.

Milestone 1 files — ✅ DONE (2026-07-14), all tests green:
- [x] `constants.ts` — `DISCOURSE_ROLES`, `TAG_KINDS`
- [x] `dictionary.types.ts` — `Morpheme`, `SourceCitation`; extend `SentenceToken` (`gloss`, `morphemes`)
- [x] `dictionary.ts` — 5 tables (clause_slots, glossing_abbreviations, grammar_sections,
  section_sentences, text_tags) + cols on sentences (discourse_role, example_label, citations),
  sources (orthography), tags (kind, code)
- [x] `20260714_structured_grammar.sql` migration (CREATE + indexes + bump-lmod ai/au +
  server_seq ai/au for 5 tables + ALTERs + re-declared `process_delete_cascade` [28 tables])
- [x] `dict-syncable-tables.ts` register 5 tables (FK-safe order)
- [x] `dict-writes.ts` add section_sentences + text_tags to JUNCTION_TABLES
- [x] `dictionary-json-columns.ts` test (sentences += citations; new tables asserted)
- [x] `dictionary-grammar-schema.test.ts` — new tables/cols exist, self-FK subtree cascade,
  entry_id SET NULL (section outlives entry), junction cascade both sides, UNIQUE keys, server_seq
- [x] `openapi.ts` — lifted `DISCOURSE_ROLES` to `constants.ts` (spec enum ⇄ DB column single source)
- [x] Live-db proxy auto-exposes new tables (derives from `DICT_SYNCABLE_TABLES` + `dict_schema`)

**Verification:** 24 touched tests + full `src/lib/db` suite (478 tests / 51 files) green; tsc clean;
lint clean. NOT yet committed (schema push = prod migration — checkpoint with Jacob first).

**PARKED — multi-orthography IGT (corpus agent's final note, 2026-07-14, NOT a blocker):**
When a sentence has tokens in >1 orthography (their later RPA ↔ Miao-pinyin same-speech goal), the
convention is `gloss` + `entry_id` ride the `default`-orthography token list; other orthographies are
index-aligned alternate spellings. **Already supported by the shape** — `SentenceTokens =
Record<orthography, SentenceToken[]>` is per-orthography, and `SentenceIgtWriteDraft.tokens` is keyed
by orthography code. Additive whenever they get there (transliteration setup OR entries carrying both
orthographies); the JSON token column does NOT foreclose it. Jacob: "yes I want it somehow… I don't
care [which mechanism]." No schema change now.

Next: Milestone 2 — `$lib/db/server/grammar-sections.ts` shared write module + `/api/v1/*` endpoints
(gives the corpus agent the real write API, replacing the draft 404s) + flip those ops off `draft`.

### Milestone 2 (2026-07-14, IN PROGRESS) — v1 server module + endpoints
Constraints from Jacob: **Jacob does ALL commits/pushes now** (I never commit). **At most ONE new
`.sql` per migration lane for the whole feature** → the existing uncommitted
`20260714_structured_grammar.sql` is my one dict migration; fold any further schema need INTO it, no
new migration files.

Scope split: **2a (this pass)** = the dict.db grammar surface (sections CRUD+reorder, section↔sentence
link/unlink, clause-slots CRUD, glossing-abbreviations CRUD, reverse entry→grammar, text-tags
link/unlink, grammar intro on shared.db) → flip these ops off `draft`. **2b (next)** = the IGT
sentence-WRITE additions (writable `tokens`+`gloss`+`morphemes`, `citations`, `example_label`,
`discourse_role` on the existing sentence PATCH / text-sentence create; `sources.orthography` on
source PATCH) — these modify EXISTING sentence/source write paths, stay `draft` until 2b.

Machinery (verified): server module = pure fns over a better-sqlite3 dict.db using `merge_dict_row`
(same path+history as a browser push) + `run_tombstone_delete` + `read_last_modified_at` (cursor);
routes use `load_v1_dictionary_context({ event, access })` + `mirror_dictionary_cursor`; input helpers
`to_multistring`/`resolve_client_id`/`to_string_array`; ordering `initial_keys`/`key_between`. Template
= `v1-texts.ts` + `v1-sub-resources.ts` + the texts routes.

Routes to add (12) + flip drafts: `grammar/` PATCH · `grammar/sections/` GET·POST ·
`grammar/sections/[sectionId]/` GET·PATCH·DELETE · `…/sentences/` POST · `…/sentences/[sentenceId]/`
DELETE · `grammar/clause-slots/` GET·POST · `grammar/clause-slots/[slotId]/` PATCH·DELETE ·
`entries/[entryId]/grammar/` GET · `grammar/glossing-abbreviations/` GET·POST ·
`…/[code]/` PATCH·DELETE · `texts/[textId]/tags/` GET·POST · `texts/[textId]/tags/[tagId]/` DELETE.

**Milestone 2a — ✅ DONE (2026-07-14), all tests green:**
- [x] `$lib/db/server/grammar-sections.ts` — shared write module: sections CRUD (create/get/list/
  update/delete) w/ fractional sibling ordering + parent nesting + entry/sense/slot links + FK
  validation; `section_sentences` link/unlink (append/after/dedupe); `clause_slots` CRUD;
  `glossing_abbreviations` find-or-create-by-code CRUD; reverse `list_entry_grammar_sections`.
- [x] `v1-texts.ts` — `list_text_tags` / `link_text_tag` (find-or-create kinded tag + link, idempotent) /
  `unlink_text_tag`.
- [x] 11 route files wired (all but grammar-intro): sections (2) · section/[id] (3) · sentences link (1)
  + unlink (1) · clause-slots (2) · clause-slot/[id] (2) · entries/[id]/grammar (1) · glossing (2) ·
  glossing/[code] (2) · text tags (2) · text tag/[id] (1).
- [x] openapi: flipped those 11 paths' ops + their schemas off `draft` (removed `[DRAFT]`/`...DRAFT`/
  "not yet implemented"); rewrote the "Draft surfaces" legend; only `PATCH …/grammar` (intro) stays draft.
- [x] `grammar-sections.test.ts` (17 unit tests) + `grammar/sections/server.test.ts` (3 route tests,
  incl. read-key 403 + 400 + full CRUD/link/reverse/text-tag round-trip) + openapi.test.ts updated.
- [x] Verified: `src/lib/db` + `src/routes/api/v1` = 608 tests green; `pnpm check` 0 errors; lint clean.

**STILL DRAFT (deliberately deferred):**
- **Grammar INTRO** `PATCH …/grammar` — needs the shared.db `dictionaries.grammar` string → MultiString
  promotion (a shared-lane migration + settings-UI + home rendering). Left draft; a human can still set
  the plain-string intro via dictionary settings today.
- **Milestone 2b — IGT sentence WRITES**: make `sentences.tokens` writable with per-token `gloss` +
  `morphemes`; `sentences.citations` / `example_label` / `discourse_role`; `sources.orthography`. These
  ALTER the existing sentence PATCH / text-sentence create + source PATCH paths (schemas
  `SentenceIgtWriteDraft` etc. still draft). Highest value for the corpus agent's 1,072 IGT examples.

**2a COMMITTED** `49303666` (2026-07-14). Pre-commit ran the full vitest suite (green).

### Milestone 2b + grammar-intro→dict.db pass (2026-07-14) — IN PROGRESS

Jacob green-lit continuing to build everything doable BEFORE the next deploy (he commits to bookmark;
NO push/deploy until the whole pre-deploy batch is done). **Direction change on the intro** (interview
2026-07-14): the legacy `dictionaries.grammar` shared-db blob does NOT become a shared-db MultiString —
it moves OUT of shared.db and INTO each `dictionaries/{id}.db` as a **`grammar_sections` row** (the
"first section"). End goal: the `dictionaries.grammar` column is GONE. Rug-pull on the current agent
sentence-write API is fine (Jacob is the only consumer) — do it all at once here.

**Locked decisions:**
- **Q1 scope (THIS pass, no deploy needed to build/verify):** (a) backfill SCRIPT (blob → ONE dict.db
  `grammar_sections` row per dict), READY but NOT run; (b) spec/schema cleanup — DROP the obsolete
  `PATCH …/grammar` intro endpoint + `GrammarIntroPatch`, make `grammar_sections.title` OPTIONAL;
  (c) Milestone 2b IGT sentence writes (flip off draft). The CUTOVER (run backfill + freeze the old
  column's edits + switch grammar-page/home-snippet/sitemap rendering to sections + eventually DROP the
  column via a later shared migration) happens WITH the structured-grammar UI milestone — that rendering
  IS that UI. Don't freeze/switch rendering now (would strand managers with no edit path).
- **Q2 migrate shape:** ONE top-level section per dict, `body = { [gloss_languages[0]]: blob }`,
  deterministic + lossless. (Auto-split into a tree is a LATER per-dict reviewable pass — see "Circle
  back" below.)
- **Q3 title:** make `grammar_sections.title` optional (nullable) → import a HEADLESS body-only section
  (no redundant "Overview" heading colliding with blobs that open with their own `##`). Require
  `title || body` in `create_section` so a section still can't be fully empty.
- **Q4/backfill run:** committed idempotent `tsx` script (`site/scripts/`), reuses the REAL server
  helpers (`get_shared_db` / `get_dictionary_db` / `create_section` — the whole chain is
  `$env`/`$app`-free, only `v1-route-context.ts` pulls `@sveltejs/kit`), deterministic section id =
  uuid5(dict_id) so re-runs no-op via `create_section`'s own id-idempotency. After each create it
  inlines `mirror_dictionary_cursor`'s effect (`UPDATE dictionaries SET updated_at=<cursor>,
  entry_count=…`) so the snapshot builder (`WHERE updated_at > COALESCE(snapshot_uploaded_at,'1970')`)
  rebuilds the R2 snapshot → clients pull the new section. Run POST-deploy (schema must be live).

**Grounding (verified in code + live prod shared.db):**
- 170 dicts have non-empty grammar; the prose language == `gloss_languages[0]` in ALL of them (151 en,
  8 es, 4 fr, 3 pt, +5 singletons); ZERO have empty gloss_languages. First-gloss key is safe.
- dict.db content (texts/sentences/`grammar_sections`) renders CLIENT-SIDE via `page.data.dict_db`
  (LiveDb), not SSR — so the public grammar-page render under the new model IS the section UI (deferred).
- `dictionary.grammar` render sites (all stay reading the frozen column until the cutover): grammar page
  (render+edit), home-snippet `[dictionaryId]/+page.svelte:250`, sitemap presence-check.
- No server-side token matcher exists; `sentences.tokens` has NO write path today → 2b is purely additive.
- All 2b columns already exist in the committed `20260714_structured_grammar.sql` (Milestone 1):
  `sentences.tokens`(JSON)/`.citations`(JSON)/`.example_label`/`.discourse_role`, `sources.orthography`.

**Build checklist (this pass) — ✅ ALL DONE (2026-07-14), all tests green:**
- [x] Task 1 — `grammar_sections.title` OPTIONAL: `dictionary.ts` dropped `.notNull()`; folded
  `title TEXT NOT NULL`→`title TEXT` INTO `20260714_structured_grammar.sql` (undeployed, one-lane rule);
  `create_section`/`update_section` require `title||body`; read shape returns `{}` for headless;
  openapi `GrammarSectionInput` title no longer required; tests updated (headless-section test added).
- [x] Task 2 — DROPPED `PATCH …/grammar` path + `GrammarIntroPatch` (intro = the first section now);
  retagged `grammar` tag LIVE; rewrote the info.description legend (grammar + IGT LIVE, no draft);
  removed the now-orphaned `DRAFT` const; `openapi.test.ts` path/schema snapshots updated (asserts NO
  schema carries `x-status: draft`).
- [x] Task 3 — Milestone 2b IGT sentence writes: new `$lib/api/v1/sentence-igt.ts` (`resolve_sentence_igt`
  L→R cursor offset derivation + text-join fallback + neutral-`default` gloss key via `to_multistring`,
  `to_citations`, `to_discourse_role`; +inline tests); `SentenceIgtFields` on `SentenceInput`/`SentencePatch`
  (entry-input) + `TextSentenceInput` (v1-texts); `SourceInput.orthography`; threaded through
  `build_sentence_rows`/`apply_sentence_update`/`read_sentence_record` (v1-entry-write),
  `build_text_sentence_row`/`list_text_sentences` (v1-texts), `create_source`/`apply_source_update`
  (v1-sources); citation slugs validated against the source registry. openapi: draft schemas flipped
  live + renamed (`SourceCitation`/`Morpheme`/`SentenceTokenInput`/`SentenceTokenFull`), IGT fields
  spread into the sentence-write schemas via `sentence_igt_props`, read fields added to
  `SentenceFull`/`TextSentenceFull`; standalone `*Draft` wrappers removed. Write-path + source tests added.
- [x] Task 4 — backfill `scripts/one-off/2026-07-14-grammar-blob-to-sections.cjs` (raw better-sqlite3,
  matches the `.cjs` one-off precedent so it runs via `docker exec node` in prod — NOT a `$lib`/tsx
  script, which the built container can't run). Headless body-only section under `gloss_languages[0]`,
  deterministic `uuid5(dict_id)` id (idempotent, skip-if-exists), `sort_key='i'`, bumps shared.db
  `dictionaries.updated_at` → snapshot rebuild. `DRY=1` preview; skips dicts missing the table / local
  file. VERIFIED end-to-end on throwaway data (create → idempotent re-run → correct body/id/sort_key,
  empty-grammar dict untouched). RUN POST-DEPLOY (after the migration is live), back up shared.db first.

**Verification:** full `pnpm vitest run` = 1636 passed / 3 skipped; `pnpm check` 0 errors; eslint clean.

**⚠️ DEPLOYED EARLY — accidental push, 2026-07-14.** Both bookmark commits (`49303666` 2a +
`312ea0d3` 2b/intro-migration) were pushed to `main` by accident and the VPS deploy ran. **Post-deploy
health audit = ALL CLEAR** (verified from live prod): homepage/`/dictionaries`/real dict `babanki` all
200 → the 315-line per-dict migration applied cleanly on real data; new `/api/v1/.../grammar/sections`
route returns 401 (new container live); server logs show NO 500s / SQLite / migration errors (only
benign pre-deploy `og_render_failed`); `dirty_rows_stuck` FLAT (editors saving fine); `schema_outdated`
409s are the chronic self-healing `client-behind-recovery` pattern (LOWER today than baseline, not a
spike); legacy `dictionaries.grammar` blob intact + still editable (no manager stranded); the "dropped
`PATCH …/grammar`" was a draft-spec entry, never a live route. The shipped changes are ADDITIVE ONLY —
the deferred **cutover** (run backfill, freeze old column, switch rendering, drop column) is NOT in
these commits, so the old blob stays authoritative. **The v1 grammar/IGT write surface is now genuinely
callable in prod** (corpus agent can feed structured data into tables nothing renders yet — harmless).

**Still TODO post-deploy:** the backfill (`scripts/one-off/2026-07-14-grammar-blob-to-sections.cjs`) is
correctly NOT run — it lands WITH the UI milestone (running it before rendering exists is premature).
Back up shared.db first when it does run.

**Circle back (Jacob's ask, AFTER the dust settles — NOT this pass):** eyeball the longer migrated
blobs and split/prettify them into proper multi-section trees where it adds value (per-dict, reviewed).

Then: UI milestones (grammar page rewrite = the cutover render, entry "Grammar notes", clause diagram).

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

---

## CORE UI PASS (Milestone 3 + entry-notes half of 4) — build plan (2026-07-14)

Interview locked (2026-07-14, tier 2): **Q1** grouping = core-first (this pass = grammar-page tree
render + per-language MarkdownEditor stack + reorder/nest + cutover render w/ blob fallback + entry
"Grammar notes" read-only block; DEFERRED to pass 2 = clause diagram, texts motif tagging, sentence-
reference examples). **Q-reorder** = up/down + indent/outdent buttons (no DnD lib; `key_between` for
sibling order, `parent_id` for nesting). **Q-edit-surface** = inline expand-in-place editor
(full-width per-language MarkdownEditor stack + live preview, like today's blob editor), NOT a
Slideover. **Q-entry-notes** = read-only reverse list (sections whose `entry_id`/`sense_id` = this
entry), linking into the grammar page; entry→section linking is done from the section editor.
**Q-cutover-flip** = section-tree RENDER stays admin-3-gated during preview (public keeps seeing the
`dictionaries.grammar` blob even on dicts with test sections); the cutover deploy runs the backfill
AND lifts the render gate together; EDIT gate stays admin-3 until GA.

### Grounded machinery (verified in code this session)
- Read: `page.data.dict_db.<table>.rows` (reactive array) / `.id(id)` / `.loading` / `.delete(id|ids)`.
  Rows expose `._save()` (persists changed cols) + `._delete()`. Create: `dict_db.<table>.insert(row|rows)`
  → parsed rows; `.upsert(...)`; junctions via `dict_db.writes.link_junction/unlink_junction({table,key})`.
- Fractional order: `key_between(a,b)` / `initial_keys(n)` from `$lib/api/v1/fractional-index` (already
  used by entry star + text sentences — compute new `sort_key` in the component from current siblings).
- Per-language field stack pattern = `text/[textId]/SentenceEditPanel.svelte` (iterate langs, one field
  each). Markdown render = `$lib/markdown/render` `render_markdown_to_html` + `$lib/markdown/sanitize-rich-text`
  `sanitize_rich_text`; editor = `$lib/markdown/MarkdownEditor.svelte` (dynamic import, like today's page).
- Language axis = gloss/analysis languages: `dictionary.gloss_languages` +
  `order_entry_and_dictionary_gloss_languages` ($lib/helpers/glosses).
- Story mock pattern: `page_data: { t: mock_t, dictionary, dict_db }` where `dict_db` is a plain object
  exposing just the collections the component reads (`{ grammar_sections: { rows: [...] , loading:false }, ... }`).
- Entry page: `entry/[entryId]/+page.svelte` renders `<EntryDisplay/>`; add `<GrammarNotes/>` after it,
  gated `auth_user.admin_level >= 3` (data already provides `auth_user`, `dict_db`, `dictionary`, entry w/ senses).

### Files to build
- `[dictionaryId]/grammar/grammar-tree.ts` (+ `.test.ts`) — pure: `build_section_tree(rows)` (flat→nested
  by parent_id, sorted by sort_key), reorder/nest key math (`move_up/down` → new sort_key among siblings,
  `indent` → become last child of prev sibling, `outdent` → become next sibling of parent), `derive_number_label`
  (dotted decimal from tree position when `number_label` NULL).
- `[dictionaryId]/grammar/GrammarSectionsView.svelte` — reads `dict_db.grammar_sections`, builds tree,
  renders nodes; admin-3 edit controls (add root section, per-node up/down/indent/outdent/edit/delete).
- `[dictionaryId]/grammar/GrammarSection.svelte` — one node: number + title + body + usage_conditions
  (per active gloss lang, markdown→html) + recursive children; inline `SectionEditor` when editing.
- `[dictionaryId]/grammar/SectionEditor.svelte` — inline full-width per-language MarkdownEditor stack
  (title/body/usage) + entry/sense link picker (reuse entry search from `AddRelatedEntryModal`) + live preview.
- `[dictionaryId]/entry/[entryId]/GrammarNotes.svelte` — read-only reverse list, admin-3-gated.
- `$lib/corpus/grammar-preview.ts` — `grammar_sections_visible({ auth_user })` = admin_level ≥ 3 (the
  render gate; flip to public at cutover) — parallels `corpus-preview-guard.ts` but RENDER-conditional (no redirect).
- Rewrite `[dictionaryId]/grammar/+page.svelte`: KEEP the legacy blob intro (render + manager edit) for
  everyone (the "blob fallback"); when `grammar_sections_visible` ALSO render `<GrammarSectionsView>` below.
  Update `+page.ts` to surface `auth_user` + `dict_db` needs (dict_db already on page.data).
- Stories: `GrammarSection`, `SectionEditor`, `GrammarNotes`, and the rewritten `_page.stories.ts`
  (Viewer/ManagerBlob unchanged + new Admin3Tree / Admin3Editing / EmptyTree stories).
- i18n EN keys: `grammar.*` / `section.*` in `$lib/i18n/locales/*en.json` (EN only).

### DEFERRED to pass 2 (do NOT build now): clause slot badge/diagram + slot picker; example-sentence
attach/detach/order + tappable/karaoke render; texts motif/genre tag chips + filter; discourse-role.

### Verification: svelte-look screenshots for each new component; unit tests for grammar-tree; `pnpm test`
/ `tsc` / `pnpm lint` / `pnpm check`. NO deploy (build behind admin-3, verify with mocks + local).

### ✅ CORE UI PASS DONE (2026-07-14) — all verified, NOT committed (awaiting Jacob's go)
Built:
- `grammar/grammar-tree.ts` (+ 16 unit tests) — `build_section_tree` (flat→numbered nested tree, orphan/
  self-parent→root, positional + `number_label`-override numbering, depth/index/sibling_count),
  `ordered_children`, `flatten_tree`, and the fractional key ops `move_up_key`/`move_down_key`/
  `append_child_key`/`after_sibling_key`.
- `$lib/corpus/grammar-preview.ts` — `grammar_sections_visible` / `grammar_sections_editable` (admin-3;
  the RENDER gate widens to public at cutover, EDIT stays admin-3 to GA). **Cutover TODO is documented in
  the file's header comment.**
- `grammar/grammar-section-actions.ts` — shared `GrammarSectionActions` type for the recursive render.
- `grammar/GrammarSectionsView.svelte` — reads `dict_db.grammar_sections.rows`, builds the tree, holds
  `editing_id`, does the reorder/nest fractional math + writes (`insert`/`delete`/row `_save`), add-root.
- `grammar/GrammarSection.svelte` — recursive node: number, per-language title, markdown body +
  usage_conditions, entry chip (→ entry page), edit controls (edit/up/down/indent/outdent/delete +
  add-subsection) with correct enablement.
- `grammar/SectionEditor.svelte` — inline expand editor: per-language title input + MarkdownEditor stack
  (cached import promise so titles paint before tiptap) + collapsible usage_conditions + entry-link picker
  (reuses `page.data.search_entries` / `entries_data`).
- `entry/[entryId]/GrammarNotes.svelte` — read-only reverse list (sections where `entry_id`/`sense_id` =
  this entry), admin-3-gated, links to `/{dict}/grammar#section-{id}`.
- Rewrote `grammar/+page.svelte`: KEPT the blob intro (render + manager edit) for everyone; renders
  `<GrammarSectionsView>` below with a preview badge when `grammar_sections_visible`. Wired `<GrammarNotes>`
  into `entry/[entryId]/+page.svelte` (admin-3-gated).
- i18n: top-level `grammar.*` block added to `en.json` (EN only).
- Stories: `GrammarSection` (ReadOnly/Editable), `SectionEditor` (Editing/WithLinkedEntry), `GrammarNotes`
  (WithNotes/NoMatches), rewritten `_page.stories.ts` (+ Admin3Sections / Admin3Empty).

**Verification (all green):** grammar-tree 16/16; full `pnpm vitest run` = 1652 passed / 3 skipped;
`pnpm check` 0 errors; eslint clean on all new files (only pre-existing entry-page star warnings remain).
svelte-look screenshots (light+dark) confirmed: tree render + numbering + entry chip + usage block, edit
controls w/ correct enablement, GrammarNotes list, blob-intro-only for non-admin Viewer, blob+tree+badge
for admin-3. (MarkdownEditor body = async tiptap mount, not captured in static screenshots — same as the
existing blob editor; renders at runtime.)

### PASS-2 (next): clause-template diagram + slot picker; example-sentence attach/detach/order + tappable/
karaoke render (`section_sentences`); texts motif/genre tag chips + filter (`text_tags`); discourse-role.
Then CUTOVER (run backfill + widen `grammar_sections_visible` to public) + eventually lift EDIT gate → GA.
