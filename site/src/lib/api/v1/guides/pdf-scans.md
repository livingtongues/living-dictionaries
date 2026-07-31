# Importing printed dictionaries from PDF

Read `/api/v1/guides/importing` first for the mandatory workflow (register the source,
then prepare the data before any data write). A published dictionary is almost always a
real **source**: create the `sources` registry row and link the file to it
(`PATCH …/files/{fileId}` with `source_id`) before you start extracting.

Two very different jobs share the `.pdf` extension — a **scan** of a printed page and a
**born-digital** export from the publisher's typesetting software. Tell them apart first;
the correct method for one is the wrong method for the other.

## First: is it actually a scan?

Check before anything else — the right method is the opposite for the two cases.

```
pdfinfo book.pdf     # a Creator/Producer like "Adobe InDesign" or "LaTeX" = born-digital
pdffonts book.pdf    # embedded fonts with real encodings = born-digital
pdftotext -f 50 -l 50 book.pdf -   # returns clean prose = there is a real text layer
```

A **born-digital** PDF (exported from InDesign, LaTeX, Word — anything published since
roughly 2000) carries the typesetter's ACTUAL characters. That text layer is not a
guess, and re-typing it by eye would *add* errors rather than remove them. Use it — but
read "The font-glyph trap" below first, because these files fail in their own quiet way.

A **scan** — page images, no text layer, or a text layer some tool OCR'd in — is
handled from "Do NOT use OCR" onward. The sections in between are the born-digital
failure modes: glyphs, spacing geometry, wrap hyphens, and how to verify the parse
against the page.

## The font-glyph trap (born-digital files)

Publishers of minority-language dictionaries commission custom fonts, and a custom font
subset often has no `ToUnicode` mapping for the very characters the language needed the
font for. Those characters do not extract as themselves: they come out as **control
characters, private-use codepoints, or a plausible-looking wrong letter** — and, because
each font subset (regular / bold / italic / small-caps headings) is encoded separately,
the SAME letter can arrive as several different codes.

A real example: a recent university-press dictionary rendered `đ`/`Đ` — the letter
for /ð/, the most distinctive consonant in the language — as `\x17`, `\x08`, `\x16`,
`\x05` and `\x1e` depending on which font ran, ~6,000 occurrences in all. Terminals
print those as nothing. A pipeline that trusted `pdftotext` would have silently deleted
that letter from every word in the dictionary.

So, before you trust one character of the text layer:

1. **Inventory every codepoint** in the extracted text and sort by frequency. Anything
   in the C0 control range, the private use area, or that you can't name is a suspect.
2. **Identify each suspect by looking at the page.** Render the page it occurs on
   (`pdftoppm -r 200 -png -f N -l N`), find the spot, and see what glyph is actually
   printed. The book's own alphabet chart usually names it outright.
3. **Build an explicit code → character map, per font if needed**, and record it in your
   report. Extract with a tool that exposes the font per span (PyMuPDF `get_text("dict")`,
   pdfminer) when one code means different things in different fonts.
4. **Re-run the codepoint inventory on the DECODED text.** Zero unknowns is the pass
   condition, and it is worth failing your pipeline over.
5. **Watch the headings.** All-caps display fonts often encode the same letters a third
   way — as a base letter plus a combining/spacing diacritic (`A` + U+02DB for `Ą`).
6. **Hunt the ASCII imposters — the codepoint inventory cannot see them.** A bad
   glyph mapping can land on a perfectly ordinary ASCII character, and step 1 will
   never flag it. In the same dictionary, a SEVENTH encoding of `đ` surfaced late,
   hiding as a plain straight quote `"` in the regular font — plausible-looking,
   nameable, invisible to a suspect scan. Catch these with **book-wide priors**:
   inventory the punctuation and letter frequencies per font subset and interrogate
   anything that breaks the book's own habits. There, every one of the 394 real
   quotation marks in the book was curly — so a straight `"` could never be a quote,
   and each occurrence was a masked letter. Any character that appears only in one
   font subset, or only word-internally where its normal use is word-adjacent, is a
   suspect regardless of how ordinary it looks.

One more layout trap: multi-column pages interleave unless you extract with
x-coordinates and split the columns yourself.

## Geometry bugs in the text layer

Even with every glyph decoded, the text layer's *spacing* lies in ways that corrupt
words. Each failure has a clean **geometric signature**, so diagnose and fix at the
character-geometry level (PyMuPDF `get_text("rawdict")` gives you per-character
origins), never with string heuristics — string patches fix the examples you saw and
corrupt the ones you didn't:

- **Ligature filler** (`"fi rst"` → `first`): the spurious space's x-origin jumps
  *backwards* behind the ligature pair.
- **Discretionary hyphens** (`/ä'- bä-/` → `/ä'-bä-/`): the next letter's origin sits
  on top of the phantom space.
- **Kerned phantom spaces** after combining accents in display type: a space emitted
  behind the accent stack with near-zero advance.
- **Eaten spaces after sentence punctuation** (`word.Next` → `word. Next`): a real
  advance gap with no space character in the stream.

