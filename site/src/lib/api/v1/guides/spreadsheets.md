# Importing from spreadsheets (CSV / Excel / Google Sheets)

Read `/api/v1/guides/importing` first for the overall workflow.

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
| source / reference | `sources` (slug — create registry rows first) |
| id / ref number | `elicitation_id` if it's genuinely a word-list/elicitation code |

- **Multiple senses in one row** often appear as numbered column groups (gloss 2,
  POS 2, …) or `;`-separated glosses — split them into separate senses only when the
  source clearly means distinct meanings, not synonyms.
- **Multiple values in one cell**: `|`, `;`, `,` are all common separators; check a
  sample before splitting on commas (glosses like "small, red car" are one value).
- One spreadsheet row is usually one entry — dedupe repeated headwords into one
  entry with multiple senses only when the rows are obviously the same lexeme.

## Sanity checks

- Row count ≈ imported entry count (minus header/blank/instruction rows).
- No header strings imported as entries ("word", "(word/phrase)", etc.).
- Diacritics survive round-trip on a sample of 10 rows.
