# Ponca duplicate-entry diagnosis

Investigate apparent duplicate (non-homophone) entries after the July 2026 Ponca import.

## Plan

- [x] Enumerate exact repeated lexemes in the live production dictionary.
- [x] Compare repeated rows' IDs, senses, citations, homograph values, and timestamps.
- [x] Trace each repeated row back through the deterministic writer and staged merge.
- [x] Determine whether the cause is source structure, importer merge identity, API retry/idempotency, or a later patch.
- [x] Report the evidence and recommend any repair or importer guardrail separately; do not mutate production during diagnosis.

## Notes

- The Ponca import working directory remains at `/home/jacob/import-work/ponca/`.
- This task is diagnostic only unless Jacob explicitly asks for a repair.

## Findings

### Live scope

- Production has exactly 5,257 entries, matching the planned payload exactly: 4,667 primary
  headword records plus 590 run-on/related forms promoted to entries. This rules out an extra
  API batch or retry as the source of the excess rows.
- Production has 322 exact repeated-lexeme groups:
  - 295 are the known primary-entry homograph groups from the book (647 entries), all numbered.
  - 27 are unnumbered repeated promoted-related-form groups (55 entries). These are the defect.
- A canonical comparison of senses within all 295 primary groups found zero pairs with identical
  sense payloads. Their repeated spellings carry different definitions/senses (for example, the two
  `Eʼbéʼ` records both gloss “somebody” but distinguish an unspecified person from a significant
  person). The same-content duplicates are confined to the promoted-related-form path.
- Rebuilding `write.py`'s payload reproduces all 55 live IDs exactly. They were present before the
  POST and did not arise from API retries, sync, or a later edit.
- Of the 27 related-form groups, 19 have byte-for-byte identical English glosses (38 entries).
  Eight have differing wording. Most of those eight are obvious paraphrases of one meaning
  (`ábisądè`, `gađį́ge`, `íʼkinaʼxđè`, `wéža`, and likely `bigíze`); two clearly carry distinct
  meanings (`íʼgitʼexì`, `ąđą́gį́tʼexì`) and need homograph/sense treatment rather than deletion.
  `kiáži` needs a source-page look because its second “gloss” appears to contain pronunciation and
  usage metadata.

Examples of exact duplicates in the source staging:

- `akʼínąsadà` — identical gloss under `Nąsáda` (PDF p147) and `Đisáda` (p377).
- `iđádiđaitʼà` — identical gloss appears twice under the same parent on p120.
- `áʼbinąxđè`, `áʼkinąxđè`, `áʼnąxđè`, and `wénąxđè` — repeated under the near-duplicate parent
  records `Wáʼnąxđè` (p197) and `Wánąxđè` (p208).
- The complete 27-group inventory was reproduced from `merged.jsonl` and matched to the live DB.

### Root cause

`write.py` has two separate identity passes:

1. `build_entries()` counts duplicate primary lexemes and gives each a deterministic ID plus a
   `homograph` number.
2. `build_related()` receives `by_casefold`, a map containing only those primary entries. A related
   form that matches a primary entry links to it correctly. Otherwise it always creates a new
   deterministic entry. It neither checks a related-form entry created earlier in the loop nor adds
   that new entry to `by_casefold`.

Therefore, when the book repeats the same run-on form under two parent entries—or repeats it in the
Ponca→English and English→Ponca halves—the writer emits two distinct IDs. The two halves were merged
for primary entries, but the promoted related-form namespace escaped that merge. This is a staging
identity bug, not an API idempotency failure.

The original final verification asserted counts and spot-checked rendered content, but treated
`590 related forms` as 590 expected new entries. Its duplicate audit operated on the merged primary
records before `build_related()` expanded the related forms, so it did not inspect the final entry
payload's natural keys.

The same first-match design exposes a related provenance problem: five promoted forms matched a
primary lexeme having multiple homographs, and `by_casefold` silently chose homograph 1. Three look
plausible, one needs judgement, and `snáđe` (“paint”) appears clearly linked to the wrong primary
homograph (“lubricate” rather than “apply a substance … painting a house”). Include these five
relationships in any repair audit rather than carrying the first-match behavior forward.

## Recommended repair (diagnosis-stage plan; completed below)

