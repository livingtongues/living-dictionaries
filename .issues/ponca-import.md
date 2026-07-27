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

## NEXT UP — the search character tap-buttons (Jacob, decided 2026-07-27)

Ponca needs `ʃ` and `ə` (and `đ`, `ą́`…) tappable next to the search box — nobody can type them.
Jacob: *"something very simple, not a Keyman keyboard… a few buttons for these special characters
right there on this dictionary"*, and *"do it in a way that works for more than just one
dictionary"* — hardcoding for `ponca` first is acceptable, standardise at the second dictionary.
Feed it from the dictionary's registered orthography/alphabet rather than a per-dict hardcode if
that lands cleanly.

## KNOWN BUG — ✅ RESOLVED by the vision sweep (see the sweep section below): the gloss-leak
class (POS/labels as gloss) is fixed at the source, `Ámąđì`/`Akíđé` extract cleanly, and the
example counts below are superseded by the sweep-final stats.

## (historical) example-sentence extraction needs another pass

Only ~229 of the book's parenthetical `(~ …)` notes are real Ponca example sentences; the same
notation is also used for plain **English usage notes** ("to use a lid to ~ the food"), which are
not sentences at all. `is_ponca()` now separates them by testing for Ponca-only letters with the
`~` removed (expanding first would make every English note look Ponca) — that part works, and the
English notes correctly stay in the definition.

**Still broken in the ~229 kept examples**, seen while verifying tilde expansion:
- `Ađį́ą́gađį̀` → translation "we are **pl.** the dishes" and `Agđítʼamà` → "the ducks are **phr.**":
  the `~` in the translation is expanded with the sense gloss, and for these entries the gloss is
  wrong — a POS abbreviation (`pl.`, `phr.`, `/ v.`) leaked into it. So the **gloss** extraction is
  wrong for a subset of entries, and the examples merely expose it. Find and fix that class first.
- `Ámąđì` → text/translation mangled ("iđádi míʼxe kèʼ, walk uponkiđaì, they caused"): nested or
  multi-part parentheticals are being split wrongly.
- `Akíđé` → `He"úškà` in the translation where the text has `Heđúškà`.

Do NOT post entry-count claims about examples to the conversation until this is resolved.

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

- Book's own typos kept verbatim: "meterorite" p140, "broadcoth" p204, "pharmarcy" p134,
  "nazalize" p84, "continuouly" p92, "twetieth-century" (+`source_typo` respellings).
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
- [ ] **Example phrases** — see the KNOWN BUG section above; fix the gloss leak first.
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
      written to the dictionary or the conversation. **59 sections · 74 markdown tables ·
      68 IGT examples · 65 legend codes · 8 clause slots.** Detail in "Grammar sketch" below.
- [x] ✅ **Prose** → `about` — `prose.py` → `about.md` (Preface 11 paras · Acknowledgments 19,
      Elders' bios come out as **Name**: bolded leads · Bibliography 7 entries with the `———.`
      author-repeat row correctly reassembled — same-row font fragments cluster within 4pt).
      Markdown-ready (`*italic*`). Not yet written to the dictionary (gated).
- [x] ✅ **Cover photo** — `cover-full.jpg` (2100×3000 extracted jacket) + `cover-crop.jpg`
      (2100×1220 text-free powwow crowd crop, y 1780–3000) staged in `~/import-work/ponca/`.
      POST to `…/cover-image` happens in Phase 2 (rights question to Greg stands).
- [x] ✅ **Vision verification sweep** — DONE, all 346 pages, see the sweep section above.
- [ ] **Rendered preview + human sign-off** before any writes (guide §1.2 / §2.5).
      `preview.html` REBUILT with sweep-final + merged numbers (4,667 entries / 5,027 senses /
      649 review-flagged) + a "checked against the printed pages" card. **WITH JACOB for review
      now** — post to the conversation only after he approves.
- [ ] **Phase 2 writes** in idempotent batches under one `import_id`.
- [ ] **Revoke the API key** `f9375f18-e388-434b-bcff-8c29f8638029` when finished.

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
site's OWN markdown pipeline (`markdown-it {html:true}` + the `xss` whitelist): all 74 tables
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
3. **The blue editorial annotations in the introduction** (excluded at extract time, pp45/57/58).
   One is real content: under the 10-column instrumental-prefix chart on p45 sits **`Gi-` 'one's
   own (makes it possessive)'** — an 11th prefix that was never typeset in black. Ask whether to
   add it. The other two are `/wi’akchi` beside the numeral **1** (p57) and `/ šap’e na,ba` beside
   **12** (p58) — look like respelling corrections.
4. **The intensive infix `-ʼi-`** sits inside the stem, so glossed examples show the stem split
   around it (`đi-ʼi-hą` = `lift-PL.INTNS-lift`). Noted in the `PL.INTNS` legend entry.
5. **`Wáđiʼihąì`** is glossed both 'he/she/it lifts them' and 'they lift them' — the book says so
   explicitly and leaves it to context. Carried as a `_flag`, not resolved.
6. **The book's own caption misprint on p40**: "Second person singular subject (**“I”**)" should
   read "you". Kept verbatim.
7. The 10-column instrumental-prefix chart is stored **transposed** to 2 columns (unreadable as
   10 columns on a phone); the other 73 tables keep the book's own shape.

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

## The artifact to post (BUILT, not yet posted)

`report.py` → `preview.html` (13KB, no scripts, inline styles only, renders in the sandboxed
iframe; screenshot-verified). Contents: what the book contains, **the `đ` / font explanation**
(all standard Unicode, no custom font needed, what the PDF did and how it was caught), six real
staged entries rendered as they will appear, the decisions above, what happens next.

Post as `kind: "preview"` — it doubles as the pre-write rendered preview the guide requires.
Endpoints confirmed live: `POST …/conversations/{threadId}/artifacts` `{kind, title, html, stats}`,
`POST …/questions` `{questions:[{kind: text|choice|multi_choice, title, body_html, options}]}`,
`POST …/messages` `{body_text}` (the message is what emails the manager).

**Hold the post until the example-sentence bug above is fixed** — the artifact should not carry
counts that are about to change.

## Original question wording (superseded by the decisions above; kept as drafting source)

1. **`ʃ` and `ə` as letters.** The book's alphabet uses `ʃ` (U+0283 esh) for the [ɪ] vowel and `ə`
   for schwa, each with its own A–Z section and a nasalized counterpart. Keep these exact characters
   in the Living Dictionary (affects typing and search), or use a more conventional spelling?
2. **Related/inflected forms** (625 per part) — promote to their own searchable entries linked back
   to the base word, or keep them inside the definition text?
3. **Gendered speech variants** — Part Two records male/female speech forms
   (`Sipʼáhi utʼą́ga` (masc./fem.) vs `Sipʼóho tʼągą́` [masc.]). Separate entries linked as
   variants, or alternate forms on one entry?
4. **Homographs** — `Iđádiđaì` is 3 entries and `Watéʼ` 2. Keep as separate entries (faithful to the
   book) or merge into one entry with multiple senses?
5. **Part One ↔ Part Two disagreements** — where the two typesettings differ (respelling, POS,
   gloss), should we import Part One's version and flag, or hold the entry for review?
6. **Rights** (from the locked decisions): permission to reproduce the complete dictionary; credit
   for the jacket photograph or a community photo instead; does the dictionary go public.
