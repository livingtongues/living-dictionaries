# Importing from spreadsheets (CSV / Excel / Google Sheets)

Read `/api/v1/guides/importing` first for the mandatory workflow (register the source, prepare and review the data, and only then write).

## Reading the sheet

- Export/convert to CSV or parse XLSX directly; trim whitespace on every cell.
- The first row is USUALLY headers, but many community spreadsheets have title rows,
  merged cells, or a template row of instructions before the data — inspect the first
  ~5 rows before assuming.
- Watch encodings: files that show `Ã©`-style mojibake were exported as Latin-1;
  re-read the bytes as UTF-8/Windows-1252 rather than importing garbage.

## Mapping columns

Typical shapes to look for:

| Column smell | Maps to |
|---|---|
| headword / word / lexeme / vernacular | `lexeme` (the `default` writing system) |
| second orthography / script column | additional key in the `lexeme` MultiString (match a dictionary orthography code) |
| gloss / English / Spanish / translation | `senses[].glosses` keyed by gloss-language code |
| definition (longer prose) | `senses[].definition` |
| POS / part of speech / category | `senses[].parts_of_speech` — send the English name or abbreviation; the API normalizes ("Noun" → "n"). Multi-values are often comma/`|`-separated |
| semantic domain / category | `senses[].semantic_domains` (keys) or `write_in_semantic_domains` (free text) |
| example / sentence + its translation | `senses[].example_sentences[]` with `text` + `translation` |
| plural / variant | `senses[].plural_form` / `variant` |
| IPA / pronunciation | `phonetic` |
| dialect / village / region | `dialects` (entry-level, created by name) |
| notes / comments | `notes` |
| source / reference | `sources` (slug — create registry rows first); with a page/example number use `citations: [{ slug, locator }]` |
| id / ref number | `elicitation_id` if it's genuinely a word-list/elicitation code |
| homonym / homograph number, or a repeated headword | `homograph` ("1", "2") on each of the separate entries |
| latitude + longitude (where recorded/elicited) | `coordinates: { points: [{ coordinates: { latitude, longitude } }] }` |
| scientific / Latin name | `scientific_names` |
| noun class / gender | `senses[].noun_class` |
| morphology / morpheme breakdown | `morphology` (word-level parse) — a running interlinear line is `interlinearization` |
| etymology / borrowed from | `linguistic_history` |
| image / audio filename or URL | not an entry field — attach after the write (see Media below) |

- **Multiple senses in one row** often appear as numbered column groups (gloss 2,
  POS 2, …) or `;`-separated glosses — split them into separate senses only when the
  source clearly means distinct meanings, not synonyms.
- **Multiple values in one cell**: `|`, `;`, `,` are all common separators; check a
  sample before splitting on commas (glosses like "small, red car" are one value).
- One spreadsheet row is usually one entry — dedupe repeated headwords into one
  entry with multiple senses only when the rows are obviously the same lexeme.
  When they're genuinely different words that share a spelling, keep them as
  separate entries and number them in `homograph` so they stay distinguishable.

## Media columns

Sheets often carry a photo/audio column — a filename pointing into a folder the
uploader sent, or a public URL. These are not entry fields: write the entries
first, then attach with `POST …/entries/{entryId}/audio`,
`…/senses/{senseId}/photos|videos`, or `…/sentences/{sentenceId}/…`, sending either
multipart `file` or a JSON `url` (the server fetches it). Audio/video REQUIRE
attribution — `speaker_id` (create the speakers first, usually from a "recorded by"
column) and/or `source`. Use `replace: true` for one-recording-per-headword sheets
so re-runs don't stack duplicates. Keep a filename→entry-id map in your ledger so
the attach pass is resumable.

## Sanity checks

- Row count ≈ imported entry count (minus header/blank/instruction rows).
- No header strings imported as entries ("word", "(word/phrase)", etc.).
- Diacritics survive round-trip on a sample of 10 rows.
