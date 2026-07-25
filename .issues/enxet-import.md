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

## ROUND 4 — phase-1 rebuild for real (2026-07-24; completed in Rounds 7–8)

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

## ROUND 6 — phase-1 audit after pull (2026-07-24)

**Gate result at the start of this audit: NOT ready for an API write yet.** The
linguistic staging work was sound and the payload passed the real write helper, but
the final payload/preview/runner had four pre-write defects. All four are repaired
and verified in Round 7 below.

### Audit checks that passed

- ✅ Pulled `main` to `f24de7c9`; preserved the unrelated local issue-file edits.
- ✅ Live uploaded file is unchanged: API download and local source both SHA-256
  `255cd5361ca5324af37d769045ac0ca57d30cc4e2e8da6653a126ccb5de6d974`.
  Instructions remain "Just import everything".
- ✅ Source is valid UTF-8 + NFC (no U+FFFD/NUL); CRLF normalization is deliberate.
- ✅ Regenerated `stage.py` → `classify.py` → `build_payload.py` → `preview2.py`.
  All four outputs were byte-identical to the pre-audit artifacts:
  - 11,970 staged entries / 14,239 staged senses
  - 11,969 payload entries after the one confirmed colophon drop
  - 14,219 data-bearing payload senses; 543 entries omit `senses`, so the API creates
    one default empty sense for each (expected DB total = **14,762 senses**)
  - 0 duplicate entry/sense UUIDs; all 11,969 records carry the source + line citation
- ✅ All 12 rest-reading chunks exist and cover 13,112 refs (the round-4 prose's
  "12,988" was stale/wrong), plus 1,124 pattern refs. The late lost-`\lx` repair
  replaces 44 old glued senses with 47 recovered senses; all 47 were re-audited here
  (7 explicit exception decisions in `decisions-recovered.json`, the rest valid
  plain glosses/definitions).
- ✅ Browser-rendered `preview.html`: no page/console errors, no horizontal overflow,
  388 rendered entry cards; screenshots rechecked.
- ✅ Ran the complete payload through `apply_entry_writes` against an in-memory
  migrated dict.db, in 500-entry chunks with source + `import_id`: **11,969 created,
  0 failed**, 14,762 DB senses.
- ✅ Read-only live API preflight: old key is still valid; Enxet has 0 entries,
  gloss languages `es` + `gn`, no extra orthographies; source `enxet-lexicon` exists
  and remains linked to the uploaded file; production OpenAPI exposes `EntryReview`.

### Blocking repairs

1. **Review queue is absent from the payload.** `entries-payload.json` has 0
   `review` values. The intended flag union is exactly **482 entries** when the
   round-5 mapping also includes `gn_mention_unextracted → language_split` and
   `source_uncertainty → other`. `build_payload.py` must generate one category +
   a bespoke, line/sense-specific note per entry.
2. **Preview is not the promised final-payload review.** It exposes only 8 selected
   flag sections, omitting classes such as headword echo, uncertain plural,
   mismatch, unfixed typo, and duplicated text; it also reports all 14,239 staged
   senses rather than the 14,219 data-bearing payload senses / 543 default-empty
   entries. Regenerate it from the actual payload/review mapping, show every review
   category and the exact reviewer note, then obtain sign-off.
3. **Three cleaned headwords collide without homograph numbers.** POS-tail cleanup
   turns separate source rows into identical `(lexeme, homograph=null)` pairs:
   `Amya’a` (lines 342/375), `Ekyetnayam` (10513/10521), and `Ekyetneykha`
   (10549/10561). Assign deterministic synthetic homographs 1/2 after ALL headword
   cleanup (the same rule already used for recovered `Mantawáseykha`), while keeping
   the UUID source key raw/stable; then rerun the downstream artifacts and preview.
4. **`import.py` is still the discarded round-1 importer.** It reparses the source
   with the bad length heuristic, asserts 11,935 entries, and uses old import id
   `enxet-lexicon-2026-07`. Replace it with a payload-only runner for
   `entries-payload.json`, import id `enxet-lexicon-2026-07-r2`, hard result-length
   checks, failure stop, resumable ledger, and rollback dry-run metadata.

### Additional review finding

The audit found **three** source homograph groups with effectively duplicate imported
content, not two: `Negyenkenweykekxa’` 1/2 (lines 36214/36220), `Nempatmeyam` 1/2
(39965/39971), and `Néltaháneykxa’` 1/2/3 (52160/52166/52172). Preserve them faithfully,
but add `review.category="other"` with a source-duplicate note to all seven entries.
Source numbering oddities (`Segaqhe` 5–10, `Sẽltámeyéyak` 1/2/4/5, four singleton
`\hm` markers) are present verbatim in the source — parser fidelity issues are ruled out.

