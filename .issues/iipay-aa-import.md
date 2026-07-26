# 'Iipay Aa import (thread 8dbcc914-d451-428b-be3c-3077f5ff40b4)

Requester: Vincent <realmofkingdoms@gmail.com> (`6c9b2809-6388-4bc8-8812-6d694e7c545f`),
Kumeyaay language student, manager of `iipay-aa`.

Instructions (authoritative): *"Please create new entries from each line in this
spreadsheet (except the headers) with the left column under 'Iipay Aa as the Lexeme
and the right column under English Translation as the English translation. Don't
worry about duplicates already in my dictionary as I will be uploading new audio and
completing the remaining tags for each one afterwards."*
Request note: *"These words are from multiple sources so I can't really label them
all with a source."*

## Phase 0 ✅

- API key minted (admin-attributed to `jwrunner7@gmail.com`), key id
  `d0138c88-815f-4ee0-8cfb-9c76f0898eb1`, label "Import agent (Iipay Aa 2026-07)".
  Raw token in `/tmp/ii-token` + `api-key-id.private`. **Revoke when done.**
- Conversation claimed: `PATCH {started:true}` → `started_by_user_id` now Jacob
  (`started_at` was already stamped at request time by the request endpoint).
- File `9307f35b-8a6a-40dc-be66-bbe9e0625e18` downloaded →
  `~/import-work/iipay-aa/raw.xlsx` (144,061 bytes,
  sha256 `976b3ac0bd974d89fae83d2a6342c8c8bbbd4d92c4e1114c89c9cb670a702cd0`).
  Real XLSX. NOTE: 4 earlier abandoned uploads of the same filename exist on the
  dictionary; only this one is attached to the import thread.
- Source registration: pending (see decisions).

## Existing dictionary state (pre-import, `live-pre.db` snapshot)

