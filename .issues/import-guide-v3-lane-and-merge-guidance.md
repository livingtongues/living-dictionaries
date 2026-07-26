# Import guide v3+v4 — lane sizing, how to read a row, audit passes, and merge-imports

Proposed edits to `site/src/lib/api/v1/guides/importing.md`, derived from auditing the
'Iipay Aa run (4,048 rows, 16 reader lanes, 663 corrections). Every item below is a gap
that **cost real quality in that run** — not speculation.

Status: ✅ LANDED in `importing.md` (2026-07-25, Jacob approved all six). Kept as the
rationale record — the guide states the rules, this states why each one exists.

---

## 1. §1.4 — size lanes by context budget, not by lane count

The guide says "parallelize the reading with sub-agent sessions" and stops there, so the
lead guesses. The 'Iipay Aa run split 4,048 rows into 16 lanes; measured peak context per
lane was **86K–143K (median ~115K)** — roughly half the usable head-room, for double the
lane count and double the per-lane onboarding tax.

Text to add:

> **Sizing the lanes.** Budget by the *rendered bytes each lane must read*, not by row
> count, and size the chunk only after the renderer exists: render one chunk, measure it,
> then divide. A reading lane's peak context lands at roughly **4–5× the size of its
> chunk** — its own thinking, re-reads and decision output dominate the material itself.
> **Target ~200 KB of rendered material per lane** (≈200–250K peak). Fewer, fuller lanes
> beat more, thinner ones: every lane re-pays the same 15–25K onboarding cost (taxonomy,
> calibration, tool definitions) before it reads a single row, and a lane that has read
> 600 rows recognises a recurring defect that a lane with 250 rows sees only twice and
> treats as noise. Do not "play it safe" at 100K — that is paying for twice the lanes to
> get worse pattern recognition.
>
> Guard the tail: a lane that exhausts its context mid-chunk loses everything it has not
> written, so require lanes to **append to their decisions file as they go**, never to
> save it all for the end.

## 2. §1.4 — how to actually read a row (currently unspecified)

The guide says *what* to hunt but never *how* a reviewer is put in a position to judge.
Everything below was invented ad-hoc for this run and should be doctrine.

> **Give the reader a self-contained block per row.** One block holding the verbatim
> source value, the record you propose to write from it, and any existing data the write
> will touch. A reviewer who has to go look something up will stop looking it up around
> row 40.
>
> **Lead with the two or three domain facts that decide most rows,** not with rules. For
> 'Iipay Aa those were "Kumeyaay statives are verbs, so a gloss like *bitter* is `v` not
> an adjective" and "existing entries are one-per-recording, so five identical copies of
> a headword are normal". Two calibration facts retired more errors than a page of
> instructions would have.
>
> **Every verdict a reader can write must have a mechanical consequence.** If the
> pipeline can silently ignore a ruling, it will — in this run ~25 merge rulings landed
> in a code path that had already decided otherwise and were dropped without a trace,
> found only by accident during the audit. After applying the decision files, **diff
> every ruling against the final payload and hard-fail on any ruling that changed
> nothing.**
>
> **Require a per-lane `summary.md`** (counts per verdict, patterns seen, anything the
> lead should fix once). This is how pipeline bugs surface: a bug reads as the same
> correction thirty times in one lane's summary, and its fix is one rule change, not
> thirty row patches.
>
> **Treat a reader correction as a bug report about your pipeline, not a row patch.**
> Before applying the corrections, ask which of them a rule change would have prevented,
> fix those globally, and re-render. Six of this run's rule bugs were found that way.

## 3. NEW §1.6 — read the FINAL payload, not the proposal

The single biggest hole. The 16 lanes read a render built at 11:27; the lead then fixed
six pipeline bugs and rebuilt the payload at 11:54. **Nobody read the text that rebuild
produced.** That is exactly how the redundant-gloss class below survived: readers
approved the *decision* ("this is the same meaning, ours says more") while the *text* was
composed mechanically afterwards, yielding glosses like `sometimes, sometime`,
`clothes, cloth`, `waits for, waits on`.

> **A reviewer must approve composed output text, never the rule that composes it.**
> "Extend this gloss" is a decision; `"sometimes, sometime"` is what the dictionary's
> owner will actually read. If a rule writes human-visible prose, a human-equivalent
> reviewer has to see the prose.
>
> After the final rebuild, re-render and re-read **every row whose written output changed
> since it was last read**. When the import edits content a human authored, budget a
> **full second pass over the final payload**: the first pass reads a proposal, the
> second reads the outcome. Cheap insurance against the one class of error that survives
> every earlier check.

## 4. NEW section — importing into a dictionary that already has content

The guide is written for greenfield imports. The hardest third of this job — 1,318 rows
overlapping 4,641 existing entries — had no guidance at all. Proposed section:

> Most imports land in an empty dictionary. When they don't, the overlap is the job, and
> it is governed by one rule: **the manager's curation is the record; you may add to it,
> never overwrite it.**
>
> - **Snapshot the live dictionary first** and resolve against the snapshot, not against
>   live reads — the live DB moves under you and the run stops being reproducible.
> - **The unit of decision is the sense, not the row.** One source row routinely holds
>   one meaning they already have and one they don't.
> - Four verdicts per sense: already covered (write nothing) · same meaning but ours says
>   more · a genuinely different meaning of the same word · a different word that merely
>   shares a spelling.
> - **Choose the target entry by MEANING, not by age.** Oldest-first silently attaches to
>   the wrong homograph; use creation order only as a tie-break between true equals.
> - **Never overwrite.** Fill a field only when theirs is empty; append to a gloss only
>   when the addition is a *meaning* they lack, not a rewording of one they have.
> - **A normalized "same meaning" test is a filter, not a verdict.** Lemmatizing and
>   stripping parentheticals is what makes "mouth, lip, beak" match "mouth, beak, lips"
>   instead of dumping 300 trivial wording differences on a reviewer — and it is also what silently
>   discards `(bell)`, `(like piano)`, `(long hard object)`, `(with -m)`. **Anything the
>   normalizer dropped must be reported, never assumed redundant.**
> - **Count and sample what you are NOT writing.** In a merge import the skipped rows
>   carry the risk: a dropped row is the one thing the owner cannot discover by browsing
>   their own dictionary. The skip count, the reasons, and a sample belong in the preview
>   and the report.
> - **Ask what a duplicate MEANS in this dictionary before de-duplicating.** Here every
>   entry is one speaker's recording, so five identical `aa` entries are intentional. In
>   another dictionary they would be a defect.

## 5. §2.5 correction — PATCH array/citation fields REPLACE, they do not merge

The guide says "PATCH is field-merge and never deletes" and carves out only
dialects/tags as additive. That is misleading and dangerous when enriching an entry
someone else built. In `v1-entry-write.ts`, `ENTRY_PATCH_ARRAY_FIELDS`
(`sources`, `scientific_names`), `SENSE_PATCH_ARRAY_FIELDS` (`parts_of_speech`,
`semantic_domains`, `write_in_semantic_domains`, `sources`) and `citations` are all
assigned wholesale — a PATCH carrying `citations: [mine]` **wipes the provenance already
on the row**, and a sense PATCH carrying `sources` drops the existing attribution.

> Add: "Array and citation fields are REPLACED by a PATCH, not merged — `sources`,
> `citations`, `scientific_names`, `parts_of_speech`, `semantic_domains`. When you patch
> a row you did not create, **read it first and send the union**; otherwise you silently
> delete someone else's provenance. Only `dialects` and `tags` are additive."

**Worse than arrays: multi-language fields.** `to_multistring` rebuilds the value from
only the keys sent, so `PATCH {glosses: {en: "…"}}` onto a sense that also had a Spanish
gloss **deleted the Spanish gloss**. The request looks like it only touches English.

### ✅ RESOLVED — the API was changed instead (Jacob, 2026-07-25)

`v1-entry-write.ts` now splits on the seam **provenance accumulates, content is replaced**:

- `merge_sources` / `merge_citations` — `sources` and `citations` UNION with the row
  (deduped, existing first) on every PATCH path: entries, senses, sentences, texts.
- `merge_multistring` — multi-language fields overlay key by key (`lexeme`, `glosses`,
  `definition`, `notes`, `linguistic_history`, `plural_form`, `variant`, text
  `title`/`summary`, sentence `text`/`translation`).
- `parts_of_speech`, `semantic_domains`, `write_in_semantic_domains`, `scientific_names`
  and all scalars still REPLACE — they state what the word *is*.
- Escape hatches: `null` clears a whole field, `""` on one language key drops just that
  language.

The old test `patch overwrites homograph + citations and replaces sense sources` was
inverted to assert the merge, plus three new tests (a second importer cannot delete the
first's provenance + idempotent re-send; one-language patch preserves the others and `""`
drops one; POS/scientific_names still replace). §2.5 of the guide and the `EntryPatch` /
`SensePatch` / `SentencePatch` OpenAPI descriptions now state the rule.

## 6. §1.5 preview — spec assumes greenfield

The preview checklist describes new records only. Add: when the import edits existing
entries, the preview must show **his current text and the proposed text together** for
every edit, plus a sample of the skipped rows with the existing entry they were judged
redundant against. Those two sections are where a manager's sign-off actually matters.

---

## Audit findings on the 'Iipay Aa payload itself