After any spacing fix, **prove no real spaces were eaten, using the corpus as its own
oracle**: a wrongly-joined pair produces a rare long token that splits cleanly into
two common tokens. Rank tokens by that signature and read the top of the list; genuine
compounds survive the check, dropped spaces do not.

## Line-wrap hyphens

A hyphen at a line break is either a soft wrap hyphen (join the halves) or a real
compound hyphen (keep it) — and **the printed page cannot disambiguate**: the glyph is
identical, and in ragged-right setting the line-end position carries no signal either.
Resolve by **corpus evidence**, not by eye:

- Build a vocabulary from the whole book and ask whether the joined form, the hyphened
  form, or the split pair is independently attested. A dictionary typeset twice — a
  main part plus a reversed finder-list — is its own oracle: the same word set
  reappears unwrapped elsewhere. One import resolved 3,620 of these decisions by
  evidence this way.
- Handle **suspended hyphens** ("yellow- or gold-colored") as their own case — the
  dangling hyphen before "or"/"and" is real and must survive the join.
- For vernacular forms, check the corpus of the language's own words; never apply an
  English wordlist to them.
- Whatever the evidence cannot settle, **record as an uncertain join and set the
  entry's `review` field** — a flagged join is data, a silent guess is corruption.

## Verifying a born-digital extraction: the compare-don't-retranscribe sweep

An exact text layer still needs its parse verified against the printed page — that is
how you catch a wrong glyph mapping, a mis-grouped entry, or a field split in the
wrong place. Do it as a **comparison sweep**, not a re-transcription (re-typing by eye
would add errors, not find them):

1. For every body page, render the page image AND emit an **expected file** — exactly
   what your pipeline parsed from that page, entry by entry, every field included.
   (An omitted field generates a wall of false "missing on page" findings.)
2. Fan the pages out to parallel vision lanes. Each lane's ONLY job: read the image,
   read the expected file, compare entry by entry, and file structured findings.
   Give lanes the list of known-and-intentional differences so they don't re-report
   them.
3. **Treat lane findings as leads, never verdicts — lanes over-correct constantly.**
   In one full re-sweep, every single diacritic/glottal claim the lanes filed was a
   lane hallucination: the extraction matched print each time. The orchestrator must
   **adjudicate each surviving finding against a rendered crop of the exact spot on
   the page** before changing anything. Auto-triage first (a finding is stale once
   its claim no longer appears in the regenerated expected file), then eyeball what's
   left.
4. **A lane that skips reading the expected file produces garbage that looks like
   findings.** When auditing lane output, check the transcript actually consulted
   both inputs; findings from a lane that compared the image against its own
   assumptions must be discarded and the pages redone.
5. Fix every confirmed bug **at its earliest pipeline stage**, re-run every downstream
   stage, and review the full before/after diff of the final payload — the diff must
   contain exactly the intended entries and nothing else.
6. Run the sweep **more than once**, with fresh lanes (ideally a different model)
   after each round of fixes. Later rounds find the bugs your fixes introduced. Stop
   when a round yields no new systemic class — see the passes discipline in
   `/api/v1/guides/importing` §1.4.

And after everything passes: **look at the rendered result in the product, not just
the data.** One import's three clean page-level audits still missed a bold span with
a trailing space that rendered as literal asterisks in five grammar tables, and a
Q&A pair fused into one example — both were caught in minutes by opening the pages
a reader would see.

## Do NOT use OCR. Read every page with your own eyes.

This is the single most important rule on this page, and it is the opposite of the
advice you'd apply to a normal document.

**For a genuine scan, traditional OCR (Tesseract, ABBYY, any "extract text from PDF"
tool) is not an acceptable method.** It is trained on majority languages —
English, Spanish, French, Chinese — and these books are not that. It fails here in
two specific, unrecoverable ways:

1. **Unfamiliar orthographies.** These dictionaries are full of characters and
   combining marks OCR has effectively never seen: ɓ ɗ ƴ ŋ ɲ ʔ ə ɛ ɔ ʌ ɨ ʉ, stacked
   tone diacritics (à á â ǎ ā a̋ a̰ a̤), underdots, macrons, hooks, apostrophes that are
   consonants. OCR does not "fail loudly" on these — it **silently substitutes the
   nearest majority-language letter**. ɓ becomes b, ŋ becomes n, ɔ becomes o or c, a
   tone mark disappears. You cannot detect these losses downstream, because the
   result is a perfectly plausible-looking word. **It is the destruction of exactly
   the data the dictionary exists to preserve.**
2. **Physical page quality.** Many of these books were typewritten, mimeographed,
   hand-corrected in ink, or photocopied several generations deep. Smudges, broken
   glyphs, bleed-through from the reverse side, skewed lines, and hand-drawn
   diacritics added after typing are normal. OCR confidence scores are meaningless
   on this input.

**Instead: render each page to an image and READ it with a vision-capable model —
you.** Look at every single page yourself. Do not run a text-extraction pass and
then "spot check" it; there is nothing to spot-check against, because the errors are
invisible in the text alone.