4,641 entries / 4,642 senses — **one sense per entry** (a single exception),
**every entry has audio** (4,641), POS on every sense, 3,427 entries carry notes,
**0 definitions, 0 variants ever used**, 250 senses keep `;` inside a single gloss,
92 keep parentheses. 70 tags, 6 dialects (Mesa Grande, Campo, Tiipay, Los Conejos,
Barona, Santa Ysabel), 9 sources (all speaker-name slugs). Gloss languages `en`,`es`.
→ **House style = one row → one entry → one sense whose gloss is the whole English
string.** The dictionary is audio-first (About: "Words we do not have audio for are
not included") — this import will be the first audio-less content.

## Phase 1 — inspection

`raw.xlsx`: one sheet, 4,049 rows, 2 columns, no merged cells, no blanks, no gaps.
Row 1 = headers (`'Iipay Aa:`, `English: Translation`). **4,048 data rows**, all
strings, alphabetically sorted (21 minor out-of-order pairs from hyphen handling).

- Encoding clean UTF-8/NFC. Iipay column uses only ASCII letters + `'` (809) and
  `-` (41); 2 rows have `é`. No whitespace/CRLF problems (0 rows need trimming);
  one row (1816) has an embedded newline + double space; one `’` (U+2019) in row 921.
- 3,995 distinct lexemes; 52 repeat within the file (different glosses), **10 exact
  duplicate (lexeme, gloss) row pairs**.
- 255 rows have `;` in the English (distinct senses in dictionary style).
- 1,198 rows carry parentheticals (1,235 total, 1,018 distinct): sense
  disambiguators `(long object)`, `(placename)` ×24, morphological notes
  `(distributive plural of aaull)`, prefix tags `(h-)`, `(Spanish)`.
- 521 rows mention "plural of", 93 "placename", 41 "auxiliary verb".
- 69 sentence-like glosses (imperatives/phrases) — normal for this dictionary.
- No cross-reference prose ("see X", "variant of", "same as", "cf.") at all.
- 5 rows have the headword inside its own gloss (all legitimate, e.g. Spanish
  etymology notes).
- Overlap with the live dictionary: 1,303 of 3,995 source lexemes already exist
  (1,318 rows); **344 rows are exact (lexeme, gloss) duplicates** of existing rows.

## Decisions (Jacob, 2026-07-25 — all "recommended" answers)

1. **Full lexicographic treatment** (option C): senses split, descriptive parentheticals
   moved to definition/notes — NOT a verbatim gloss dump.
2. **Real duplicate reconciliation.** "Vincent doesn't know the power we have… we're not
   going to leave him with a pile of duplicates to clean up. Where our version has more
   info, take the best of both. Where they're the same, don't duplicate." Implemented as
   per-SENSE resolution against the OLDEST existing entry with that headword:
   covered → write nothing · ours richer → append the missing wording to his gloss
   (never overwrite) · genuinely different meaning → add a sense to his entry ·
   different word → new entry. Empty fields (notes / word history / scientific name)
   are filled only when his are empty.
3. **In-file duplicate rows collapse** (deterministic uuid5 of lexeme+English).
4. **One source row**, slug `mg-bitd-wordlist`; ask him what MG/BITD stand for in the report.
5. **POS assigned** where the English is unambiguous (rule-based proposal, then read).
6. **Relationships built** from the "(plural of X)" prose + spelling-variant markers.
7. Proceed without a blocking round-trip; questions go in the final report.

## Phase 1 — pipeline (`~/import-work/iipay-aa/`)

`stage.py` (raw.xlsx → `staging.jsonl`) → `build.py` (+ reader decisions → `records.json`)
→ `merge.py` (resolve against `live-pre.db` → `resolved.json`) → `apply.py` (→ `payload.json`)
→ `preview.py` (→ `preview.html`). `pos.py` is the POS proposer; `decisions_io.py` loads
`decisions/chunk-NN.jsonl`; `review.py` renders the 16 reader chunks.

### POS proposer, calibrated not guessed
342 rows have a (headword, English) pair that already exists in his dictionary with a
single POS label — that is a free ground-truth set. Rules were tuned against it to
**88.0%** (WordNet-based, adjective-dominant head word ⇒ `v` because Kumeyaay statives are
verbs; frequency-ordered first sense as tiebreak). The readers correct the rest.

### Structure found in the source and lifted out
- `;` splits senses (249 rows).
- `(plural of X)` / `(distributive plural of X)` / `(2nd person of X)` → note + a real
  entry relationship (558 links; the phrase can be nested inside a longer parenthetical,
  e.g. "(round object, plural of topk)", and the qualifier stays in the gloss).
- Affix markers `(h-)`, `(aa-)`, `(-k)` → note, meaning unconfirmed → **report question**.
- **Bare letter markers `(ii)`/`(i)`, `(hu)`/`(hw)`, `(s)`/`(ch)` are spelling variants** —
  identified by the marker's letters occurring in the headword; the pairs get
  `spelling_variant` links.
- `(MG)` / `(BA)` / `(B)` → the two source dictionaries, inline → note (confirms
  BITD = Barona).
- `(Salix exigua)` → scientific_names · `(Spanish)`, `(from Spanish tener)` →
  linguistic_history · `(placename)` → note + POS `pr.n`.
- **Literal translations** — `glad, happy (his heart is good)`, `priest (one who tells of
  God)` — → `Literally "…".` note (32), matching Vincent's own note style.
- Long descriptive parentheticals and `head: prose` → sense definition.

### Reading — all 4,048 rows ✅
16 chunk files, one sub-agent session each (`reader-sessions.txt`), exceptions-only
JSONL decisions in `decisions/`. **663 reader corrections** + 61 lead decisions
(`chunk-99*-lead.jsonl`). Every row was rendered with its proposed record AND the
existing entries it would touch; every chunk has a `*.summary.md`.

### Lead audit ✅ — bugs the readers surfaced, all fixed in the pipeline
1. **Target chosen by age, not meaning** — a homograph (`tuukwaa` "they walk" vs
   "divides") got enriched on the wrong entry. Target is now the existing entry whose
   sense best matches, oldest only as a tie-break.
2. **Reader merge rulings silently dropped** when the pipeline had already called a
   sense "a new meaning" (score 0). Rulings now also apply to the closest overlapping
   sense, plus an explicit per-sense `sense_status` key for mixed rows.
3. **Nested morphology** — "(round object, plural of topk)" became a definition and
   lost the link. Now the derivation is searched anywhere in the parenthetical and the
   qualifier stays in the gloss (+55 links).
4. **Markers bundled with content** — "(a-, puberty ceremony?)", "(w-, MG)" — lifted
   segment by segment; the remainder is re-classified (literal note / definition / keep).
5. **Scientific-name false positives** — "Torrey pine", "East-West wind" were read as
   binomials. A species epithet is now required not to be an ordinary English word.
6. **Literal translations** — a new rule turns "(his heart is good)", "(one who tells of
   God)" into `Literally "…".` notes (32 rows).
