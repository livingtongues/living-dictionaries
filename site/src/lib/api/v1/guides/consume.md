# Reading a dictionary — apps, analysis, mirrors

You're feeding something that READS this dictionary: a language-learning or
flashcard app, a corpus analysis, a mirror, a study tool. You need bulk data out,
not writes in.

**Don't paginate the API.** Download the dictionary's whole SQLite snapshot and
query it locally — one HTTP request, no key needed, every table with real joins
instead of thousands of round-trips.

Two things to respect while you build:

- **These are living communities' languages.** Attribute the dictionary, link back
  to it, and don't present its content as your own. Audio recordings are of real
  named people.
- **Never round-trip the snapshot's rows back through the write API.** It is a read
  mirror; pushing it back will fight the humans editing the real thing.

## The URL

```
https://snapshots.livingdictionaries.app/dictionaries/{id}.db.gz
```

- No auth. Use the dictionary **id**, not the url slug, if they differ (read the id
  from `GET /api/v1/dictionaries/{slug}`).
- If the file 404s, that dictionary has no public snapshot — paginate the API instead.

## Loading it

```bash
curl -sL https://snapshots.livingdictionaries.app/dictionaries/{id}.db.gz | gunzip > dict.db
sqlite3 dict.db "SELECT COUNT(*) FROM entries"
```

Or in Python:

```python
import gzip, sqlite3, urllib.request
with urllib.request.urlopen(url) as response:
    open('dict.db', 'wb').write(gzip.decompress(response.read()))
db = sqlite3.connect('file:dict.db?mode=ro', uri=True)
```

Open it **read-only**: the snapshot is a read mirror — never write to it, and never
send its rows back through the write API wholesale.

## Key tables

| Table | What it holds |
|---|---|
| `entries` | headwords: `lexeme` (JSON locale→text), `homograph`, `phonetic`, `notes`, `sources` (JSON slug array), `citations`, `coordinates`, `elicitation_id` |
| `senses` | meanings per entry (`entry_id` FK): `glosses`, `definition`, `parts_of_speech`, `semantic_domains`, `sources` |
| `sentences` | examples + text lines: `text`, `translation`, `tokens` (interlinear), `text_id` + `sort_key` when part of a text |
| `senses_in_sentences` | sense ↔ example-sentence junction |
| `texts` | connected passages: `title`, `summary`, `sources`, `citations`, `work_id` (parallel-version grouping) |
| `audio` | media rows that link DIRECTLY by `entry_id` / `sentence_id` / `text_id`; `storage_path` (fetch bytes via `GET …/media/{storage_path}` on the API) + `timings` (karaoke word timings) |
| `photos` / `videos` | media rows with NO owner column — join through `sense_photos`, `sentence_photos`, `sense_videos`, `sentence_videos` (videos also carry `text_id` directly) |
| `speakers`, `audio_speakers`, `video_speakers` | attribution |
| `dialects`, `entry_dialects`, `text_dialects` | variety labels + links |
| `tags`, `entry_tags`, `text_tags` | labels incl. `import_id` batch tags |
| `sources` | the citation registry the slug arrays reference |
| `entry_relationships`, `relationship_types` | typed entry↔entry links (globals like `synonym`/`hypernym` plus per-dictionary custom types) |
| `grammar_sections`, `clause_slots`, `glossing_abbreviations`, `section_sentences` | structured grammar + the sentences cited in each section |
| `featured_entries` | the curated entries pinned on the dictionary's home page |
| `ignored_forms` | dictionary-level "ignore everywhere" word forms the matcher skips (see the `suggestions` API group) |

Multilingual columns are JSON `{ "<locale>": "text" }`; array columns are JSON
arrays. `sqlite3`'s `json_each`/`json_extract` make these queryable directly.

## Freshness

The snapshot is rebuilt within **~30 minutes** of any edit (a 30-minute sweep that
only rebuilds when content actually changed) and CDN-cached briefly. Treat it as at
most ~30 minutes stale — and always verify your OWN fresh writes via the write
API's responses, never via the snapshot.

## Media bytes

The snapshot carries media **rows**, not media bytes. Each `audio` / `photos` /
`videos` row has a `storage_path`; fetch the actual file with:

```
GET /api/v1/dictionaries/{id}/media/{storage_path}
```

which 302-redirects to storage. Photos also exist as pre-generated WebP variants
(`_thumb`, `_w900`, `_w1600`) — use the smallest that suits your UI rather than the
original.

## When to use the API instead of the snapshot

- **No snapshot available** (the `.db.gz` 404s) — paginate the API with a read key.
- **Small targeted lookups** — a handful of entries by id or lexeme. `GET
  …/entries?lexeme=…&match=exact` is cheaper than a 40MB download.
- **Incremental catch-up** — `GET …/entries?updated_since=<ISO>` returns only what
  changed, ordered by `updated_at ASC`. Good for keeping a mirror warm between
  snapshot refreshes.
- **Verifying your own writes** — always the API, never the snapshot.

A read-only key is enough for all of these; ask your human for a **read** key rather
than a read & write one if you never write.