### The method

1. **Pages → images** at **300 dpi or higher** (`pdftoppm -r 300 -png`, PyMuPDF, or
   equivalent). If a *scan* has an embedded text layer, treat it as a **hint only** — it
   is the output of exactly the OCR you are avoiding. Never import it directly. (A
   born-digital file is the opposite case — see above.)
2. **Actually view each page image.** One page (or one column) per look. Transcribe
   what you *see*, character by character, not what you'd expect the word to be.
3. **Zoom in whenever you are not certain of a diacritic or glyph.** Re-render the
   region of the page at 600–1200 dpi, or crop the headword and view the crop on its
   own, and look again. This is cheap and you should do it liberally — every time
   you think "that's probably an á", crop it and confirm. Tone marks, the
   dot-vs-comma below a letter, ɔ vs c vs o, ɛ vs e, ŋ vs n, a hook vs a smudge, and
   whether an apostrophe is a glottal stop character or a typewriter artifact are
   all worth a zoom.
4. **When a glyph is still ambiguous after zooming, do not guess.** Record your best
   reading and set the entry's `review` field (see `/api/v1/guides/importing` §2.3)
   with a category like `uncertain_character` and a note naming the exact character
   and the page — so a human speaker can adjudicate it from the entry page. A flagged
   uncertainty is useful data; a confident wrong character is a corruption that
   nobody will ever catch.
5. **Cross-check against the book's own alphabet.** The front matter almost always
   lists the orthography's full character inventory. If you "read" a character that
   isn't in that inventory, you misread it — go back and zoom.

## Working the scan

- Read the front matter first: it defines the orthography (including the alphabet
  chart — your character whitelist), abbreviations list (POS codes, gloss-language
  markers), and entry structure. The abbreviations page is your legend for the whole
  book — extract it before touching entries.
- Work in **page ranges** (e.g. 20 pages at a time) and keep a ledger of which pages
  are done. Deterministic UUIDs per headword+page let you resume safely.
- Entry boundaries in print are typographic (bold headword, hanging indent) — which
  is another reason to look at the page: the layout carries meaning that flat text
  throws away. In multi-column books, read column by column, never straight across.

## Fidelity rules (these matter most)

- **Never "normalize" diacritics or special characters** — ɓ vs b, ŋ vs ng, tone
  marks, and combining characters are the data. Preserve the book's characters
  exactly; do not swap in look-alikes (e.g. don't use a Latin `c` for `ɔ`, or an
  ASCII apostrophe where the orthography specifies `ʼ`).
- **Canonical Unicode normalization (NFC) is the one normalization you MUST apply** —
  it changes byte sequences, never letters. Extracted text routinely mixes
  precomposed and decomposed forms (one import had a third of its headwords as
  `a` + combining ogonek + combining acute), which silently breaks search, sorting,
  and duplicate detection while looking identical on screen. Apply NFC to
  everything, then **verify the distinct-headword count is unchanged** — if NFC
  merged two "different" headwords, that was a real duplicate you needed to know
  about. Compatibility folding (NFKC) and any look-alike substitution remain
  forbidden: those change letters.
- Keep the printed sense numbering (1., 2., …) as separate senses.
- Example sentences: keep the printed example with its translation, and record the
  page in a citation — `citations: [{ "slug": "smith-1979", "locator": "p. 214" }]` —
  so every imported sentence points back to its exact page.
- Run-on / derived forms listed inside an entry become their own entries linked by a
  relationship (or `notes` when the derivation is unclear).

## Print typos: fix the majority language, never the vernacular

Printed books contain typos, and the policy differs by language:

- **Obvious majority-language print typos MAY be corrected** — "pharmarcy",
  "meterorite", a misspelled place name. Each correction must carry a page citation
  and live in a **fail-loud corrections layer**: every fix asserts that its exact
  misspelling still occurs in the extracted text, and the pipeline aborts if one
  stops matching (that means an upstream change shifted the text and your fix may
  now be corrupting something else). Find candidates with a word-frequency sweep
  over all the majority-language text, then **hand-review the whole list** — rare
  words (fetlock, vomitus, ejective) and Latin binomials are not typos. One book
  import ended with 58 such corrections, all listed in the report's decisions
  section.
- **The vernacular is NEVER corrected.** What looks like a typo in a language you
  don't speak is data. Where the book is internally inconsistent in its own
  language — the same word printed two ways in two places — reproduce both
  faithfully and record the disagreement in the entry's `review` field for a
  speaker to settle. You are not qualified to pick the winner, and neither is the
  requester's memory of the book.

## Verify hard

Scan imports need heavier verification than structured formats: after import,
re-open the page image and check ~1 entry per page against it (headword spelling,
every diacritic, gloss-sense alignment). Report the pages covered, entries created
per page range, entries left in the `review` queue, and any sections you skipped
(front matter, grammar sketch, indexes).

Plates and figures in the book are importable too — attach a cropped photo to the
sense it illustrates (`POST …/senses/{senseId}/photos`, multipart `file`), with the
plate's page in the entry's `citations`.