7. **Same headword twice in the file** → one entry with several meanings (29 headwords,
   59 rows), not competing entries. 5 possible homographs among them carry a review flag.
8. Review notes were rewritten manager-facing; 3 stale ones (describing bugs since
   fixed) were dropped.

Verified afterwards: every reader `merge` ruling reflected (3 remaining mismatches
hand-checked as correct), every `pos` ruling reflected, all 36 `unsure` items ruled on
personally, 0 senses without a part of speech except 1 deliberate blank.

## Payload (signed off? — pending Jacob)

| | |
|---|---|
| source rows | 4,048 (all accounted for) |
| **new entries** | **2,695** (2,816 meanings) |
| existing entries improved | 417 — 223 glosses extended, 261 meanings added, 28 empty fields filled |
| word-to-word links | 580 |
| rows written off | 936 — 896 already in the dictionary, 30 folded into a sibling row, 10 duplicate rows |
| review queue | 31 (18 uncertain_gloss, 8 uncertain_form, 5 other) |

`preview.html` (94 KB) renders it. Pipeline proven deterministic: two full runs from
`raw.xlsx` produce a byte-identical `payload.json`.

## Second-pass audit (2026-07-25, before any write) — ⛔ HOLD THE WRITE

Jacob asked for an independent pass before pulling the trigger. `audit.py` re-renders
every row from the **final** payload (what will actually be written — the first pass had
read the *pre-fix proposal*), 6 chunks × 675 rows, ~220 KB each; 6 `gpt-5.6-sol` lanes
read them against `AUDIT.md`. Peak context per lane was the target 200–250 K, vs 86–143 K
for the 16 first-pass lanes — same total work, 6 lanes instead of 16.

**430 findings**, 292 of them on rows the first pass had passed clean.

| stream | rows | contested | verdict |
|---|---|---|---|
| creates | 2,695 | 140 (5.2%) — 99 of them POS | ✅ sound, fix POS |
| skips | 936 | 7 | ✅ sound |
| **enrichments** | **417** | **282 (68%)** | ⛔ **do not write** |
| relations | 580 | 7 link findings | ✅ sound |

All six lanes independently named the same #1 defect: **the merge compares our wording
only against Vincent's GLOSS, never against his NOTES** — and 3,427 of his entries carry
rich notes. So detail he deliberately put in a note gets appended to his gloss as if new
(`"attaches, connects, fits, buttons, traps, jails"` + `"handcuffs, locks up"` when his
note already says *Can also mean "handcuffs someone" or "locks with a padlock"*). 147
edits match that pattern mechanically; the lanes flagged 169 `drop_change` + 51 `rewrite`.

Systemic fixes to make in the pipeline (NOT row by row):
1. Compare a proposed append/added sense against the target's **gloss AND note**.
2. A more specific wording of the same meaning is a **rewrite of the gloss**, not an
   append and not a new sense (`"hides small, solid object"` + `"hides it (small, solid
   object)"`).
3. **Homograph guard.** 21 `should_be_new`: waterfall was being merged into "throat",
   juniper into "bird", pine pitch into "cattail", "they are yellow" into "aches".
   Implausibly unrelated meaning ⇒ its own entry, never a sense on his.
4. **`pr.n`** for personal names, nicknames, clan/people/song-cycle names, placenames —
   under-applied across ~40 creates.
5. POS ordering: one-word imperative ⇒ `v`; multiword subjectless verbal ⇒ `vp`; full
   clause with an explicit subject ⇒ `sent`.
6. 4 malformed derivation notes: `Plural of *aahwar and*.` (lines 256, 2388, 2817, 2818).
7. 7 form markers `(with s)` / `(no -m)` discarded or left in a gloss (lines 103, 204,
   205, 2044, 2840, 2857, 3042); lines 204/205 are a real minimal pair and both skipped.
8. 58 entries whose whole English cell is a metalabel ("personal name", "placename") have
   no real translation and no review flag.

