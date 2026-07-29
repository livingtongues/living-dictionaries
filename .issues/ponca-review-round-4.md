# Ponca review round 4 — settle the petty flags, diff the real ones

Follow-on to `.issues/ponca-import.md` (import complete, report artifact posted, **no message sent
to Greg yet — thread has 0 messages**, conversation unresolved). Jacob reviewed the live queue and
found flags that no human should ever be asked about (a space before `~`; `n. suffix` vs
`n., suffix`), plus a display gap: a genuine difference is prose-only, with no visual diff.

## Starting state (prod, verified 2026-07-28)

349 entries flagged, holding **375 items** (a note can stack blocks — `Ágaxđè` has a POS block AND
a definition block, so settling one leaves the banner up).

| field | items | nature of the difference |
|---|---|---|
| definition | 84 | punctuation/spacing only |
| definition | 206 | words differ (100 of those ≥80% identical) |
| pos | 34 | one label vs another; 1 is the comma case |
| phonetic (respelling) | 34 | usually a single letter |
| pairing | 17 | finder list files the word under an unrelated English sense |

Structured source of truth for all 706 original items (`field`, `p1`, `p2`, `page`, `sense_gloss`,
`action`): `~/import-work/ponca/review-decisions.json`. Categories on prod:
`definition-differs` 271 · `respelling-differs` 32 · `part-of-speech-differs` 29 ·
`possibly-two-words` 17.

## Jacob's rulings (locked)

1. **Definitions** — auto-settle same-meaning paraphrases by taking the fuller/better-formed
   wording. Keep a flag ONLY when the halves say materially different things (different referent,
   contradictory meaning, one half describing another word). Where the finder list adds real extra
   synonyms, prefer the fuller wording; fold both together only when it reads naturally.
2. **Parts of speech** — a POS difference is NEVER a review item. Union both halves' labels; where
   the book prints a compound we have a canonical code for (`n. suffix` → `n.suff`), use that code.
   Also clean up the ~90 leftover verbatim POS strings dictionary-wide (`v. phr.` → `vp`, `art.` →
   `art`, `n. phr.` → `np`…), leaving person/tense labels (`1st pers. sing.`) verbatim.
3. **Respellings** — settle by cross-checking each respelling against the headword's own letters
   using the book's alphabet table (a = /ä/, e = /ā/, i = /ē/, o = /ō/, u = /ü/ …). Keep a flag only
   where neither half matches, or both do.
4. **Every settled decision must be listed in the report so a human can audit it later.**
5. **Diff display** — stacked labeled rows, changed spans highlighted on BOTH sides (not red/green:
   neither half is wrong yet). Char-level refinement for one-letter respelling cases.
6. **Data model** — extend `EntryReview` with structured `comparisons`; the note shrinks to the
   human sentence + question. Ships through v1 + OpenAPI so future imports get it free.
7. **"Use this one" buttons** — build them this round: each version gets a one-click apply that
   writes the field and drops that comparison.
8. **List view** — the ⚠ indicator moves to the END of the headword line (after respelling /
   alternate spellings), not mid-line next to the lexeme.
9. **Respellings are not IPA** — move `entries.phonetic` (4,667 rows) into an alternate orthography
   named **"Pronunciation guide"** (code `pronunciation`), the book's own term. Note the dictionary
   HAD an orthography row named `Pronunciation` before the import, which the import deleted as
   unused.
10. **Report artifact** — regenerate with new counts + the auditable decision list, replace the
    posted one (nothing has gone out).

## Part 1 — app code

- ✅ `dictionary.types.ts`: `EntryReviewComparison` + `EntryReviewApply` + `comparisons?` on
      `EntryReview`.
- ✅ `entry-input.ts` `to_review()`: normalize/validate `comparisons` (+ tests) — an `apply` target
      that couldn't be written is dropped while the comparison survives.
- ✅ `openapi.ts`: schema + description; `openapi.test.ts` keys. `guides/importing.md` documents it.
- ✅ `$lib/entry/review-diff.ts`: word-level LCS diff with char-level refinement for short
      replacements; bails to "no marks" when the two sides barely overlap (>60% changed) so a
      wholly-different wording isn't confetti. Unit tests in `review-diff.test.ts`.
