# Importing a dictionary: the orchestration guide

You are importing someone's language materials into a Living Dictionary through the
`/api/v1` API. This guide is the workflow; the format-specific guides
(`/api/v1/guides/spreadsheets`, `flex-lift`, `pdf-scans`) cover parsing.

## Before you write anything

1. `GET /api/v1/dictionaries/{id}` — learn the gloss languages, orthographies, and
   current entry count. If the source material uses a gloss language or writing
   system the dictionary doesn't have yet, add it first (orthographies endpoint)
   or ask the requester.
2. `GET /api/v1/dictionaries/{id}/files` — the uploaded resources, each with the
   uploader's `import_instructions` (authoritative — follow them) and optional
   `source_note`. Download each via `GET …/files/{fileId}`.
3. Read `?view=index` of the OpenAPI spec, then pull the tags you need
   (`?tag=entries`, `?tag=texts`, …).

## Triage each resource: is it a source?

Not every uploaded file deserves a `sources` registry row:

- **A random working spreadsheet / word list someone typed up** — NOT a source.
  Import the data; leave the file unlinked.
- **A published or citable work** (a printed dictionary scan, a thesis, a published
  wordlist, archived fieldwork) — IS a source:
  1. `POST …/sources` with a stable `slug` (e.g. `smith-1979`), full `citation`,
     `abbreviation`, `author`, `year`, `type` (dictionary/wordlist/fieldwork/
     manuscript/other), and `orthography` if its forms use a specific script.
     If the uploader's `source_note` is thin, write the best citation you can from
     the material itself (title page, colophon).
  2. `PATCH …/files/{fileId}` with `{ "source_id": "<the new source's id>" }` so the
     original file lives permanently behind its source.
  3. Stamp imported records: entry/sentence `sources: ["smith-1979"]`, and use
     `citations: [{ slug, locus }]` on sentences when you know the page/example number.

## Writing the data

- **Generate a UUID yourself for every entry** and send it as `id` — it is the
  idempotency key (re-POST of the same id is a safe no-op) and your handle for later
  `PATCH` fixes. Keep a local ledger mapping source-record → uuid.
- **Batch** `POST …/entries` with `{ "entries": [...], "import_id": "<slug>-2026-07" }`
  in batches of ≤1000 entries (and ≤~16MB per request). The `import_id` becomes a
  private tag so the whole batch can be found or cleaned up later.
- Connected texts (stories, example paragraphs) are NOT entries — use the
  `…/texts` endpoints; interlinear glossed text goes in sentence `tokens`.
- Never invent data. If glosses/POS are ambiguous in the source, leave the field
  empty rather than guessing, and note it in your report.

## Verify, then report

- Spot-check ~10 imported entries against the source (diacritics intact, glosses on
  the right senses, examples attached to the right entries).
- Re-fetch `GET /api/v1/dictionaries/{id}` and confirm the entry count moved by the
  expected amount.
- Reply to the requester with: what was imported, counts, the `import_id`, decisions
  you made (skipped sections, source rows created), and anything needing human review.