Also verified clean by the lead: all 4,048 rows accounted for exactly once · no duplicate
entry/sense ids · no empty lexemes or glosses · 0 unresolved relationship targets · no
self-links or duplicate relationships · pipeline byte-deterministic across a full re-run
from `raw.xlsx` · pre-import backup present on the VPS (`10,395,648` bytes, matches live).

Working files: `audit.py`, `AUDIT.md`, `audit-01..06.txt`, `decisions/audit-*.jsonl`
(+ `.summary.md`), `audit-rows.json`. Lane ids in `audit-sessions.txt`.

Doctrine changes this run earned are LANDED in `importing.md` (tracked in
`.issues/import-guide-v3-lane-and-merge-guidance.md`).

## Systemic fixes applied (2026-07-25) ✅

Fixed as RULES in the pipeline, then rebuilt — not as 430 row patches.

1. ✅ **Note-aware suppression** (`merge.already_said`) — nothing we propose may repeat
   what the target entry says in its gloss OR its notes, checked **item by item** so a
   half-new append keeps only the new half. An explicit reader `add_sense` ruling still
   beats the rule (his note *"can also be a noun for 'comb'"* → the reviewer wanted that
   formalized as a real sense).
2. ✅ **`rewrite` status** — the auditor's own wording replaces a gloss instead of a
   mechanical comma-append; on a brand-new row it just corrects our own text
   ("they cuts" → "they cut").
3. ✅ **Homograph splits** — `should_be_new` forces its own entry AND sets
   `separate_entry` so the one-headword-one-entry pass cannot fold it back in.
4. ✅ **`pr.n` + one-word-imperative rules** in `pos.py`. Calibration against Vincent's
   own labels went **88.0% → 88.3%**. NOTE: the auditors' proposed general
   "multiword verbal ⇒ `vp`" rule was **tested and REJECTED** — it scored 87.4%, because
   Vincent writes `v` for most multiword verbs (`ii way` "talks to") and reserves `vp`
   largely for reflexive `mat X`. Calibrate a reviewer's generalization before adopting it.
5. ✅ **`FORM_CONTRAST`** — `(with ny)`, `(no -m)` become a note instead of being dropped
   or left in the gloss (10 rows).
6. ✅ **Multi-base derivations** — `TARGET` no longer swallows "and", so
   "plural of aahwar and aahwaar" makes TWO links and a clean note (was
   `Plural of *aahwar and*.`).
7. ✅ **`NAME_LABEL_ONLY`** — 63 rows whose whole English cell is "personal name" /
   "placename" now carry a `missing_gloss` review flag asking Vincent what the word means.
8. ✅ **`split_items`** — paren-aware gloss splitting, so `ties up (horse, bundle)` can
   no longer append the fragment `ties up (horse` to his gloss.
9. ✅ **A review question survives a no-op row** — a manager-facing question on a row that
   writes nothing now attaches to the existing entry it is about.

`verify.py` (new) is the guide's "every ruling must have a mechanical consequence" check:
it diffs all **622** reviewer rulings against the final payload and hard-fails on any that
changed nothing. It caught 25 dropped rulings on the first run; now **0**.

### Payload after the fixes

| | before audit | after |
|---|---|---|
| new entries | 2,695 | **2,719** (incl. 5 homographs split off his entries) |
| entries of his we edit | 417 | **194** |
| — glosses extended | 223 | 108 |
| — glosses replaced | 0 | 44 (reviewer-authored wording) |
| — meanings added | 261 | 103 |
| review queue | 31 | 108 (63 = "no English translation given") |
| rows written off | 936 | 1,140 |

## Third pass ✅ (2 lanes, `AUDIT2.md` / `audit2-01,02.txt` / `decisions/final-*.jsonl`)

424 rows that touch his entries — the 194 we still edited, the 5 homograph splits, **and
all 225 we had STOPPED writing** (a false suppression is silent data loss, so the
suppressed rows needed reading as much as the written ones). His notes shown **IN FULL**;
the 200-char truncation in pass 2 had caused real misjudgements.

**86 findings**, and they found a bug I introduced:

- ⛔ **Blanket suppression.** My `suppresses()` handler silenced EVERY sense on a row when
  an auditor's redundancy verdict fired, even where the auditor's own `why` said "keep
  only *turns several loose*". **15 real meanings were being thrown away** — `rind`,
  `blanket`, `cantaloupe`, `strainer`, `switch places`, `is strong (coffee, alcohol)`…
  Now scoped to the named sense (or the single sense, or just the `extend` senses).
