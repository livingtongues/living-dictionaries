# API basics — read this once

The mechanics every job shares: how you authenticate, how multilingual text works,
what the data model is, and the limits. Task guides (`importing`, `cleanup`,
`media`, `corpus`, `consume`) assume you know this and won't repeat it.

## Auth

Every request carries:

```
Authorization: Bearer ldk_…
```

The key is minted by a dictionary manager on their dictionary's Agents page. It is
scoped to **one dictionary** and grants either **read** or **read & write** (read &
write is the default; a read key can only `GET`). A key for dictionary A cannot
touch dictionary B — that's a `403`.

Any standard HTTP client works — curl, Python `requests`/`urllib`, `fetch`. Nothing
about this API is special. Send a descriptive `User-Agent` naming your tool; it
helps us help you when something goes wrong.

## The dictionary id

Every path contains `{id}` — the id (or url-slug) of the dictionary your key is
scoped to. Whoever gave you the key tells you which; it's also the `<id>` in the
dictionary's web URL `livingdictionaries.app/<id>`. Confirm it with:

```
GET /api/v1/dictionaries/{id}
```

A wrong id for your key returns `403`/`404`. Call this first regardless — you need
its `gloss_languages` before you can write a single gloss.

## Multilingual fields (IMPORTANT)

Headwords, glosses, translations, and notes are multilingual. Every such field
accepts **either** a plain string **or** a `{ "<locale>": "text" }` map:

```json
{ "lexeme": "mbwa" }
{ "lexeme": { "default": "mbwa", "ipa": "ᵐbwa" } }
```

- `default` is the **vernacular** — the language being documented. A bare string is
  stored here.
- Gloss-language codes (`en`, `es`, `fr`, …) key **glosses and translations**. Use
  only codes present in the dictionary's `gloss_languages`; add one first with
  `POST …/gloss-languages` if your source glosses in a language not yet listed.
- Additional vernacular writing systems are keyed by the dictionary's
  **orthography** codes (see `…/orthographies`).

Full Unicode — IPA, combining diacritics, non-Latin scripts — is supported and
stored **verbatim**. Never transliterate, never "normalize" or strip diacritics,
never substitute a look-alike ASCII letter. The characters other tools mangle
(ɓ ŋ ɔ ẽ ǃ) are frequently the ones carrying the meaning.

## The data model

- An **entry** is a headword (`lexeme`) plus metadata and one or more **senses**.
- A **sense** is one meaning: `glosses` (short translations keyed by gloss
  language), an optional longer `definition`, `parts_of_speech`,
  `semantic_domains`, and `example_sentences`. Omit `senses` entirely and one empty
  sense is created for you.
- `parts_of_speech` should come from the supported abbreviation list in the
  `SenseInput` schema. Abbreviations and full English names both match
  case-insensitively and store as the canonical lowercase abbreviation (`"N"` /
  `"Noun"` → `"n"`). Anything else stores verbatim — use custom values only for
  genuinely language-specific categories.
- An **example sentence** has vernacular `text` + `translation`(s).
- `dialects` and `tags` are entry-level labels, referenced by name and created
  automatically if new.
- An entry may carry `coordinates` — where-spoken geometry marking where THIS form
  was attested or elicited. A **dialect** has its own `coordinates` for the
  variety's areal extent; set that on the dialect so one polygon isn't repeated
  across thousands of entries.
- A **text** is a separate object: a connected passage/story with its own ORDERED
  sentences. Independent of entries — see the `corpus` guide.

## Idempotency — generate your own ids

**Generate a UUID yourself and send it as `id` on every entry you create.** This is
the single most important habit for a reliable import:

- You know the id up front, so you can record it against your source's id.
- You use it directly for later `PATCH …/entries/{id}` edits — no round-trip to
  discover what got created.
- Re-POSTing the same `id` is a safe **no-op** (`status: "exists"`), so retrying a
  timed-out batch never duplicates.

Deterministic uuid5 of a stable external key works well. The same applies to senses,
sentences, and media rows. `elicitation_id` is a different thing — it's for word-list
/ elicitation ordering, persisted and queryable via `?elicitation_id=`; use it as a
dedupe key only if your source id genuinely *is* elicitation data.

## Batch results & errors

Bulk writes are **per-item best-effort**. `POST …/entries` returns a `results` array
with one item per input entry, in order:

```json
{ "status": "created" | "exists" | "failed", "entry_id": "…", "sense_ids": ["…"], "error": "…" }
```

Read it. Re-send only the `failed` ones. `exists` is success, not a problem.

Standard HTTP status codes otherwise: `400` bad input (the body says what),
`401` missing/invalid key, `403` wrong dictionary or insufficient scope, `404`
absent, `409` a guard tripped (e.g. a stale `confirm_count`).

## Limits

| | |
|---|---|
| Entries (or relationships) per request | ≤ 1000 |
| Non-video request body | ≤ ~16 MB |
| Audio upload | ≤ 25 MB |
| Photo upload | ≤ 10 MB |
| Video upload | ≤ 100 MB (larger → link a `hosted_url`) |

## Reading the reference

The OpenAPI document is large and grows. Fetch a slice, not the whole thing:

- `GET /api/v1/openapi.json` → the **compact index**: every path, its method
  summaries, and its tag, plus the list of schema names. Start here.
- `GET /api/v1/openapi.json?tag=entries` → one group's paths **with** full
  request/response schemas. Tag names are in the index's `tags` list.
- `GET /api/v1/openapi.json?view=full` → everything (~200KB). Rarely what you want.

## Read shape ≠ write shape

A known asymmetry that trips agents verifying their own imports: top-level scalars
you POST come back nested under `entry.main`, and `senses[].example_sentences` come
back as `senses[].sentences`. See the `EntryResponse` schema.

Also: `entry_count` on the dictionary is eventually-consistent and **lags** — it can
read `0` right after a successful bulk POST. Never use it to verify an import;
paginate `/entries` for a live count.