1. Classify all 27 groups from their source contexts: exact clone, same-word paraphrase, or genuine
   distinct meaning.
2. For clones/paraphrases, keep one canonical entry, combine gloss/senses and both citations as
   appropriate, repoint every `derived_from` relationship to it, then delete losers through the API
   so tombstones sync.
3. For genuinely distinct meanings, preserve both with homograph numbers (or one entry with
   separate senses if that is the desired model).
4. Add a final-payload audit to every import: group the actual entry payload by NFC/casefolded
   lexeme, require every repeated group to be explicitly classified, and make related-form creation
   reuse an already-promoted canonical form where appropriate.
5. Replace first-homograph related-form matching with sense-aware or explicitly reviewed matching;
   repair the five ambiguous Ponca links at the same time.

No production rows were changed during this diagnosis.

## Repair work — authorized 2026-07-31

Jacob selected “Repair data and guardrail,” then chose:

- Merge promoted forms that express the same meaning; retain genuinely distinct meanings as
  numbered homographs.
- Add a reusable, fail-loud final-payload auditor rather than API-level duplicate enforcement.
- File a corrected replacement report artifact on the import conversation. Do not send Greg a
  message without separate authorization.

- [x] Classify all 27 promoted-form collision groups against their printed contexts.
- [x] Classify the five related-form → primary-homograph links against their meanings.
- [x] Build a deterministic, dry-run-first repair plan with canonical IDs, merged citations/senses,
      relationship repoints, homograph numbering, and tombstone deletes.
- [x] Back up the production Ponca DB, run the repair through the public API, and verify counts,
      relationships, tombstones, integrity, API reads, and rendered entry pages.
- [x] Add the approved durable final-payload/ambiguous-relationship guardrail and tests.
- [x] Update the import guide and maintained tooling documentation.
- [x] Handle the now-stale import report according to Jacob's decision; do not send a manager
      message without explicit authorization.

### Collision decisions

The first exact-spelling audit found 27 promoted-form collision groups. Running the new required
NFC/casefold audit against the actual final payload then found five more: the printed headword was
capitalized while a run-on form repeated the same spelling in lowercase. All five are the same
lexical meaning/paradigm and will be merged into the existing primary entry, with their useful
grammatical/gloss detail folded into that entry. This is the exact miss that auditing only the
pre-expansion primary records allowed.

Twenty-nine groups express one meaning and will be merged. Three groups are genuinely distinct and
will remain as numbered homographs:

- `ąđą́gį́tʼexì` — feeling ill after disagreeable food vs being unable to think clearly.
- `íʼgitʼexì` — feeling unwell after food vs being unable to think clearly because of trouble with
  a friend or relative.
- `kiáži` — did not come here vs did not return/come home. The second staged gloss accidentally
  contains the printed pronunciation and usage note; repair that sense from the printed parent
  context and preserve the pronunciation separately.

The original 24 merge groups are `ábisądè`, `ádədù`, `akʼínąsadà`, `ąkʼínąsadài`, `áʼbinąxđè`,
`áʼkinąxđè`, `áʼnąxđè`, `bigíze`, `đakʼínąsadà`, `đíʃ́wađakią̀`, `đíudą̀`, `gađį́ge`, `gáxaì`,
`gígíze`, `iđádiđaitʼà`, `į́udą̀`, `íʼkinaʼxđè`, `kʼiną́sadà`, `pʼáxe`, `škáxe`, `wegísiđè`,
`wénąxđè`, `wéudą̀i`, and `wéža`. Merge policy: keep a deterministic canonical row, retain the
fuller faithful gloss where wording differs, union citations, and preserve every distinct
`derived_from` parent relationship.

The five case-only self-collisions are `Biká`/`biká`, `Gíudą̀`/`gíudą̀`, `Įdádi`/`įdádi`,
`Tíxįdè`/`tíxįdè`, and `Xtʼáđe`/`xtʼáđe`. Each lowercase run-on form currently points back to the
same primary entry. Merge its useful wording into that primary entry, delete the redundant run-on
entry, and let the now-meaningless self-provenance relationship disappear with it.

Expected post-repair totals, confirmed against the staged natural keys: 5,227 entries, 5,587
senses, 560 unique promoted-form entries, and 663 `derived_from` relationships. The entry and sense
totals each drop by 30. The original 24-group merge preserves all 668 distinct parent links; the
five case-only self-collisions each remove one relationship that would otherwise point from an
entry to itself.