## ROUND 7 — repaired final phase-1 package (2026-07-24)

**Gate result: READY FOR PHASE-1 HUMAN SIGN-OFF, then the phase-2 API write.**
No production entries have been written.

### Why the rebuilt payload initially had zero reviews

Nothing from the prior review pass was lost. The 482 review-worthy entries were still
encoded as specific flags and decisions in `rows-final.jsonl`. Round 5 added the new
`entries.review` API/schema field after the Enxet payload pipeline had already been
built, but `build_payload.py` was never given the promised flag → `{ category, note }`
serialization step. The old payload therefore faithfully rebuilt the linguistic data
while dropping the new review field. Prior-session transcripts confirm the last Enxet
handoff explicitly left that bridge as the next task.

### Repairs completed

- ✅ Added `/tmp/enxet-import/review.py`: translates every staged review flag into
  one entry-level category plus a bespoke source-line/sense-specific note. The final
  payload contains **498 reviews**: all original 482 candidates plus 8 synthetic
  homograph assignments, 1 source-missing homograph number, and all 7 records in the
  3 effectively duplicate source-homograph groups.
- ✅ Added post-cleanup homograph finalization. The three newly discovered cleaned
  collisions plus the previously recovered `Mantawáseykha` pair now import as
  deterministic homographs 1/2 without changing their stable source-derived UUIDs.
  `Nenláneykekxa’` remains faithfully unnumbered but is explicitly flagged for review.
  Final payload has **zero duplicate `(lexeme, homograph)` pairs**.
- ✅ Rebuilt `preview.html` from the exact API payload/review mapping. It reports
  payload counts (not intermediate staging counts), includes a diverse 33-entry
  structural sample, and renders **all 498 review entries exactly once**, grouped by
  the category the reviewer will see.
- ✅ Replaced the obsolete round-1 `import.py` with a payload-only, resumable runner
  for `entries-payload.json` and import id `enxet-lexicon-2026-07-r2`. Production
  writes require both `--run` and an explicit fresh backup path; validation happens
  before writes; it checks response length/status per entry, persists an atomic
  payload-hash-bound ledger after every ≤500-entry batch, safely resumes, and arms
  rollback verification through the private import tag.

### Exact final artifact

- Payload: `/tmp/enxet-import/entries-payload.json`
- SHA-256: `eca191b6540848f12944a3f44766074c482f21fbc3a44f183fcd5972d8809aea`
- 11,969 entries; 14,219 data-bearing payload senses; 543 entries intentionally
  receive the API's default empty sense → **14,762 DB senses**
- 498 reviews:
  - `truncated`: 200
  - `headword_in_gloss`: 140
  - `language_split`: 43
  - `dropped_text`: 38
  - `other`: 32
  - `uncertain_plural`: 29
  - `missing_gloss`: 16
- Source SHA-256 (local and live API download):
  `255cd5361ca5324af37d769045ac0ca57d30cc4e2e8da6653a126ccb5de6d974`

### Final verification

- ✅ Ran the entire pipeline twice; `rows.jsonl`, `rows-final.jsonl`,
  `entries-payload.json`, and `preview.html` were byte-for-byte deterministic.
- ✅ `py_compile` clean for all six pipeline/preview/import scripts.
- ✅ Browser audit: 531 cards (33 sample + 498 review), 498 unique review IDs,
  exact per-category counts, no empty rendered fields, no page/console errors,
  no horizontal overflow. Light/dark preview screenshots rechecked.
- ✅ Ran the exact final payload through the production `apply_entry_writes`
  helper against an in-memory migrated dictionary DB in 24 × ≤500 batches:
  **11,969 created, 0 failed, 14,762 senses, 498 stored reviews**, exact category
  counts, all repaired homograph pairs 1/2, and 11,969 private import-tag links.
- ✅ Final live API preflight: key valid; Enxet still has 0 entries; gloss languages
  `es` + `gn`; source/file linkage and "Just import everything" instructions
  unchanged; import rollback tag count 0.
- ✅ Runner safety check: `--run` without `--backup` exits before preflight/import
  and creates no ledger.
- ✅ Fresh online SQLite rollback backup made from the still-empty live DB:
  `/opt/hosting/data/.import-backups/enxet-pre-r2-20260724T130236Z.db`
  (17,051,648 bytes; `PRAGMA integrity_check = ok`; SHA-256
  `c6674df9c4dea2719242c4cd9d942a1feff7af8abc4ea336e8624af25ca30108`).

### Phase-1 gate (completed in Round 8)

