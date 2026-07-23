# Texts & sentences pipeline — corpus ingestion, unified search, word→entry matching

Level up LD from entry-driven documentation to corpus-driven documentation: drop in a text (or a
single sentence) → it becomes ordered sentences → each word/phrase either matches an existing entry
or surfaces as an entry suggestion a human can confirm. Entries/sentences/texts become three
searchable first-class citizens in ONE search surface. Karaoke playback (sentence audio/video +
word timings) rides on the same foundation.

**Status: M1 + M2 COMPLETE (2026-07-05), M3 (matching) ✅ COMPLETE (2026-07-23, pushed a4be4ae0),
M4 (suggestions queue + v1 parity) ✅ COMPLETE (2026-07-23, pushed 561882e9) — all behind the
admin-3 gate (LIFT AT GA). Karaoke PLAYBACK shipped separately (fd1518a7, 2026-07-18: `$lib/media/
media-timings.ts` decode utils, `TextAudioPlayer`, `KaraokeSentence`, v1 timings PATCH endpoints).
M5 (audio attach + waveform timings editor — REFRAMED 2026-07-23, tap-along is DEAD)
✅ COMPLETE (2026-07-23, mustang). Remaining: M6 (auto-align via forced alignment — separate
issue `.issues/auto-align-timings.md`).**

## M5 — audio attach + waveform timings editor (✅ COMPLETE 2026-07-23, mustang)

### Interview decisions (2026-07-23)

