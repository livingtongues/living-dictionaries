# Enxet import — first agent-driven production import

Import request: dictionary `enxet` (unlisted, fresh, gloss langs es+gn), file
`Enxet-LD.db` (source_files id `46cad7cd-3f53-42f1-b4cf-b40ff988691d`, thread
`66c9b38b-bec4-4155-99c9-cf6a41cd3476`, uploaded by Diego). Instructions: "Just
import everything."

## File analysis (done)

- NOT SQLite despite the name — a Toolbox/SFM (MDF) UTF-8 text file, CRLF.
- Markers: `\lx` (11,935), `\hm` (411), `\de` (14,262 Spanish), `\ge`/`\gn` (ALL
  effectively empty — the 51 "non-empty" `\gn` lines are word-wrap overflow of the
  preceding Spanish definition, verified in context).
- Parse results: 11,935 records, 0 missing lexeme, 0 (lexeme,homograph)
  collisions, 409 with homograph numbers, 2,131 multi-sense (max 9), 531
  lexeme-only, 23 empty `\de` values (drop).
- Working dir: `/tmp/enxet-import/` (file + `parsed.json` ledger + scripts).
  File fetched from R2 `livingdictionaries-attachments` key
  `import/enxet/46cad7cd…` using container env creds + local aws cli.

## Decisions (Jacob)

- ✅ Mint a per-dict API key directly in prod shared.db, then import via public
  `/api/v1` like an outsider (bulletproofs the guides). Admin-level API key is a
  FOLLOW-UP issue, not now.
- ✅ Create a best-effort source row — observed facts only, SIMPLE slug so the
  manager can iteratively improve the citation later. Also update the importing
  guide: ALL imports should get a source.
- ✅ `\de` values: use judgment per value — short translation-equivalents →
  `glosses.es`, prose → `definition.es`. Never copy to both. No fabrication.
- ✅ Full import in one run (batched ≤500, `import_id` rollback if problems).
- ✅ Report to Jacob here; skip the import thread reply.

## Plan

1. ✅ Analyze file, parse, profile
2. ✅ Mint API key — id `1b4af47a-6b25-4fe7-8e54-72f7208f33f6`, label "enxet
   import agent (Jacob)", attributed to jwrunner7@gmail.com (GOTCHA: must be an
   `$lib/admins.ts` email — jacob@livingtongues.org failed the requested-file
   owner guard). Raw token only in `/tmp/enxet-import/api-key.json`.
3. ✅ Source `enxet-lexicon` (id `4cb1598a-eb54-4067-9bc0-144a3d096f30`,
   best-effort citation, type dictionary) + file PATCHed with source_id +
   source_note
4. ✅ Import script `/tmp/enxet-import/import.py` — uuid5 ids keyed on
   (lx|hm, sense index), gloss-vs-definition classifier (≤60 chars and no
   metalinguistic lead-in → gloss), `import_id: enxet-lexicon-2026-07`