Jacob reviewed `/tmp/enxet-import/preview.html` and signed off on phase 1. The
phase-2 command used was:

```bash
cd /tmp/enxet-import
python3 import.py --run --backup /opt/hosting/data/.import-backups/enxet-pre-r2-20260724T130236Z.db
```

After the runner completes, verify live entry/sense/review/category/import-tag counts
and spot-check the browser before considering the import complete.

## ROUND 8 — phase-2 production API import complete (2026-07-24)

Jacob approved the final phase-1 preview and authorized the production import.

### Import result

- ✅ Ran `/tmp/enxet-import/import.py --run` against the exact approved payload
  SHA-256 `eca191b6540848f12944a3f44766074c482f21fbc3a44f183fcd5972d8809aea`,
  with rollback backup
  `/opt/hosting/data/.import-backups/enxet-pre-r2-20260724T130236Z.db`.
- ✅ All 24 API batches returned exact result-array lengths:
  **11,969 created, 0 existed, 0 failed**.
- ✅ Runner's final batch-delete dry-run found exactly **11,969** entries under
  private import tag `enxet-lexicon-2026-07-r2`; nothing was deleted.
- ✅ Atomic resumable ledger completed at
  `/tmp/enxet-import/ledger-r2.json` (`completed_at` 2026-07-24T13:07:31Z).

### Independent live verification

- ✅ Production `enxet.db`: `PRAGMA integrity_check = ok`; 11,969 entries;
  14,762 senses; 498 valid nonblank review objects.
- ✅ Exact review counts:
  `truncated` 200 · `headword_in_gloss` 140 · `language_split` 43 ·
  `dropped_text` 38 · `other` 32 · `uncertain_plural` 29 ·
  `missing_gloss` 16.
- ✅ All 11,969 entries carry source `enxet-lexicon` and an `l. …` citation.
  All 11,969 are linked to the private rollback tag.
- ✅ Zero duplicate final `(lexeme, homograph)` pairs. The four synthetic pairs
  (`Amya’a`, `Ekyetnayam`, `Ekyetneykha`, `Mantawáseykha`) are all 1/2.
- ✅ Deployed v1 GET returned the exact lexeme, senses, review category, and
  bespoke note from the approved payload. Catalog `entry_count` is 11,969.
- ✅ Authenticated production browser check as a real Enxet manager:
  - Entry `A-²` rendered the exact `truncated` review banner + Resolve button.
  - Entries list loaded all 11,969 records.
  - Needs review filter returned exactly 498.
  - All seven review category facets appeared with their exact counts.
  - No page errors, console errors, or horizontal overflow.
  - Screenshots:
    `/tmp/enxet-import/production-review-entry.png` and
    `/tmp/enxet-import/production-review-queue.png`.

### API/documentation defects encountered

None. The import did not require a workaround, no response contract differed from
the deployed OpenAPI/guide expectations, and no repair checklist is needed.

## ROUND 9 — human-facing review queue rewrite complete (2026-07-24)

Jacob found the production review notes were written like importer tracebacks
(`glosses.gn`, source line numbers, “verify the source”) rather than tasks a
dictionary manager could answer from the entry page. Decisions: plain English,
structured citations collapsed under Source details, rewrite/prune existing
reviews, and personally audit all 498.

- ✅ Audited all 498 against staged verbatim + final fields: **317 rewrite/keep,
  181 remove**. Final category counts: truncated 100 · headword-in-gloss 97 ·
  other 44 · language-split 42 · missing-gloss 20 · uncertain-plural 14.
- ✅ `/tmp/enxet-import/review-human-final-audit.json` records every decision;
  `/tmp/enxet-import/review-final.json` is the stable UUID-keyed patch source.
- ✅ Rebuilt payload contains the same 11,969 entries and zero non-review data
  changes; new SHA-256
  `f4e268d1b8b6ca0461d3d5a872b53e60e933061fc4a8b4ab326c0ded79db14a2`.
- ✅ Category labels are human-facing in the entry banner and queue; existing
  citations now appear under collapsed **Source details**. Long notes use the
  full banner width on mobile, and the new UI strings are in the English i18n
  catalog.
- ✅ Phase 1 + Phase 2 importing guidance, OpenAPI, and TS docs now require
  self-contained, plain-language review questions and keep agent provenance in
  structured citations.
- ✅ Full verification passed: 1,978 Vitest tests (3 skipped), `tsc`, ESLint,
  `svelte-check`, `svelte-fix`, and light/dark desktop/mobile svelte-look
  screenshots.