- **Tap-along timings entry is DEAD.** Timings become data that arrives from forced alignment
  (M6) or the v1 API (external pipelines like tutor's wenshanhua push already do this). The
  human's job is *adjusting* aligner output, not creating timings by ear — "listening to long
  things and hitting the spacebar is error-prone and tedious; we're moving to a more automatic
  world."
- **Editor UX**: "Adjust timings" opens a full-width editor panel — sentence-scoped zoom with
  prev/next sentence nav; waveform with a labeled region per timed token; drag each region's
  start/end edge independently (gaps allowed, clamped by neighbors — the classic aligner error is
  word TAILS running long/short); tap a region to play just that word; save re-encodes all timing
  strings. Editor hidden when the audio row has no timings.
- **Attach surfaces**: reader text-level "Add audio" (record or upload + speaker select) when no
  text audio exists; sentence detail page gets attach + player + karaoke (sentence-scoped
  timings, cursor from 0). NOT in SentenceEditPanel (sentence page is the per-sentence home).
- **Permission**: contributor+ (`can_edit`), all still behind the admin-3 preview gate.
- **Alignment itself is M6** (own issue) — LD-owned agnostic Modal app, LD-server-side
  align_form derivation, manual button first, per-dict "approved → automatic" switch later.

### Build plan — ALL DONE

1. ✅ **`encode_token_spans`** in `$lib/media/media-timings.ts` — inverse of
   `unpack_timing_string`; rounds via the cursor so decode reproduces the chain exactly
   (fractional drag positions would otherwise drift). Round-trip tests.
2. ✅ **`insert_audio` owner extension** — guarded-writes + `add_audio` accept exactly one of
   `entry_id | sentence_id | text_id` (worker `insert_audio_local` already passed rows through).
3. ✅ **`AttachAudioModal`** (`$lib/media/`) — attach (SelectSpeaker + Record/Select + progress)
   AND manage (waveform, speaker/source reassign, download, delete) for text/sentence owners.
4. ✅ **Reader wiring** — no audio → "Add audio" row; with audio → manage pencil +
   "Adjust timings" (only when `timings` non-empty) beside the sticky player.
5. ✅ **Sentence page** — player (moved `TextAudioPlayer` → `$lib/media/AudioPlayer.svelte`) +
   karaoke on the token strip (single-sentence `build_text_timings`, cursor 0) + attach/manage +
   adjust-timings.
6. ✅ **`TimingsEditor`** (`$lib/media/` + pure `timings-editor-state.ts`) — full-screen portal
   overlay: fetch+decode → per-window canvas waveform (window-normalized peaks), sentence-scoped
   zoom w/ prev/next + arrow keys, min 100px/s with horizontal scroll (mobile), per-token regions
   w/ inside-edge drag handles + grab-offset, clamps (neighbors, cross-sentence floor/ceiling,
   20ms CTC-frame min), auto-play the word after a drag, tap region to hear it, staggered labels,
   save re-encodes every sentence with the chained cursor via `writes.update_audio`.
7. ✅ **i18n** — `timings.*` EN keys (adjust/editor_title/sentence_of/no_timings/drag_hint).
8. ✅ **Verify** — vitest (site suite 1919 passed; new round-trip/clamp/reflow tests),
   stories (TimingsEditor light+dark desktop+mobile, `csr: true` + synthesized WAV data-URI),
   e2e `/tmp/ld-m5-e2e.mjs` **26/26** on real wenshanhua timings (drag→save→reopen→restore
   round-trip left prod data byte-identical; sentence attach/delete; achi ingest+attach+cleanup),
   `pnpm check`/`tsc`/`lint` clean. Screenshots `/tmp/m5-*.png`.

### M5 lessons

- **Region drag handles must sit INSIDE their region** — straddling the edge (±7px) made adjacent
  tokens' handles overlap across small inter-word gaps and drags grabbed the wrong token
  (crushed a neighbor to the 20ms min in e2e run 1). Pair with a grab-offset so the edge doesn't
  jump to the pointer.
- svelte-look stories are **SSR by default** — components whose whole body lives behind `$effect`
  (fetch/decode) screenshot as their loading state; need `csr: true` + an `interactions`
  `waitForSelector`. svelte-look doesn't serve the app's `static/` — synthesize media as a
  data-URI in the story module.
- Generic `.nav-row`-style class names collide with app-shell elements in e2e selectors — scope
  queries to the overlay root.
- Whole-ms encode rounding means a reopened region can differ from the pre-save width by <0.02% —
  assert with tolerance.

## M4 — suggestions queue + v1 parity (✅ COMPLETE 2026-07-23, mustang)

### Interview decisions (2026-07-23)

- **Persistent ignore**: new syncable `ignored_forms` table in dict.db (normalized `form` key,
  standard audit columns), consulted by the matcher — ingest/re-analyze emits `status:'ignored'`
  for member forms so "ignore everywhere" survives future ingests and the queue converges.
- **Queue facets**: Unmatched + Ambiguous (multi-candidate) + Ignored (restore action). Default =
  Unmatched. Auto-unconfirmed stays reader-review-mode territory, NOT in the queue.
- **Form-wide link/create semantics**: entry-level `status:'confirmed'` on every non-confirmed
  occurrence; NO sense/junction writes from the queue (sense links stay per-occurrence in the
  reader — bulk junction writes would fabricate concordance data for polysemy).
- **Bulk actions**: checkbox multi-select, bulk IGNORE only. Link/create are per-row.
- **v1 scope**: POST `sentences/[id]/tokens/actions` (per-token confirm/ignore/unlink, logic
  extracted from `set_token_link_local` into a shared pure module), GET `suggestions` (same pure
  aggregation function as the client), form-level actions endpoint (ignore/restore/link/create).
  Timings PATCH deferred to M5.
- **Restore semantics** (agent-decided): delete `ignored_forms` row + clear `ignored` status on
  non-punct occurrences of the form lacking entry_id/sense, then re-match fills.

### Build plan — ALL DONE

1. ✅ Migration `20260723_ignored_forms.sql` (text_dialects template: table + updated_at/
   server_seq indexes + lmod triggers + server_seq ai/au triggers + cascade re-declare).
   Registered in: Drizzle `dictionary.ts`, `DICT_SYNCABLE_TABLES` (appended), 
   `DICT_NATURAL_KEY_COLUMNS` (`['form']`), convergence-test SPECS, dict-json-columns test.
2. ✅ Pure logic in `$lib/corpus/`: `aggregate-suggestions.ts` (3 facets, majority-casing
   display_form, freq sort, `count_unmatched_forms` cheap pill path), `token-actions.ts`
   (`apply_token_action` extracted from `set_token_link_local`, shared w/ v1), matcher accepts
   `ignored_forms` set (checked AFTER matching — a new entry beats the ignore list),
   `load_ignored_forms` beside `load_lexeme_index`.
3. ✅ Worker ops: `ignore_form` upserts `ignored_forms`; new `restore_form` (tombstone + clear
   occurrence ignores + immediate re-match), `link_form`, `create_entry_from_form` (link/create
   also LIFT a dictionary-level ignore); every analyze/ingest path loads the ignored set.
   Guarded writes (`ignore_form`/`restore_form`/`link_form`/`create_entry_from_form`),
   DictWrites typing, mocks. 6 new dict-writes tests (34 green).
4. ✅ `/[dictionaryId]/suggestions` page (corpus-preview-guard): facet chips w/ counts, rows w/
   snippet (own sentence-map — the lazy `.id()` store left samples blank on first paint),
   Create/Link(EntryPickerModal)/Ignore, ambiguous candidate pills, Ignored facet w/
   everywhere-badge + Restore, checkbox multi-select + bulk-ignore bar. Side-menu item +
   unmatched-count pill (admin-3 shield).
5. ✅ v1: GET `suggestions` (occurrences capped at 20/row, totals exact), POST
   `suggestions/actions` (ignore/restore/link/create_entry), POST
   `sentences/[id]/tokens/actions` (confirm/ignore/unlink, junction mirror + cleanup). Shared
   server module `$lib/db/server/v1-suggestions.ts` (merge_dict_row/delete_dict_row plumbing —
   full-row merges, partial rows violate NOT NULL on the upsert INSERT); 5 tests. openapi.json
   (`suggestions` tag, SuggestionRow/TokenAction schemas, tag_for_path rule) + openapi.test +
   snapshot.md guide table updated.
6. ✅ i18n: 15 new `token.*` EN keys (38 total — /fill-translations waits for GA per decision).
   Stories SKIPPED for the queue page (same rationale as TokenPopover: needs live page.data).

### Verification (2026-07-23)

- vitest full suite 1903 passed; `tsc` clean; `pnpm check` 0 errors; `pnpm lint` clean.
- Browser e2e `/tmp/ld-m4-e2e.mjs` — **35/35 green** on achi (mustang dev :3041): throwaway-text
  ingest w/ nonsense forms → queue facets/counts/snippets, ignore→`ignored_forms` synced
  server-side→ignored facet w/ badge→restore→tombstone verified, create-entry-from-form (entry+
  sense server-side, 2 occurrences confirmed entry-level, NO junction rows), link-form via
  picker modal (4 confirmed), ambiguous candidates render, bulk-select+bulk-ignore+restore,
  side-menu pill, dark + mobile screenshots (`/tmp/m4-*.png`), cleanup (text deleted, entry
  tombstoned, `ignored_forms` empty). Plus first-paint snippet check 8/8.
- v1 via curl (dev-auth admin-3 cookie): GET suggestions facets, ignore/restore round-trip w/
  sqlite verification, bad-action 400, tokens/actions confirm→unlink w/ junction semantics,
  ghost-entry 400, unknown-sentence 404, `openapi.json?tag=suggestions` serves the 3 paths + 2
  schemas.

### E2E lessons (M4)

- The FIRST guarded write on a fresh page load can hit `still_loading` — e2e must retry (same
  as M3's Re-analyze lesson; applies to queue actions too).
- `/texts/new` is a two-step flow: "Adjust sentences" → "Create text".
- Dark-mode override class lives on `<html>` (documentElement), not body.
- Queue `display_form` is majority-CASED — e2e row lookups must compare case-insensitively.

## M3 — matching (✅ COMPLETE 2026-07-23)

### State-of-the-world updates since the M3 section was drafted (2026-07-05)

- **`SentenceToken` grew `gloss` (MultiString) + `morphemes` (Leipzig IGT)** — added for the
  corpus agent's IGT import (commit `312ea0d3`, spec review in
  `.issues/ld-igt-corpus-feedback-2026-07-14.md`). The matcher/re-analyze must PRESERVE these.
- **v1 API already writes gold tokens**: `$lib/api/v1/sentence-igt.ts` (offset auto-derivation
  with a left-to-right cursor, text synthesis from forms, `status` defaults `'confirmed'`),
  threaded through sentence create/PATCH in `v1-entry-write.ts`. GAP: token `sense_id` is stored
  in the JSON but NOT mirrored to `senses_in_sentences` (only the entry-example create path
  writes the junction) — M3 closes this so agent-written sense links feed the concordance.
- **Karaoke shipped** (`.issues/text-reader-audio-karaoke.md`): reader renders `tokens.default`
  spans when timed; sentence-tap = play its span when audio+timing exist. Token tap targets must
  coexist (word tap → popover; non-word sentence area keeps play/select behavior).
- **Orama lives in the per-tab entry worker (comlink), NOT the leader worker** — the matcher
  won't sit next to Orama. It runs as leader-worker `dict_write` ops reading lexemes straight
  from dict.db via SQL (atomic per the op-mutex/transaction wrapper in `dict-instance.ts`),
  reusing `simplify_lexeme_for_search` (`$lib/search/augment-entry-for-search.ts`) for
  normalization parity with search.
- **wenshanhua has gold agent-written tokens** (local seed: 15 sentences with `tokens.default`,
  glosses; prod has ~1050 IGT examples) — prime test data AND clobber hazard.
- Sentences also carry `citations` / `example_label` / `discourse_role`; texts carry
  `summary`/`work_id`/tags/dialects — none block M3.

### M3 interview decisions (2026-07-23)

- **Popover = new anchored-popover primitive** in `components/ui/`: floating card near the word
  on desktop, bottom sheet on mobile. (No popover primitive existed; Modal/Slideover too heavy.)
- **Audience**: matched words tappable for ALL visitors (entry preview: headword, gloss, PoS,
  photo thumb, link to entry page). Confirm/link/create/ignore actions + unmatched/ambiguous
  highlighting are contributor+ only. Viewers see auto + confirmed links identically (no status
  distinction outside review mode).
- **Review mode** (unmatched/ambiguous highlighting + status distinction): default ON for
  contributor+, toolbar toggle to turn off for pure reading; never shown to viewers.
- **Auto-matcher NEVER sets `sense_id` or writes `senses_in_sentences`** — auto = `entry_id` +
  `status:'auto'` only; the junction is written exclusively on confirm. BUT agents acting on
  human instruction can write confirmed sense links via v1 (tokens PATCH) — hence the v1
  junction-mirror fix below.
- **Multi-sense confirm**: popover lists senses (gloss summaries), FIRST SENSE PRESELECTED —
  confirm stays one tap; single-sense entries skip the picker.
- **Concordance**: entry-level read-only "Used in N sentences" section. Split at render time by
  `sentence.text_id`: curated examples (`text_id` NULL) stay in today's editable per-sense UI;
  text occurrences render read-only, each linking to the reader anchored at the sentence
  (`/text/{id}#{sentence_id}`), capped list + "show all" → search pre-scoped to Sentences.
- **Auto re-tokenize on sentence text edit**, worker-side in the sentence-update write path:
  recompute tokens whenever text changes, carry over `entry_id`/`sense_id`/`gloss`/`morphemes`/
  `status` by normalized-form equality (ordered greedy); vanished forms drop their token +
  `senses_in_sentences` cleanup. Gold IGT tokens survive unless their word was deleted.
- **M3 scope extras**: sentence detail page gets the same token strip + popovers (shared
  component); "ignore everywhere" bulk action in the popover (not waiting for M4); match-coverage
  stat in the reader toolbar ("82% of words linked"). NOT in M3: dedicated v1 confirm-link
  endpoint (M4) — the existing tokens PATCH + junction mirror covers agents.
- **IGT gloss display**: popover shows token gloss + morphemes; the full under-word interlinear
  gloss line is a SEPARATE follow-up milestone (alongside structured-grammar display).

### M3 build progress (session 2026-07-23, mustang — handed off mid-verification)

**DONE (all code written, unit-tested, and largely live-verified):**
- ✅ Pure logic in `$lib/corpus/`: `tokenize-sentence.ts` (word/punct tokenizer, offsets,
  `normalize_token_form` = lowercase + simplify + APOSTROPHE-VARIANT unification — achi entries
  store U+2019 while sentence text has U+02BC; without unification nothing matches),
  `match-tokens.ts` (`build_lexeme_index` + greedy longest n-gram `match_tokens`, fill-only),
  `carry-over-tokens.ts` (two-pass ordered-greedy + moved-word rescue), `sentence-analysis.ts`
  (`analyze_sentence_tokens` pipeline + `tokens_equal` canonical compare + `load_lexeme_index`),
  `token-kind.ts`. All vitest-covered.
- ✅ Worker ops in `dict-writes.ts`: `analyze_sentences`, `update_sentence` (re-tokenize on text
  change + junction cleanup), `set_token_link` (confirm/ignore/unlink + junction mirror/cleanup),
  `create_entry_from_token`, `ignore_form` (bulk), `insert_sentences`; `insert_text` +
  `insert_sentence` now tokenize+match on ingest. 11 new tests in `dict-writes.test.ts` (29 total
  green) incl. gold-IGT byte-identical idempotency.
- ✅ Facade + guards: `DictWrites` typing in `dict-live-db.svelte.ts`, guarded ops in
  `guarded-writes.ts` (`analyze_text/analyze_sentence/confirm_token/unlink_token/ignore_token/
  create_entry_from_token/insert_sentences`, `update_sentence` now routes through the worker op);
  `AddSentence`/`AppendSentencesModal`/`SentenceEditPanel`/sentence-detail all switched off
  `_save()`/raw insert for text writes. `mocks/db.ts` updated.
- ✅ UI: `components/ui/Popover.svelte` (anchored card / mobile bottom sheet, z 70);
  `$lib/corpus/TokenizedSentence.svelte` (WHITESPACE-TIGHT parts renderer — template newlines
  between tokens render as spaces and break CJK/punctuation adjacency, hence the one-line block;
  absorbs karaoke; KaraokeSentence.svelte DELETED) + stories (4, verified light+dark);
  `TokenPopover.svelte` (entry preview via `$entries_data`, sense radio picker first-preselected,
  candidate list, link/create/ignore/unlink, `EntryPickerModal` at z 80 above popover);
  reader toolbar (Review toggle default-ON, Re-analyze, coverage stat), sentence `<button>` →
  `<span role="button">` (token buttons can't nest in a button); sentence-detail token strip +
  Re-analyze; entry-page `EntryConcordance.svelte` (text sentences via junction, expand-in-place
  instead of the search-scoped link — search can't filter sentences by entry); `Sense.svelte`
  filters `text_id` sentences out of editable examples (+ `text_id` added to the EntryData pick).
- ✅ v1 parity: `mirror_token_sense_links` in `v1-entry-write.ts` (additive/idempotent,
  unknown-sense-skipping), called from sentence PATCH, standalone create, v1-texts create+append.
  2 new tests green.
- ✅ i18n `token.*` group (23 keys, EN only).
- ✅ Headless e2e (`/tmp/ld-m3-e2e.mjs`, achi dict on mustang): 17/18 green (the 1 ❌ is a
  first-run-only "no tokens yet" precondition — local achi.db is now already analyzed). Verified:
  re-analyze, auto/ambiguous/unmatched/ignored rendering, phrase-merge ("Ri achi"), coverage
  stat, confirm→junction→entry-page concordance, entry picker, ignore, review-toggle semantics,
  preview-guard redirect. Screenshots /tmp/m3-*.png.

**E2E environment lessons (don't relearn):**
- Local-first + login ordering: visiting a dict page BEFORE login boots the OPFS db as viewer
  from the PROD R2 snapshot (locally-seeded rows absent, and the prod cursor makes local /changes
  a no-op). Log in from `/` first; editor boot then snapshots from the local VPS db.
- True logged-out viewers can't reach `/text/*` at all (admin-3 corpus-preview guard) — viewer
  token UX is verified via the ViewerMode story, not live.
- Dev server on mustang: `nohup pnpm dev` → log /tmp/ld-dev.log (port 3041), still running.

**Verification session (2026-07-23, mustang — ALL DONE):**
1. ✅ Full gates: vitest 1875 passed (the only 3 failures are the CONCURRENT media/R2-key
   session's WIP in `add-media.test.ts` / `media-route-handlers.ts` — not M3 files); `tsc` clean;
   `pnpm check` 0 errors; `pnpm lint` clean after fixing 14 fresh M3-file errors (indent-only in
   TokenizedSentence's whitespace-tight template — tag-internal, render-safe; destructuring in
   match-tokens/carry-over; SvelteSet in EntryConcordance) — e2e re-ran 41/41 after.
2. ✅ 41-check headless e2e (`/tmp/ld-m3-e2e.mjs` + idempotent server-side reset
   `/tmp/ld-m3-reset.sh`) — ALL GREEN, covering: reset→untokenized, Re-analyze, coverage stat,
   single-sense confirm (no radio), multi-sense confirm (sense radio, first preselected),
   ambiguous candidate pick, entry picker, ignore occurrence + Restore, ignore-everywhere
   (confirm dialog), create-entry-from-token (entry + junction verified server-side post-sync),
   review toggle, entry concordance, standalone sentence Re-analyze + popover, `/texts/new`
   fresh-ingest auto-match (no Re-analyze click) + text delete cleanup, mobile bottom sheet
   (375px, `.card.sheet` + dimmed backdrop), dark mode (reader + popover screenshots),
   viewer preview-guard redirect. Screenshots `/tmp/m3-*.png`.
3. ✅ BUG FOUND+FIXED during verification: trailing-apostrophe asymmetry — `WORD_MATCH` drops a
   trailing `'`/`’` from lexemes ("Juyub'" → key `juyub`) but U+02BC is category Lm so token
   "juyubʼ" kept it (key `juyub'`) → never matched. `normalize_token_form` now strips word-edge
   apostrophes after variant unification (tests added; achi coverage 36%→43%).
4. ✅ Pluralization nit fixed: `token.used_in_sentence` ("Used in 1 sentence") singular key +
   count===1 branch in `EntryConcordance.svelte`.
5. ✅ Stories decision: SKIP TokenPopover/Popover stories — TokenPopover needs live `page.data`
   (writes/entries_data/dictionary) which svelte-look mocks can't supply meaningfully, and
   Popover's anchor is a live HTMLElement; visual coverage comes from the 4 TokenizedSentence
   stories (light+dark, incl. ViewerMode) + the e2e screenshots of every popover state.
6. ✅ i18n `token.*` group is now 24 EN keys — run `/fill-translations` before GA.

**Verification lessons:**
- Guarded writes throw `still_loading` until the entries bundle loads — an immediate
  Re-analyze click after page mount is (correctly) blocked with a toast; e2e must retry.
- Server-side `INSERT INTO deletes (table_name, id)` is the clean way to remove rows in a reset
  script — the cascade trigger deletes the row and clients drop it via the tombstone sync.

### M3 build plan

Pure logic in `$lib/corpus/` (unit-tested), writes as leader-worker ops in `dict-writes.ts`,
UI shared between reader + sentence detail.

1. **Tokenizer** — `$lib/corpus/tokenize-sentence.ts`: whitespace + punctuation split, char
   offsets, punctuation kept as tokens with `status:'ignored'`; tokenizes the default/
   first-populated orthography only (v1). Normalizer = lowercase + `simplify_lexeme_for_search`
   (shared helper so token forms and lexeme forms normalize identically).
2. **Matcher** — `$lib/corpus/match-tokens.ts`: pure fn over a prebuilt lexeme index
   (normalized form → entry ids, all orthographies; multi-word lexemes via greedy longest n-gram
   up to the longest lexeme word-count). Single hit → `entry_id`+`status:'auto'`; multiple →
   `candidates`; none → unmatched.
3. **Carry-over** — `$lib/corpus/carry-over-tokens.ts`: re-tokenize preservation by normalized
   form (ordered greedy), carrying entry/sense/gloss/morphemes/status; returns dropped sense_ids
   for junction cleanup. Used by both edit-hook and Re-analyze.
4. **Worker ops** (in `dict-writes.ts`, following the orchestrator pattern):
   - `analyze_sentences` ({ text_id | sentence_ids }): read entry lexemes via SQL, tokenize +
     match + carry-over, write `sentences.tokens`. Fills gaps only — never downgrades
     confirmed/glossed tokens.
   - sentence-update path: when `text` changes, re-tokenize with carry-over in the same
     transaction (+ junction cleanup for dropped links).
   - `confirm_token` ({ sentence_id, token_index, entry_id, sense_id }): status → 'confirmed',
     set entry_id/sense_id, link `senses_in_sentences`.
   - `link_token` (different entry via search picker) — same op with explicit entry.
   - `unlink_token` / `ignore_token` ({ scope: 'occurrence' | 'everywhere' }): everywhere =
     bulk status:'ignored' across all sentences for the normalized form. Junction cleanup: for
     TEXT sentences (`text_id` set) removing the last token referencing a sense drops the
     junction row; for STANDALONE sentences leave the junction alone (it may be a curated
     example link).
   - create-entry-from-token = existing `insert_entry` + `confirm_token` (entry's first sense).
5. **Ingest hook**: `insert_text_local` + AddSentence + append paths run tokenize+match inline
   (same transaction). Existing texts get tokens via the reader's "Re-analyze" button
   (contributor+) — no automatic backfill (per the 2026-07-05 "when it runs" decision).
6. **UI**:
   - `components/ui/Popover.svelte` — anchored floating card (desktop) / bottom sheet (mobile),
     new reusable primitive.
   - `$lib/corpus/TokenizedSentence.svelte` — renders `tokens.default` spans (absorbs/wraps
     KaraokeSentence's span rendering; karaoke highlight still works), token status classes,
     review-mode aware, falls back to plain text when no tokens.
   - `$lib/corpus/TokenPopover.svelte` — matched: entry preview + (editors) change-link/unlink/
     confirm; unmatched: confirm-candidates/link (entry search picker, AddRelatedEntryModal
     pattern — consider extracting a shared EntryPickerModal)/create/ignore; ambiguous:
     candidate picker; multi-sense: sense list, first preselected.
   - Reader toolbar: review-mode toggle + coverage stat + Re-analyze button.
   - Sentence detail page: same token strip + popovers.
7. **Entry page concordance**: "Used in N sentences" via `senses_in_sentences` joined to
   sentences with `text_id` NOT NULL (render-time split), capped + show-all → sentences-scoped
   search. Defensive: tokens referencing deleted entries render as unmatched.
8. **v1 parity fix**: sentence create/PATCH mirrors token `sense_id` → `senses_in_sentences`
   (additive, idempotent — removal stays a UI/worker concern). Shared server helper per the
   editing-parity direction.
9. **Verification**: vitest (tokenizer/matcher/carry-over round-trips incl. gold-IGT
   preservation), svelte-look stories (popover states light+dark), dev-auth + browser-tools e2e
   (ingest → auto-match → confirm → concordance), `pnpm check`/`lint`/`tsc`. Test dict:
   wenshanhua (gold tokens must survive Re-analyze byte-identically).

Known accepted risks: row-level LWW on concurrent token confirms (documented in code);
token/match writes appear in history (collapse later in history UI if noisy).

## M2 — ✅ DONE (texts pages + ingest + reader)
Shipped: `$lib/corpus/split-text-into-sentences.ts` splitter; `insert_text` write op (atomic
text + ordered sentences, `initial_keys` sort_keys); `/[dictionaryId]/texts` list, `/texts/new`
paste-ingest (live split preview → per-sentence adjust → create), `/text/[textId]` reader
(prose↔interlinear, sentence-tap Slideover edit, title edit, append, delete, `#sentence_id`
anchor); SideMenu Texts item (admin-3 shield); admin-3 redirect guards
(`$lib/corpus/corpus-preview-guard.ts`) — **LIFT AT GA**; i18n `text.*`; 29-check headless e2e.
- ⏭ Sentence audio attach — DEFERRED to M5 (timings milestone needs the audio UI anyway; schema +
  `insert_audio` already accept `sentence_id`).

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

## M1 — ✅ DONE (schema + unified search + sentences surfaced)
Shipped: migration `20260705_sentence_tokens_media_timings.sql`
(`sentences.tokens`/`audio.timings`/`videos.timings`) + Drizzle/types; sentences + texts Orama
indexes in the worker (`corpus-schemas.ts`, `augment-sentence-for-search.ts`, `search-corpus.ts`,
`collect_corpus_effects` before `apply_one`); `QueryParams` scope/in_text/has_translation;
`SearchScopeChips` (admin-3), `SentenceResults`, `TextResults`, `SentenceFilters`, scope-adaptive
add button; AddSentence modal; `/[dictionaryId]/sentence/[sentenceId]` detail page; i18n
`sentence.*`; tests + stories + headless e2e.

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

Follow `.knowledge/db/adding-a-syncable-dict-table.md` — columns only, no new tables, so
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