5. ✅ Full run: 24 batches, **11,935 created, 0 failed, 0 exists**
6. ✅ Verified: dry-run batch-delete count = 11,935; DB counts (14,778 senses =
   11,699 gloss + 2,540 definition + 539 default-empty); 409 homographs; all
   entries source-stamped; 12/12 content spot-checks match source (incl. both
   Agko' homographs, diacritics intact). Pre-import backup:
   `/opt/hosting/data/dictionaries/enxet.db.pre-import-bak`.
7. ✅ Docs: importing.md rewritten ("Register a source for every import",
   simple-slug guidance), flex-lift.md gained hard-wrap + gloss-in-`\de`
   gotchas, `.knowledge/domain/import-workflow.md` insider recipe created
8. ✅ Follow-up issues created
9. Report to Jacob (in session)

## Known data quirks (left faithful to source)

- Some definitions flow across two `\de` markers in the source (e.g. "Ekhem
  ektaqmalma": "Navidad; o más comunmente" + "haber buen tiempo…") — imported
  as separate senses per the source's own structure; human review could merge.
- 539 lexeme-only entries (no definition in source) each carry one empty sense
  (the API's default new-entry shape).

## ROUND 2 — data-quality review + rethink (2026-07-24)

Jacob reviewed the live import and flagged issues. Findings:

### ROOT CAUSE: the `definition` field is effectively dead in LD's UI
- `Sense.svelte` renders `definition?.en` ONLY, labeled "Definition (deprecated)",
  behind `{#if sense_fields?.definition}` (comment: "Only in Bahasa Lani").
- `ListEntry.svelte` (entries list) shows ONLY `senses[0].glosses` — never
  definition, and only the FIRST sense.
- `augment-entry-for-search.ts` indexes ONLY `_glosses` — definitions unsearchable.
- ⇒ My `definition.es` content (2,540 senses) is INVISIBLE + UNSEARCHABLE. This is
  why `-Exma` (which has a real clitic definition) shows blank. **String-length
  gloss/definition split was wrong on two counts** (bad heuristic AND wrong target
  field).

### Data-quality scan (source, 14,239 non-empty \de over 11,935 entries)
- trailing `;`: **6,576**; trailing `,`: 358; no terminal punct: 1,364
- multi-item (internal `;`): 3,492 (these are multi-synonym single glosses — keep)
- paradigm tags (`2/3PMS`, `1PS`, `pl`…): 23 inline + many `pl <form>` plural forms
- `lit "…"` literal asides: 248 · curly-quote content: 597 · xrefs (véase/variante
  de): 39 · metalinguistic lead-ins (prefijo/letra/clítico…): 77 (the real
  ~50 "definition" cases)
- headword-appears-in-its-de: 69 (source packed examples/etymology into the def,
  e.g. ¡Mes! "(de 'qames' gato); ¡mes!, ¡mes!")

### Local reviewable pipeline built (the workflow Jacob asked for)
`/tmp/enxet-import/`: `clean.py` → `rows.jsonl` (11,935 rows, cleaned text + raw +
proposed kind + lifted notes + flags) + `review.json` (24-entry sample spanning
every class) → `render_sample.py` → `preview.html` (human-readable dictionary
view). Cleaning strips MDF `;`/`,` noise (271 non-trivial), lifts paradigm +
`lit` asides to notes. Still TODO in cleaning: `pl <form>` → plural_form; inline
possession paradigms; mid-string person tags.

### Jacob's asks (pending decisions — DO NOT re-import yet)
1. gloss vs definition must be a principled/manual call, not length
2. strip trailing `;` etc. — YES, confirmed direction
3. properly handle the 2/3PMS paradigm data
4. fix headword-in-gloss cases
5. remove "(deprecated)" from the definition field label — ENTANGLED with the
   .en-only + not-in-list + not-searched problem; needs a fuller revival decision
6. NEW workflow: parse→JSONL→human-readable sample BEFORE touching the API (built)

### Rollback note
Current live import (import_id `enxet-lexicon-2026-07`, 11,935 entries) is
BATCH-DELETABLE. Plan: clean up + redo once decisions land.

## ROUND 3 — wipe + workflow-guide restructure (2026-07-24)

### Jacob's decisions (LOCKED)
- ✅ Wipe enxet and start fresh.
- definition-field revival: being handled by ANOTHER agent (first-class,
  multilingual, list+search) — irrelevant to this issue now; just target the
  field per its final shape when re-importing.
- gloss vs definition: **LLM/manual pass over all 14k defs with per-item
  judgment** — as patterns emerge, mass-apply them; items without a pattern get
  a manual pass. NO shortcuts, no length heuristics. "Someone's real language;
  agent time is cheap."
- Cleanup rules confirmed: strip trailing `;`/`,`/whitespace noise; lift
  `pl <form>` → `plural_form`; lift inline paradigm tags (2/3PMS, 1PS…) →
  notes/morphology; move `lit "…"` asides → notes (handle as best judged).
- Jacob ALSO spotted **Guaraní glosses embedded inside Spanish defs** (¡Chó! →
  `¡fuera de aquí! guaraní "¡haley!";`) — round-1 analysis wrongly concluded
  "no Guaraní content". Bulk eyeballing must find + split these into
  glosses.gn. Quantify the class (`guaraní` mentions and similar) in the stage.

### Done this round
- ✅ **Wipe executed via API batch-delete** (dry-run 11,935 → confirmed run):
  0 live entries/senses, 11,936 tombstones, entry_count mirror 0. `sources` row
  `enxet-lexicon` kept for reuse. (File swap/restore rejected: synced clients'
  cursors would out-run the reset watermark and fast-bail forever — recorded in
  `.knowledge/domain/import-workflow.md`.)
- ✅ **importing.md restructured as the two-phase master guide** (Phase 1 data
  preparation: inspect → human questions → local JSONL/SQLite staging → bulk
  eyeballing → preview.html → sign-off; Phase 2 API usage). index.ts blurb,
  openapi.ts "Uploaded resources" section, and the three format guides'
  pointer lines updated; knowledge page updated.

## ROUND 4 — phase-1 rebuild for real (2026-07-24, in progress)

Jacob greenlit the restart + asked to keep improving importing.md as we go.

### Stage v2 (`/tmp/enxet-import/stage.py` → `rows.jsonl`, 11,935 entries / 14,239 senses)
- ✅ Line locators; per-sense named rules + flags; verbatim raw kept.
- ✅ `extract_gn` (260 senses, 270 forms — `guaraní “X”` + bare-quoted continuations)
- ✅ `lift_plural` (38) + 40 `pl_manual` → hand-decided (decisions-flagged.json)
- ✅ `lift_lit` (221) + 24 `lit_only` kept as sense text (def)
- ✅ `lift_paradigm` (19), `strip_separators` (~7.4k), `", ."` tail rule
- ✅ NEW discoveries: 7 inline SFM markers (`\sc`→scientific_names ×2, `\va`/`\uv`→variant,
  `\xv`→note, `\ps` in \lx); 18 lexemes with POS tails (nf/vi/pref v → n.f/vi/pref,
  hidden by trailing whitespace+CRLF); 11 lexemes with leaked IPA → `phonetic`;
  stray next-headword glue; inline sense numbers ("; 2 …"); ~87 truncated values
  (dangling "por ejemplo:", "variante de", "; pl").

### Gloss-vs-definition per-item pass (Jacob's locked no-shortcuts rule)
- ✅ 1,124 pattern-hit senses read PERSONALLY line-by-line (metalinguistic 55,
  expresion 16, usage 27, cuya 32, xref 57, que 937). Decisions in
  `work/decisions-hits.jsonl` + `work/decisions-que.json` (652 g / 233 d / 52 splits).
  Learning: long causative verb phrases are GLOSSES (polysynthetic verbs); the old
  length heuristic would have been catastrophically wrong.
- 🔄 12,988 remaining short values: 12 alphabetical chunks delegated to 3 spawned
  sessions (512d97a8, 5c21f65f, 65e8d4ed) with `work/REST-PASS-INSTRUCTIONS.md`
  (taxonomy + exceptions-only JSON contract + anomaly flags incl. gn_unmarked).
  They write `work/decisions-rest-NN.json` + `findings-NN.md`. AUDIT their output.
- ✅ 59 headword_in_def hand-decided (`work/decisions-headword.json`): ethnonyms/
  biographies stay defs; packed examples → notes; contractions → notes; strays dropped.
- ✅ `classify.py` merges all decision sources → `rows-final.jsonl`
  (sense kinds: gloss / definition / both via splits; entry pos/phonetic fixes).

### Done (all 12 rest-chunks folded + audited)
- ✅ 3 reader sessions returned all 12 `decisions-rest-NN.json` + findings.
  Lead audited every findings file, pulled + resolved ~30 flagged re-check refs
  (`work/decisions-audit.json`, 43 entries — wrong-language/vernacular phantom
  senses emptied w/ text lifted to notes; typos fixed; truncations flagged).
- ✅ **BIG BUG found + fixed: 35 headwords lost their `\lx` marker** in the
  source. Old parser glued each onto the previous entry (phantom extra sense +
  stray tail — several readers had flagged these as `stray_text_dropped`!).
  `stage.parse()` now recovers them as their own entries (line-keyed uuid5,
  homograph on the one spelling collision: Mantawáseykha). Gotcha written to
  flex-lift.md. Entry count 11,935 → 11,970.
- ✅ Final pipeline: `classify.py` → `rows-final.jsonl` → `build_payload.py` →
  `entries-payload.json` (11,969 entries after dropping 1 colophon non-entry;
  14,219 senses: 13,224 glosses.es · 298 glosses.gn · 1,076 definition.es · 88
  gloss+def splits; 55 POS, 53 plural_form, 11 phonetic, 2 scientific_names, 623
  entries w/ markdown notes). All source+citation(l. N) stamped. 4.0 MB.
  2,395 senses explicitly decided; 11,844 plain-gloss defaults (bulk-verified).
- ✅ `preview.html` v2 (designed entry view; diverse sample + every flagged
  class incl. the gn_unmarked catches). Screenshots reviewed — renders great.
- ✅ Guide improvements folded live: importing.md (CRLF/whitespace trap, inline
  markers, headword-column leaks, truncated values, polysynthetic-gloss +
  split rules, parallelized-reading-with-subagents method) + flex-lift.md
  (lost-`\lx` recovery, headword-column leaks, inline markers).

### Remaining (PAUSED for Jacob sign-off — phase-1 gate before ANY API write)
1. **Jacob reviews `preview.html`** (`/tmp/enxet-import/preview.html`) → sign-off.
2. Confirm sequencing vs the definition-field revival (entries-list-redesign
   lanes) — import now in parallel, or wait so re-imported definitions are
   immediately list-visible/searchable.
3. Mint fresh API key (old one may be stale post-wipe) OR reuse
   `/tmp/enxet-import/api-key.json`; run import under new import_id
   `enxet-lexicon-2026-07-r2` (batches ≤500, hard-fail on results-length
   mismatch, ledger + rollback armed). Verify via snapshot COUNT/spot-checks.
4. Commit the guide changes (publishes new text to live `/api/v1/guides`).

## ROUND 5 — editor-only "needs review" field landed (2026-07-24)

Jacob spotted the ~482 review-worthy entries + asked how to flag them for the
reviewer (Diego, a manager — NOT a site admin) without showing the public. Built a
first-class **`entries.review` `{ category, note }`** field (`.issues/entry-needs-review.md`,
ALL DONE): editor-only (stripped from non-editor reads, filter-at-render like private
tags), entries-list "Needs review" toggle + category facet, entry-page banner +
Resolve, v1 API `review` on create/PATCH. Also fixed private-tag visibility so
managers/contributors see private tags on their own dict.

**Import must now populate `review`:** `build_payload.py` should emit an entry-level
`review: { category, note }` for each flagged entry, mapping the stage flags →
categories, e.g. `truncated_in_source|truncated_maybe → truncated`;
`headword_echo|headword_in_def → headword_in_gloss`; `gn_unmarked → language_split`;
`stray_text_dropped → dropped_text`; `pl_manual → uncertain_plural`;
`vernacular_only|no_gloss → missing_gloss`; `possible_lexeme_gloss_mismatch|typo*|
duplicated_text|needs_review → other`. `note` = the specific finding (may enumerate
senses). Homograph near-dups (2) can also carry `category:"other"`. ~482 entries.

Also: the homograph 3/5/5 Jacob saw were real complete `\hm` sets (146 sets / 405
entries, all imported) — the preview just shows ONE representative per headword, so
siblings looked "missing". No action.

## Follow-ups spawned

- `.issues/admin-api-key.md`
- `.issues/gloss-definition-display-audit.md` (now upgraded: definition field is
  deprecated/invisible/unsearchable — decide whether to revive it)