- **12 more homographs** split out (`juniper`/`bird`, `pine pitch`/`cattail`,
  `arroyo willow`, `Cupeño`/`Cahuilla`, `is loud`/`his ear`, `stepfather`/`uncle`…),
  and **1 un-split** (2312 — his note documents the same particle).
- **24 `drop`** — more edits whose content was already in his full notes, incl. line 69
  `aakatt` where pass 2's rewrite would have narrowed "cuts" although his note calls it
  *the most general word for "to cut"*.
- **18 `rewrite`**, 4 `pos`, 2 `flag`, 1 `review`.

`final_io.py` applies pass 3 as the authoritative layer; `verify.py` gives it precedence
over pass 2 and now checks **647 rulings across all three passes — 0 with no effect.**

### Final payload

| | original | after audit | **final** |
|---|---|---|---|
| new entries | 2,695 | 2,719 | **2,727** (2,846 meanings) |
| homographs split off his entries | 0 | 5 | **10** |
| entries of his we edit | 417 | 194 | **186** |
| — glosses extended | 223 | 108 | **96** |
| — glosses replaced (reviewer-written) | 0 | 44 | **44** |
| — meanings added | 261 | 103 | **108** |
| review queue | 31 | 108 | **109** (63 = "no English given") |
| rows written off | 936 | 1,140 | **1,145** |
| near-redundant gloss appends | 57 | 13 | **5** (all genuine) |

Determinism re-proven byte-for-byte after every rebuild. `preview.html` regenerated with
the two sections the new guide requires: **his text beside ours for every edit**, a
**sample of the rows we do NOT write** with the entry each was measured against, plus a
homographs section and a separate "wording we replace" section.

## Fourth pass ✅ — 7 Opus 5 lanes over ALL 4,048 rows (`AUDIT3.md`, `audit3-01..07.txt`)

Chunked at ~210 KB each per the new lane-sizing rule (580 rows/lane, vs 253 in pass 1).
**281 findings** — 171 on new entries, 101 on edits, 9 on skips.

Bugs it caught, each fixed as a rule:
- ⛔ **An early `continue` skipped the whole final-verdict layer** for rows a reader had
  ruled `merge: "new"` — every later pass's wording, POS and review ruling on those rows
  was silently discarded. Same failure class `verify.py` exists to catch; it caught it.
- **Twin senses.** An ADD whose first meaning-item is the same word as an existing sense
  ("kills" + "kills one", "barters, trades…" + "barters, trades… changes it out") now
  extends that sense instead of sitting beside it.
- **Etymology lost behind a derivation.** "(Spanish, plural of vendeerr)" left "(Spanish)"
  in the gloss — after a morphological lift the remainder was never re-classified.
- **`FILL his empty notes` with nothing but a marker note** ("The source marks this form
  \"u-\".") is noise on HIS entry; suppressed (still fine on a new entry).
- **The compiler's own misspelling** "whipporwill" ×3, fixed via a `SOURCE_TYPOS` map.
- `restore` now lifts a plainly-covered sense, not only a `suppressed` one; splits and
  folded siblings carry the row's review question.

- **Reviewer notes written in the imperative are instructions to the PIPELINE, not
  questions for Vincent** ("Move 'no e' out of the gloss", "Replace the malformed note").
  9 were about to ship verbatim onto his entry pages. `final_io.is_lead_instruction`
  now holds them back for the lead; all 12 were verified already resolved by later
  verdicts, except one (`nyemsap`) which needed a lead ruling.
- **A verdict on a FOLDED entry is indexed by the entry's senses, not by one row's.**
  Rows 2620+2621 share the headword `nyemsap`; the auditor's `pos: ["n","v"]` meant the
  folded entry's two senses, and applying their `rewrite` to row 2620's only sense
  produced "continues all night" twice. Ruled explicitly in `decisions/last-99-lead.jsonl`
  (lead files load LAST so they win), and `verify.py` now follows a row into the entry it
  was folded into.

**Rejected a second reviewer generalization** (after the `vp` rule in pass 2): lane 01
proposed a global rule turning parenthetical literal decompositions into notes
(`ladder (thing you climb with)`). Quantified first — 136 rows match, and the large
majority are legitimate scoping parentheticals in Vincent's own house style
(`(horse, bundle)`, `(woman speaking)`, `(flame)`, `(said by man only)`; his dictionary
already keeps 92 of them). Only the 6 explicitly-flagged rows were changed. **Calibrate a
reviewer's generalization against the manager's own practice before adopting it.**

