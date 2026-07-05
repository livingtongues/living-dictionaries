# Texts & sentences pipeline — corpus ingestion, unified search, word→entry matching

Level up LD from entry-driven documentation to corpus-driven documentation: drop in a text (or a
single sentence) → it becomes ordered sentences → each word/phrase either matches an existing entry
or surfaces as an entry suggestion a human can confirm. Entries/sentences/texts become three
searchable first-class citizens in ONE search surface. Karaoke playback (sentence audio/video +
word timings) rides on the same foundation.

**Status: M1 + M2 COMPLETE (2026-07-05), shipped together behind the admin-3 gate. Next: M3
(matching).**

## M2 checklist (texts pages + ingest + reader)

- ✅ `$lib/corpus/split-text-into-sentences.ts` — pure splitter (terminal punct incl. `…`/CJK,
  single newline = sentence break, blank line = paragraph break → `ends_paragraph`) + inline tests
- ✅ `insert_text` write op in `dict-writes.ts` (text + ordered sentences w/ `initial_keys`
  fractional sort_keys, one atomic dict_write) + `DictWrites.insert_text` facade + tests (incl.
  re-send PK collision)
- ✅ `/[dictionaryId]/texts` list page (title via get_headword, sentence count, updated date, New
  text button)
- ✅ `/[dictionaryId]/texts/new` ingest: title + orthography picker (only if alternates) + paste →
  live split preview count → adjust phase (per-sentence textarea, merge-up, ¶ toggle, remove, add,
  back-to-paste re-split w/ confirm) → `writes.insert_text` → reader
- ✅ `/[dictionaryId]/text/[textId]` reader: paragraph prose ↔ interlinear (Show translations
  toggle), sentence tap → Slideover panel (EntryField text/translation, ¶ checkbox, delete),
  title edit (EditFieldModal), append modal (split + `key_between` chaining), delete text
  (sentences first — FK SET NULL), `#<sentence_id>` anchor scroll+highlight
- ⏭ Sentence audio attach — DEFERRED to M5 (timings milestone needs the audio UI anyway; media
  components are entry/sense-shaped and deserve a proper sentence variant, not a rushed one).
  Schema + `insert_audio` already accept `sentence_id`.
- ✅ SideMenu Texts item (admin-3 shield + count pill, `fa6-solid/scroll` icon), TextResults →
  reader links, SentenceResults in-text → `/text/{id}#{sentence_id}`, texts-scope add button →
  /texts/new
