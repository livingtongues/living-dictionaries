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
- A LINE-FINAL hyphen is ambiguous (auto-hyphenation vs a real hyphen) and **geometry cannot settle
  it — the body text is set RAGGED RIGHT**, so the gap to the right margin is smoothly distributed
  0–17pt for hyphen-ending lines exactly as it is for all lines. Resolve from corpus evidence when
  rejoining lines (below), never from where the line ends.

## Extra pipeline gotcha found while drafting the teaching example

The all-caps **heading** font (`MeropeSans-Bold`) encodes the special letters a THIRD way — as base
letter + spacing/combining diacritic: `A˛-` (A + U+02DB ogonek) for `Ą-`, `D̶ I-` (D + U+0336
combining long stroke overlay) for `Đi-`. So headings need their own normalisation pass on top of
the control-code map.

## Stage 1 rewritten on character geometry (2026-07-27) — the string heuristics were destroying data

Re-running the divider check exposed two bugs in the first pass, both from repairing the text
layer with string replaces. Stage 1 now rebuilds every line from `rawdict` **per-character bboxes**.

**1. Spurious spaces are invisible in text and obvious in geometry.** Three different artefacts turn
out to have ONE signature — a space glyph that overlaps a neighbour, i.e. carries no advance:

| artefact | printed | text layer | geometry |
|---|---|---|---|
| ligature filler | `first` | `fi rst` | space x0 jumps **backward** 5.2pt behind the `fi` pair |
| discretionary hyphen | `/ä’-bä-zü’/` | `/ä’- bä- zü’/` | next letter starts **on top of** the space |
| headword kerning | `Ą́ʼ` | `Ą́ ʼ` | space emitted **behind** the combining accents (−3.4pt) |

`real_space()` drops a space when `x0 < prev_x1 − 0.6` OR `next_x0 < x1 − 0.6`. Result across the
book: 169,350 spaces kept, 29,804 dropped, **5,502 of 13,731 Part One lines changed**, and the old
ligature blacklist was itself corrupting text — it produced `take offcontinuously` (ate a REAL
space) and missed unlisted ligatures (`ty` in `certain ty pe`, `ft` in `fift h`). A geometric rule
needs no ligature list at all.

**Verification that no real space was eaten:** the corpus is its own oracle — a dropped space makes
a rare long token that splits into two common ones. All 124 candidates are genuine compounds
(`drumstick`, `playground`) or line-wrap fragments (`fortable` ← `com-fortable`). Zero false drops.

**2. `ʃ` and `ə` are NOT decode failures.** They are letters of this book's Ponca alphabet, each
with its own A–Z section: the alphabet chart (book p3) lists `ʃ` as the **fourth vowel** [ɪ] (as in
"tip", plus a nasalized counterpart [ɪ̃]) and `ə` as the **seventh** [ə]. Both are caseless — the
chart gives `A/a`, `E/e`, `I/i` but bare `ʃ` and bare `ə`. Confirmed against rendered crops of the
chart and both dividers. **Ask Greg** whether the Living Dictionary should keep these exact
characters (they affect typing + search) or use a more conventional spelling.

The glyph-map font attributions in the table above were also wrong (`\x17` is Bold, not regular);
corrected in `extract.py`. No control code is used by two fonts, so a flat map is safe.

**3. The hanging indent is the entry boundary.** Both parts are set with a 12pt hanging indent, and
the x0 histogram is perfectly bimodal (60.0/259.5 = entry opens, 72.0/271.5 = continuation). This is
the ONLY reliable boundary in Part Two, whose entries open with a plain-type English keyword rather
than a bold Ponca headword — keying on `**` found 4 entries there instead of 4,388. Stage 1 marks
continuation lines with a leading tab.

## Stage 2 — blobs + fields: ✅ (`lines.py`, `parse.py`) — 100% parse coverage

`pages-*.jsonl` → `blobs-{part}.jsonl` (one continuous blob per entry) → `parsed-{part}.jsonl`.

**Line-final hyphens: 3,620 decisions, resolved by evidence, 22 left for a human.** Geometry can't
help (ragged right), so a four-tier oracle decides:

