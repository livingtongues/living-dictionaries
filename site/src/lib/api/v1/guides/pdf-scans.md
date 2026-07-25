# Importing from PDF scans of printed dictionaries

Read `/api/v1/guides/importing` first for the mandatory workflow (register the source, then prepare the data before any data write). A scanned published
dictionary is almost always a real **source**: create the `sources` registry row
and link the file to it (`PATCH …/files/{fileId}` with `source_id`) before you
start extracting.

## Do NOT use OCR. Read every page with your own eyes.

This is the single most important rule on this page, and it is the opposite of the
advice you'd apply to a normal document.

**Traditional OCR (Tesseract, ABBYY, any "extract text from PDF" tool) is not an
acceptable method for these materials.** It is trained on majority languages —
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
   equivalent). If a PDF has an embedded text layer, treat it as a *hint only* — it
   is usually the output of exactly the OCR you are avoiding. Never import it
   directly.
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
  ASCII apostrophe where the orthography specifies `ʼ`), and don't silently change
  Unicode normalization.
- Keep the printed sense numbering (1., 2., …) as separate senses.
- Example sentences: keep the printed example with its translation, and record the
  page in a citation — `citations: [{ "slug": "smith-1979", "locator": "p. 214" }]` —
  so every imported sentence points back to its exact page.
- Run-on / derived forms listed inside an entry become their own entries linked by a
  relationship (or `notes` when the derivation is unclear).

## Verify hard

Scan imports need heavier verification than structured formats: after import,
re-open the page image and check ~1 entry per page against it (headword spelling,
every diacritic, gloss-sense alignment). Report the pages covered, entries created
per page range, entries left in the `review` queue, and any sections you skipped
(front matter, grammar sketch, indexes).

Plates and figures in the book are importable too — attach a cropped photo to the
sense it illustrates (`POST …/senses/{senseId}/photos`, multipart `file`), with the
plate's page in the entry's `citations`.