- ✅ Admin-3 redirect guards (`$lib/corpus/corpus-preview-guard.ts` + `+page.ts` on texts,
  texts/new, text/[id], sentence/[id]) — LIFT AT GA (stronger than /home's link-only gating, per
  Jacob's "only admin 3 changes" instruction)
- ✅ i18n EN `text.*` keys; full vitest (1271), check, lint clean
- ✅ Headless browser pass (29 checks): list, side menu, ingest (live count → adjust → merge-up →
  create), reader (paragraphs, panel edit incl. translation via EntryField modal, append ×2,
  prose toggle, anchor deep-link on hard load), deletes (sentence + whole text), search wiring
  (texts scope cards + add button, in-text sentence deep-links), all four gate redirects for
  non-admin + no chips/side-menu leakage, zero pageerrors; sync push verified server-side
  (creates AND tombstoned deletes landed in `.data/dictionaries/achi.db`); dark-mode screenshots

### M2 lessons

- `page.url.hash` is EMPTY during hydration of a hard load (server never sees the fragment) —
  anchor logic must fall back to `location.hash`; keep `page.url.hash` as the reactive source for
  client-side navs.
- EntryField's empty-value `at-end` class uses `order: 2` — its parent flex container must hold
  ONLY fields, or empty fields visually jump below unrelated siblings (bit the Slideover panel).
- puppeteer `page.goto` to the SAME url + `#hash` is a same-document navigation (no remount) —
  hard-load via `about:blank` first when testing anchor mounts.
- Modal (zIndex 60) portals later than Slideover (60) so EntryField's edit modal stacks correctly
  above the sentence panel — no z-index fiddling needed.

## M1 checklist

- ✅ Migration `20260705_sentence_tokens_media_timings.sql` (sentences.tokens, audio.timings, videos.timings) + Drizzle schema + `SentenceToken`/`SentenceTokens`/`MediaTimings` types + json-columns test expectations
- ✅ Bundle/watcher: `texts` in DATA_TABLES, `sentence_videos` + `sentence_photos` in JOIN_TABLES (read-dict-bundle.ts)
- ✅ Worker: sentences + texts Orama indexes — `corpus-schemas.ts`, `augment-sentence-for-search.ts` (tested), `search-corpus.ts`, orama.worker `create_corpus_indexes`/update/search, entry.worker `collect_corpus_effects` (runs BEFORE apply_one so it sees old row state) + corpus reindex in `apply_rows`; `_text`/`_title` get word+simplified tokens in the multilingual tokenizer (no suffix explosion)
- ✅ QueryParams: `scope`, `in_text`/`standalone` (two halves of one 3-state filter), `has_translation`/`no_translation`
- ✅ Entries page: `SearchScopeChips` (admin-3 gated w/ shield icon; non-admin URL `scope` param safely ignored), `SentenceResults` (live dict_db rows + doc booleans for badges), `TextResults` (cards, not linked until M2 reader), `SentenceFilters`, scope-adaptive add button (Pagination now takes an `add_button` snippet), scope-aware search placeholder
- ✅ AddSentence modal (EditFieldModal reuse) → insert standalone sentence → goto sentence page
- ✅ `/[dictionaryId]/sentence/[sentenceId]` detail page (EntryField reuse: text per orthography + translation per gloss language, delete → back to sentences scope, part-of-text breadcrumb)
- ✅ i18n EN keys (`sentence.*`, `dictionary.words`/`texts`)
- ✅ Tests (16 new/updated pass; full suite 1256 pass) + svelte-look stories (SentenceResults, SearchScopeChips — verified light+dark) + `pnpm check`/`lint` clean
- ✅ Browser verification (headless puppeteer, dev-auth admin 3 on seeded achi): chips, scope switch, diacritic-folded sentence search ("balam"→"bʼalam"), standalone/in-text facets, texts list, add-sentence flow, translation edit → live index update, delete → index removal, sync push to server db, migration applied server+client, zero pageerrors

### M1 lessons / gotchas for later milestones

- **`QueryParamStore.update()` passes the parsed URL param, NOT the store value** — it's `null`
  when no `?q=` is in the URL. Destructuring the callback arg crashes on first use from a clean
  URL (bit the scope chips; ClearFilters had the same latent bug — both now guard with `?? {}`).
- The svelte2tsx checker rejects passing a top-level-declared snippet to a component attribute
  (`Snippet` brand mismatch, "two different types with this name") — declare the snippet INSIDE
  the component tag instead (implicit snippet prop) and it types fine.
- Orama custom `sortBy` items are `[internal_doc_id: number, score, doc]` — docs can carry
  unindexed fields (`_created_at`, `_text_id`, `_sort_key`) for sorting/rendering; only schema
  fields are indexed/facetable.
- Texts delete: client FK `ON DELETE SET NULL` flips its sentences to standalone WITHOUT bumping
  their `updated_at` (invisible to the delta watcher) — `collect_corpus_effects`+`apply_one`
  mirror the nulling in the worker maps so `in_text` facets stay correct.
- Sentence-media junctions can outlive their media row in the worker maps (media tombstone
  arrives; cascaded junction deletes may not) — `process_sentence` filters junctions to live
  photo/video rows.
- Seeding dev sentences: write directly into `site/.data/dictionaries/<id>.db` with proper
  audit columns; lmod bump triggers fire on insert so client sync/snapshot picks them up.

## Decisions already made (interview 2026-07-05)

- **IA = hybrid**: Entries page stays primary; its search becomes unified with type-scope chips
  (Words · Sentences · Texts). New Texts browse + reader pages. NO standalone sentences page —
  sentences are reached via search scope, their parent text, and entry concordances.
- **Add-a-sentence entry point**: the primary add button on the search page adapts to the active
  scope (Words → "Add entry", Sentences → "Add sentence", Texts → "New text"), mirroring the
  existing `AddEntry` pattern. Contextual paths remain: example sentence from a sense (existing
  flow), append sentences inside the text reader.
- **Legacy example sentences ARE sentences**: everything users hacked in as "example sentences"
  (sense-linked, `text_id` NULL) surfaces in the Sentences scope. Filter facet: All / In texts /
  Standalone.
- **Tokens = JSON column on `sentences`** (not a per-word table — a 10k-word text would mean 10k
  synced rows in every client's OPFS DB). Confirmed word→sense links ALSO write the existing
  `senses_in_sentences` junction so concordance stays SQL-clean.
- **No suggestions table in phase 1** — suggestions are computed at runtime client-side by
  aggregating unmatched token forms. ⚠️ FUTURE CONVERSATION (out of scope): if matching later gets
  server/LLM help, computed suggestions need storage; revisit then.
- **Matching runs client-side in the leader worker** (owns dict.db + Orama). FLEx-grade morphology
  is a later, swappable matcher v2 (possibly server/agent-side) — same data model.
- **Permissions**: adding texts/sentences + confirming matches/creating entries from suggestions =
  contributor+ (same as Add Entry). One mental model.
- **Suggestion review** happens BOTH inline in the text reader (tap word → popover) AND on a
  dict-wide frequency-sorted queue page (side-menu item, count pill).
- **Timings**: per-SENTENCE only, never text-level. Steal tutor's compact format (see below).
  Don't over-engineer round 1; format refinement doesn't affect view layout.
- **Release gating**: everything admin-level-3 only at first (same shield pattern as the dict-home
  preview in `SideMenu.svelte`), but the views are designed for GA — gating must not shape the UI.

## What already exists (don't rebuild)

- Schema: `texts` (MultiString title, sources), `sentences` (`text`/`translation` MultiString,
  `text_id` FK, fractional `sort_key`, `ends_paragraph`, sources), `senses_in_sentences`,
  audio/videos attachable to texts AND sentences, `sentence_photos`/`sentence_videos`.
- v1 API: full texts CRUD (`$lib/db/server/v1-texts.ts` — create with ordered sentences,
  append, reorder, delete), sentences CRUD, media subresources on both.
- Client write path: `insert_sentence_local` (sense-linked example sentences) in
  `dict-writes.ts`.
- Search: in-worker Orama over entries only (`$lib/search/*`, fed by `orama-watcher.ts` +
  `read-dict-bundle.ts`; sentences already flow INTO entry docs via the bundle). A `_sentences`
  field sits commented-out in `entries-schema.ts`.

## Data model changes (one dictionary-migration)

Follow `.knowledge/migration/adding-a-syncable-dict-table.md` — columns only, no new tables, so
the checklist is light (no cascade-trigger rewrite, no `DICT_SYNCABLE_TABLES` change):

1. **`sentences.tokens` TEXT (JSON)** — keyed by orthography for future-proofing; v1 tokenizes only
   the default/first-populated orthography:
   ```ts
   type SentenceTokens = Record<string, Token[]> // orthography code → tokens
   interface Token {
     form: string          // surface form as it appears
     start: number         // char offset into that orthography's sentence text
     end: number
     entry_id?: string     // matched/linked entry
     sense_id?: string     // set on confirm (also mirrored to senses_in_sentences)
     candidates?: string[] // entry ids when auto-match is ambiguous (homographs)
     status?: 'auto' | 'confirmed' | 'ignored' // absent = unmatched; punctuation tokens get 'ignored' at tokenize time
   }
   ```
2. **`audio.timings` TEXT + `videos.timings` TEXT (JSON)** — tutor's compact word-timing format
   (`shared/utils/parse-words` + `encode-word-timings.ts` in tutor: pipe-delimited
   `"offset,duration|offset,duration|"`, offset relative to the end of the previous timed token,
   empty entry = untimed token e.g. punctuation). Two cases, one shape —
   `Record<sentence_id, string>`:
   - sentence-level media: one key, the sentence's own token timings.
   - text-level media: one key per sentence; each sentence's first offset chains from the previous
     sentence's end (tutor's `previous_end_ms` cursor — exactly Jacob's "sentence 2's first
     timestamp is the offset from the end of 1").
   Timings index against the sentence's `tokens` array for the default orthography (token count
   must match; punctuation tokens = empty entries). PORT (don't reinvent) tutor's
   `parse_words`/`encode_word_timings` incl. their round-trip tests.
3. **Registry updates**: `dictionary-json-columns.ts` inline vitest expectations (3 tables gain a
   JSON column), Drizzle schema, `dictionary.types.ts` for `SentenceTokens`/timings types.

No changes to `texts`. No suggestions table (runtime-computed). History note: token/match writes go
through the normal write path so they appear in history — acceptable; if too noisy, collapse in the
history UI later, don't special-case the write path.

## Tokenization + matching engine (client, leader worker)

New module `$lib/corpus/` (feature folder per lib layout conventions):

- **Sentence splitting** (ingest-time, main thread is fine): split pasted body on terminal
  punctuation (`.!?…` + ellipses + CJK `。！？`), blank line = paragraph break (`ends_paragraph`),
  editable preview before save. Keep the splitter pure + unit-tested.
- **Tokenizer**: whitespace + punctuation for v1; punctuation kept as tokens (status `ignored`) so
  char offsets and timing arrays stay complete. FUTURE: `Intl.Segmenter` for no-space scripts.
- **Normalizer**: reuse the diacritic-fold/IPA-simplify logic the Orama index already applies to
  lexemes (see `_lexeme` "simplified version" in `entries-schema.ts` / `augment-entry-for-search`)
  so token forms and lexeme forms normalize identically.
- **Matcher v1**: exact match of normalized token form against all normalized lexeme forms (all
  orthographies) → single hit = `entry_id` + `status:'auto'`; multiple hits = `candidates` (no
  entry_id); none = unmatched. Multi-word lexemes (phrases): greedy longest-match over token
  n-grams (entries' lexemes can be phrases — check n-grams up to the longest lexeme word-count).
- **When it runs**: on ingest (text/sentence save), on manual "Re-analyze" (text reader button +
  suggestions queue refresh), and that's it for v1. FUTURE: debounced auto re-match when entries
  change.
- **Suggestions (runtime)**: worker aggregates unmatched tokens across all sentences → unique
  normalized form, occurrence count, sample sentence ids. Powers the queue page. "Ignore
  everywhere" = bulk-set status `ignored` on all occurrences (persisted in tokens JSON — no new
  storage).
- **Confirm actions** (each writes sentences.tokens; sense-link confirm also inserts
  `senses_in_sentences`):
  - confirm auto match (pick sense if entry has >1)
  - link to a different entry (search picker)
  - create entry from form (existing entry-insert path, prefilled lexeme) → link
  - ignore (this occurrence / everywhere)
- **Sync/LWW caveat**: two users confirming different words of the same sentence at once = row-level
  LWW conflict on the tokens JSON. Rare; accept for v1, document in code.
- **Re-tokenize on sentence edit**: recompute tokens, preserve confirmed links by (normalized form)
  equality; drop links whose form vanished (and clean their `senses_in_sentences` rows).

## Search architecture

Parallel Orama indexes in the SAME worker (not one mega-index — entries keep rich facets):

- `sentences` index: doc per sentence — text (all orthographies, raw + simplified), translations;
  facets: `in_text` (boolean → All/In texts/Standalone filter), `has_audio`, `has_video`,
  `_sources`, `has_translation`. Feed from the same bundle/watcher (sentences + junctions already
  in `WATCHED_TABLES`).
- `texts` index: doc per text — title (MultiString) + maybe concatenated first-N-sentences preview;
  tiny (dozens of rows).
- UI: scope chips (Words · Sentences · Texts) in `SearchInput`/`View` area; `QueryParams` gains
  `type` (URL-driven via the existing `createQueryParamStore`). Default scope Words = today's page,
  zero regression. Facet sidebar swaps per scope.
- Result rendering: sentence results show vernacular + translation + parent-text breadcrumb or
  "standalone" + media badges; text results show title + sentence count.
- Result navigation: in-text sentence → text reader anchored to that sentence; standalone sentence
  → sentence detail page.

## Views / routes (all under `[dictionaryId]`, naming parallels entries/entry)

- **`/texts`** — browse list: title, sentence count, media badges, updated. "New text" button.
  Side-menu item with count pill (admin-3 shield during preview).
- **`/texts/new`** — ingest flow: title + orthography picker (only when dict has >1 orthography) +
  paste body → live segmentation preview (editable: merge/split sentences, paragraph breaks) →
  save via a new client write helper (same shape as `v1-texts.create_text` but through
  `dict-writes.ts`) → redirect to reader, matching kicks off.
- **`/text/[textId]`** — the reader; the heart of the feature:
  - paragraphs from `ends_paragraph`, sentences flow as prose; per-sentence translation display
    toggle (interlinear vs hidden)
  - every token is tappable: matched (subtle underline) → entry popover w/ link; unmatched
    (highlight) → confirm/link/create/ignore popover; ambiguous → candidate picker. A
    "review mode" toggle turns highlighting on/off for pure reading.
  - append/edit/reorder/delete sentences (contributor+), text title edit, sources
  - attach audio/video to the text or to individual sentences (existing media upload paths)
  - "Re-analyze" button; match-coverage stat ("82% of words linked")
  - karaoke playback once timings exist (M5): active token/sentence highlight from
    `parse_words`-style cursor chaining
- **`/sentence/[sentenceId]`** — lightweight detail for standalone sentences (in-text sentences
  deep-link to the reader instead): text + translation edit, token strip with the same popovers,
  media attach, timings editor, linked-senses list, "part of text X" redirect guard.
- **`/suggestions`** — the queue: runtime-aggregated unmatched forms, frequency-sorted, sample
  sentence snippets; row actions = create entry / link to entry / ignore everywhere. Side-menu
  item + count pill (contributor+; admin-3 during preview).
- **Entry page concordance**: entry detail gains "Used in N sentences" (via `senses_in_sentences`,
  distinguishing curated examples [`text_id` NULL] from text occurrences at query time). Capped
  list + "show all" → search page pre-scoped to Sentences.

## v1 API parity

Texts CRUD already exists. Add in the matching milestone (shared server helpers per AGENTS.md
parity direction): PATCH sentence tokens / confirm-link endpoint (writes tokens JSON +
`senses_in_sentences` via one shared module the UI write path mirrors), GET suggestions
(server-computed aggregate — same pure aggregation function as the worker), timings PATCH on
audio/videos. OpenAPI updates alongside.

## Milestones

- **M1 — schema + unified search + sentences surfaced**: migration (tokens/timings columns),
  scope chips + sentences/texts Orama indexes, legacy example sentences browsable (All/In
  texts/Standalone facet), scope-adaptive add button incl. "Add sentence" (standalone), sentence
  detail page (minimal: view/edit text + translation).
- **M2 — texts**: `/texts` list, `/texts/new` paste-ingest with segmentation preview, `/text/[id]`
  reader (read + sentence editing + media attach; no token UI yet), side-menu item.
- **M3 — matching**: tokenizer/normalizer/matcher in worker, tokens written on ingest +
  re-analyze, reader token popovers (confirm/link/create/ignore), `senses_in_sentences` writes,
  entry-page concordance.
- **M4 — suggestions queue** page + bulk actions + v1 API parity endpoints.
- **M5 — timings + karaoke**: port tutor `parse_words`/`encode_word_timings`, tap-along timings
  editor (space/click marks word ends during playback), karaoke highlight in reader + sentence
  page.

Each milestone independently shippable behind the admin-3 gate. Verify per milestone: vitest for
splitter/tokenizer/matcher/timings round-trip, svelte-look stories for reader/popovers/chips,
dev-auth + browser-tools for flows, `pnpm check`/`lint`/`tsc`.

## Explicitly out of scope (noted for later)

- **Sentence-like entries cleanup**: scan entries by lexeme length to flag sentences hacked in as
  entries (one dict has ~30K) and offer conversion to real sentences. NOT NOW — future issue.
- **Suggestion storage** if matching becomes server/LLM-assisted (future conversation).
- **Morphology matcher v2** (agglutinative languages; FLEx-style parses; inflected-form handling
  possibly via `entry_relationships` "form of" links).
- **FLEXtext interlinear import** — communities with FLEx corpora bring texts in pre-analyzed;
  sidesteps hard matching exactly where it's hardest. High-leverage future milestone.
- **Alternate-orthography tokenization**, `Intl.Segmenter` scripts, two-column/interleaved
  translation paste, sentence/text export surfaces, auto re-match on entry changes.
