# Ponca import — Dictionary of the Ponca People (Headman & O'Neill 2019)

Conversation `523ba8fe-3ce9-4e0e-9700-a3c0e89727db` · dictionary `ponca` ·
requester **Gregory Anderson** `livingtongues@gmail.com`
(`16b1a809-25ef-41bb-89ab-12a89475abc4`, site admin level 2).
Dictionary manager of record: **Cailie Keating** `ck1105@georgetown.edu`
(`4991369f-d011-460a-9bb5-a7756ce34f68`) — the only `dictionary_roles` row.

Uploader instructions (authoritative): *"import all entries with parts of speech, example
sentences, glosses are in English. Skip intro unless it can be extracted into Grammar and About
sections"*
Source note: *Headman, Louis V., and Sean O'Neill. 2019. Dictionary of the Ponca people.
University of Nebraska Press.*

Jacob's addition (2026-07-27): **use absolutely everything in the PDF.** Cover photo from page 1,
all prose into Grammar + About, and treat this as the stress test of the structured-grammar +
Leipzig-gloss (IGT) surface. Ground zero dictionary, high visibility (it's Greg's).

## Working dir

`~/import-work/ponca/` — `raw.pdf`, `full.txt`, `pages/`, pipeline + staging (gitignored, outside
the repo).

## Phase 0 status

- [ ] API key minted (admin-attributed to `jwrunner7@gmail.com` = `f0fdbb2f-…`) — **REVOKE WHEN DONE**
- [x] File pulled from R2 (`livingdictionaries-attachments`, key `import/ponca/a2ded9a6-…`)
      → `~/import-work/ponca/raw.pdf`, 9,258,502 bytes,
      sha256 `d6012c66bcb177f65ea5a0184018f63ee153262e5831173aeb28180cf8c58852`
- [ ] `PATCH …/conversations/{id}` `{started:true}` (`started_at` already backfilled to
      2026-07-23T16:30:32.978Z by the `started_at` migration — re-PATCH is idempotent/no-op)
- [ ] Source registered (proposed slug `headman-oneill-2019`) + file PATCHed with `source_id`
- [ ] VPS backup of `dictionaries/ponca.db`

## Existing dictionary state (pre-import, verified on prod 2026-07-27)

**Ground zero.** 0 entries / senses / sentences / texts / audio / photos / videos / speakers /
tags / dialects / sources / grammar_sections / glossing_abbreviations / clause_slots.
Catalog: `name` Ponca, `url` ponca, `iso_639_3` **oma**, `glottocode` **omah1247**,
`gloss_languages` `["en"]`, coordinates 1 point (−100.1332, 41.7858), `bucket` **unlisted**,
`public` NULL, `about` NULL, `citation` NULL, `featured_image` NULL, `orthographies` NULL.
`author_connection` (from Cailie): *"I am not part of the Ponca community but am in contact with a
member of the community who wishes to create a Living Dictionary…"*, `community_permission` "yes".

Thread has **zero messages**, zero questions, zero artifacts so far.

## The source PDF

408 pages, **born-digital** (Adobe InDesign 14.0 → Distiller 15.0, 2019-11-07), NOT a scan and NOT
OCR. Real embedded text layer. Page size 504×720pt.

| pdf pp | book pp | content |
|---|---|---|
| 1 | — | book jacket: title + **community powwow photograph** (2100×3000 JPEG, 300 dpi) |
| 5 | — | copyright page (© 2019 Louis Headman; LCCN 2017045889; UNP) |
| 6 | — | contents |
| 8–11 | vii–x | **Preface** |
| 12–18 | xi–xvii | **Acknowledgments** (incl. bios of the Ponca Council of Elders) |
| 20–59 | 1–40 | **Introduction: Notes on Ponca Pronunciation and Grammar** — the grammar sketch |
| 60–231 | 41–212 | **Part One. Ponca to English** — ~4,581 headwords |
| 232–407 | 213–388 | **Part Two. English to Ponca** — near-mirror, English-keyed, ~4,5xx headwords |
| 408 | 389 | Bibliography |

### Grammar sketch headings (pdf pages)

