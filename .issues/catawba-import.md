# Catawba import (thread 979d53da-6618-41a6-bc15-71b9d896526a)

Requester: **thohahente** <thohahente@thohahente.com> (`9c056e48-0ad2-44c3-8988-888bf3624ad7`),
manager of `catawba` since 2026-07-26 (contributor since January). Dictionary owner /
original manager: Rebekah Ingram <rebekah.ingram@catawba.com> (`12661d2b-…`), Tribal Linguist
for the Catawba Nation.

Instructions (authoritative): *"Exactly as laid out. Catawba Word, English Translation,
Part of Speech, Semantic Domain."*
Request note: *"This is a test for accuracy and consistency. Once we have that I will
complete an API Agent for the bulk upload."*

→ **This is a fidelity pilot.** 14 rows. The deliverable is a demonstrable byte-exact
round-trip, not lexicographic re-interpretation. Do exactly what the columns say; raise
judgement calls as questions instead of acting on them.

## Working dir

`~/import-work/catawba/` (raw.csv, live-pre.db, token.private, pipeline, preview, report).

## Phase 0 ✅

- API key minted (admin-attributed to `jwrunner7@gmail.com` = `f0fdbb2f-…`), key id
  **`d220bf34-2b3e-444a-9c1d-ccfb2d694e2b`**, label "Import agent (Catawba 2026-07)".
  Raw token in `~/import-work/catawba/token.private`. **REVOKE WHEN DONE.**
- Conversation claimed (`PATCH {started:true}`). `started_at` had already been stamped
  2026-07-27T02:02:25Z by Jacob's earlier click; re-PATCH is idempotent.
- File `42dc6ceb-76e9-4b77-b07f-8a80f2c8fca6` downloaded → `raw.csv`, 739 bytes,
  sha256 `16672445a80f2380a0907df80b7de28bbaee21d46b98d0101b7239092f746dfb`.
  Real CSV, UTF-8 **with BOM**, CRLF line endings, RFC4180 quoting.
- Source registered: slug `rudes-catawba` (see below), file PATCHed with its `source_id`.

## Existing dictionary state (`live-pre.db`, pre-import)

**111 entries / 111 senses — exactly one sense per entry.** bucket `unlisted`, gloss
languages `["en"]`, no orthographies, 0 tags, 0 dialects, 0 audio/photo/video, 5 sentences,
1 speaker, 0 relationships, 1 source row (slug `sb`, citation "Sb", used by 1 entry).

House style measured:
- glosses on 109/111, POS on 87/111, semantic domains on 84/111 (as **keys**).
- **0 definitions, 0 variants, 0 plural forms, 0 write-in domains** ever used.
- notes on 16 (e.g. `suffixing verb`, literal translations, an interlinear sketch),
  phonetic on 4 (English-style respelling, not IPA), linguistic_history on 2
  (neologism coinage credits).
- Only 1 of 111 entries carries any source attribution.
- POS is often a **stack**: `["v","v.suff"]`, `["v","v.pref"]`, `["pple","v"]`,
  `["cpd","pple","indf","v"]` — a base category plus the affix category.
- Gloss capitalization is inconsistent (`Grasshopper` / `to be awful` / `To make a bed`).

**Orthography (critical, and the CSV matches it exactly):** the dictionary writes the low
vowel with **Greek α U+03B1** (51×) and its stressed form with **ά U+03AC** (9×), glottal
stop with **Ɂ U+0241** (34×, one stray ɂ U+0242), plus ogonek nasals ą ę į ų, ɛ U+025B,
č U+010D, and combining acute U+0301 where no precomposed form exists. The incoming CSV
uses the **same codepoints** — so no normalization is needed or wanted. Do NOT "fix"
Greek alpha to Latin ɑ.

## Phase 1 — inspection of `raw.csv`

4 columns, 14 data rows, no blanks, no interior gaps, alphabetically ordered.
Every value is clean NFC UTF-8; no trailing whitespace, no mojibake, no stray markers.