| tier | rule | P1 | P2 |
|---|---|---|---|
| respelling | inside the entry's first `/…/`, every syllable break is a real hyphen (detect: exactly one `/` so far) | 100 | 370 |
| book | the fused form appears elsewhere in the **whole book** → dissolve; both halves common + fusion never seen → keep | 1,557 | 1,530 |
| English | `wordfreq` zipf: fused ≥2.0 → dissolve; both halves ≥3.0 → keep | 30 | 19 |
| review | hand-checked exceptions (`sharp-shinned`, `twetieth-century` [the book's own typo]) | 1 | 1 |

The **whole-book** vocabulary is what made this work — Part Two is the same lexicon typeset a second
time, so a word broken in one part is usually written out whole in the other. Per-part vocabularies
wrongly kept `ari-kara`, `china-ware`, `house-flies`; the whole-book one fixed all of them and cut
the unresolved residue from 122 to 22. Those 22 entries carry `uncertain_joins` → set `review` on
them at write time.

**Entry shape** (both parts, after the Part Two English key): `**Lexeme** /respelling/ __pos__.,
body`. Coverage: lexeme + phonetic + body **8,941/8,941**; pos 8,851 (the 90 without it are
single-letter alphabet entries and entries whose POS sits inside numbered senses).

Structural discoveries that the naive shape missed:
- **A headword can be split across several bold runs**, because the glottal stop `ʼ`, the
  interpunct `·` and some spaces come from a different font: `**Mí**ʼ`, `**Hánitʼà č**’**éškà**`,
  `**Iʼtʼíʼgąđeʼàtʼà wabáxu** **itéʼđaikè tʼí**` are each ONE lexeme. `read_lexeme()` absorbs bold
  runs plus short joiners between them.
- **Suffix entries** put the hyphen outside the bold run (`-**áʼtʼašą̀**`).
- The roman-font apostrophe is U+2019 while headwords use U+02BC — normalised to U+02BC in lexemes.
- **Gendered speech variants** in Part Two: `(masc./fem.)` plus a whole alternate headword with its
  own respelling, e.g. `Sipʼáhi utʼą́ga (masc./fem.) (**Sipʼóho tʼągą́** /sē-p’ō’-hō t’oⁿ-goⁿ’/
  [masc.])`. **Real linguistic data — needs a question to Greg** about how to model it.
- Book typos found: respellings closed with `)` instead of `/` (recorded as `source_typo`).

## Stage 2c — body → senses: ✅ (`senses.py` → `senses-{part}.jsonl`)

The body follows one grammar throughout:
`gloss, definition[, lit., literal][ 1. sense 2. sense][; __form__, gloss …]`, with `~` standing
for the headword and italic labels (`archaic`, `usu.`, `masc.`, `fem.`).

| | Part One | Part Two |
|---|---|---|
| entries | 4,553 | 4,388 |
| senses | 4,845 | 4,655 |
| multi-sense entries | 266 | 246 |
| related/inflected forms | 625 | 625 |
| example phrases (`~`) | 202 | 184 |
| literal translations | 309 | 302 |
| senses with no gloss | 0 | 0 |

**Numbered senses have a shared preamble, and it is not a sense.** `blue bird, lit., blue anger,
1. refers to the bluejay 2. proper name in the … clan` means "blue bird" in BOTH senses — the
numbered pieces narrow it. Treating the preamble as sense 1 invents a meaning the book never
claims. `merge_senses()` gives every numbered piece the shared gloss + literal, and puts the piece's
own text in `definition`.

### Lexeme profile (drives the merge design)

| | count |
|---|---|
| Part One distinct lexemes | 4,201 (295 lexemes are homographs → 352 extra rows) |
| Part Two distinct lexemes | 3,941 (384 homograph lexemes → 447 extra rows) |
| lexemes in both parts | 3,823 |
| Part One only | 378 |
| Part Two only | 118 |
| **union of distinct lexemes** | **4,319** |

**HOMOGRAPHS ARE REAL AND MUST NOT BE COLLAPSED.** `Iđádiđaì` is three separate entries in Part One
(*father* / *agent* / *Indian agent*, and note the third even respells slightly differently) and
`Watéʼ` is two (*bounteous* / *dress*). A merge keyed on lexeme alone would fuse unrelated words.
Merge must key on **(lexeme, best-matching gloss)** with the Part One ↔ Part Two pairing done by
gloss similarity, and anything that doesn't pair confidently becomes a `review` flag rather than a
silent join.

## Unicode normalisation — ✅ (added to `parse.py`)

**A third of the headwords were decomposed.** Nasal vowels carrying a stress accent have no single
codepoint, so the book writes them `a` + U+0328 + U+0301 (1,797×) while other words use the
precomposed `ą` + U+0301. Without normalising, the same word stores two ways and search breaks.

NFC is provably safe here: it changes **3,143 of 8,941** headwords yet the count of distinct
headwords is **4,319 before and after** — the mapping is injective, so the book never spells one
word two ways. Also unified: `ǝ` U+01DD → `ə` U+0259 (two codepoints for the seventh vowel, from
two font subsets) and `’` U+2019 → `ʼ` U+02BC (the glottal stop, from the roman font). Applied to
lexemes, phonetics, bodies and English keys. Verified: 0 non-NFC lexemes, 0 turned-e, 0 U+2019.

## The font answer (for Greg, and for the tap-buttons feature)

**No custom font is needed.** Every character is standard Unicode — `đ`/`Đ` are U+0111/U+0110
(Latin Extended-A, the everyday Croatian/Vietnamese letter), and the rest are Latin Extended-A/B
plus two IPA-block letters. The PDF problem was never a Unicode gap: the book's *embedded font
subsets* simply carry no ToUnicode mapping for `đ`, which is a PDF export artefact.

**85 distinct characters** appear in Ponca lexemes. The non-ASCII inventory, by frequency:
`ʼ` 7,732 · `đ` 4,562 · `ą` · `á` · `í` · `é` · `è` · `š` · `à` · `ž` · `ú` · `ì` · `į` · `Đ` 555 ·
`Á` · `Š` · `Í` · `Ú` · `Ž` · `č` · `É` · `ù` · `Į` · `·` 70 · `ə` 69 · `ʃ` 46 · `Ą` · `ę` · `ó` ·
`Č` · `ò` · `Ų` · `ų` · `ǫ` · `ẋ` — plus combining U+0301/U+0300/U+0328 for the stressed nasals.
This inventory is exactly the input the search tap-buttons need.

## VISION SWEEP — ✅ COMPLETE (2026-07-27, all 346 body pages, 3 waves)

Every body page (pdf 61–231, 233–407) vision-checked by gpt-5.6-sol lanes (findings in
`sweep/findings/`, triage verdicts in `sweep/triaged.json`), every finding hand-adjudicated.
212 findings total → every real bug FIXED, everything else confirmed as lane over-correction or
the book's own quirk. Final stats: **4,553 + 4,388 entries · 4,858 + 4,667 senses ·
626 + 623 related forms · 110 + 99 examples · 0 unknown chars · 0 label-as-gloss senses.**

### Bugs found by the sweep and fixed (pipeline stage in parens)

1. **POS chains split at the comma** (`parse.py`) — `__v__., __pl__.,` is ONE label; 158 entries.
   POS_CONTINUATIONS absorbs pos-words after the comma → pos "v., pl.", "prep., suffix",
   "v., 1st pers. sing." etc. Also "v. t." → "v.t.", `/…/, __v__.` comma-after-respelling (p129),
   `,__ ` comma-caught-inside-italic normalisation (`__suffix,__`).
2. **172 senses had a bare label as gloss** (`senses.py`) — `__archaic__,`/`__masc__./__fem__.,`
   after the pos leaked into gloss AND poisoned ~-expanded translations ("this is my fem.").
   `strip_leading_labels()` + plain-text token folding (FOLDABLE_POS / PERSON_TENSE / LABEL_WORDS,
   only DOTTED tokens fold — `Waą́` "sing" is the real English gloss) + label-only preambles
   propagate to numbered senses.
3. **All splits were paren-blind** (`senses.py`) — `depth0_split` everywhere: `;` related-form
   split, gloss/definition partition (now also `; ` boundary + trailing-paren-note fallback),
   `lit.,` literal boundary, sense-number marks inside parens skipped.
4. **Related forms** (`senses.py`) — leading `__n__.,` POS captured as the form's `pos`; adjacent
   italic runs fused (`__đéxądè __ __wahí__` = one form); label-forms (archaic/prefix/suffix)
   stay in body; sense-number in a related gloss hands `2. …` back to the sense splitter (p80);
   comma-less `__nąxíáđa__ fall…` fallback (book typo, +17 forms — all eyeballed).
5. **`; __v.t__., hexed (…)` = a new SENSE with its own pos** (`senses.py` SENSE_POS, ~23 chunks,
   dot inside or outside the run) — extra senses appended with `pos`, examples extract from them.
6. **Example splitter** (`senses.py`) — roman-font `·`/ellipsis after the italic run belong to the
   Ponca sentence (`đipʼi·`, `Xúkʼà mašé . . .`); a solo `~` between commas is Ponca-side
   (`(ebéte, ~, it was ~ …)`) while `, ~ boy is tall` stays translation-side.
7. **Slash-wrapped line joins** (`lines.py`) — "he/" + newline + "she/it/they" now joins tight
   (51 occurrences, all pronoun stacks).
8. **Part Two suffix entries** (`parse.py`) — "covering -**abaèʼ**": the hyphen moves off the
   english_key onto the lexeme (`-abaèʼ`, `-áʼtʼašą̀`, `-nąmą́`).
9. **BLUE editorial annotations excluded** (`extract.py`) — the press left 7 annotations printed
   in blue (color 0x77d4): "Tha-aychay-wahthay (f)" mid-word in Đaéđe p343, "The #4" p93, five in
   the intro (pp45/57/58 — remember when extracting the grammar sketch). Dropped by span color,
   logged at extract time.
10. **4 straight ASCII apostrophes** ("dictionary's", "muscle's") → normalised to curly.

### Book quirks confirmed against page images (NOT bugs — do not "fix")

- ~~Book's own typos kept verbatim: "meterorite" p140, "broadcoth" p204, "pharmarcy" p134,
  "nazalize" p84, "continuouly" p92, "twetieth-century" (+`source_typo` respellings).~~
  **SUPERSEDED 2026-07-28**: Jacob ordered obvious ENGLISH misspellings corrected — see the
  AUDIT ROUND 2 section (`corrections.py`). Ponca-side inconsistencies still faithful.
- Book-internal inconsistencies (print verified): `moⁿkoⁿʼ` no hyphen p134 vs hyphenated sibling;
  `theⁿ` no macron p185; `zheⁿ` vs `zhēⁿ` p78 (two Bažį́de entries differ); `Heđúska-` with plain
  s p111 (vs Heđúškà elsewhere); `awíʃwaą̀` truly printed WITHOUT đ p74+p401 (both parts agree);
  `adv/n.` without dot p110; `xoⁿʼ· -dā` spacing p223; `Mažą́ išʼáge` plain first a p137.
- Lanes sometimes hallucinate corrections (đ/ogonek/accent claims p87, p79, p225 ẋ→ž, p230,
  p341, p62, p83, p112 ×5 "missing H", p131) — every one checked against a rendered crop; our
  extraction matched the print every time. `crop.py` (search-string or `band:0.3-0.7`) renders
  verification crops into `crops/`.
- `~` inside definition-text usage notes stays unexpanded (book notation; context-dependent
  Ponca-vs-gloss meaning makes blanket expansion unsafe) — e.g. `(~ is he/she/it?)` p401.

## REMAINING WORK

- [x] ✅ **Part One ↔ Part Two merge** — `merge.py` → `merged.jsonl` (2026-07-27, after the sweep).
      Pairs each Part Two row to the best-gloss-similarity row inside the same-lexeme group
      (Jaccard on gloss+definition word sets; homographs verified exact: Iđádiđaì ×3 and Watéʼ ×2
      all landed correctly). Part One authoritative. **4,667 entries** (4,553 P1 + 114 P2-only) ·
      **5,027 senses** (52 added from P2) · 669 related forms (24 added) · 124 examples (10 added) ·
      **649 entries carry `review`** (220 phonetic diffs, 73 pos diffs, 411 definition diffs,
      17 zero-gloss-overlap pairings — those 17 eyeballed: all synonym phrasings like atop/upon,
      deplete/run out; incl. P2 "Šą́šą ever" which is really P1's Šą́šą́ accent-variant).
      P2 english_keys collected per entry as extra search keys; `part_two_pages` kept for citations.
- [ ] **Related forms** (625 in each part) — decide with Greg: own entries linked by
      `derived_from`/`root_of` via `entry_relationships`, or left inside the definition text.
      They are inflected/derived words (`badúže` "squash by using force" under `Bidúže`), so making
      them findable argues for real entries.
- [ ] **Gendered speech variants** (Part Two `(masc./fem.)` + whole alternate headwords) — model as
      `dialectal_variant` relationships, or as alternate forms? Needs Greg.
- [x] ✅ **Example phrases** — gloss-leak class fixed in round 1; round 2 fixed the remaining
      splitter bugs (question marks, stranded Ponca fragments, Q&A pairs). 122 examples staged.
- [x] ✅ **Search character tap-buttons** — SHIPPED 2026-07-27 (site feature, tracked in
      `.issues/orthography-character-buttons.md`). Data-driven, no per-dict code: `Orthography`
      gained `characters?: string[]` on the existing catalog JSON, so the row is fed from the
      dictionary's own registered orthographies (union of all of them, registry order).
      `$lib/orthography/SpecialCharacterButtons.svelte` renders the row under the entries search
      box (`SearchInput.svelte` splices the tapped character in at the caret via
      `$lib/utils/insert-at-caret.ts` and keeps focus). Managers set the list on the dictionary
      home → Orthographies modal, where a **Detect** button proposes a frequency-ranked inventory
      scanned from that orthography's own headwords; agents use
      `PATCH /api/v1/dictionaries/{id}/orthographies/{code}` with `characters`.
      **Ponca action when the dictionary lands:** set the primary's characters to
      `đ ʼ ą ę į ų ǫ š ž č ʃ ə ·` (Detect will propose close to this from the imported lexemes).
      Also fixed while here: `ə` (U+0259) and `đ` were missing from the search simplifier's
      `ipa_to_common_keyboard`, so those two now have plain-keyboard search forms (`e`, `d`) —
      accented vowels already did (NFD diacritic stripping).
- [x] ✅ **Grammar sketch** (pdf 20–59) → staging JSON — DONE 2026-07-27. Staging only; nothing
      written to the dictionary or the conversation. **59 sections · 73 markdown tables ·
      68 IGT examples · 65 legend codes · 8 clause slots** (74→73 after the round-2 sweep
      merged the p25 stub table back into its row). Detail in "Grammar sketch" below.
- [x] ✅ **Prose** → `about` — `prose.py` → `about.md` (Preface 11 paras · Acknowledgments 19,
      Elders' bios come out as **Name**: bolded leads · Bibliography 7 entries with the `———.`
      author-repeat row correctly reassembled — same-row font fragments cluster within 4pt).
      Markdown-ready (`*italic*`). Not yet written to the dictionary (gated).
- [x] ✅ **Cover photo** — `cover-full.jpg` (2100×3000 extracted jacket) + `cover-crop.jpg`
      (2100×1220 text-free powwow crowd crop, y 1780–3000) staged in `~/import-work/ponca/`.
      POST to `…/cover-image` happens in Phase 2 (rights question to Greg stands).
- [x] ✅ **Vision verification sweep** — DONE, all 346 pages, see the sweep section above.
- [x] ✅ **Rendered preview + human sign-off** — Jacob reviewed the report 2026-07-28 ("looks
      great"), ordered the misspelling corrections + audits, and ruled: no questions to Greg,
      post artifact + message once audit round 3 is clean, then proceed. `preview.html` carries
      the round-2 numbers (4,667 entries / 5,027 senses / 639 review-flagged) + the
      "checked twice" card.
- [x] ✅ **AUDIT ROUND 3** — DONE 2026-07-28, session `560e3f1e`. All 346 body + 40 grammar
      + 12 prose pages re-verified (opus-5 wave 1 + sol backfill/wave 2); 10 real bug
      classes fixed, corrections 33 → 58, examples 122 → 131, review flags 639 → 624,
      preview rebuilt. Full detail in the AUDIT ROUND 3 section above.
- [x] ✅ **Post to the conversation** — report artifact `a64e7686-23fa-4d38-9e73-af8b631721ee`
      (kind `report`, rebuilt post-import framing, stats line 5,257/5,617/131/59) posted
      2026-07-28. NO questions, NO message (message is DRAFTED for Jacob — new workflow rule).
- [x] ✅ **Phase 2 writes** — DONE on prod 2026-07-28 under `import_id` `ponca-book-2026-07-28`.
      See PHASE 2 EXECUTION below. Prod ponca.db: 5,257 entries · 5,617 senses · 199 sentences ·
      668 relationships · 59 sections · 8 slots · 65 legend · 68 links · 634 review-flagged
      (624 part-two-differs + 10 uncertain-join). Backup first:
      `/opt/hosting/data/ponca.db.pre-import-2026-07-28.bak`.
- [x] ✅ **Revoke the API key** `f9375f18-e388-434b-bcff-8c29f8638029` — revoked_at
      2026-07-28T06:34Z, token verified 401.

## Grammar sketch (pdf 20–59) — ✅ STAGED 2026-07-27

Files in `~/import-work/ponca/`, all shaped for the v1 write API (field names checked against
`$lib/db/server/grammar-sections.ts` + `$lib/api/v1/entry-input.ts`, not against the openapi text):

| file | contents |
|---|---|
| `grammar-sections.json` | the tree: 1 root → 19 printed headings → 39 chart subsections |
| `glossing-abbreviations.json` | 65 `{code, name, category}` (the column is **`name`**, not "expansion") |
| `clause-slots.json` | 8 `{id, code, name}` in template order |
| `grammar-sentences.json` | 68 `{id, text, translation, tokens.default[], citations}` |
| `grammar-preview.html` | rendered sign-off preview (181 KB, screenshot-verified) |

Pipeline: `blocks.py` (geometry primitives) → `grammar.py` (block stream + table rebuild) →
`stage.py` (tree + JSON), with `igt.py` / `legend.py` holding the curated linguistic data and
`lint.py` / `check.py` as the stop conditions (both at **0 problems**).

### How the charts were rebuilt

The line stream interleaves chart cells (a 3-column row reads as three consecutive "lines"), so
every chart is rebuilt from x/y. Four things carried it, none of them string heuristics:

1. **Columns from horizontal overlap, not x0 clustering.** Several charts are set RAGGED — p29
   indents its `Sing.`/`Pl.` rows, pushing both the form AND its gloss right — so clustering x0
   makes 4 columns out of 2. Two x-clusters are the same column when they **overlap horizontally
   and never share a printed row**; real columns have a gutter, a ragged indent does not.
2. **Row grouping has three modes** (`nearest` for vertically centred small-caps row labels,
   `left`, `gap`), chosen automatically from the label font and the row-gap distribution
   (natural breaks — a midpoint threshold fuses a page-split chart into one row).
3. **The book's own rules are the chart's boundary.** A PAIR of rules with no row between them
   splits two charts printed back to back (p56); the rule under a chart keeps the next paragraph
   out of it (p34's "To start with a simple case…").
4. **Charts continued overleaf are rejoined** (12 of them, incl. the 3-page numeral table), with
   the reprinted header dropped and the continuation placed one normal row-gap down so the gap
   clustering still reads it as a row break.

Wrapped prose cells join with a space, stacked form-over-gloss cells with `<br>` — decided by the
column measure, and only in columns wide enough to hold prose. Verified end-to-end through the
site's OWN markdown pipeline (`markdown-it {html:true}` + the `xss` whitelist): all tables
become `<table>`, `<br>` survives sanitisation, nothing renders literally.

Content spot-checked against rendered page crops for p29, p30, p44 (the 6×6 conjugation grid),
p51 and p56 — exact match each time.

### Two pipeline bugs found here and FIXED (both re-ran the body stages)

1. **`"` is NOT always `đ`.** `extract.py` mapped the straight double quote to `đ` (the regular
   MeropePonca subset hides it there). The intro quotes two plain English words with STRAIGHT
   quotes — `"judge"` (p24) and `"yes"` (p25) — which came out `đjudgeđ`. Narrow rule added
   (`(?<= )"([A-Za-z]{2,})"` not followed by a letter); **exactly 2 matches book-wide**, both real.
2. **The sentence space after a full stop was being eaten.** The space glyph after `.` is kerned
   back under the period's side bearing, so `real_space()` read it as ligature filler:
   `the vocal cords.While`. **15 occurrences book-wide, every one a `. ` + Capital sentence break**
   (p23 ×4, p25, p26 ×3, p39 ×2, p43 ×2, p50, **p149 ×2**). Two were on a Part One body page, so
   `lines/parse/senses/merge` were re-run: the only diff is those two spots — and Part One now
   AGREES with Part Two there, so the merge's `review` count drops **649 → 648**.
   (The colon cases are NOT bugs: `Howard 1965:69` is printed with no space — crop-verified.)

Also fixed: `Americanist` was being kept hyphenated (`American-ist`) because the fragment "ist"
scores zipf 3.35 as a word — added to a new `DISSOLVE_HYPHEN` review set in `lines.py`.

### Clause slots — decision 10 finalised

`person → reflexive → instrumental → stem → modifier → plural → tense → particle`

The person zone is **one** slot, not subject+object: the book teaches it as one prefix string and
the order inside it flips with the person hierarchy (`Ąđí-` 'we…you' puts the subject first,
`Ą́n-` 'you…me' the object first). Reflexive is split out (it has its own subsections), and the
final zone is split three ways because plural, tense and particle each get their own book section.
**22 sections carry a slot.**

### IGT — 68 examples

46 are the book's OWN morpheme decompositions of the `Đihą́` 'to lift' (pp39–43) and `-ną́ʼą`
'to hear' (pp44–45) paradigms; 22 are running utterances (`Uʼsní čábe` 'It's very cold',
`Mąđí ga`/`Mąđí á`, the `-tigđè` distals, past/future-perfect forms). Only the LABELS are ours —
segmentation, forms and free translations are the book's.

`check.py`'s decisive test: **every token's morphemes must concatenate back to the printed word**
(ignoring `Ø`). It caught 17 real errors on the first run — the book's decomposition lines cite the
stem's DICTIONARY form (`đihą́`, `ną́ʼą`) while the inflected word carries different accents
(`Ąđí-đihą́-i` for `Ąđíđihąì`). Morphemes are now surface-accurate, so the aligned display shows
the word the book actually printed. It also checks every gloss code against the legend and that
tokens locate left-to-right in the text (mirroring the server's `derive_tokens`).

### ⚠️ Phase 2 dependencies

- **Register the source `headman-oneill-2019` BEFORE POSTing sentences** — every example carries
  `citations: [{slug, locator: "pdf p39"}]` and the API validates slugs against the registry.
- Order: clause-slots → glossing-abbreviations → sections (parents first, `parent_id` is a real
  ref) → sentences → `POST …/sections/{id}/sentences` for the 68 links (or pass
  `example_sentence_ids` on the section, which is already populated).
- Ids are deterministic UUID5s, so re-POSTing is a no-op. Strip the `_`-prefixed staging keys
  (`_page`, `_key`, `_section`, `_flag`, `_synthetic`).
- **Recommended first step:** POST the four files into a LOCAL dev dictionary and look at
  `/{dict}/grammar`. Everything was verified structurally and through the real markdown renderer,
  but the API layer itself has not been exercised with this payload.

### Flagged for Greg (linguistic / editorial judgement)

1. **Section titles are the book's ALL CAPS, verbatim** (`PRONUNCIATION GUIDE`). Title-casing them
   reads better but risks mangling `Ą-` / `ĐI-`, so it was left alone — one-line change if he wants it.
2. **3 subsection titles are OURS**, marked `"_synthetic": true` — `The suffix -tigđè`,
   `The particles gá and á`, `The verb -ną́ʼą 'to hear (something)'`. The book runs these
   paradigms on without a caption; the wording is lifted from its own prose.
3. ~~The blue editorial annotations~~ **RESOLVED 2026-07-28**: the p45 `Gi-` prefix is now
   INCLUDED as an appended chart row marked as an editorial addition (Jacob's ruling). The two
   numeral respellings (`/wi’akchi` at **1** p57, `/ šap’e na,ba` at **12** p58) stay excluded.
4. **The intensive infix `-ʼi-`** sits inside the stem, so glossed examples show the stem split
   around it (`đi-ʼi-hą` = `lift-PL.INTNS-lift`). Noted in the `PL.INTNS` legend entry.
5. **`Wáđiʼihąì`** is glossed both 'he/she/it lifts them' and 'they lift them' — the book says so
   explicitly and leaves it to context. Carried as a `_flag`, not resolved.
6. **The book's own caption misprint on p40**: "Second person singular subject (**“I”**)" should
   read "you". Kept verbatim.
7. The 10-column instrumental-prefix chart is stored **transposed** to 2 columns (unreadable as
   10 columns on a phone); the other 72 tables keep the book's own shape.

## AUDIT ROUND 2 — full re-verification (2026-07-28, in progress)

Jacob approved the preview content but ordered: (a) **correct obvious English misspellings**
(superseding the "kept verbatim" rule for ENGLISH typos only — Ponca-side inconsistencies stay
faithful), (b) update this file, (c) a second full audit: orchestrator does the important checks
itself + gpt-5.6-sol vision lanes re-verify EVERY page at 40 pages/lane, grammar included.

### English typo corrections — ✅ DONE
`corrections.py` (new pipeline stage, applied in `senses.py` to English-side fields only:
gloss/definition/literal/example translation/related-form gloss/english_key). **28 misspellings,
48 total firings** across both parts — the full map with page cites is in `corrections.py`
(meterorite→meteorite, broadcoth→broadcloth, pharmarcy→pharmacy, habeus→habeas,
accipter→accipiter, oftens→often, twelth/eleveth, childen, practioner, supressed, aquaintance,
twetieth/twenthieth→twentieth, etc.). Found via a wordfreq sweep over ALL English text (entries +
about.md + grammar) — two passes: zero/low-freq words near common words, then zero-freq words
near rare-but-real words. Latin binomials (piscivorus, vociferus, erminea, columbarius, gerardii,
pomifera are all CORRECT Latin), rare-real words (bedew, adulate, congealment, overripen,
automized, philio) and all Ponca text untouched. Each fix must fire ≥1× or senses.py exits
nonzero (guards against upstream drift). Side effect: 5 P1↔P2 definition disagreements were
typo-vs-correct pairs and vanished — review-flagged entries 648 → **644**. about.md + grammar
had NO typos (ritualism/bivocational/unbiasedly/ejective/hacek/ogonek are real words; the odd
"words" flagged there are Ponca substrings).

### Orchestrator's own structural audit — ✅ clean
Invariant scan of merged.jsonl (markdown leaks, double spaces, control chars, empty senses,
unexpanded `~` in examples, unstripped/unbalanced fields, label-as-gloss, dup entries): only 3
flags, all crop-verified as the BOOK's own print: `Eʼbéʼ` really is two back-to-back entries on
p94 (dup is faithful); `Éʼžą̀hì` p95 and `Stápʼì` p170 parentheticals are never closed in Part
One's print (P2 closes Stápʼì's — already captured as a review diff).

### Vision sweep round 2 — SPAWNED 2026-07-28 (11 lanes, ids in /tmp/wave-ids.txt)
- Round-1 findings archived: `sweep/findings-round1/`, `sweep/triaged-round1.json`.
- Expected files REGENERATED from the corrected data; `lane-prompt.md` now lists the 28
  intentional corrections (lanes must not report them; NEW book typos → severity "low",
  field "book_typo").
- 9 body lanes × 40 pages (offsets 0..320) over all 346 body pages.
- **NEW: grammar lane** (pdf 20–59 vs page-annotated `grammar-blocks.md`,
  `grammar-lane-prompt.md`, findings → `sweep/findings-grammar/`) and **prose lane**
  (pdf 8–18 + 408 vs `about.md`, `prose-lane-prompt.md`, findings → `sweep/findings-prose/`).
  Intro/prose page images rendered into `sweep/img/` (pdf 8–18, 20–59, 408).
- After the wave: `triage.py` (body findings only — grammar/prose findings need manual review,
  the triager only knows `pages-{part}.jsonl`), then hand-adjudicate confirmed + needs_eyes,
  fix at the earliest stage, re-run, re-triage. Then rebuild `preview.html`.

### Round-2 results: prose + grammar lanes — ✅ DONE (2026-07-28)
- **Prose lane: 12/12 pages, 0 issues** (about.md verified word-for-word against print).
- **Grammar lane: 40/40 pages, 5 findings → 3 REAL bugs, all FIXED** (crop-verified):
  1. **p25 pronunciation key**: the /ʼ/ row's 6-line wrapped cell broke — 3 lines exceeded
     PROSE_WIDTH so absorption refused them → prose leak + a stub table. Fix in `grammar.py`
     `classify_rows`: a line starting EXACTLY at a non-first column edge is a wrapped cell
     no matter how wide (real prose starts at the page margin). Tables 74 → 73 (stub merged
     back into its row).
  2. **p34**: "To start with a simple case…" landed as a row of the person-prefix chart —
     the seed run fused the two charts ACROSS the caption between them, so their ruled boxes
     merged and the sentence read as "inside". Fix in `seed_runs`: a caption/heading
     interrupts a run (it titles the NEXT chart).
  3. **p38 "appears be-fore"**: the hyphen-oracle's respelling shortcut (count("/")==1) was
     poisoned by the slashed pair "object/patient" in the same paragraph. Fix in `lines.py`:
     `in_prose=True` (used by grammar.py + prose.py joins) skips the respelling shortcut.
  Adjudicated NOT bugs: p20 "Introduction" is the book's part-title (our root deliberately
  uses the meaningful subtitle); p37 `Amą́đį` — 8× zoom shows the print really has plain A,
  no ogonek (lane over-corrected the book's grammar). `lint.py` + `check.py` re-run: 0
  problems, about.md byte-identical, blocks diff = exactly the three fixes.

### Round-2 results: body lanes — ✅ COMPLETE (2026-07-28, all 346 pages, 9 lanes × 40)
230 findings → triage.py → live-check (a finding is *stale* once its "parsed" claim no longer
appears in the regenerated expected file). Every confirmed/needs_eyes/both_present finding
adjudicated; real bugs found and FIXED (stage in parens):

1. **Parenthetical alternate form BEFORE the pos** (`parse.py`) — "(masc./fem.) (**Nąbúhu
   žį́gà** /…/ [masc.]) n., little finger": pos was lost and the paren note + "n." became the
   gloss. ~24 entries per part (little finger/toe, thumb, Tʼegá, meadowlark, mosquito, Otoe,
   Santee, Sabáʼa…). Held notes now re-attach at the body tail → they land in the definition.
2. **Bold markers inside respellings** (`parse.py`) — `/wä-moⁿ**ʼ**/`, `moⁿ**-**äʼ`: style
   markers stripped from phonetic (~10 entries; review_phonetic 220 → 210).
3. **POS label chains** (`parse.py`) — "pres./past t." as ONE italic run now splits on "/"
   for the continuation test; fixes "sing./pl.", "3rd pers. sing./pl." too (Gđíze, Íʼkʼigđaè,
   Akíbažì, Ayáđaì, Atíʼ, Ađį́ʼ, Itʼúšʼpʼà — labels had leaked into glosses/translations:
   "they pres./ past t. the money").
4. **Related-form label chains** (`senses.py`) — "__pl./ emphatic__, __wíwítʼa__, they are
   mine": label chain now becomes the form's pos ("pl./emphatic"), the next run is the form.
   Plus: the book's stray unmatched ")" there (P1 p221, crop-verified) is dropped.
5. **Numbered senses inside a RELATED form's gloss** (`senses.py`) — the "2. …" hoist to the
   entry now fires ONLY when the entry itself opened a "1." list (Bíʼze p79 keeps nąbíze's
   two senses in its gloss; Bihútʼą̀ p80 still hoists correctly).
6. **Quoted literals** (`senses.py`) — 'lit., "in between or in the middle," usu. used…'
   ends at the closing quote (p180).
7. **Multi-comma literals** (`senses.py`) — explicit crop-verified LITERAL_EXTEND set for
   "flat, wide, or broad water" (p154) + "long, curved head" (p157). A general heuristic was
   tried and REVERTED: literal continuations and definition synonym runs are structurally
   identical ("flying canoe, airplane, or jet-propelled aircraft") — do NOT generalize.
8. **Example splitter** (`senses.py`) — the "?" of a question joins the Ponca text
   (`Ánąskà à?`); a short Ponca fragment stranded before the first comma is the Ponca tail
   (`~ì` p85, `~aì` p361, `~ à?` p96); "…; answer: …" Q&A parens become TWO examples (Edí).
9. **"ca. 1800s" dating notes fold into labels** (`senses.py`) — 7 entries where a date was
   the gloss; real glosses (drum, weak man, write…) now surface.
10. **More book typos corrected** (`corrections.py`, now **33 fixes / 59 firings** incl. one
    phrase): continously, extinquish (an english_key — the first sweep never scanned keys),
    "cause by a sickness"→caused, philio→philia (P2 p264 prints philia for the same entry),
    Spings→Springs (capitalized, so the proper-noun filter had hidden it).

Adjudicated NOT bugs (crop-verified): the mid-respelling dots (`/ä·ēʼ/` p69, `/thē·-üʼ/`
p91, `/thē·-xēʼ/` p92, `/āʼ·-…/` p99, `xoⁿʼ· -dā` p223 — print really has them; lanes can't
see the dot), `míxa amà` p264 (grave in print), Gaxđą́/Háʼ/Xą́·de homograph mixups,
p395 "utility poles" keyed to the telephone definition (the book's own copy-paste error,
kept + review-flagged), Eʼbéʼ printed twice on p94 (real duplicate entries in print),
Éʼžą̀hì p95 + Stápʼì p170 parens never closed in P1's print.

**Sweep.py expected files now render sense labels + per-sense pos** (the "archaic missing"
false-positive cluster — ~40 findings — was the renderer omitting `labels`, data was right).

### Final state after both audit rounds
**4,667 entries · 5,027 senses · 668 related forms · 122 examples · 639 review-flagged ·
0 markup leaks / control chars / empty senses / unexpanded ~ · 0 unknown characters.**
Grammar: 59 sections · 73 tables · 68 IGT · 65 legend · 8 slots, lint+check 0 problems.
preview.html REBUILT (sweep card now says "checked twice", 33 corrected misspellings).
Round-2 artifacts: `sweep/findings{,-grammar,-prose}/`, `sweep/triaged.json`,
`sweep/live.json`; round 1 archived as `sweep/findings-round1/` + `triaged-round1.json`.

## AUDIT ROUND 3 — final full re-verification — ✅ COMPLETE (2026-07-28, session 560e3f1e)

Fresh sweep, per Jacob **≥20 pages per lane**. Round-2 artifacts archived
(`sweep/findings-round2/` etc.). Expected files regenerated before spawning; `lane-prompt.md`
corrections list updated 28 → 33 (the round-2 additions were missing → would have caused
false positives). Coverage: **all 346 body pages + grammar 40 + prose 12**.

- Wave 1 (12 lanes: body 61–241 + grammar ×2 + prose) on **opus-5** `--key personal` — ~⅓
  finished, the rest hit the session limit; Jacob spawned a gpt-5.6-sol recovery orchestrator
  that backfilled them. Wave 2 (body 242–407, 8 lanes) opus died instantly on the limit
  (resets 7am UTC) → respawned on **gpt-5.6-sol** (Jacob's own recovery pattern).
- 114 findings → triage.py → `live-check.py` (NEW script, the round-2 stale rule) → every
  live confirmed/needs_eyes/both_present hand-adjudicated against ~35 rendered crops.

### Real bugs found and FIXED (stage in parens; all crop-verified; full /tmp diff reviewed)
1. **`is_ponca` counted ASCII fragments of Ponca words as English markers** (`senses.py`) —
   "ađái"→"a", "tʼiną́kʼa"→"in" hit the ≥2-marker veto; **15 real Ponca examples per book**
   (8 P1 + 7 P2 twins: Baiáxa, Batʼą́tʼąđį̀, Edábe, Mąšíáhà, Mą́teádi, Mą́teátʼa, Ubáhadì,
   Wéʼnąxđè…) were never extracted. Fix: whole-token-ASCII counting. Examples 122 → **131**.
2. **Related form lost its first italic run across a roman `~`** (`senses.py`) — p69
   Ąguágađį̀ "`__ągù__ ~ __ągúáđi__`" → form is now "ągù ~ ągúáđi" (RELATED.search had
   skipped to the second run).
3. **`, (` comma artifact** (`senses.py`) — merge/literal rejoins inserted ", " before
   parenthetical notes the print sets with a bare space ("a meteorite falling (The one…",
   ~20 entries per part). All joins now paren-aware.
4. **Book's `;` flattened to `,`** (`senses.py`) — gloss_partition now returns the consumed
   separator and merge_senses reuses it (Čákʼì p81 "lazy way; an extremely casual…").
5. **Em dashes** — (a) wrap-join after a line-ending "—" now joins tight (`lines.py`; the
   book sets closed dashes — "roundhouse—traditionally" p176, + grammar prose);
   (b) a depth-0 "—" is now a gloss boundary (`senses.py`): Tʼiʼbútʼa gloss "roundhouse",
   Míʼgđą̀/Wáʼđixè gloss "married", Đaúją, Héʼúbažą̀ literal.
6. **Translation `~` used the propagated entry gloss** (`senses.py` expand_tilde) —
   "he comes here calendar" → "monthly" (Míʼíđawà): a numbered sense's own SINGLE-WORD lead
   now takes precedence. (First attempt used any local lead — regressed Égidą̀/Údąžì/
   Wáđatʼą̀į with long phrases; constrained to one word, regressions reverted.)
7. **pos "n. /v." → "n./v."** (`parse.py`, 4 entries; crop-verified tight in print p168).
8. **Hyphen-oracle review sets** (`lines.py`) — DISSOLVE: down-size p93, rest-room p388,
   work-station p12 (about.md), in-complete p339 (killed a spurious review flag — P1 was
   already right); KEEP: bä-ägä (the ONLY dissolved respelling-interior wrap in the book —
   Sabáʼa p161 /sä-bäʼ-ägä/); NEW SUSPENDED set: "yellow- or gold-colored" p252 keeps
   hyphen + space.
9. **Grammar** (`grammar.py`) — p33 Gíđe chart now `mode: "gap"` via TABLE_SPECS (single
   row-pair defeats auto_mode; now `<br>`-stacked like its siblings); NEW
   `unify_respelling_glottals`: /…/ respelling spans now use ʼ U+02BC matching the 9,726
   entry phonetics (the decode had mixed ’/ʼ for the same glyph, p21 vs p25).
10. **corrections.py 33 → 58 fixes** (113 firings): +18 words (pronounciation ×9(!),
    occuring, occured, apperance, descendents, excercise, Bristish, Cucurbitasceae,
    Curcurbitaceae, Fasgaceae, charaterized, sombody, Morman, Prolcyon, Txideinae,
    Brachycern, daugher, Zanaida) and +7 phrases ("It was call į́ʼę"→called, "Arkansas
    Rover"→River, "no long burning"→longer, "the the"→the, "as in in sports"→in,
    "Helianthus x annus"→annuus, "breath deeply"→breathe). Sol lanes' book_typo reports
    (triaged lane_wrong because we DO match the page) were the richest source.

### Adjudicated NOT bugs (crop-verified this round — extraction matched print every time)
All 14 diacritic/glottal lane claims: p138 `Máze` plain á (siblings print Mą́ze — book),
p245 `Uxđəáʼbážì` acute, p341 `Tʼàgeʼžįgàhì` grave, p334 `Wétʼąįʼ` trailing glottal,
p252 theⁿ, p258 zheⁿ, p260 Íkʼipʼahą̀ + tʼoⁿgäʼ, p284, p328 ×2, p330, p332, p341.
Book quirks kept: Niʼé "n" p151/p338 + Kúʼzi "adj" p339 (dots really absent), racoon
(real variant), prophesy (real word), "an heired of" p304 (book's own garble),
"a upper-body", "made milk and cream" (omission — not inserting words), p33 `Wéđe` without
· (p45 prints Wé·đe — book inconsistency), p45 blue "ones own" (we correct to "one's" per
policy on an explicitly-marked editorial row). Xʼáʼđe/Ínąhì "trailing clause after related
forms lands in definition" = deliberate no-data-loss design.

### Final state after round 3
**4,667 entries · 5,027 senses · 668 related forms · 131 examples · 624 review-flagged ·
0 structural flags** (markup/control/empty-gloss/unexpanded-~/dups — audit script re-run
clean). Grammar 59 sections · 73 tables · 68 IGT · 65 legend · 8 slots; `lint.py` +
`check.py` = 0. about.md: workstation fix only. Full baseline diff (`/tmp/ponca-r3-baseline`)
reviewed field-by-field — every change intentional. Expected files regenerated; final
live-check: every remaining live finding is an adjudicated not-a-bug or a squash-substring
false-positive of a fixed item. `preview.html` REBUILT (58 corrections, "third pass" line,
fresh totals). Round-3 artifacts: `sweep/findings{,-grammar,-prose}/`, `triaged.json`,
`live.json`; round 2 archived as `*-round2`.

## Decisions: Jacob 2026-07-28 — NO questions to Greg, just get it done

Jacob reviewed the drafted question set and killed it entirely:
- **Rights/permission: confirmed.** The rights holders gave the book and ASKED for a Living
  Dictionary — no need to ask.
- **Cover image: approved** — use the staged jacket powwow crop; Greg can change it later
  himself.
- **Visibility: separate process**, not part of the import conversation.
- **The blue `Gi-` 11th instrumental prefix: INCLUDE it** — done, appended to the p45 chart
  marked "an editorial addition printed in blue in the book" (grammar.py TABLE_SPECS
  append_rows; the two blue numeral respellings on pp57–58 stay excluded — they conflict
  with the printed respelling rather than adding a missing item).
- **No pre-import questions at all.** Post the report; Greg replies if something needs
  fixing. Wipe-and-reimport is cheap (blank dictionary), so fix-on-reply beats ask-first.
- Posting plan is therefore: **artifact + message only, zero `/questions` posts.**

## Decisions taken with Jacob 2026-07-27 (Greg is NOT asked in advance)

Jacob ruled on all five open modelling questions. Greg gets a **progress report + the questions**
on the conversation BEFORE the import runs so he can object, but we do not block on him.

1. **`ʃ` / `ə` preserved exactly as printed** (recently published, deliberate orthography), the
   book's alphabet registered as the dictionary's orthography, plus the search tap-buttons above.
2. **Related forms promoted to real entries** with `derived_from` → `root_of` relationships
   (~+800 entries, ~18%).
3. **Homographs stay separate entries.**
4. **Part One is authoritative.** Part Two merges in its extra senses + its 118 unique headwords;
   every disagreement writes Part One's value with a `review` flag recording Part Two's
   alternative. Measured on 3,411 cleanly pairable entries: 274 respellings differ, 120 have no
   gloss overlap, 47 POS differ, 318 definitions differ.
5. **Gendered speech variants** (34 entries) → the alternate becomes its own entry linked
   `dialectal_variant`, keeping the book's masc./fem. note on both.
6. **Rights** — unchanged from locked decision 5: the three rights questions go to Greg with the
   report (permission to reproduce; credit for the jacket photograph or a community photo instead;
   does it go public).

## PHASE 2 EXECUTION (session started 2026-07-28, after round 3)

Jacob's ruling (2026-07-28 evening): wrap up → **Phase 2 writes FIRST → then post the report
artifact → then DRAFT (never post) the message for Greg**. Workflow change ordered: the agent
never posts the final conversation message itself — it always hands a draft to the human
(importing.md guide updated accordingly). Rationale: a resumed lane once double-sent a message.

State verified at start: prod deployed with the full v1 surface (PATCH dictionary, cover-image,
sources, grammar, relationships all live; GET /api/v1/dictionaries/ponca returns
`featured_image`, entry_count 0). Token in `~/import-work/ponca/token.private` works. No idle
lane sessions remained to close (all exited). Existing prod orthographies:
`[{code: "Pronunciation", name: "Pronunciation"}]` (unused — will be deleted; respelling lives
in `phonetic`).

### Writer: `~/import-work/ponca/write.py`
Deterministic uuid5 ids (idempotent re-POST). Mapping decisions taken this session:
- pos: canonicalize the cleanly-mappable abbrevs (n.→n, v.→v, adj., adv., pron.→pro, prep.,
  conj., interj.→int, v.t.→vt, v.i.→vi, aux. v.→v.aux); compounds split on `/` (and `, `)
  only when every piece maps; everything else (v. phr., 1st pers. sing., …) stored verbatim.
- sense.literal → appended to definition as `lit., …` (book's own inline style).
- sense.labels (archaic/usu./masc./fem.) → definition prefix `(archaic) …`.
- english_keys not already present in the entry's text (114 of 4,387) → entry `notes`
  ("Part Two lists this entry under: …") — notes are Orama-indexed, so they stay searchable.
- review[] → EntryReview category `part-two-differs`, note enumerating each field with Part
  Two's version + its pdf page; `uncertain_joins` → category `uncertain-join` (or folded into
  the note when both).
- citations: entry → `pdf p{page}` + one per part_two_page; examples + grammar sentences same
  slug `headman-oneill-2019`.
- homographs: 295 duplicated lexemes numbered "1"/"2"/"3" in book order.
- related forms → own entries (form as printed, incl. lowercase) + `derived_from` relationship
  (from=derived, to=base); if the form casefold-matches an existing main headword, link only,
  don't create.
- gendered speech variants: NOT auto-linked (pair data was never staged; english_key grouping
  would false-positive — Wisą́ga/Wižį́đe are younger/elder sibling, not gender variants of each
  other). masc./fem. labels + parenthetical alternates are preserved in definitions. Follow-up
  for Greg/manager noted in report. (Supersedes locked decision 5's linking half.)
- orthographies: PATCH `default` → name "Ponca", characters `đ ʼ ą ę į ų ǫ š ž č ʃ ə ·`;
  DELETE the unused `Pronunciation` alternate.
- catalog PATCH: `about` = about.md, `citation` = the UNP citation, `copyright` = © 2019 Louis
  Headman.
- grammar order: source → clause-slots → glossing-abbreviations → sentences → sections
  (tree, parents first) → section↔sentence links from the sentences' `_section` keys.
- import_id: `ponca-book-2026-07-28`.

### Rehearsal findings — 3 residual staged-data bugs found by LOOKING at the rendered site
(all crop-verified, fixed at the pipeline stage, diffs exact):
1. **p363 Akʼíđahà (P2)**: P2 runs P1's related form akʼíwahà inline; its example paren leaked
   out as a garbled sense example ("wą́giđèxtì" / translation full of Ponca). Content already
   survives in the related-form gloss → explicit drop in senses.py `EXAMPLE_FIXES` (must-fire
   guarded, like the typo map).
2. **p74/p401 Áwa**: "(áwađià?, ~ is he, she, it?; áwakeà?, ~ is it?)" is a Q&A pair → split
   into TWO examples (same EXAMPLE_FIXES map). merged.jsonl diff = exactly these 2 entries,
   examples stay 131.
3. **Grammar chart cells `**Ą- **`** — a bold run ending in a space doesn't parse as GFM bold →
   literal asterisks on /grammar. Fixed in blocks.py `tidy_marker_runs` (markdown_table moves
   run-edge whitespace outside the markers); 19 spans across 5 section bodies, lint+check 0,
   body diff = exactly those cells. Lesson: the "verified through the markdown pipeline" check
   asserted table STRUCTURE, not per-cell bold parsing.
Also confirmed NOT bugs: "I let him Heđúškà dance" (proper-noun dance name in English print);
sentence route redirect (corpus-preview-guard, admin-3 only — expected).

### Prod run — ✅ COMPLETE 2026-07-28
- started PATCH · source existed (`7651c97f`) · file linked · catalog (about 29,527 chars +
  citation + copyright) · primary orthography "Ponca" + 13 characters, "Pronunciation"
  alternate deleted · cover uploaded (788,643 bytes → featured_image with variants).
- Entries: first 500-batch OK, second hit **Cloudflare's 100s limit (524, rolled back
  clean)** → re-ran at `--batch-size 150`, resumed idempotently (500 skipped), 0 failed.
  **Lesson: ≤150 entries/batch through Cloudflare on prod.**
- related (590 + 668 relationships) · grammar (8/65/68/59/68) all clean; verify:
  entry_count 5257, featured_image true.
- Live-site verification (headless): the empty logged-out entries list was NOT privacy and
  NOT snapshot staleness — it was **`is_bot`**: HeadlessChrome's UA is (correctly) treated
  as a robot, and robots never boot the offline DB. With a normal Chrome UA the logged-out
  prod pages render fully: entries 5,257 with tap-buttons + facets in ~5s, grammar page
  complete (clause strip, tables, prose). R2 snapshot rebuilt to 8.9MB within the 30-min
  window. Insider spot-check: 10 random entries (incl. related-form entries) pulled from
  prod ponca.db and compared field-by-field against the staged inputs — 0 mismatches.
- Report artifact posted; API key revoked; guide (importing.md §2.8), brief step 7
  (`import-request-body.ts`) and `.knowledge/domain/import-workflow.md` all updated to the
  new **draft-don't-post** message rule (+ the ≤150-entries-per-prod-batch CF gotcha).
- Uncommitted repo changes from this session: `site/src/lib/api/v1/guides/importing.md`,
  `site/src/lib/import/server/import-request-body.ts`, `.knowledge/domain/import-workflow.md`,
  this issue file. Message to Greg: DRAFTED for Jacob, not posted. Conversation left
  UNRESOLVED — Jacob posts the message, then resolves at /admin/imports.

### Run order
1. ✅ Local rehearsal DONE (2026-07-28): dev server + local ponca dict mirroring prod catalog
   (incl. the stray "Pronunciation" orthography), full write via write.py (session auth), all
   idempotency re-runs clean. Screenshot-verified: home (hero image, orthography chip, about/
   grammar snippets, 5,257 entries stat after warm boot — the 0s on first paint are the
   local-first cold-boot race, not bad data), entries list (char tap-buttons, pos facets
   noun 2324/verb 1390, examples facet), entry pages (homograph superscript, phonetic, canonical
   pos chips, import tag, source chip with pdf-page locator, examples, "Root of" related
   entries), /grammar (clause template strip, 73 tables incl. fixed bold cells, IGT blocks with
   aligned morphemes + small-caps legend codes + entry links). Counts in local dict.db:
   entries 5257 (4667+590) · senses 5617 · relationships 668 · sentences 199 (131+68) ·
   sections 59 · slots 8 · legend 65 · links 68 · source 1.
2. VPS backup of `dictionaries/ponca.db` → then prod run: PATCH conversation started → source
   → file source_id → catalog/orthographies/cover → entries → related → grammar → verify counts.
3. Rebuild report.py as the POST-import report (round-3 numbers, no "questions" card) → POST
   artifact kind `report`.
4. Draft Greg's message → hand to Jacob (NOT posted). 5. Revoke API key. 6. Update guide
   (importing.md draft-don't-post) + knowledge.

## The artifact to post (BUILT, not yet posted)

`report.py` → `preview.html` (13KB, no scripts, inline styles only, renders in the sandboxed
iframe; screenshot-verified). Contents: what the book contains, **the `đ` / font explanation**
(all standard Unicode, no custom font needed, what the PDF did and how it was caught), six real
staged entries rendered as they will appear, the decisions above, what happens next.

Post as `kind: "preview"` — it doubles as the pre-write rendered preview the guide requires.
Endpoints confirmed live: `POST …/conversations/{threadId}/artifacts` `{kind, title, html, stats}`
and `POST …/messages` `{body_text}` (the message is what emails the manager). Per the 2026-07-28
ruling: NO `/questions` posts. Post after audit round 3 comes back clean.

## REVIEW-FLAG TRIAGE + REPORT v2 — ✅ COMPLETE 2026-07-28

Jacob's rulings after reading the first report: (a) every lexeme printed in a report must
LINK to its live entry (the rule was already in importing.md §2.8 — the v1 builder was
derived from the *preview* builder, which legitimately has no links, and the checklist was
never re-run: a process failure, not an ambiguity); (b) review flags must not be petty —
settle trivia ourselves choosing whichever typesetting looks best; (c) surviving notes must
be legible in one read; (d) reports need a per-category review explanation with examples;
(e) reports should tell the linguistic/editorial story (Greg is learning) but stay
one-sitting readable — v1 was too short, iipay-aa (167KB) too long.

### Triage (`review-triage.py` → `resolve-review.py` → `review-patch.py`)
- 706 raw flag items (694 P1-vs-P2 + 12 uncertain joins) bucketed by difference class.
- Settled by rule + ~45 hand overrides: 258 drop · 48 adopt · 5 literal · 2 sense_fix ·
  2 fix · 12 joins. **Kept 358 items on 349 entries** (was 624 entries / 694 items).
- Rules encoded: stress-marks → main dictionary (129); syllable separators → the variant
  matching the headword's word-breaks (39); oⁿm vs oⁿ before b → plain (141:13 corpus
  majority, 6 cases); shortened finder-list copies → fuller (44); pos detail → fuller
  label wins (31); style/quote/case → the book's own majority habit (21:2 for `as in “…”`
  without a comma, 100:18 against period-inside-quote, respellings never capitalized).
- Notes rewritten: BOTH versions quoted + the difference named; falls back to "the wording
  differs throughout — read both" when the span list would be mangled.
- Categories split from one bucket into four: `definition-differs` (271) ·
  `respelling-differs` (32) · `part-of-speech-differs` (29) · `possibly-two-words` (17).
- **Bug caught by a wide crop**: p77 has TWO run-on forms (bašnúʼšnudè under Bašnúʼde,
  bašnúšnúde under Bašnúde). A narrow crop showed the wrong one and I "fixed" a correct
  lexeme on prod; reverted. LESSON: crop wide enough to see the neighbouring entries.
- 634 PATCHes applied to local rehearsal then prod (0 errors; the freshly minted key needs
  **`role='write'`** — the schema comment's 'manager' 403s "read-only key").

### Report v2 (`report.py` rewritten, 249KB)
- `Linker.lex()` is the ONLY way to print a headword — raises on an unknown word; build
  asserts `href` count == lex() call count (641 links). This class of miss can't recur.
- Structure: 3 questions at top (gendered pairs · the m-before-b · stress marks) → counts →
  đ/fonts → three-pass verification → sample entries → **How the linguistic decisions were
  made** (narrative) → **review queue by category** with worked examples + collapsed full
  lists → **What we settled ourselves** (every case, collapsed) → not-imported → next → record.
- Posted as artifact `a999a59d-bc38-4bf1-b1c8-e7474e95555a`; old `a64e7686…` deleted from
  `thread_artifacts` AND from R2 (`import/ponca/artifacts/…`), so Greg sees exactly one.
- API key `review-triage 2026-07-28` minted → used → **revoked** (401 verified).

### App feature: review indicator in list views
`$lib/components/entry/ReviewIndicator.svelte` (orange ⚠, same #d97706 as ReviewBanner,
title = "Needs review · <category label>") rendered in list/table/gallery next to the
headword whenever `entry.main.review` exists — which is editor-only by construction
(`assemble_entry_data` strips `review` for non-editors), so no extra gate needed.
Story `EditorNeedsReview` added; svelte-look verified light+dark; browser-verified against
real flagged Ponca data (349 filtered, 4 category facets, indicators inline).

### Guide updates (importing.md)
§2.3: "Never flag a difference a rule can settle" + "A comparison note must make the
difference legible in one read" + the list-view indicator in the queue description.
§2.8: review-queue-by-category requirement · tell decisions as a story · length rule
(one-sitting main flow, depth in `<details>`; names the 167KB anti-pattern) · a
**pre-POST checklist** whose first item is the preview→report link trap.

Verification: `pnpm test` 2,269 passed (use `--maxWorkers=2`; full parallelism OOMs → 137),
`tsc` clean, eslint clean on changed files, `pnpm check` 0 errors.