Pronunciation Guide (20) · Parts of Speech (26) · The Ponca Verb (27) · Verb Classes (29) · Basic
Verb Paradigms in Ponca (30) · Verbs with 1st person A̜- and 2nd person Đi- (32) · Verbs with 2nd
person Š- (33) · Verbs with 1st person B- and 2nd person Na- (36) · Verbs with both subject and
object markers (38) · Verb Prefixes (45) · Verbal Suffixes (47) · Tense Marking (49) · Verb
Internal Modifiers (53) · Ponca Articles and Classes of Objects (54) · Demonstrative Pronouns (55)
· Interjections (55) · Possessive Prefixes (56) · Relationships between Omaha and Ponca (56) ·
Ponca Numerical System (57–59).

Content is prose + ~15 ruled paradigm tables + morpheme decompositions
(`Akíg-` 'I act upon myself' + `dihą́` 'to lift'). The book uses its own labels
("1st pers. sing.", "dual", "Ø-" for unmarked 3rd person), **not** Leipzig codes.

### The font-glyph trap (CRITICAL, and the reason the text layer needs decoding)

Fonts are custom subsets — `MeropePonca`, `-Bold`, `-Italic`, `MeropeSans-Bold`,
`IowanOldStyle-Roman` — with **Custom encodings**. The letter **đ/Đ** (the /ð/ "th" sound, central
to Đegiha/Ponca) has NO ToUnicode mapping and extracts as **control characters**, differently per
font subset:

| code | count | true glyph | seen in |
|---|---|---|---|
| `\x17` | 4,130 | **đ** | MeropePonca (regular) |
| `\x08` | 1,143 | **đ** | MeropePonca-Bold |
| `\x16` | 677 | **Đ** | MeropePonca (regular, capital) |
| `\x05` | 16 | **Đ** | bold capital |
| `\x1e` | 39 | **Đ** | italic capital |

Verified against rendered page images: pdf p23 legend line reads `Đ/đ  /th/ as in the th in "them"`,
pdf p10 `Đégihà` (= Dhegiha), pdf p62 running head `Á'gđađè`. **Any pipeline that ignores this
silently deletes the single most distinctive letter in the language.**

Other live characters in the body: `ą ę į ų ǫ` (ogonek nasals), `č š ž` (hačeks), `á à é è í ì ó ò
ú ù` (acute/grave), `ä ā ē ī ō ü` (in the respelling column), `ⁿ` (U+207F superscript n), `ʼ`
(U+02BC glottal stop — note headword apostrophes come from a DIFFERENT font, IowanOldStyle-Roman,
as their own span), `·` (U+00B7 elevated period = long vowel), `ə ǝ ʃ`, combining U+0301/U+0300/
U+0328.

Also: pymupdf inserts a spurious space after `ﬁ`/`ﬂ` ligatures (`"fi rst"`); pdftotext does not.
The pipeline must reconstruct spacing from character geometry (rawdict) rather than trusting either.

### Entry structure (Part One)

```
**Headword**  /respelling/  *pos.*, short gloss, longer definition ; related-form, its gloss
```
Observed features and their counts in Part One:
- numbered senses inside one entry (`1.` … `2.`) — ~272 entries
- `;`-separated run-on related/inflected forms in italic (`đinégi, your uncle; inégi, his/her
  uncle; winégi, my uncle`) — ~786
- parenthetical **example sentences** using `~` for the headword
  (`(~ ađá biáma, he went to pray and fast)`) — ~48 in Part One, ~46 in Part Two
- `lit.,` literal translations — 298 · `archaic` labels — 49
- scientific names in italic (`Megascops`, `Hesperostipa curtiseta`)
- parenthetical encyclopedic notes `(Orig. brushes were made from…)`
- POS inventory (Part One, left column sample): n. 978, v. 633, adj. 272, adv. 93, pron. 33,
  n./v. 19, prep. 19, adj./n. 17, interj. 15, v. phr. 15, v.t. 15, conj. 9, prefix 7, art. 5,
  n. phr. 5, prep. phr. 5, pl. pron., poss. pron., aux. v., suffix, v.t./v.i. …
  plus person/number labels used as POS-ish (`1st pers. sing.`, `3rd pers. pl., past part.`).

**Part Two is not a finderlist** — it is a full second dictionary keyed by English, with its own
respellings, POS, definitions and examples. Largely the same lexicon typeset twice ⇒ a free
**double-keyed proofread**: any Part One ↔ Part Two disagreement is either real variation or a
typo, and is worth a `review` flag.

