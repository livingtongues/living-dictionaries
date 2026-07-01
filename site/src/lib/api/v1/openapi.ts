/**
 * OpenAPI 3.1 spec for the agent-facing `/api/v1` write API. Served as JSON from
 * `/api/v1/openapi.json`; this is the COMPREHENSIVE surface an agent fetches and
 * self-configures from (the human-facing page stays a one-liner). Hand-curated
 * (not generated) so the prose is agent-oriented.
 */

export function build_openapi_spec({ origin }: { origin: string }): Record<string, unknown> {
  const MultiString = {
    type: 'object',
    description: 'A multilingual string: a map of locale code → text. Use `default` for the vernacular/headword writing system, and gloss-language codes (e.g. `en`, `es`) for glosses/translations. Most string inputs also accept a plain string, which is wrapped as `{ "default": "…" }`.',
    additionalProperties: { type: 'string' },
    example: { default: 'mbwa', en: 'dog' },
  }

  const StringOrMultiString = { oneOf: [{ type: 'string' }, { $ref: '#/components/schemas/MultiString' }] }
  const StringOrStringArray = { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] }

  const SentenceInput = {
    type: 'object',
    description: 'An example sentence.',
    properties: {
      text: { ...StringOrMultiString, description: 'The sentence in the vernacular.' },
      translation: { ...StringOrMultiString, description: 'Translation(s), keyed by gloss-language code.' },
      sources: { ...StringOrStringArray, description: 'Source slug(s) — each must already exist (create via `POST …/sources`).' },
    },
  }

  const SenseInput = {
    type: 'object',
    description: 'A meaning of the entry.',
    properties: {
      glosses: { ...StringOrMultiString, description: 'Short glosses keyed by gloss-language code.' },
      definition: { ...StringOrMultiString, description: 'Longer definition(s).' },
      parts_of_speech: { ...StringOrStringArray, description: 'POS abbreviation(s), e.g. "n", "v".' },
      semantic_domains: { ...StringOrStringArray, description: 'Semantic domain keys.' },
      write_in_semantic_domains: { ...StringOrStringArray, description: 'Free-text semantic domains.' },
      noun_class: { type: 'string' },
      plural_form: StringOrMultiString,
      variant: StringOrMultiString,
      example_sentences: { type: 'array', items: { $ref: '#/components/schemas/SentenceInput' } },
    },
  }

  const EntryInput = {
    type: 'object',
    required: ['lexeme'],
    description: 'A dictionary entry (headword) with nested senses.',
    properties: {
      external_id: { type: 'string', description: 'Your own source id, echoed back in `results` for id-mapping. NOT stored server-side — keep a local ledger of external_id→entry_id for idempotent/resumable imports. This is the recommended idempotency key.' },
      lexeme: { ...StringOrMultiString, description: 'The headword. Required.' },
      phonetic: { type: 'string' },
      interlinearization: { type: 'string' },
      morphology: { type: 'string' },
      notes: StringOrMultiString,
      linguistic_history: StringOrMultiString,
      sources: { ...StringOrStringArray, description: 'Source slug(s) — each must already exist in this dictionary\'s registry (create via `POST …/sources`); an unknown slug rejects the write.' },
      scientific_names: StringOrStringArray,
      elicitation_id: { type: 'string', description: 'Source-side stable id for word-list/elicitation ordering. Persisted and queryable via `?elicitation_id=`; use it as a server-recoverable dedupe key ONLY if your source id is genuinely elicitation data — for generic import bookkeeping use `external_id` + a local ledger instead.' },
      dialects: { ...StringOrStringArray, description: 'Dialect names — found-or-created on this dictionary.' },
      tags: { ...StringOrStringArray, description: 'Tag names — found-or-created.' },
      senses: { type: 'array', items: { $ref: '#/components/schemas/SenseInput' }, description: 'Defaults to one empty sense if omitted.' },
    },
  }

  const SensePatch = {
    allOf: [{ $ref: '#/components/schemas/SenseInput' }],
    description: 'A sense within a PATCH. With `id` → field-merge that existing sense; without `id` → create a new sense. Example sentences are appended.',
    properties: { id: { type: 'string' } },
  }

  const SentencePatch = {
    type: 'object',
    description: 'Field-merge for one example sentence (`PATCH …/sentences/{id}`). Provided fields overwrite; omitted ones stay.',
    properties: {
      text: { ...StringOrMultiString, description: 'The sentence in the vernacular.' },
      translation: { ...StringOrMultiString, description: 'Translation(s), keyed by gloss-language code.' },
      sources: { ...StringOrStringArray, description: 'Source slug(s) — each must already exist (create via `POST …/sources`).' },
    },
  }

  const EntryPatch = {
    type: 'object',
    description: 'Partial entry update. Provided fields overwrite; omitted ones are untouched. `dialects`/`tags` are ADDITIVE links. `senses` upsert by id.',
    properties: {
      lexeme: StringOrMultiString,
      phonetic: { type: 'string' },
      interlinearization: { type: 'string' },
      morphology: { type: 'string' },
      notes: StringOrMultiString,
      linguistic_history: StringOrMultiString,
      sources: { ...StringOrStringArray, description: 'Source slug(s) — each must already exist (create via `POST …/sources`). Replaces the entry\'s current source list.' },
      scientific_names: StringOrStringArray,
      elicitation_id: { type: 'string' },
      dialects: StringOrStringArray,
      tags: StringOrStringArray,
      senses: { type: 'array', items: { $ref: '#/components/schemas/SensePatch' } },
    },
  }

  const SourceInput = {
    type: 'object',
    required: ['slug'],
    description: 'A citation record in the dictionary\'s source registry. Entries/sentences reference it by `slug`.',
    properties: {
      slug: { type: 'string', description: 'Stable id referenced by entries/sentences. Unique per dictionary.' },
      citation: { type: 'string', description: 'Full display citation.' },
      abbreviation: { type: 'string', description: 'Short label shown in badges + the search facet.' },
      author: { type: 'string' },
      year: { type: 'string', description: 'Text (allows ranges like "1979–1985").' },
      url: { type: 'string' },
      license: { type: 'string' },
      type: { type: 'string', enum: ['dictionary', 'wordlist', 'fieldwork', 'manuscript', 'other'] },
    },
  }

  const EntryWriteResult = {
    type: 'object',
    properties: {
      external_id: { type: 'string', description: 'Echoed from your input, for id-mapping.' },
      status: { type: 'string', enum: ['created', 'updated', 'failed'] },
      entry_id: { type: 'string', description: 'The created entry id (absent on failure).' },
      sense_ids: { type: 'array', items: { type: 'string' } },
      error: { type: 'string', description: 'Why this item failed (absent on success).' },
    },
  }

  const EntriesWriteResponse = {
    type: 'object',
    properties: {
      created: { type: 'integer' },
      updated: { type: 'integer' },
      failed: { type: 'integer' },
      results: { type: 'array', items: { $ref: '#/components/schemas/EntryWriteResult' }, description: 'One per input entry, in order.' },
    },
  }

  const EntrySummary = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      lexeme: { $ref: '#/components/schemas/MultiString' },
      phonetic: { type: 'string', nullable: true },
      elicitation_id: { type: 'string', nullable: true },
      updated_at: { type: 'string', format: 'date-time' },
    },
  }

  const EntriesListResponse = {
    type: 'object',
    properties: {
      entries: { type: 'array', items: { $ref: '#/components/schemas/EntrySummary' } },
      has_more: { type: 'boolean', description: 'True when more rows exist past this page — bump `offset` by `limit` and re-request. Default order is `updated_at` ASC, so paginating to the end gives you every entry (handy for a live count or verifying an import).' },
    },
  }

  // ── READ shape (output) ──────────────────────────────────────────────
  // What GET/PATCH /entries/{id} return. NOTE the input→output asymmetry:
  //  • top-level scalars you POST (lexeme, phonetic, notes, sources, …) are
  //    READ BACK nested under `entry.main`.
  //  • `senses[].example_sentences` you POST are READ BACK as `senses[].sentences`.
  // The shape is the same one the web UI/search use, so it also carries read-only
  // media (audios/photos/videos) and server-managed fields (ids, timestamps).
  const SentenceFull = {
    type: 'object',
    description: 'A stored example sentence (read shape). You POST these under `senses[].example_sentences`; they are returned here under `senses[].sentences`. Edit or remove one by its `id` via `PATCH`/`DELETE …/sentences/{id}`.',
    properties: {
      id: { type: 'string' },
      text: { $ref: '#/components/schemas/MultiString' },
      translation: { $ref: '#/components/schemas/MultiString' },
      text_id: { type: 'string', nullable: true, description: 'Set when the sentence belongs to a longer connected `text`; `null` for a standalone example sentence (the usual case for imports).' },
      sort_key: { type: 'string', nullable: true, description: 'Fractional ordering index within its `text_id`; `null` for standalone example sentences.' },
      ends_paragraph: { type: 'integer', nullable: true, description: '1 when a paragraph break follows this sentence within a `text`; otherwise `null`.' },
      updated_at: { type: 'string', format: 'date-time' },
    },
  }

  const SenseFull = {
    type: 'object',
    description: 'A stored sense (read shape). Mirrors `SenseInput` plus a server-assigned `id`; example sentences come back under `sentences` (not `example_sentences`). Media arrays are read-only and present only when media exists (v1 has no media write endpoints).',
    properties: {
      id: { type: 'string' },
      glosses: { $ref: '#/components/schemas/MultiString' },
      definition: { ...MultiString, nullable: true },
      parts_of_speech: { type: 'array', items: { type: 'string' }, nullable: true },
      semantic_domains: { type: 'array', items: { type: 'string' }, nullable: true },
      write_in_semantic_domains: { type: 'array', items: { type: 'string' }, nullable: true },
      noun_class: { type: 'string', nullable: true },
      plural_form: { ...MultiString, nullable: true },
      variant: { ...MultiString, nullable: true },
      sentences: { type: 'array', items: { $ref: '#/components/schemas/SentenceFull' }, description: 'The sense\'s example sentences. Present only when sentences exist. (Input field name is `example_sentences`.)' },
      photos: { type: 'array', items: { type: 'object' }, description: 'Read-only; present only when present. No v1 write endpoint.' },
      videos: { type: 'array', items: { type: 'object' }, description: 'Read-only; present only when present. No v1 write endpoint.' },
      updated_at: { type: 'string', format: 'date-time' },
      created_at: { type: 'string', format: 'date-time' },
    },
  }

  const EntryMain = {
    type: 'object',
    description: 'The entry\'s top-level scalar fields. These are exactly the fields you POST at the top level of `EntryInput` (lexeme, phonetic, notes, sources, …) — on READ they live here, nested under `entry.main`.',
    properties: {
      lexeme: { $ref: '#/components/schemas/MultiString' },
      phonetic: { type: 'string', nullable: true },
      interlinearization: { type: 'string', nullable: true },
      morphology: { type: 'string', nullable: true },
      notes: { ...MultiString, nullable: true },
      linguistic_history: { ...MultiString, nullable: true },
      sources: { type: 'array', items: { type: 'string' }, nullable: true },
      scientific_names: { type: 'array', items: { type: 'string' }, nullable: true },
      elicitation_id: { type: 'string', nullable: true },
      coordinates: { type: 'object', nullable: true, description: 'Where-spoken geometry, when set.' },
    },
  }

  const EntryFull = {
    type: 'object',
    description: 'A fully-assembled entry (read shape) — the read-side mirror of `EntryInput`. ASYMMETRY: scalars POSTed at the top level are read back under `main`; `senses[].example_sentences` are read back as `senses[].sentences`.',
    properties: {
      id: { type: 'string' },
      main: { $ref: '#/components/schemas/EntryMain' },
      senses: { type: 'array', items: { $ref: '#/components/schemas/SenseFull' } },
      tags: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, private: { type: 'boolean', nullable: true }, updated_at: { type: 'string', format: 'date-time' } } }, description: 'Entry-level tags (includes the `import_id` private tag from a bulk import). Present only when tags exist.' },
      dialects: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, updated_at: { type: 'string', format: 'date-time' } } }, description: 'Present only when dialects exist.' },
      audios: { type: 'array', items: { type: 'object' }, description: 'Read-only; present only when audio exists. No v1 write endpoint.' },
      updated_at: { type: 'string', format: 'date-time' },
    },
  }

  const EntryResponse = {
    type: 'object',
    description: 'Returned by `GET` and `PATCH /entries/{id}`.',
    required: ['entry'],
    properties: { entry: { $ref: '#/components/schemas/EntryFull' } },
  }

  const post_entries_example = {
    import_id: 'swahili-pdf-2026',
    entries: [
      {
        external_id: 'p12-mbwa',
        lexeme: 'mbwa',
        phonetic: 'ˈᵐbwa',
        dialects: ['Coastal'],
        senses: [
          {
            glosses: { en: 'dog', sw: 'mbwa' },
            parts_of_speech: ['n'],
            example_sentences: [{ text: 'Mbwa wangu ni mkubwa', translation: { en: 'My dog is big' } }],
          },
        ],
      },
    ],
  }

  const dict_id_param = {
    name: 'id',
    in: 'path',
    required: true,
    schema: { type: 'string' },
    description: 'Dictionary id or url-slug. Must match the dictionary your API key is scoped to.',
  }
  const entry_id_param = { name: 'entryId', in: 'path', required: true, schema: { type: 'string' } }
  const sentence_id_param = { name: 'sentenceId', in: 'path', required: true, schema: { type: 'string' } }
  const sense_id_param = { name: 'senseId', in: 'path', required: true, schema: { type: 'string' } }
  const tag_id_param = { name: 'tagId', in: 'path', required: true, schema: { type: 'string' } }
  const dialect_id_param = { name: 'dialectId', in: 'path', required: true, schema: { type: 'string' } }
  const source_id_param = { name: 'sourceId', in: 'path', required: true, schema: { type: 'string' } }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Living Dictionaries Write API',
      version: '1.0.0',
      description: [
        'Programmatic, bulk-capable read/write access to a SINGLE Living Dictionary — an agent can do anything a human editor can (add/edit/delete entries with senses, glosses, example sentences, dialects, tags, speakers).',
        '',
        '## Auth',
        'Every request carries `Authorization: Bearer ldk_…` — an API key minted on the dictionary\'s Agents page. A key is scoped to ONE dictionary and grants either **read** or **read & write** access (read & write is the default; a read key can only `GET`). A key for dictionary A cannot touch dictionary B (403).',
        '',
        '## The dictionary id',
        'Every path needs `{id}` — the id (or url-slug) of the dictionary your key is scoped to. Whoever gave you the key tells you the id (it is also the `<id>` in the dictionary\'s web URL `…/<id>`). Confirm it with `GET /api/v1/dictionaries/{id}`; a wrong id for your key returns 403/404.',
        '',
        '## Multilingual fields (IMPORTANT)',
        'Headwords/glosses/translations/notes are multilingual. Every such field accepts EITHER a plain string (stored under the `default` writing system) OR a `{ "<locale>": "text" }` map. Use `default` for the vernacular (the language being documented) and gloss-language codes (e.g. `en`, `es`, `fr`) for glosses & translations. **Call `GET /api/v1/dictionaries/{id}` first to read the dictionary\'s valid `gloss_languages`** and key your glosses by those codes. Full Unicode (IPA, diacritics, non-Latin scripts) is supported and stored verbatim — never transliterate or strip diacritics.',
        '',
        '## Recommended import workflow',
        '1. `GET /api/v1/dictionaries/{id}` → note `gloss_languages` (which locale codes to use). `entry_count` is updated asynchronously and lags — **do not use it to verify a fresh import** (it can read 0 right after a bulk POST). For a live count, paginate `/entries` instead.',
        '2. `POST /api/v1/dictionaries/{id}/entries` with `{ "entries": [ … ], "import_id": "my-import-2026" }` in batches of ≤1000. Give each entry an `external_id` (your own source id) — the response echoes it back mapped to the created `entry_id`. The whole batch shares an `import_id`, which tags every entry with a private tag of that name so you can find/clean the batch later.',
        '3. Read the per-item `results` array. Each item is `{ external_id?, status: "created"|"failed", entry_id?, sense_ids?, error? }`. **Record the `external_id`→`entry_id` map in a local ledger** — that ledger is what makes re-runs idempotent/resumable (skip what you already recorded, re-POST only failures). `external_id` is echoed but not stored server-side, so keep the ledger.',
        '4. Spot-verify with `GET /api/v1/dictionaries/{id}/entries/{entryId}` (returns the full nested entry — the READ shape). Heads-up on the input→output asymmetry: top-level scalars you POST come back nested under `entry.main`, and `senses[].example_sentences` come back as `senses[].sentences`. See the `EntryResponse` schema. (`elicitation_id` is for word-list/elicitation ordering; it is persisted and queryable via `?elicitation_id=`, so use it as a server-recoverable dedupe key only if your source id is genuinely elicitation data — otherwise the `external_id` + ledger approach above is preferred.)',
        '',
        '## Data model',
        'An **entry** is a headword (`lexeme`) plus metadata and one or more **senses**. A **sense** is one meaning: its `glosses` (short translations keyed by gloss-language), an optional longer `definition`, `parts_of_speech`, `semantic_domains`, and `example_sentences`. An **example sentence** has vernacular `text` + `translation`(s). `dialects` and `tags` are entry-level labels (referenced by name; created automatically if new). If you omit `senses`, one empty sense is created.',
        '',
        '## Edits & deletes',
        '`PATCH …/entries/{entryId}` field-merges the entry: provided fields overwrite, omitted ones stay. `senses` upsert by `id` (include the sense `id` to edit it, omit it to add a new sense); example sentences are appended; `dialects`/`tags` are added (never removed) by this call. `DELETE …/entries/{entryId}` removes the entry and its senses.',
        'For surgical, single-row fixes (e.g. correcting ONE OCR typo) read the ids from the entry READ shape (`senses[].id`, `senses[].sentences[].id`, `tags[].id`, `dialects[].id`) and use the dedicated routes:',
        '- `PATCH …/sentences/{sentenceId}` — edit one example sentence\'s `text`/`translation`; `DELETE …/sentences/{sentenceId}` removes it.',
        '- `DELETE …/senses/{senseId}` — delete one sense (refused for an entry\'s LAST sense → delete the entry instead).',
        '- `PATCH …/tags/{tagId}` / `…/dialects/{dialectId}` — rename a tag/dialect (affects EVERY entry it\'s on); `DELETE` removes it globally (unlinks it everywhere).',
        '- `DELETE …/entries/{entryId}/tags/{tagId}` / `…/entries/{entryId}/dialects/{dialectId}` — unlink ONE tag/dialect from ONE entry (it survives on other entries).',
        '',
        '## Scope (v1)',
        'v1 covers entries, senses, example sentences, speakers, tags, and dialects. It does **not** cover media (audio, photos, video) — there are no media write endpoints. Media may appear (read-only) in the entry READ shape if it was added through the web app, but text-only imports never need to touch it.',
        '',
        '## Clients',
        'Any standard HTTP client works (curl, Python `requests`/`urllib`, fetch, etc.) — there is nothing special about this API. Sending a descriptive `User-Agent` (e.g. naming your import tool) is good practice.',
      ].join('\n'),
    },
    servers: [{ url: origin }],
    security: [{ bearerAuth: [] }],
    paths: {
      '/api/v1/dictionaries/{id}': {
        get: {
          summary: 'Dictionary metadata',
          description: 'Returns gloss_languages, orthographies, entry_count, etc. Call this first so glosses/translations use valid locale codes. NOTE: `entry_count` is eventually-consistent (updated asynchronously) — it lags after a bulk import; do not rely on it to verify a fresh import. Paginate `/entries` for a live count.',
          parameters: [dict_id_param],
          responses: { 200: { description: 'Dictionary metadata' }, 401: { description: 'Missing/invalid key' }, 403: { description: 'Key scoped to another dictionary' }, 404: { description: 'Not found' } },
        },
      },
      '/api/v1/dictionaries/{id}/entries': {
        get: {
          summary: 'List/filter entries',
          description: 'Entry summaries for verification / live counts. Ordered by `updated_at` ASC. Paginated via `limit` (default 100, max 500) + `offset`; `has_more` tells you when to fetch the next page. (For idempotent imports, prefer a local `external_id`→`entry_id` ledger over paginating for dedupe.)',
          parameters: [
            dict_id_param,
            { name: 'elicitation_id', in: 'query', schema: { type: 'string' }, description: 'Exact match.' },
            { name: 'lexeme', in: 'query', schema: { type: 'string' }, description: 'Substring match on the headword.' },
            { name: 'updated_since', in: 'query', schema: { type: 'string', format: 'date-time' }, description: 'ISO timestamp, exclusive.' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 100, maximum: 500 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
          ],
          responses: { 200: { description: 'Entry summaries + pagination', content: { 'application/json': { schema: { $ref: '#/components/schemas/EntriesListResponse' } } } } },
        },
        post: {
          summary: 'Create entries (bulk)',
          description: 'Body: a single entry, a bare array, or `{ entries: EntryInput[], import_id? }`. Max 1000/request. Per-item best-effort — read `results` for per-entry outcomes.',
          parameters: [dict_id_param],
          requestBody: {
            required: true,
            content: { 'application/json': {
              schema: {
                oneOf: [
                  { $ref: '#/components/schemas/EntryInput' },
                  { type: 'array', items: { $ref: '#/components/schemas/EntryInput' } },
                  { type: 'object', properties: { entries: { type: 'array', items: { $ref: '#/components/schemas/EntryInput' } }, import_id: { type: 'string' } }, required: ['entries'] },
                ],
              },
              example: post_entries_example,
            } },
          },
          responses: { 200: { description: 'Per-item write report', content: { 'application/json': { schema: { $ref: '#/components/schemas/EntriesWriteResponse' } } } }, 400: { description: 'Bad input' }, 401: { description: 'Missing/invalid key' }, 403: { description: 'Insufficient role or wrong dictionary' } },
        },
      },
      '/api/v1/dictionaries/{id}/entries/{entryId}': {
        get: { summary: 'Read one entry (full nested)', description: 'Returns the full nested entry (the READ shape — see `EntryResponse`). NOTE the input→output asymmetry: scalars you POST at the top level are read back under `entry.main`; `senses[].example_sentences` are read back as `senses[].sentences`.', parameters: [dict_id_param, entry_id_param], responses: { 200: { description: 'The full nested entry', content: { 'application/json': { schema: { $ref: '#/components/schemas/EntryResponse' } } } }, 404: { description: 'Not found' } } },
        patch: {
          summary: 'Update an entry (field-merge)',
          description: 'Field-merge: provided fields overwrite, omitted ones stay. `senses` upsert by `id` (no id → create a new sense); example sentences are APPENDED; `dialects`/`tags` are additive links (this call never removes them). For surgical single-row edits/deletes — one sentence, sense, tag, or dialect — use the dedicated `…/sentences/{id}`, `…/senses/{id}`, `…/tags/{id}`, `…/dialects/{id}` routes (see "Edits & deletes"). Returns the updated entry in the READ shape (`EntryResponse`).',
          parameters: [dict_id_param, entry_id_param],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/EntryPatch' } } } },
          responses: { 200: { description: 'The updated nested entry', content: { 'application/json': { schema: { $ref: '#/components/schemas/EntryResponse' } } } }, 400: {}, 404: {} },
        },
        delete: { summary: 'Delete an entry (cascades senses/junctions)', parameters: [dict_id_param, entry_id_param], responses: { 200: { description: "{ result: 'deleted' }" }, 404: {} } },
      },
      '/api/v1/dictionaries/{id}/entries/{entryId}/tags/{tagId}': {
        delete: { summary: 'Unlink a tag from this entry', description: 'Removes ONE tag from ONE entry; the tag (and its links to other entries) survives. To delete the tag everywhere use `DELETE …/tags/{tagId}`.', parameters: [dict_id_param, entry_id_param, tag_id_param], responses: { 200: { description: "{ result: 'unlinked' }" }, 404: { description: 'Tag not linked to this entry' } } },
      },
      '/api/v1/dictionaries/{id}/entries/{entryId}/dialects/{dialectId}': {
        delete: { summary: 'Unlink a dialect from this entry', description: 'Removes ONE dialect from ONE entry; the dialect survives globally. To delete it everywhere use `DELETE …/dialects/{dialectId}`.', parameters: [dict_id_param, entry_id_param, dialect_id_param], responses: { 200: { description: "{ result: 'unlinked' }" }, 404: { description: 'Dialect not linked to this entry' } } },
      },
      '/api/v1/dictionaries/{id}/sentences/{sentenceId}': {
        patch: {
          summary: 'Edit one example sentence',
          description: 'Field-merge `text` / `translation` for a single example sentence — the surgical OCR-typo fix. Read its id from `senses[].sentences[].id` in the entry READ shape. Returns `{ sentence }`.',
          parameters: [dict_id_param, sentence_id_param],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SentencePatch' } } } },
          responses: { 200: { description: 'The updated sentence', content: { 'application/json': { schema: { type: 'object', properties: { sentence: { $ref: '#/components/schemas/SentenceFull' } } } } } }, 400: {}, 404: {} },
        },
        delete: { summary: 'Delete one example sentence', description: 'Deletes the sentence and its sense links.', parameters: [dict_id_param, sentence_id_param], responses: { 200: { description: "{ result: 'deleted' }" }, 404: {} } },
      },
      '/api/v1/dictionaries/{id}/senses/{senseId}': {
        delete: { summary: 'Delete one sense', description: 'Deletes a single sense and its sentence/media links. Refused (400) when it is the entry\'s ONLY sense — delete the entry instead.', parameters: [dict_id_param, sense_id_param], responses: { 200: { description: "{ result: 'deleted' }" }, 400: { description: "Can't delete an entry's only sense" }, 404: {} } },
      },
      '/api/v1/dictionaries/{id}/speakers': {
        get: { summary: 'List speakers', parameters: [dict_id_param], responses: { 200: { description: '{ speakers }' } } },
        post: {
          summary: 'Create a speaker',
          parameters: [dict_id_param],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, decade: { type: 'integer' }, gender: { type: 'string', enum: ['m', 'f', 'o'] }, birthplace: { type: 'string' } } } } } },
          responses: { 200: { description: '{ speaker }' } },
        },
      },
      '/api/v1/dictionaries/{id}/tags': {
        get: { summary: 'List tags', parameters: [dict_id_param], responses: { 200: { description: '{ tags }' } } },
        post: { summary: 'Find-or-create a tag', parameters: [dict_id_param], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, private: { type: 'boolean' } } } } } }, responses: { 200: { description: '{ tag, created }' } } },
      },
      '/api/v1/dictionaries/{id}/tags/{tagId}': {
        patch: { summary: 'Rename a tag / set private', description: 'Renames the tag and/or flips its `private` flag. Affects EVERY entry the tag is on. Returns `{ tag }`.', parameters: [dict_id_param, tag_id_param], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, private: { type: 'boolean' } } } } } }, responses: { 200: { description: '{ tag }' }, 400: { description: 'Name collides with another tag' }, 404: {} } },
        delete: { summary: 'Delete a tag (globally)', description: 'Deletes the tag and unlinks it from every entry. To remove it from just one entry use `DELETE …/entries/{entryId}/tags/{tagId}`.', parameters: [dict_id_param, tag_id_param], responses: { 200: { description: "{ result: 'deleted' }" }, 404: {} } },
      },
      '/api/v1/dictionaries/{id}/dialects': {
        get: { summary: 'List dialects', parameters: [dict_id_param], responses: { 200: { description: '{ dialects }' } } },
        post: { summary: 'Find-or-create a dialect', parameters: [dict_id_param], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } } } } }, responses: { 200: { description: '{ dialect, created }' } } },
      },
      '/api/v1/dictionaries/{id}/dialects/{dialectId}': {
        patch: { summary: 'Rename a dialect', description: 'Renames the dialect (plain string or locale map). Affects EVERY entry it is on. Returns `{ dialect }`.', parameters: [dict_id_param, dialect_id_param], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: StringOrMultiString } } } } }, responses: { 200: { description: '{ dialect }' }, 400: { description: 'Name collides with another dialect' }, 404: {} } },
        delete: { summary: 'Delete a dialect (globally)', description: 'Deletes the dialect and unlinks it from every entry. To remove it from just one entry use `DELETE …/entries/{entryId}/dialects/{dialectId}`.', parameters: [dict_id_param, dialect_id_param], responses: { 200: { description: "{ result: 'deleted' }" }, 404: {} } },
      },
      '/api/v1/dictionaries/{id}/sources': {
        get: { summary: 'List sources', description: 'The dictionary\'s citation registry, each with `used_by` reference counts.', parameters: [dict_id_param], responses: { 200: { description: '{ sources }' } } },
        post: { summary: 'Create a source', description: 'Adds a citation record. `slug` is required and must be unique. Entries/sentences reference sources by slug, so create sources here BEFORE citing them on a write (an unknown slug rejects the write).', parameters: [dict_id_param], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SourceInput' } } } }, responses: { 200: { description: '{ source }' }, 400: { description: 'Missing/duplicate slug or invalid type' } } },
      },
      '/api/v1/dictionaries/{id}/sources/{sourceId}': {
        patch: { summary: 'Edit source metadata', description: 'Field-merges citation metadata (and optionally renames the `slug`). Avoid renaming a slug that is already in use — the rename does not rewrite referencing rows.', parameters: [dict_id_param, source_id_param], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SourceInput' } } } }, responses: { 200: { description: '{ source }' }, 400: { description: 'Slug collision or invalid type' }, 404: {} } },
        delete: { summary: 'Delete a source', description: 'Refuses with 409 while the source is still referenced. Pass `?remove_from_all=true` to strip the slug from every referencing entry/sentence/text first and then delete.', parameters: [dict_id_param, source_id_param, { name: 'remove_from_all', in: 'query', required: false, schema: { type: 'boolean' } }], responses: { 200: { description: "{ result: 'deleted', removed_from }" }, 409: { description: 'Still referenced (retry with remove_from_all)' }, 404: {} } },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', description: 'A Living Dictionaries API key (`ldk_…`) minted in the dictionary Settings.' },
      },
      schemas: {
        MultiString,
        SentenceInput,
        SenseInput,
        EntryInput,
        SensePatch,
        SentencePatch,
        EntryPatch,
        SourceInput,
        EntryWriteResult,
        EntriesWriteResponse,
        EntrySummary,
        EntriesListResponse,
        SentenceFull,
        SenseFull,
        EntryMain,
        EntryFull,
        EntryResponse,
      },
    },
  }
}
