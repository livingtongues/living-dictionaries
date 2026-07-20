# Bulk reads via dictionary snapshots

Mirroring, analyzing, or bulk-reading a whole dictionary? Don't paginate the API —
download the dictionary's SQLite snapshot and query it locally.

## The URL

```
https://snapshots.livingdictionaries.app/dictionaries/{id}.db.gz
```

- No auth. Use the dictionary **id**, not the url slug, if they differ (read the id
  from `GET /api/v1/dictionaries/{slug}`).
- Every dictionary has one **except secure dictionaries** (restricted-access
  communities) — those have no public snapshot; paginate the API instead.

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
| `audio` / `photos` / `videos` | media rows (`storage_path` — fetch bytes via `GET …/media/{storage_path}` on the API) |
| `speakers`, `audio_speakers`, `video_speakers` | attribution |
| `dialects`, `entry_dialects`, `text_dialects` | variety labels + links |
| `tags`, `entry_tags`, `text_tags` | labels incl. `import_id` batch tags |
| `sources` | the citation registry the slug arrays reference |
| `entry_relationships`, `relationship_types` | typed entry↔entry links |
| `grammar_sections`, `clause_slots`, `glossing_abbreviations` | structured grammar |

Multilingual columns are JSON `{ "<locale>": "text" }`; array columns are JSON
arrays. `sqlite3`'s `json_each`/`json_extract` make these queryable directly.

## Freshness

The snapshot is rebuilt within **~30 minutes** of any edit (a 30-minute sweep that
only rebuilds when content actually changed) and CDN-cached briefly. Treat it as at
most ~30 minutes stale — and always verify your OWN fresh writes via the write
API's responses, never via the snapshot.