## API gaps for "use everything" (need building before Phase 2)

- `PATCH /api/v1/dictionaries/{id}` does not exist — v1 dictionary root is **GET only**. So an
  agent cannot write `about`, `citation`, `location`, `alternate_names`, `copyright`, … The human
  path is `POST /api/dictionaries/[id]/catalog` (manager-gated allowlist).
- No v1 route sets `featured_image` (the cover photo). Human path: `upload_media` →
  `/api/photo-upload` → `catalog` save (`site/src/routes/[dictionaryId]/home/hero-image.ts`).
  v1 already has the byte-handling half in `$lib/api/v1/media-route-handlers.ts` +
  `$lib/server/photo-variants.ts`.
- Everything else needed already exists: `…/grammar/sections`, `…/grammar/glossing-abbreviations`,
  `…/grammar/clause-slots`, `…/grammar/sections/{id}/sentences`, `…/orthographies`, `…/sources`,
  `…/entries` (with `citations`, `review`, `phonetic`, senses, nested `example_sentences`),
  `…/sentences` with gold `tokens` (IGT; Leipzig codes under the reserved `default` gloss key).

## Grammar / IGT surface — what is actually built (audited 2026-07-27)

**Data + write API: complete.** `grammar_sections` (nested tree, MultiString-markdown
`title`/`body`/`usage_conditions`, own `number_label`, `entry_id`/`sense_id`/`slot_id` links),
`clause_slots`, `section_sentences` (examples BY REFERENCE), `glossing_abbreviations`
(code → expansion + category), and `sentences.tokens` with per-token `gloss` (MultiString,
reserved `default` key for category codes), `morphemes[]` (with `separator` `-`/`=`/`~`/`.`),
`entry_id`, `status`. All reachable from `/api/v1`.

**Reader: partial.** Verified by reading every component:
- `GrammarSectionsView` / `GrammarSection` render the tree, markdown bodies (markdown-it default
  preset ⇒ **GFM tables work**, and `[x]{.smallcaps}` pandoc spans work), usage-conditions block,
  entry chips, slot badges, and attached examples.
- `ClauseTemplateStrip` renders `Slot → Slot → Slot` with each slot's assigned sections as chips.
- `GrammarNotes` on the entry page lists sections whose `entry_id`/`sense_id` is that entry.
- ❌ **No aligned interlinear gloss line exists anywhere.** `GrammarExampleSentence` renders
  vernacular + free translation only. `TokenizedSentence` renders the vernacular line with tappable
  tokens (matching / karaoke) but no gloss row.
- ❌ **Token `gloss` is visible ONLY inside `TokenPopover`** (tap one word).
- ❌ **`morphemes` is rendered NOWHERE** — write-only today.
- ❌ **`glossing_abbreviations` is read by NOTHING** — the table syncs, but there is no legend UI and
  no small-caps / tap-to-expand. (The schema comment describes intent, not shipped behaviour.)
- ⚠️ Structural grammar editing is gated at **admin level 3** (`grammar_sections_editable`);
  managers only get a scoped intro-prose editor. Cailie (manager) and Greg (level 2) could NOT
  restructure an imported grammar tree.

**How Ponca deviates from the defaults:** the book uses no Leipzig codes at all — its labels are
`1st pers. sing.`, `2nd pers. sing.`, `3rd pers. pl., past part.`, `dual`, and `Ø-` for the
unmarked third person, and it uses those same strings as POS-ish values inside entries. Its ~15
paradigm tables already carry the morpheme decomposition in prose
(`Akíg-` 'I act upon myself' + `dihą́` 'to lift'), which maps 1:1 onto `tokens[].morphemes`.
Standardising = one label→code map (1SG, 2SG, 3, 1PL, DU, PL, PST.PTCP, POSS, REFL, NEG, Q,
plus book-specific ones like `1SG>2SG` for `wí-` and `PL.INTNS` for the intensive plural infix).

## Guide gap to feed back at the end

`/api/v1/guides/pdf-scans` covers scans-and-OCR only. A **born-digital PDF** (InDesign/LaTeX
export) needs the opposite advice: the text layer IS the typesetter's text and must be used — but
custom font subsets can drop letters into private/control codes, so every distinct code must be
identified against a rendered page before it is trusted. Add this to the guide (new section or a
sibling guide) once proven here.

## Decisions LOCKED (Jacob, 2026-07-27)

