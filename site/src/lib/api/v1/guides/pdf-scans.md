# Importing from PDF scans of printed dictionaries

Read `/api/v1/guides/importing` first for the overall workflow. A scanned published
dictionary is almost always a real **source**: create the `sources` registry row
first and link the file to it (`PATCH …/files/{fileId}` with `source_id`).

## Working the scan

- Read the front matter first: it defines the orthography, abbreviations list
  (POS codes, gloss-language markers), and entry structure. The abbreviations page
  is your legend for the whole book — extract it before touching entries.
- Work in **page ranges** (e.g. 20 pages at a time) and keep a ledger of which pages
  are done. Deterministic UUIDs per headword+page let you resume safely.
- Entry boundaries in print are typographic (bold headword, hanging indent). When
  OCR flattens them, re-split on the headword pattern from the front matter rather
  than trusting line breaks.

## Fidelity rules (these matter most)

- **Never "normalize" diacritics or special characters** — ɓ vs b, ŋ vs ng, tone
  marks, and combining characters are the data. If the OCR is unsure, check the page
  image; if still unsure, skip and log rather than guess.
- Keep the printed sense numbering (1., 2., …) as separate senses.
- Example sentences: keep the printed example with its translation, and record the
  page in a citation — `citations: [{ "slug": "smith-1979", "locus": "p. 214" }]` —
  so every imported sentence points back to its exact page.
- Run-on / derived forms listed inside an entry become their own entries linked by a
  relationship (or `notes` when the derivation is unclear).

## Verify hard

OCR imports need heavier spot-checking than structured formats: verify ~1 entry per
imported page against the page image (headword spelling, diacritics, gloss-sense
alignment). Report the pages covered, entries created per page range, and any
sections you skipped (front matter, grammar sketch, indexes).