Tracked separately; see `.issues/iipay-aa-import.md`. Summary of what the audit
(6 × `gpt-5.6-sol` lanes over the final payload + the lead's own passes) turned up:

- ✅ Structural integrity clean: all 4,048 rows accounted for exactly once, no duplicate
  entry/sense ids, no empty lexemes/glosses, 0 unresolved relationship targets, no
  self-links or duplicate relationships, pipeline byte-deterministic across a full re-run,
  pre-import backup present on the VPS.
- ⚠️ **57 near-redundant gloss appends** (class 1 above).
- ⚠️ **~110 dropped source parentheticals** (11 in edits, ~99 in skipped rows) where the
  source scoped a meaning and the kept wording does not.
- ⚠️ **58 entries whose entire English cell is a metalabel** ("personal name",
  "placename") — no real translation, and none carry a review flag.
- ⚠️ Isolated: 1 derivation parenthetical left unlifted with no link (line 3257), 6
  marker parentheticals left in a gloss, 1 definition duplicating its gloss's
  parenthetical.

---

# v4 additions — landed 2026-07-26 (Jacob)

A second round, derived from passes 3 and 4 of the same run (the ones the v3 text made
happen). Same bar: every item is a defect that occurred, not speculation.

## 7. §1.4 NEW "How many passes: two or three, not one"

The v3 text said "budget a full second pass". Passes 3 and 4 then found *more* than pass
2 did, so the guide now prescribes **2 audit passes minimum, 3 for a merge import**, with
the run's evidence (430 findings in pass 2 with 292 on rows pass 1 had cleared; 15
meanings rescued in pass 3; the dropped-verdict code path and the imperative review notes
in pass 4). Plus the four operating rules: vary the model between passes, always re-read
what the previous pass's rules STOPPED writing, stop only when a pass names rows rather
than causes, and track the payload's shape across passes (that convergence table is now
required in the report).

## 8. §1.4 — never truncate the existing material shown to a reader

Pass 2 rendered the target's notes clipped to 200 chars and ruled that `aakatt` "cuts"
should be narrowed; the full note said it is *the most general word for "to cut"*. The
render contract is now: every field of the record you are about to touch, in full.

## 9. §1.4 — generalize the cause, never the blast radius

My pass-2 suppression handler took "don't add the first of these two meanings" and
silenced the whole row: 15 real meanings (`rind`, `blanket`, `cantaloupe`, `strainer`,
`switch places`) were being dropped. Invisible in any diff of what we *would* write —
only rendering the suppressed stream caught it.

## 10. §1.4 — calibrate a proposed rule before adopting it

Two reviewer generalizations were rejected on measurement: the "multiword verbal ⇒ `vp`"
rule scored 87.4% vs 88.0% against Vincent's own labels, and the "parenthetical
decomposition ⇒ note" rule matched 136 rows of which most were his house style (his
dictionary already keeps 92 such glosses). Generalized in the guide to: quantify, sample,
check against the manager's practice — and for any machine-assigned field, score against
their own labels and publish the accuracy in the preview.

## 11. §1.4 — one authoritative verdict layer; verdicts key to the record

Both ruling-loss bugs (pass 1's ~25, pass 4's whole-layer skip) were an early `continue`
above the application layer. And a verdict on a folded entry (`nyemsap`, two rows → one
entry) applied row-wise duplicated a gloss, because it was keyed to the row instead of
the ids it changes.

## 12. §1.7 — profile the house style, copy conventions but not mistakes

Jacob's framing, and the highest-leverage single item in the whole run: the "0 of 4,642
senses use a definition field / 92 glosses keep a parenthetical / 100% carry a POS"
profile decided more design questions than any rule did. Paired with its guard — a typo
repeated three times is not a convention (the compiler's own "whipporwill" ×3).

## 13. §2.3 — reader-authored text is a draft, never a review note

9 notes were about to ship in the imperative ("Move 'no e' out of the gloss") — addressed
to the importer, landing on a manager's entry page. The queue now has to be re-read in
the manager's voice before writing.

---

# v5 additions — landed 2026-07-26 (Jacob)

From filing the 'Iipay Aa report, and from what building it uncovered.

## 14. §2.7 — every headword in the report links to its live entry

Jacob's rule, and it is not just for the questions: samples, before/after lists, the
review index, the table of rows you did not write, a rule's worked example. "The report
is read beside the dictionary itself, and a word the reader cannot click is a word they
have to go search for; after the second search they stop checking." For a skipped row you
still know the existing entry it was measured against — link that one. (402 links in the
'Iipay Aa report.)

## 15. §1.5 — show the WHOLE record as it will read, not the field you touched

The report card was rebuilt to render each edited entry as it now stands — every meaning
in order, with "added by this import" / "reworded" chips — instead of a `was → becomes`
line. It immediately exposed four entries whose PRIMARY meaning had been replaced by an
unrelated one (`achhuukaayp` "barters, trades, swaps, exchanges" → "switches places";
`tekehap` "brings in, runs into" → "puts on hat"; plus `tekewank`, `nyehatt`). Five review
passes had missed them, because every pass read rows and rulings rather than the composed
result on his entry.

## 16. §1.7 — a replacement may only keep their words and say more

Root cause of the above: `apply_final`'s `rewrite` branch chose its target **positionally**
(first sense carrying a matched-sense id), so a ruling meant to reword the sense being
ADDED landed on his. Two rules now, both in the guide and both enforced in `verify.py`:
target by wording overlap, and refuse any replacement that drops most of the content words
of the wording it replaces (it is a different meaning, so write it beside theirs).

Also new in the pipeline: a `keep_only` verdict ("of everything this row would write, only
this is new") and `repair.py`, which diffs the live dictionary against
`live-pre.db` + the corrected payload and issues the minimal PATCH/DELETE set — the thing
that makes "fix the rule and re-run" work after a write has already happened.