1. **Extraction** — decode the born-digital text layer with the verified per-font glyph map as the
   source of truth, then **vision-verify every body page** against the parsed entries (compare,
   don't re-transcribe) + an automated audit flagging any character outside the book's alphabet.
2. **Part Two** — parse and **merge by lexeme**. New headwords get created; extra glosses/senses/
   examples merge in; every Part One ↔ Part Two disagreement becomes a `review`-flagged discrepancy.
3. **Prose** — Introduction → structured grammar sections (tree + markdown tables + legend + IGT
   examples); Preface + Acknowledgments (incl. Council of Elders bios) → `about`; Bibliography →
   appendix section at the end of `about`.
4. **Build the API gaps first**, deploy, then drive the whole import as an outsider:
   `PATCH /api/v1/dictionaries/{id}` + `POST`/`DELETE …/cover-image`, sharing one server helper with
   the human `/api/dictionaries/[id]/catalog` path, documented in openapi + guides.
5. **Rights** — import now (dictionary is `unlisted`), and put the three rights questions to Greg on
   the conversation with the report: permission to reproduce the complete dictionary; credit for the
   jacket photograph (or send a community photo instead); does it go public.
6. **IGT** — full: Leipzig codes under the reserved `default` gloss key, morpheme segmentation,
   `entry_id` links, complete `glossing_abbreviations` legend, **book's own wording kept verbatim in
   the section body**.
7. **Execution** — sequential in one session, issue file checkpointed each phase; fan the per-page
   vision verification out to parallel horse sessions (**gpt-5.6-sol** for vision) working only in
   `~/import-work/ponca/`, never the repo.
8. **Build the missing reader half** — aligned gloss-line renderer (form / morpheme row / gloss row)
   used by `GrammarExampleSentence`, the sentence page and the text reader; legend-code small-caps +
   tap-to-expand from `glossing_abbreviations`; legend block on the grammar page.
9. **Graduate `grammar_sections_editable` to managers** so the dictionary's own manager can correct
   the imported tree.
10. **Model the Ponca verb template as clause slots** (person → instrumental/locative → stem →
    internal modifier → plural/tense suffix) and assign the relevant sections to them. Exact slot
    inventory finalised after reading all 40 introduction pages.

Linguistic judgement calls still go to **Greg on the conversation**, per guide §1.2.

## Build phase — ✅ DONE (2026-07-27), awaiting Jacob's push + deploy

All green: `pnpm vitest run` 2161 passed / 3 skipped · `pnpm check` 0 errors · `pnpm lint` clean.

**New API surface**
- `$lib/db/server/dictionary-catalog.ts` — the ONE writer of `shared.db.dictionaries` catalog
  fields, with `CATALOG_FIELDS` (human) and `V1_CATALOG_FIELDS` (agent) + `CatalogFieldError`.
  `/api/dictionaries/[id]/catalog` refactored onto it (behaviour unchanged).
- `PATCH /api/v1/dictionaries/{id}` — about / citation / location / alternate_names / coordinates /
  iso_639_3 / glottocode / copyright / author_connection / community_permission /
  con_language_description / language_used_by_community / hide_living_tongues_logo /
  write_in_collaborators / name / url. **Excluded on purpose**: `gloss_languages`, `orthographies`,
  `featured_image` (own endpoints) and `public` / `print_access` (a human decision — the 400 names
  the better door). 10 route tests.
- `POST` / `DELETE /api/v1/dictionaries/{id}/cover-image` — multipart `file` or `{url}`; stores at
  `{dict}/photo/{uuid}.{ext}`, records the media ledger, reads real width/height with sharp (the
  human hero path stores neither), fires the 3 WebP variants behind the response. 9 route tests.
- `GET /api/v1/dictionaries/{id}` now also returns `featured_image`.
- openapi: `patch` + `cover-image` ops, `DictionaryCatalogPatch` schema, `cover-image` → `dictionary`
  tag, tag description widened.

**Reader half of the IGT surface (was entirely missing)**
- `$lib/corpus/gloss-legend.ts` — `build_gloss_splitter` (longest-code-first, case-sensitive,
  regex-escaped substring match), `gloss_for_language` (reader language → `default` → any),
  `legend_expansion`. 7 unit tests.
- `$lib/corpus/InterlinearGloss.svelte` — aligned form/gloss columns, one column per morpheme with
  the Leipzig separator drawn TRAILING, entry deep-links on morphemes, legend codes in small caps
  with tap-to-expand via the shared `Popover`. Ignored (punctuation) tokens excluded. Renders
  nothing when no gloss exists. 4 stories using real Ponca data from the book.
- `$lib/corpus/GlossingLegend.svelte` — the legend grouped by `category`, on the grammar page.
- Wired into `GrammarExampleSentence` (replaces the plain line when glossed), the sentence page,
  and the text reader behind a **"Show glosses"** toolbar toggle that only appears when the text
  actually has interlinear data.

**Gate graduation** — `grammar_sections_editable({ auth_user, is_manager })`: dictionary managers
now get structural grammar editing (admin-3 still passes without a manager role). 3 unit tests.

**Guides** — importing gains **§2.6 "The material that isn't entries"** (prose→about, sketch→grammar
sections, legend→glossing-abbreviations, photo→cover-image, plus attribute-don't-absorb and
ask-before-publishing-a-photograph; old §2.6/2.7 renumbered to §2.7/2.8 with cross-refs updated).
`pdf-scans` rewritten to cover BOTH cases: "is it actually a scan?" triage + **the font-glyph trap**
(the Ponca đ/Đ story as the worked example) + ligature/multi-column traps.

## Phase 1 — extraction: ✅ stage 1 done (`~/import-work/ponca/extract.py`)

PDF → `pages-{front,intro,part-one,part-two,back}.jsonl`, one record per page
(`{page, running_head, columns: [[line…]]}`), lines carrying `**bold**` / `__italic__` so the
typographic signal (bold = headword, italic = POS / related forms / scientific names) survives.
Column split by line x-midpoint; running head stripped as the topmost line.

**Character audit = 0 unknowns across all 408 pages** — the pipeline's stop condition. Getting
there found the full glyph map, including a **6th** encoding the first pass missed:

| code | glyph | font subset | how confirmed |
|---|---|---|---|
| `\x17` | đ | MeropePonca | book's own legend page: `Đ/đ  /th/ as in "them"` |
| `\x08` | đ | MeropePonca-Bold | running head `Á'gđađè` |
| `\x04` | đ | MeropePonca-**BoldItalic** | 10× crop of `iđápʼahą̀` (pdf p35) + same word as `i\x08ápʼahą̀` on p28 |
| `\x16` | Đ | MeropePonca | `Đégihà` (= Dhegiha) |
| `\x05` | Đ | bold | running head `Đadį́dį` |
| `\x1e` | Đ | italic | `Đíxidą̀` clan name |

Trap while confirming `\x04`: the tight crop showed a horizontal rule through the whole word that
looks like a stroke — it is the **book's own underline** on the bold-italic form. Crop wide enough
to see neighbouring words before judging a glyph.

Also normalised: ` ` en space (4,556 in Part One + 4,388 in Part Two — the headword ⇄
pronunciation separator, must never end up inside a lexeme); heading-font `D̶`/`A˛` → `Đ`/`Ą`;
ligature-artefact spaces (`"fi rst"`). IPA in the pronunciation guide is now in the allowed set.

**Verified against the page image** for pdf p62: columns, running head, bold/italic runs, `đ`, and
every diacritic match what is printed.

### Known artefacts for stage 2 (parsing)
- InDesign discretionary spaces after a hyphen: `/ä’- bä- zü’/` is printed `/ä’-bä-zü’/`, and
  `uh- huh` is printed `uh-huh`. Collapse `- ` → `-` inside `/…/` respellings, headwords and prose;
  a LINE-FINAL hyphen is a different thing (word wrap → join with the next line).
- A kerning gap can split a headword: `**Ą́ ʼ**` is the single lexeme `Ą́ʼ` (the `ʼ` comes from a
  different font, IowanOldStyle-Roman, as its own span). Strip spaces before `ʼ` inside a bold run.

## Extra pipeline gotcha found while drafting the teaching example

The all-caps **heading** font (`MeropeSans-Bold`) encodes the special letters a THIRD way — as base
letter + spacing/combining diacritic: `A˛-` (A + U+02DB ogonek) for `Ą-`, `D̶ I-` (D + U+0336
combining long stroke overlay) for `Đi-`. So headings need their own normalisation pass on top of
the control-code map.
