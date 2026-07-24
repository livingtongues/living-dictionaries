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

### Next (PAUSED — regroup with Jacob before restarting the import)
1. Re-run phase 1 properly on the Enxet file: rebuild the stage with the
   confirmed cleanup rules + the Guaraní-in-def split + headword-in-def cases
   (69, hand-review) + LLM/manual gloss-vs-definition pass.
2. Full preview.html review with Jacob (diverse sample + all flagged classes).
3. Re-import under a new import_id with same deterministic uuid5 ids, after the
   definition-field revival lands (check the other agent's progress).

## Follow-ups spawned

- `.issues/admin-api-key.md`
- `.issues/gloss-definition-display-audit.md` (now upgraded: definition field is
  deprecated/invisible/unsearchable — decide whether to revive it)