### Final payload

| | original | pass 2 | pass 3 | **pass 4** |
|---|---|---|---|---|
| new entries | 2,695 | 2,719 | 2,727 | **2,729** (2,846 meanings) |
| homographs split off his entries | 0 | 5 | 10 | **10** |
| — glosses extended | 223 | 108 | 96 | **83** |
| — glosses replaced (reviewer-written) | 0 | 44 | 44 | **41** |
| — meanings added | 261 | 103 | 108 | **76** |
| entries of his we edit | 417 | 194 | 186 | **142** |
| review queue | 31 | 108 | 109 | **124** |
| rows written off | 936 | 1,140 | 1,145 | **1,187** |
| near-redundant gloss appends | 57 | 13 | 5 | **4** (all genuine) |

`verify.py`: **837 rulings across all four passes, 0 with no effect.** Pipeline
byte-deterministic across a full re-run from `raw.xlsx`. `preview.html` regenerated.

### Pass 5 ✅ — the review queue read as Vincent will see it (2026-07-26)

The guide's new rule ("reader-authored text is a draft, never a review note") applied to
our own queue: all 124 notes rendered **beside the action the row finally takes**. Two
defect classes, invisible until note and outcome are read together:

1. **Stale notes** — a later pass changed the plan, the note kept describing the old one.
   `chewuuw` and `'ekwaas` said "I added it as a further meaning here" while the row had
   become its own entry; `hapechaa` said "I put both on this one entry" after a split;
   `chehich` said "I kept it so the word is not lost" while the row wrote nothing.
2. **Duplicate questions** — a split row put the SAME question on the new entry AND on
   his existing one. Fixed as a rule in `apply.py`: when a row also becomes its own
   entry, the question belongs there and only there.

Also: template mismatch (13 placename/clan rows asked "Whose name is it?"), category
vocabulary normalized to six facets (`conflicting_place_identification` +
`conflicting_species_identification` → `source_conflict`; `uncertain_pos` folded into
`uncertain_gloss`; the four `other` metalabel rows → `missing_gloss`), and first-person
voice made consistent. New `unreview` verdict + its `verify.py` check; review/unreview
now supersede like dispositions (last ruling wins).

**Result: 124 → 121 questions, 142 → 138 of his entries edited.**

## Phase 2 ✅ — written 2026-07-26

`run.py` — three streams, ledger bound to a sha256 of `payload.json`, `results.length`
hard-fail, resumable. Canary first (one PATCH + one POST read back), then the run.

Three defects were caught **after** the first write, each fixed as a rule and re-run
(every stream is idempotent, so the corrected payload simply overwrote):

1. **Two patches racing on one sense** (`mewaly`, `uumall`) — a reviewer `rewrite` and a
   mechanical `extend` both targeted the same existing sense; array order let the weaker
   mechanical wording win. Rule: dedupe by sense id, a reviewer's wording outranks a
   composed one.
2. **A `restore` that duplicated his own gloss** (`aachap`) — the reviewer meant "write
   the derivation link", the only mechanical consequence available was "un-suppress the
   sense", and his entry got the same gloss twice. Rule: decline a restore whose gloss is
   literally his, keep the row's link.
3. **A restore that should have been a rewrite** (`'iihaatt` "greedy" → "greedy (like a
   dog)", `llekwis`) — ours keeps his words verbatim and adds a scope, so it rewrites the
   one gloss instead of standing beside it as a near-twin.

Three orphan senses from the first run were deleted, and one residual source stamp on
`aachap` cleared, so **the live dictionary matches the signed-off payload exactly**.

### Verification (live `iipay-aa.db` pulled WITH its `-wal`, vs `live-pre.db`)

| | before | after |
|---|---|---|
| entries | 4,641 | **7,370** (+2,729) |
| senses | 4,642 | **7,561** (+2,919) |
| relationships | 1 | **581** (+580) |
| entries needing review | 0 | **121** |

- **138 of his entries changed, 0 unintended, 0 deletions.** Only the intended fields
  moved: `sources`/`citations` (138), `review` (14), and 3 empty-field fills.