- **Every one of the 4 semantic-domain strings maps to an LD domain NAME exactly**
  (Location and Directions→9, Kinship and relationships→2.6, Grammar→10,
  Quantities and Quantifiers→7, Earth, geology and landscape→1.2, Transportation→5.15,
  Body functions→2.2, Senses and perception→2.3, Discourse Markers→10.5).
  The API does **not** name→key normalize semantic domains — the pipeline does it.
- **Every POS value is an LD part-of-speech name exactly** (particle→p, noun→n, verb→v,
  compound→cpd, noun suffix→n.suff, verb suffix→v.suff, verb prefix→v.pref). The API
  normalizes these itself; we send the English name so the pilot exercises that path.
- **Zero overlap with the 111 existing entries** — exact and diacritic-stripped both
  return nothing. The manager has hand-entered neighbouring α-words (`αkaw-`, `αkénaɁ`,
  `αkíinɛ`, `αkíipíi-`, `αníyαtαɁ`) but none of these 14.
- Row 5 gloss `epistemic ("might have")` mirrors the existing entry `-ah-`
  `Intentive "must X"` — same house pattern for affix glosses. Left verbatim.
- Rows 1–3 (`αkíiráɁ`, `αkíirą`, `αkíirii`) are all "near" / particle / Location and
  Directions — almost certainly variants of one word. Per "exactly as laid out" they
  import as three entries; asked as a whole-import question instead of acted on.

## Decisions

1. **Verbatim mapping, no lexicographic restructuring.** 1 row → 1 entry → 1 sense.
   Lexeme, gloss, POS, domain exactly as given; no splitting on `,`, no case fixing,
   no variant/relationship inference.
2. Semantic-domain names → LD keys (only transformation applied to a cell value).
3. Provenance stamped once at entry level: `sources: ["rudes-catawba"]`. The uploaded
   filename contains `Page_3`, but a `p. 3` citation locator is not shown until the manager
   confirms what that part of the filename means. Senses do not repeat the entry source.
4. Deterministic ids: uuid5(DNS-ns of `livingdictionaries.app`,
   `catawba/rudes-catawba/p3/<row#>/<verbatim Catawba word>`), so a re-run addresses the
   same rows.
5. `import_id` = `rudes-catawba-p3-2026-07`.
6. No entry-level `review` flags — nothing in these 14 rows is unresolved after cleanup;
   the two open questions are whole-import ones and go on the conversation.

## Phase 2 ✅

- VPS backup: `/opt/hosting/data/.import-backups/catawba-pre-rudes-p3-20260727-025621.db`.
- `run.py` → 1 chunk, 14 results, all `created`. Ledger in `ledger.json`
  (bound to payload sha256 `57af000a442d180fb92db013fcb021542f38dd28fec017b266b111683f3dd117`).
- `import_id` **`rudes-catawba-p3-2026-07`** (private tag id
  `128fc219-898f-4f2e-9086-db28cbda3732`) — rollback handle is
  `POST …/entries/batch-delete {import_id, dry_run|confirm_count}`.
- Source id `0551f5bd-cc36-40d2-93fd-c01c226c6840` (slug `rudes-catawba`).
- **Verification (three independent paths, all clean):**
  1. `verify-payload.py` — payload re-derived from raw bytes, no builder import: PASS.
  2. `verify-live.py` — every entry re-read through the public API: 14/14 with headword,
     meaning, POS, domain, one entry-level source, no unconfirmed locator, no review flag,
     no invented fields.
     Full paginated sweep: **125 entries** (111 + 14, as predicted).
  3. Insider read of `catawba-post.db` (WAL checkpointed) diffed against `live-pre.db`:
     entries **+14 −0 changed=0**, senses **+14 −0 changed=0**, sentences/dialects
     untouched. Nothing of the manager's moved.
- `server_seq` 129–168 assigned → the rows sync down to editors' browsers normally
  (no snapshot-lag caveat applies; the v1 write path is sync-correct).
- Report artifact `b231f28c-dbb5-4196-8e5d-670c3a9693ba` (26,716 B, script-free,
  no external assets → renders under `default-src 'none'`).
- 3 questions filed: `41af66bf…` (literal vs. shaped — the one that matters for the
  bulk upload), `e2ea86d1…` ("near" triple), `fedbfcc5…` (provenance).