- ✅ Fresh online backup before mutation:
  `/opt/hosting/data/.import-backups/enxet-pre-review-rewrite-20260724T143539Z.db`
  (integrity `ok`; SHA-256
  `67459acea183178eb064a13883954d56b580edfbb2b6096bbe7ea82184fb8d7e`).
- ✅ Patched the 498 existing review fields through v1: **317 rewritten, 181
  cleared, 0 failures/conflicts**. The hash-bound ledger is
  `/tmp/enxet-import/review-patch-ledger.json`; every result was independently
  read back and compared to `/tmp/enxet-import/review-final.json`.
- ✅ Live DB is healthy and contains the exact final queue:
  `truncated` 100 · `headword_in_gloss` 97 · `other` 44 ·
  `language_split` 42 · `missing_gloss` 20 · `uncertain_plural` 14.
- ✅ Authenticated live-browser checks confirmed exact notes, a removed stale
  banner, the 317-entry queue, all six categories, and no page/console errors
  or horizontal overflow.

### API/documentation checklist

- [x] Phase 1 now distinguishes broad importer/audit flags from the final human
  review queue and requires re-evaluating every flag after deterministic repairs.
- [x] Review notes must be answerable from the entry page, use UI vocabulary
  such as “Spanish translation” and “Notes,” quote the complete relevant
  original/imported/omitted text, and end with a concrete question or action.
- [x] Source slug/locator belongs in structured `citations`, not the human note;
  the UI exposes it in collapsed Source details.
- [x] Phase 2 examples, OpenAPI descriptions, and TS docs match that contract.
- [x] No v1 API defect or documentation/API mismatch was encountered during the
  import or the 498-item rewrite. No workaround or remaining repair item exists.

## Follow-ups spawned

- `.issues/admin-api-key.md`
- `.issues/gloss-definition-display-audit.md` (now upgraded: definition field is
  deprecated/invisible/unsearchable — decide whether to revive it)

## ROUND 10 — Gundolf correction audit and production update (2026-07-24)

Gundolf's July 23 `Enxet-SFM-for-LD.txt` is a corrected source revision, not a
duplicate of Diego's uploaded file. The new export repairs real record
boundaries and meanings, but also introduces new missing-space artifacts, so it
was reconciled semantically rather than blindly re-imported.

- ✅ Compared all records between the two source revisions and built a
  deterministic identity map: 11,969 existing identities preserved, 3 genuine
  new entries, 1 obsolete recovered entry, and 5 stale senses.
- ✅ Retained complete wording from the earlier source wherever the corrected
  export only damaged spacing/truncated a value; accepted the corrected
  revision's genuine sense splits/merges, homograph numbering, headwords, and
  meanings.
- ✅ Re-audited all carried review tasks. Removed five that the correction
  resolved and added one self-contained `missing_gloss` task for new entry
  `Yalaqe’`. Final queue: 313 reviews — truncated 99,
  headword-in-gloss 97, language-split 42, other 40, missing-gloss 21,
  uncertain-plural 14.
- ✅ Created a hot production backup before mutation:
  `/opt/hosting/data/.import-backups/enxet-pre-gundolf-correction-20260724T160343Z.db`
  (20,348,928 bytes, `PRAGMA integrity_check = ok`, SHA-256
  `2cc138b43f621eb9226e0a5b217c311125bd5417a8505ba04b960cf1c1b46d05`).
- ✅ Applied the correction through v1: 11,968 existing entry PATCHes, 3 entry
  creates, 5 stale-sense deletes, and 1 superseded-entry delete. Zero failures,
  retries, or response-contract mismatches.
- ✅ Independent readback found exactly 11,971 live entries, all 11,971 under
  import tag `enxet-lexicon-2026-07-r2`; every changed/new target matched the
  audited payload and the removed entry was absent.
- ✅ Preserved the original source file and added Gundolf's corrected revision
  as a second private permanent resource under source `enxet-lexicon`:
  `source_files.id = 10b14c13-e9b3-4d5d-840f-1a9f0f89f6c0`, R2 key
  `import/enxet/10b14c13-e9b3-4d5d-840f-1a9f0f89f6c0`. Its v1 download matches
  the received file exactly (1,077,435 bytes; SHA-256
  `074a6b98d4bdcfbebe789d8cde8426ec5687cacc78bb4ee7e81ac660f959e142`).

### API/documentation checklist from the correction

- [ ] Batch entry PATCH is missing; citation-locator revisions required 11,968
  single-entry requests.
- [ ] Runtime accepts `null` to clear entry `notes` and sense `variant`, but the
  TypeScript/OpenAPI PATCH shapes do not document that contract consistently.

Tracked for follow-up in
`.issues/api-entry-patch-bulk-and-clear-semantics.md`. Neither item blocked or
weakened the verified correction.