- **83 of his senses changed, only `glosses` + `sources`.**
- New entries/senses in the DB match the payload id-for-id (0 symmetric difference).
- No entry anywhere carries two identical glosses.
- `import_id` dry-run batch-delete: 2,729 (the rollback handle).
- 10 entries spot-checked against the spreadsheet: diacritics, POS, notes, links intact.

GOTCHA for the next import: copying `dictionaries/{id}.db` off the VPS **without its
`-wal`** silently loses the most recent writes — the first verification pass reported
1 relationship instead of 581. Always copy `.db` + `.db-wal`, then
`PRAGMA wal_checkpoint(TRUNCATE)`.

### Filed on the conversation (both silent)

- Report artifact `97460878-4eff-4a0d-b270-6c39a172592b` (`report.py` → `report.html`,
  counted from the live DB, questions at the top, per §2.7).
- 6 answerable questions: provenance (MG/BITD), where the new audio goes, keep the
  machine-proposed POS, what the `(h-)`/`(t-)` markers mean, keep the 69 name/placename
  entries, and whether to stamp the source on the 1,191 words already covered.

## Pass 6 ✅ — the report card caught 4 destroyed glosses (2026-07-26)

Rebuilding the report so that **every enrichment card shows the entry as it now reads**
(rather than a `was → becomes` line) exposed the worst defect of the whole job, live on
his entries:

    achhuukaayp  'barters, trades, swaps, exchanges, transacts'  ->  'switches places'
    tekehap      'brings in, runs into, animals come in'         ->  'puts on hat'
    tekewank     'turned around, twisted, injured, wrenched…'    ->  'turns himself around…'
    nyehatt      'his dog, pet, horse, domesticated animal'      ->  'has an animal as a pet…'

**Cause:** `apply_final`'s `rewrite` branch picked the target sense *positionally* — the
first sense carrying a `match_sense_id` — so a ruling meant to reword the sense we were
ADDING landed on HIS sense and replaced it. Five passes missed it because they read rows
and rulings, never the composed result on his entry.

**Fixed as rules:** a `rewrite` now targets the sense whose own wording the ruling
restates (content-lemma overlap), and may only replace his gloss when it keeps ≥50% of
his content words — otherwise it is written as a meaning BESIDE his. New `keep_only`
verdict for "of everything this row would write, only this is new". `verify.py` now
hard-fails on any rewrite that discards the majority of a human's wording.

`repair.py` (new) computes the difference between the live dictionary and
`live-pre.db` + the corrected payload, and issued the minimal fix: **7 of his senses put
back / corrected, 9 of ours deleted**. Re-run of `run.py` after that: idempotent.

### Final verification (live vs `live-pre.db`)

- entries **7,370** (+2,729) · senses **7,556** (+2,914) · relationships **581** (+580)
  · review flags **121**
- **138 of his entries changed, 0 unintended, 0 deletions**; 86 of his senses changed and
  **0 of them lost the majority of his wording**; new rows match the payload id-for-id.
- `repair.py` re-run after the fix: nothing left to repair.

## Handed back ✅ (2026-07-26)

- Report artifact `1f1e0a02-36c5-4a43-ac98-f0d9a56d0678` — every headword in it links to
  its live entry (402 links), enrichment cards show the entry as it now reads, and the
  counts come from the live DB.
- The earlier artifact `97460878…` (stale: pre-repair counts, no links) was deleted from
  `shared.db.thread_artifacts` via the container's better-sqlite3 **before Vincent was
  ever notified**, so his page carries exactly one report. Its R2 object is orphaned and
  harmless (no `@aws-sdk/client-s3` in the container's node_modules to delete it with).
- 6 answerable questions filed; closing message posted (`1a2762cf…`) — that is the email.

### Still to do

- Jacob resolves the conversation at `/admin/imports`, and the per-dict API key
  `d0138c88-815f-4ee0-8cfb-9c76f0898eb1` gets revoked.

## Working files

`~/import-work/iipay-aa/` on mustang. Backup of the live dict.db before any write:
`/opt/hosting/data/.import-backups/iipay-aa-pre-import-20260725-112958.db`.
Source registered: `mg-bitd-wordlist` (`d25e954d-bfc1-41f7-8855-e5dd9dc9cbb6`); the
uploaded file is filed under it.