## Provenance/report correction ✅

- A pre-send review caught that the batch payload put `rudes-catawba` in both
  `entries.sources` and each `senses.sources`. `correct-provenance.py` cleared the
  sense-level copy and the unconfirmed entry `p. 3` locator on all 14 entries. The public
  entry page now shows one `Source — Rudes` section.
- The source registry record now describes the uploaded CSV itself and says that the
  underlying Rudes work / meaning of `Page 3` in the filename is unconfirmed. It no longer
  guesses an author or manuscript type.
- The report generator and payload/verification scripts were updated to encode the
  corrected representation. The existing report artifact
  `b231f28c-dbb5-4196-8e5d-670c3a9693ba` was corrected in place before notification
  (explicit Jacob direction; artifacts ordinarily stay frozen): title now says “14 words
  from the Rudes CSV”; question 1 uses plain language about a structured CSV vs. the
  Living Dictionary data model; the compiler/page sentence and direct guide link are gone;
  “build your own import agent” is now “use your own agent to import”.
- Browser verification: exact public entry has one `Rudes` source; corrected question 1
  rendered cleanly with no runtime errors. Screenshots:
  `~/import-work/catawba/entry-corrected.png` and
  `~/import-work/catawba/report-question-1-corrected.png`.
- Safety backups made before the corrections:
  `/opt/hosting/data/dictionaries/catawba.db.bak-provenance-20260727-034531` and
  `/opt/hosting/data/shared.db.bak-catawba-report-20260727-034531`.

## Completion ✅

- Jacob had already posted the closing admin message
  `7b5d7d50-6f93-4516-b3f8-46cb2d904885` at `2026-07-27T03:48:09.593Z`.
- The agent mistakenly posted a second closing message
  `c5370b0c-25f3-424e-89e9-c541f40bd871` at `03:51:28Z`. At Jacob's request it was
  tombstoned at `03:56:53Z`; the thread now contains only the requester message and
  Jacob's reply, and `message_threads.last_message_at` points back to Jacob's reply.
  The already-sent email notification cannot be recalled.
- Pre-delete backup:
  `/opt/hosting/data/shared.db.bak-remove-duplicate-import-message-20260727-035650`.
- Conversation resolved at `2026-07-27T03:51:28.687Z`.
- Temporary import API key `d220bf34-2b3e-444a-9c1d-ccfb2d694e2b` revoked at
  `2026-07-27T03:52:20.522Z`; its token now returns HTTP 401.

## Gotcha found while writing the report