- ✅ `ReviewBanner.svelte`: comparisons stacked + highlighted on BOTH sides, "Use this" / "In use"
      per side, `onapply`. Stories cover definition / respelling / two-comparison / no-apply cases,
      light+dark, 640px+360px.
- ✅ `EntryDisplay.svelte`: apply writes through the live row (`$lib/entry/review-apply.ts` resolves
      the target value + strips the settled comparison), clearing the review when the last one goes.
- ✅ `ListEntry.svelte`: `ReviewIndicator` now sits at the END of the headword line.
- ✅ i18n EN keys (`entry.review_use_this`, `entry.review_in_use`).
- ✅ Verify: `pnpm test` (exit 0), `tsc --noEmit` clean, `pnpm eslint` 0 errors, `pnpm check`
      0 errors, svelte-look stories, and a live browser run against the real prod data (below).

## Part 2 — Ponca data (prod, through v1 with a minted+revoked write key)

Order matters (the respelling apply-target depends on the orthography move landing first):

- ✅ Backup `dictionaries/ponca.db` on the VPS.
- ✅ Catalog: added the `pronunciation` alternate orthography ("Pronunciation guide", with a note
      explaining it is the book's own phonetic key, not IPA) — prod + local `shared.db`.
- ✅ Moved `phonetic` → `lexeme.pronunciation` on 4,667 entries, cleared `phonetic` (prod now has
      **0** rows with `phonetic`).
- ✅ POS: unions + canonical cleanup dictionary-wide.
- ✅ Definitions: settled values applied; all 206 real ones hand-audited with a recorded reason.
- ✅ Respellings: alphabet cross-check, matching half adopted.
- ✅ Surviving reviews rewritten; settled ones cleared.
- ✅ Regenerated + replaced the report artifact (`0d5c2ca5…`, `review_flags: 38`); the superseded
      artifact row + its R2 object are gone. Thread still has **0 messages** — nothing has gone out.
- ✅ Verified on prod by SQL and in a signed-in browser on livingdictionaries.app (post-deploy).
- ✅ Structured `comparisons` restored on the 38 surviving prod reviews (post-deploy pass below).

## Notes / gotchas carried in

- `PATCH …/entries/{id}` needs an API key with `role='write'` (the schema comment's `manager` 403s).
- Per-dict prod writes only reach editors' browsers after the ~30-min snapshot rebuild.
- Crop wide enough when verifying a page against the PDF (round-3 lesson: a narrow crop showed a
  neighbouring entry's run-on form and led to "fixing" a correct lexeme).

## Results

**375 review items → 38.** Prod `ponca.db`, verified 2026-07-28 10:37 UTC:

| | before | after |
|---|---|---|
| flagged entries | 349 | **38** |
| definition-differs | 271 | **16** |
| respelling-differs | 32 | **2** |
| part-of-speech-differs | 29 | **0** |
| possibly-two-words | 17 | **20** (3 reclassified out of definition-differs) |
| entries with `phonetic` | 4,667 | **0** |
| entries with `lexeme.pronunciation` | 0 | **4,667** |

Everything settled is listed with its reason in the regenerated report artifact ("What we settled
ourselves"), so any call can be audited and reversed.

### Correction found while verifying: "Use this" was wrong on 15 of 21 comparisons

The import merged the finder list's reading as a **second sense**, so on any multi-sense entry the
`b` version of a definition disagreement is ALREADY in the entry. A one-click apply (which rewrites
the FIRST sense's definition) would have duplicated a sibling sense — and 12 of those notes still
asked "should this entry carry both senses?" when it already did. Fixed in
`round4-fix-apply-targets.py` (plan rewritten; backup `round4-plan.json.bak-pre-apply-fix`):

- `apply` kept only where replacing IS the answer — 4 single-sense definition entries (Áwa,
  Tʼadéʼwégđi, Uhíaškà, Wéđaginąhì) + the 2 respelling/`entry.lexeme` ones. 21 comparisons, 6 with
  a "Use this" button.
- The other 15 are diff-only. The 12 `definition-differs` ones got an honest closing question:
  *"Both readings are kept here as separate senses — is that right, or does the word only carry one
  of them?"* The 3 `possibly-two-words` keep "Are these the same word?" — still exactly the question.
- `report.py` prose updated to match (a "Use this" appears *where picking one settles the question*).
  Regenerated `report.html`; **the prod artifact still holds the previous wording** — replace it in
  the same post-deploy pass.

Generalizable: **only offer an apply when writing that value is the whole answer.** If the other
reading already lives on a sibling sense, the question is about the senses, not the string.

### Post-deploy pass — ✅ DONE (2026-07-28 11:30 UTC, commit `97444112`)

While the old code was live, `to_review()` dropped the unknown `comparisons` field, so the 38 reviews
carried self-contained prose notes for ~2h (`round4-interim-notes.py`). After Jacob deployed:

1. ✅ Backed up prod (`/opt/hosting/data/.import-backups/ponca-pre-round4-comparisons-20260728-112743.db`).
2. ✅ `round4-restore-comparisons.py … --execute` — 38 PATCHes; prod now holds the short note +
   structured comparisons **with the corrected apply targets**: 21 comparisons, 6 with `apply`.
3. ✅ Report artifact regenerated from the updated `report.py` and posted
   (`a10d5a1c-c7d5-4fc5-b7b2-ef745ea5f0a8`); superseded row `0d5c2ca5…` + its R2 object deleted —
   exactly one artifact remains.
4. ✅ Temporary write key `98c4fe1a…` revoked (0 live ponca keys); raw token deleted.
5. ✅ Verified in a real browser signed in as an admin on **livingdictionaries.app**:
   `Uhítʼaʼžì` shows the character-level diff (`bä` marked), `In use` + a working `Use this`;
   `Kʼukʼúmi` shows the diff with **no** apply button and the corrected question; the entries list
   shows ⚠ at the end of each headword line with facets **Needs review (38) · Possibly two words
   (20) · Definition differs (16) · Respelling differs (2)**. No page errors.
6. ✅ Final DB state: 38 flags · 21 comparisons · 6 applies · 0 `phonetic` · 0 dirty rows ·
   `integrity_check ok` · thread still at **0 messages**.

**JWT gotcha for future prod browser checks:** the session JWT puts the user id in `sub`
(`.setSubject(id)`), not a `user_id` claim — a token with `user_id` verifies as signed-out.

### Verification performed (2026-07-28, this session)

- `pnpm test` exit 0 · `tsc --noEmit` clean · `pnpm eslint` 0 errors · `pnpm check` 0 errors.
- Pulled the post-round-4 prod `ponca.db` to `site/.data/dictionaries/ponca.db`, ran
  `round4-restore-comparisons.py` against local dev (new code keeps `comparisons`: 21 of the 38
  items carry them), then drove a real browser:
  - **Respelling entry** (`Uhítʼaʼžì`) — banner shows the character-level diff (`bä` marked on the
    main-dictionary side), `In use` on the version already in the entry, `Use this` on the other;
    clicking it rewrote `lexeme.pronunciation` to `ü-hēʼ-tʼä-zhēʼ` and the banner disappeared.
  - **Definition entry** (`Áʼąʼwà`) — `Use this` rewrote the sense's English definition; banner
    cleared. No marks rendered (the two wordings share almost nothing — the >60% bail working).
  - **Entries list** with the "Needs review" facet (36 after the two test applies) — the ⚠ now sits
    after the respelling at the end of the headword line. Facets: two-words 20 · definition 15 ·
    respelling 1. POS unions render as `n, suff`.
  - Zero page errors in all runs.

### Local dev DB note

`site/.data/dictionaries/ponca.db` is now a copy of prod post-round-4 **plus** structured
comparisons **plus** the two entries whose reviews the apply-test resolved. Local-only.