### Ambiguous relationship decisions

Five related forms matched a primary spelling with multiple homographs. Keep the existing target
for `edítą`, `éʼkiđè`, and `gaxíáđa`; move `đišéđą` to the “demolish/break down” homograph and
`snáđe` to the “apply a substance/paint a house” homograph. The replacement auditor must reject a
natural-key relationship lookup with multiple candidates unless its exact target is explicitly
recorded.

### Dry run and backup

- Full online production backup completed before live writes:
  `r2/backups-rolling/db/living/2026-08-01T02-14-13Z.tar.zst` (shared DB + all 1,427
  per-dictionary DBs).
- Fresh online Ponca snapshot retained at
  `/home/jacob/import-work/ponca/ponca-pre-duplicate-repair-2026-08-01T02-14-13Z.db`.
- Deterministic repair builder: `/home/jacob/import-work/ponca/repair.py`; emitted payload/lookup/
  plan artifacts live beside it.
- Corrected final payload audit: PASS — 5,227 entries, 298 numbered collision groups, 78
  natural-key relationship lookups.
- Snapshot simulation: PASS — entries 5,257→5,227; senses 5,617→5,587; relationships 668→663;
  `PRAGMA integrity_check = ok`; post-repair live-row collision audit PASS.

### Production repair — completed 2026-08-01

- [x] Back up the production Ponca DB, run the repair through the public API, and verify counts,
      relationships, tombstones, integrity, API reads, and rendered entry pages.
- [x] Handle the stale report by filing a corrected replacement artifact; no manager message was
      posted and no email was triggered.
- Temporary API key `bbdcdbb2-0fa4-4c56-8c2c-a04e6548fc1f` was admin-attributed, used only for
  this repair/report, revoked at `2026-08-01T02:24:47.985Z`, verified to return HTTP 401, and both
  raw-token files were permanently removed.
- Live production totals: 5,227 entries; 5,587 senses; 663 relationships; shared catalog
  `entry_count=5227`; `PRAGMA integrity_check=ok`.
- Natural-key sweep: 298 repeated default-spelling groups, all with unique non-empty homograph
  numbers; zero unresolved collisions.
- Sync evidence: exactly 30 `entries` tombstones (server seq 24039–24068) and two
  `entry_relationships` tombstones (24069–24070).
- Meaning/relationship reads: the corrected `kiáži²`, `Tíxįdè`, and merged `ábisądè` payloads match
  the decisions; a loser entry returns 404; `đišéđą` now points to “demolish” and `snáđe` to the
  painting/apply-a-substance homograph, while the old links are absent.
- Browser verification: the merged, numbered, and case-only-merge entry pages all rendered their
  corrected content; screenshots were visually inspected. No page/runtime errors occurred. The
  logged-out shell did expose a pre-existing Google One Tap CORS failure, recorded separately in
  `.issues/google-one-tap-script-cors.md` because changing production auth requires its own test pass.
- Corrected report artifact `0a857c58-0fe6-4d8f-a60a-80d02b5711d0`, title “Corrected import
  report — Dictionary of the Ponca People (2026-08-01)”, was filed silently. Its protected R2 read
  is byte-identical to `report-corrected.html` (SHA-256
  `752fa3a8adf6951a33d533c6c141401e3a39cd492ca5c1721d07b473f0eb0bcb`) and carries the expected
  script-blocking CSP. Questions were not posted again.

### Final repository verification

- `python3 -m unittest discover -s scripts/import-audit -p 'test_*.py'` — 8 passed.
- Corrected Ponca payload CLI audit — PASS: 5,227 entries, 4,872 default natural keys, 298
  numbered collision groups, 78 relationship lookups.
- `pnpm lint` — passed.
- `pnpm check` — passed with 0 errors (46 pre-existing warnings in 23 files).
- `pnpm test --run` — 332 files passed, 1 skipped; 2,480 tests passed, 4 skipped.

No `.knowledge/` page was added: the reusable discovery is now enforced in the maintained auditor
and importing guide, while the Ponca-specific repair evidence belongs in this issue and the frozen
corrected report artifact.