Parts of speech render **two different ways**: the entry page shows the full English
name via `t({dynamicKey: 'ps.<abbrev>'})` (`EntryPartOfSpeech` → `ModalEditableArray`
renders the option's `name`), while the dictionary home word cards, gallery and print
view show the abbreviation via `add_periods_and_comma_separate_parts_of_speech` +
`psAbbrev.*` (`p.`, `v.suff.`). An earlier draft of the report claimed the entry page
abbreviates — wrong. Semantic domains always render as names.

## Requester answers (2026-07-27) — thread RE-OPENED

thohahente answered all three questions on 2026-07-27T18:15–18:22Z. Answering **re-opens the
thread** (`resolved_at` → null; intended behavior, asserted by
`routes/api/v1/dictionaries/[id]/conversations/server.test.ts:192`), so it went back into the
queue unread and unassigned-to-anyone-new. The "Resolved" line below was stale from 07-27 to 07-29.

1. **`41af66bf…` literal vs shaped → `literal`.** One row, one word, columns as given. Matches
   what the pilot did; nothing to change. This is the mandate for their bulk upload.
2. **`e2ea86d1…` the "near" triple → `separate`.** Already three headwords — no data change.
   Follow-up message gives the reason: *"These are particles that are phonetically distinct
   depending on what they attach to in speech. Although they share the English gloss 'near,' the
   different forms represent meaningful phonological variants in Catawba and should not be merged."*
   **Deliberately NOT written into the entries as notes** — that would be exactly the "shaping"
   answer 1 rules out. The rationale lives in the thread and here.
3. **`fedbfcc5…` the Rudes citation → confirmed**, see the fix below.

### Reconciling answers 1 and 3 (matters for the bulk upload)

Answer 3 also states: *"Rudes is a source, not the governing linguistic authority. Standardization,
entry structure, classification and treatment of forms follow the rules established for the
contemporary Catawba dictionary project and the decisions of the Catawba Language Group and
Dr. Rebekah Ingram."* That is not in tension with "literal" — **they do the shaping upstream per
their own project rules, and LD writes exactly what arrives.** An agent working the bulk upload
must not re-analyse or restructure their material.

## Citation correction ✅ (2026-07-29)

The stored source record still asserted the work and "Page 3" were unconfirmed — false once they
answered, and visible on 14 public entry pages. Fixed by direct VPS edit (no API key needed; the
temporary one stays revoked). Backup:
`/opt/hosting/data/dictionaries/catawba.db.bak-citation-confirm-20260729-093602`.

`sources` row `0551f5bd-cc36-40d2-93fd-c01c226c6840` (slug `rudes-catawba`), `server_seq` 199 → 200:

| field | before | after |
|---|---|---|
| `citation` | "…Page 3… have not yet been confirmed." | "Blair A. Rudes. Catawba-English/English-Catawba Dictionary. Draft, Winter 2005–2006. …" + the governing-authority statement appended (Jacob's call) |
| `author` | null | `Blair A. Rudes` (natural order — corpus convention, cf. "Ernest E. Heimbach") |
| `year` | null | `2005–2006` (TEXT column exists for ranges) |
| `type` | `other` | `manuscript` (corpus uses `manuscript` for unpublished, `dictionary` for published; this is an unpublished draft) |

**`p. 3` locator restored** on all 14 entries — `citations = [{"slug":"rudes-catawba","locator":"p. 3"}]`,
`server_seq` 201–214. It was stripped on 07-27 *only* because the filename's "Page 3" was
unguessable; that is now confirmed. `EntrySource.svelte` de-dupes `sources` ∪ `citations` into one
`chip_slugs` set, so this renders as a single chip **"Rudes p. 3"**, not a second source section —
verified via the `WithCitationLocators` svelte-look story (light + dark).

`dirty` left null on every touched row (client-only flag); `integrity_check` ok. Per-dict writes
reach editors' browsers on the next R2 snapshot build (~30 min), not instantly.

## Progress

- ✅ Phase 0 (claim, download, inspect, source registered + file filed)
- ✅ Phase 1 (profile, stage, eyeball all 14 rows ×2, preview rendered + screenshotted)
- ✅ Jacob sign-off on preview (all five questions answered "recommended")
- ✅ Phase 2 writes (14 entries / 14 senses, verified three ways)
- ✅ Report + questions filed
- ✅ Jacob's closing message remains; duplicate agent message removed
- ✅ Resolved at `/admin/imports` (07-27) — **re-opened 07-27T18:15Z by the requester's answers**
- ✅ Temporary API key revoked
- ✅ Requester answers processed; citation + locator corrected (07-29)
- ⬜ Jacob to send the closing reply (draft below) and re-resolve the thread
- ⬜ Report artifact `b231f28c…` still carries the old "unconfirmed" wording — left frozen; the
  corrected citation now lives on the source record and in the reply

## Draft closing reply (awaiting Jacob's send)

> Thank you — that's exactly what we needed.
>
> We've recorded the source properly now: Blair A. Rudes, *Catawba-English/English-Catawba
> Dictionary*, draft, Winter 2005–2006, with the 14 pilot words cited to page 3. We've also noted
> on the source record that Rudes is source material rather than the governing authority, and that
> standardization and entry structure follow the Catawba Language Group's and Dr. Ingram's
> decisions — so anyone who works on this dictionary later sees that alongside the citation.
>
> The three words for "near" stay as three separate headwords, and your explanation of why is
> recorded with them.
>
> For the bulk upload we'll take your material literally — one row, one word, columns as given —
> and we won't re-analyse or restructure it. That fits what you described: your team does the
> standardization, and we store faithfully what you send. When your agent is ready, point it at
> the import guides in the API docs and give it room to work through them.
