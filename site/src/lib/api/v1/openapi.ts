/**
 * OpenAPI 3.1 spec for the agent-facing `/api/v1` write API. Served as JSON from
 * `/api/v1/openapi.json`; this is the COMPREHENSIVE surface an agent fetches and
 * self-configures from (the human-facing page stays a one-liner). Hand-curated
 * (not generated) so the prose is agent-oriented.
 */

import { DISCOURSE_ROLES, RELATIONSHIP_TYPES, SOURCE_TYPES } from '$lib/constants'
import { partsOfSpeech } from '$lib/mappings/parts-of-speech'

export function build_openapi_spec({ origin }: { origin: string }): Record<string, unknown> {
  const MultiString = {
    type: 'object',
    description: 'A multilingual string: a map of locale code → text. Use `default` for the vernacular/headword writing system, and gloss-language codes (e.g. `en`, `es`) for glosses/translations. Most string inputs also accept a plain string, which is wrapped as `{ "default": "…" }`.',
    additionalProperties: { type: 'string' },
    example: { default: 'mbwa', en: 'dog' },
  }

  const StringOrMultiString = { oneOf: [{ type: 'string' }, { $ref: '#/components/schemas/MultiString' }] }
  const StringOrStringArray = { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] }

  const client_id_prop = { type: 'string', format: 'uuid', description: 'Optional client-generated UUID (any version — deterministic uuid5 ids work well). Supply it to know the id up front (for later edits) and to make writes idempotent — re-sending the same id is a safe no-op. Omit → the server mints one.' }

  const LngLat = {
    type: 'object',
    required: ['longitude', 'latitude'],
    description: 'A single WGS-84 geographic point.',
    properties: {
      longitude: { type: 'number', minimum: -180, maximum: 180, description: 'Decimal degrees east, −180…180.' },
      latitude: { type: 'number', minimum: -90, maximum: 90, description: 'Decimal degrees north, −90…90.' },
    },
    example: { longitude: 77.2, latitude: 28.6 },
  }
  const GeoPoint = {
    type: 'object',
    required: ['coordinates'],
    description: 'A single located point (e.g. one elicitation/survey village).',
    properties: {
      coordinates: { $ref: '#/components/schemas/LngLat' },
      label: { type: 'string', description: 'Optional display label (e.g. the village name).' },
      color: { type: 'string', description: 'Optional marker color (any CSS color string).' },
    },
  }
  const GeoRegion = {
    type: 'object',
    required: ['coordinates'],
    description: 'A closed area, given as its ring of vertices (3–100).',
    properties: {
      coordinates: { type: 'array', items: { $ref: '#/components/schemas/LngLat' }, minItems: 3, maxItems: 100, description: 'Ring vertices; at least 3.' },
      label: { type: 'string' },
      color: { type: 'string' },
    },
  }
  const Coordinates = {
    type: 'object',
    description: 'Where-spoken geometry, `{ points?, regions? }`. On an ENTRY these are the attestation/elicitation location(s) of that specific form; on a DIALECT they are the variety\'s areal extent (set once on the dialect, not repeated per entry). Longitude/latitude are validated to their real-world ranges; a bad point rejects the write. Limits: ≤100 points, ≤20 regions, each region 3–100 vertices. On PATCH the whole object is REPLACED — send `null` to clear, or omit the field to leave it untouched.',
    properties: {
      points: { type: 'array', items: { $ref: '#/components/schemas/GeoPoint' }, maxItems: 100 },
      regions: { type: 'array', items: { $ref: '#/components/schemas/GeoRegion' }, maxItems: 20 },
    },
    example: { points: [{ coordinates: { longitude: 77.2, latitude: 28.6 }, label: 'Khirsu' }] },
  }
  const CoordinatesNullableRef = { oneOf: [{ $ref: '#/components/schemas/Coordinates' }, { type: 'null' }] }

  // Interlinear-glossing (IGT) + discourse fields shared by every sentence-write
  // shape (SentenceInput / TextSentenceInput / SentencePatch). Turns a sentence
  // into a first-class interlinear unit: the default-orthography token list is the
  // SHARED index the gloss line, word→entry taps, AND `audio.timings` karaoke all
  // align to 1:1. When `tokens` are omitted the server auto-matches as today.
  const sentence_igt_props = {
    tokens: { type: 'object', additionalProperties: { type: 'array', items: { $ref: '#/components/schemas/SentenceTokenInput' } }, description: 'Orthography code → ordered token list (usually just `default`, the vernacular line) — the GOLD alignment from a glossed source, carrying the per-token gloss line + optional morphemes. If the sentence `text` for an orthography is omitted but its tokens are supplied, the server builds `text` by joining the token `form`s with a space — so a rows-only glossed source (aligned `[form, gloss]` rows, no separate vernacular line) imports without pre-assembling the text.' },
    citations: { type: 'array', items: { $ref: '#/components/schemas/SourceCitation' }, description: 'Source refs with a citation locus (page/example number) — complements the bare `sources[]` membership. Each `slug` must already exist in the source registry.' },
    example_label: { type: 'string', nullable: true, description: 'The author\'s own example number (e.g. "(2a)") for cross-referencing within a grammar.' },
    discourse_role: { type: 'string', enum: DISCOURSE_ROLES, nullable: true, description: 'Discourse salience / information role — lets a narrative render foreground vs. background and a grammar section point at the role a particle signals.' },
  }

  const SentenceInput = {
    type: 'object',
    description: 'A sentence write/reference. With content fields, creates or field-merges the sentence. Nested under a sense, `{ id: "<existing sentence UUID>" }` alone links that existing sentence without rewriting it; an unknown id-only reference fails loudly.',
    properties: {
      id: client_id_prop,
      text: { ...StringOrMultiString, description: 'The sentence in the vernacular.' },
      translation: { ...StringOrMultiString, description: 'Translation(s), keyed by gloss-language code.' },
      sources: { ...StringOrStringArray, description: 'Source slug(s) — each must already exist (create via `POST …/sources`).' },
      ...sentence_igt_props,
    },
  }

  const SenseInput = {
    type: 'object',
    description: 'A meaning of the entry.',
    properties: {
      id: client_id_prop,
      glosses: { ...StringOrMultiString, description: 'Short glosses keyed by gloss-language code.' },
      definition: { ...StringOrMultiString, description: 'Longer definition(s).' },
      parts_of_speech: { ...StringOrStringArray, description: `POS abbreviation(s). Send the abbreviation or its full English name — both are matched case-insensitively and stored as the canonical lowercase abbreviation ("N" / "Noun" → "n"). Values outside this list are stored verbatim, so only use custom values for genuinely language-specific categories. Supported: ${partsOfSpeech.map(({ enAbbrev, enName }) => `${enAbbrev} (${enName})`).join(', ')}.` },
      semantic_domains: { ...StringOrStringArray, description: 'Semantic domain keys.' },
      write_in_semantic_domains: { ...StringOrStringArray, description: 'Free-text semantic domains.' },
      noun_class: { type: 'string' },
      plural_form: StringOrMultiString,
      variant: StringOrMultiString,
      sources: { ...StringOrStringArray, description: 'Source slug(s) for THIS sense — per-sense provenance when an entry\'s senses are merged from several sources. Each must already exist (create via `POST …/sources`).' },
      example_sentences: { type: 'array', items: { $ref: '#/components/schemas/SentenceInput' }, description: 'Sentence content to create/upsert, or `{ id }` alone to link an existing sentence. Re-linking is idempotent; an unknown id-only reference fails.' },
    },
  }

  const EntryInput = {
    type: 'object',
    required: ['lexeme'],
    description: 'A dictionary entry (headword) with nested senses.',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Optional client-generated UUID (any version — deterministic uuid5 ids work well) — THE idempotency key. Generate it yourself and a re-POST of the same entry is a safe no-op (`status: "exists"`) instead of a duplicate, and you already know the id for later `PATCH …/entries/{id}` edits (no round-trip to discover it). Omit → the server mints one. Must be a valid UUID if provided.' },
      lexeme: { ...StringOrMultiString, description: 'The headword. Required.' },
      homograph: { type: 'string', description: 'Homograph number for identically-spelled headwords — "1", "2" (some sources use "a"/"b"). Rendered as a superscript after the lexeme, so deliberate homographs are distinguishable from accidental duplicates. Orthogonal to the `homophone` relationship type (differently-spelled words that sound alike).' },
      phonetic: { type: 'string' },
      interlinearization: { type: 'string' },
      morphology: { type: 'string' },
      notes: { ...StringOrMultiString, description: 'Rich text stored as MARKDOWN (headings/bold/lists/links) — write markdown, not HTML.' },
      linguistic_history: StringOrMultiString,
      sources: { ...StringOrStringArray, description: 'Source slug(s) — each must already exist in this dictionary\'s registry (create via `POST …/sources`); an unknown slug rejects the write.' },
      citations: { type: 'array', items: { $ref: '#/components/schemas/SourceCitation' }, description: 'Source refs WITH a citation locus (the page/example number this entry came from — always known for scanned dictionaries). Complements the bare `sources` slugs.' },
      scientific_names: StringOrStringArray,
      elicitation_id: { type: 'string', description: 'Source-side stable id for word-list/elicitation ordering. Persisted and queryable via `?elicitation_id=`; use it as a server-recoverable dedupe key ONLY if your source id is genuinely elicitation data — for generic idempotency, supply your own `id` instead.' },
      coordinates: { ...CoordinatesNullableRef, description: 'Where-spoken geometry for this form: the attestation/elicitation point(s) (and/or region[s]). See the `Coordinates` schema.' },
      dialects: { ...StringOrStringArray, description: 'Dialect names — found-or-created on this dictionary.' },
      tags: { ...StringOrStringArray, description: 'Tag names — found-or-created.' },
      senses: { type: 'array', items: { $ref: '#/components/schemas/SenseInput' }, description: 'Defaults to one empty sense if omitted.' },
    },
  }

  const SensePatch = {
    allOf: [{ $ref: '#/components/schemas/SenseInput' }],
    description: 'A sense within a PATCH — a true upsert by client id. With an `id` already on this entry → field-merge that sense; with an unknown `id` (or none) → create the sense WITH that id (deterministic import ids keep addressing the same sense across re-syncs). An `id` belonging to a different entry is a 400. Example sentences upsert by id; `{ id }` alone links an existing sentence without rewriting it, existing links are not duplicated, and an unknown id-only reference is a 400.',
    properties: { id: { type: 'string' } },
  }

  const SentencePatch = {
    type: 'object',
    description: 'Field-merge for one sentence (`PATCH …/sentences/{id}`) — works on both an entry\'s example sentence and a text-sentence. Provided fields overwrite; omitted ones stay.',
    properties: {
      text: { ...StringOrMultiString, description: 'The sentence in the vernacular.' },
      translation: { ...StringOrMultiString, description: 'Translation(s), keyed by gloss-language code.' },
      sources: { ...StringOrStringArray, description: 'Source slug(s) — each must already exist (create via `POST …/sources`).' },
      ends_paragraph: { type: 'boolean', description: 'For a text-sentence: whether a paragraph break follows it.' },
      ...sentence_igt_props,
    },
  }

  const EntryPatch = {
    type: 'object',
    description: 'Partial entry update. Provided fields overwrite; omitted ones are untouched. `dialects`/`tags` are ADDITIVE links. `senses` upsert by client id (unknown id → created with that id — see SensePatch). Within a sense, `example_sentences: [{ id }]` links an existing sentence by reference without copying its content.',
    properties: {
      lexeme: StringOrMultiString,
      homograph: { type: 'string', description: 'Homograph number ("1", "2", …); empty string clears.' },
      phonetic: { type: 'string' },
      interlinearization: { type: 'string' },
      morphology: { type: 'string' },
      notes: { ...StringOrMultiString, description: 'Rich text stored as MARKDOWN (headings/bold/lists/links) — write markdown, not HTML.' },
      linguistic_history: StringOrMultiString,
      sources: { ...StringOrStringArray, description: 'Source slug(s) — each must already exist (create via `POST …/sources`). Replaces the entry\'s current source list.' },
      citations: { type: 'array', items: { $ref: '#/components/schemas/SourceCitation' }, description: 'Whole-array replace of the entry\'s citation loci.' },
      scientific_names: StringOrStringArray,
      elicitation_id: { type: 'string' },
      coordinates: { ...CoordinatesNullableRef, description: 'Whole-object replace: `{ points?, regions? }` overwrites; `null` clears; omit → untouched.' },
      dialects: StringOrStringArray,
      tags: StringOrStringArray,
      senses: { type: 'array', items: { $ref: '#/components/schemas/SensePatch' } },
    },
  }

  const OrthographyInput = {
    type: 'object',
    required: ['code'],
    description: 'An alternate writing system. Its `code` is the immutable key each entry\'s `lexeme` (and each sentence\'s `text`) stores this spelling under.',
    properties: {
      code: { type: 'string', description: 'Immutable key. Prefer a BCP-47 tag (e.g. `sat-Olck`) — if it matches a Keyman-supported writing system it wires up a keyboard automatically; otherwise a custom slug (letters/numbers/hyphens). `default` (the primary headword) and `lo{n}` are reserved.' },
      name: { type: 'string', description: 'Editable display label.' },
      bcp: { type: 'string', description: 'BCP-47 tag driving the Keyman keyboard. Defaults to `code` when `code` is a known writing system.' },
      notes: { type: 'string' },
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
      type: { type: 'string', enum: [...SOURCE_TYPES] },
      orthography: { type: 'string', nullable: true, description: 'Which writing system this source\'s forms use — an orthography `code` from the dictionary\'s `orthographies` (or `default`), so multiple romanizations/scripts across a corpus are not conflated.' },
    },
  }

  const SourceFile = {
    type: 'object',
    description: 'An uploaded import resource (any format — spreadsheet, FLEx/LIFT export, PDF scan…). Bytes download from `GET …/files/{fileId}`. `import_instructions` is the uploader\'s authoritative brief for the import; `source_note` is their (optional) citation info. After importing, link the file to its permanent `sources` registry row via `PATCH …/files/{fileId}` with `source_id` when the resource is a real citable source.',
    properties: {
      id: { type: 'string', format: 'uuid' },
      dictionary_id: { type: 'string' },
      source_id: { type: 'string', nullable: true, description: 'The dict `sources.id` this file is filed under, once linked.' },
      filename: { type: 'string' },
      mimetype: { type: 'string' },
      size_bytes: { type: 'integer' },
      import_instructions: { type: 'string', nullable: true },
      source_note: { type: 'string', nullable: true },
      upload_confirmed_at: { type: 'string', format: 'date-time', nullable: true },
      import_requested_at: { type: 'string', format: 'date-time', nullable: true },
      import_thread_id: { type: 'string', format: 'uuid', nullable: true },
      uploaded_by_user_id: { type: 'string' },
      can_manage_requested: { type: 'boolean', description: 'Whether this caller may edit/delete the resource after import was requested (original uploader or site admin).' },
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' },
    },
  }

  const ImportRequest = {
    type: 'object',
    description: 'One import-request batch. Multiple source files can share this thread and its editable overall note.',
    properties: {
      thread_id: { type: 'string', format: 'uuid' },
      request_note: { type: 'string', nullable: true },
      requested_at: { type: 'string', format: 'date-time' },
      can_manage: { type: 'boolean', description: 'Whether this caller may edit the request note (original requester or site admin).' },
    },
  }

  const EntryWriteResult = {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['created', 'exists', 'updated', 'failed'], description: '`created` = new entry written; `exists` = a client-supplied `id` already existed, so this item was skipped (idempotent no-op — edit via PATCH); `failed` = see `error`.' },
      entry_id: { type: 'string', description: 'The entry id (the client-supplied one when given). Absent only on a pre-id failure.' },
      sense_ids: { type: 'array', items: { type: 'string' } },
      error: { type: 'string', description: 'Why this item failed (absent on success).' },
    },
  }

  const EntriesWriteResponse = {
    type: 'object',
    properties: {
      created: { type: 'integer' },
      skipped: { type: 'integer', description: 'Items skipped because their client-supplied `id` already existed.' },
      updated: { type: 'integer' },
      failed: { type: 'integer' },
      results: { type: 'array', items: { $ref: '#/components/schemas/EntryWriteResult' }, description: 'One per input entry, in order.' },
    },
  }

  const SenseSummary = {
    type: 'object',
    description: 'A sense\'s meaning fields — attached to list rows only when `?include=senses`.',
    properties: {
      id: { type: 'string' },
      glosses: { ...MultiString, nullable: true },
      definition: { ...MultiString, nullable: true },
      parts_of_speech: { type: 'array', items: { type: 'string' }, nullable: true },
      semantic_domains: { type: 'array', items: { type: 'string' }, nullable: true },
    },
  }

  const EntrySummary = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      lexeme: { $ref: '#/components/schemas/MultiString' },
      homograph: { type: 'string', nullable: true },
      phonetic: { type: 'string', nullable: true },
      elicitation_id: { type: 'string', nullable: true },
      sources: { type: 'array', items: { type: 'string' }, nullable: true, description: 'Entry-level source slugs — always included, so provenance checks don\'t need per-entry detail fetches.' },
      updated_at: { type: 'string', format: 'date-time' },
      senses: { type: 'array', items: { $ref: '#/components/schemas/SenseSummary' }, description: 'Present only when the request passes `?include=senses`.' },
    },
  }

  const TextSentenceInput = {
    type: 'object',
    description: 'One sentence within a text (a connected story/passage). Ordered by array position on create.',
    properties: {
      id: client_id_prop,
      text: { ...StringOrMultiString, description: 'The sentence in the vernacular.' },
      translation: { ...StringOrMultiString, description: 'Translation(s), keyed by gloss-language code.' },
      sources: { ...StringOrStringArray, description: 'Source slug(s) — each must already exist.' },
      ends_paragraph: { type: 'boolean', description: 'Whether a paragraph break follows this sentence.' },
      ...sentence_igt_props,
    },
  }

  const TextInput = {
    type: 'object',
    required: ['title'],
    description: 'A text (long connected passage/story) with ordered sentences. Text-level metadata (sources, citations, summary, dialects, work_id) lives HERE — don\'t repeat it on every sentence.',
    properties: {
      id: client_id_prop,
      title: { ...StringOrMultiString, description: 'The text\'s title. Required.' },
      sources: { ...StringOrStringArray, description: 'Source slug(s) for the whole text — each must already exist (create via `POST …/sources`).' },
      citations: { type: 'array', items: { $ref: '#/components/schemas/SourceCitation' }, description: 'Source refs WITH a citation locus (page / hymn number).' },
      summary: { ...StringOrMultiString, description: 'Synopsis/abstract of the text, per language.' },
      dialects: { ...StringOrStringArray, description: 'Dialect name(s) this text version is written in — found-or-created, linked via the text↔dialect junction.' },
      work_id: { type: 'string', description: 'Parallel-texts grouping key: texts sharing a `work_id` are versions of ONE work (e.g. the same hymn in two dialects, each with its own wording + audio). Mint any stable id for the first version and reuse it on the others; reads then include `parallel_texts` siblings.' },
      sentences: { type: 'array', items: { $ref: '#/components/schemas/TextSentenceInput' }, description: 'Ordered sentences — sort_keys are assigned in array order.' },
    },
  }

  const TextSentenceFull = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      text: { ...MultiString, nullable: true },
      translation: { ...MultiString, nullable: true },
      sources: { type: 'array', items: { type: 'string' }, nullable: true },
      tokens: { type: 'object', additionalProperties: { type: 'array', items: { $ref: '#/components/schemas/SentenceTokenFull' } }, nullable: true, description: 'Stored interlinear tokens per orthography.' },
      citations: { type: 'array', items: { $ref: '#/components/schemas/SourceCitation' }, nullable: true },
      example_label: { type: 'string', nullable: true },
      discourse_role: { type: 'string', nullable: true },
      ends_paragraph: { type: 'integer', nullable: true },
      sort_key: { type: 'string', nullable: true, description: 'Fractional ordering index within the text.' },
      audio: { type: 'array', items: { $ref: '#/components/schemas/AudioMedia' }, description: 'This sentence\'s attached audio (each with `timings` + `download_url`). Present only when audio exists.' },
    },
  }

  const TextFull = {
    type: 'object',
    description: 'A text with its ordered sentences, attached audio, and referenced speakers (read shape).',
    properties: {
      id: { type: 'string' },
      title: { $ref: '#/components/schemas/MultiString' },
      sources: { type: 'array', items: { type: 'string' }, nullable: true },
      citations: { type: 'array', items: { $ref: '#/components/schemas/SourceCitation' }, nullable: true },
      summary: { ...MultiString, nullable: true },
      work_id: { type: 'string', nullable: true, description: 'Parallel-texts grouping key (versions of one work share it).' },
      dialects: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { $ref: '#/components/schemas/MultiString' } } }, description: 'Dialect(s) this version is written in. Present only when set.' },
      parallel_texts: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { $ref: '#/components/schemas/MultiString' }, dialects: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { $ref: '#/components/schemas/MultiString' } } } } } }, description: 'Other versions of the same work (same `work_id`). Present only when siblings exist.' },
      tags: { type: 'array', items: { $ref: '#/components/schemas/TextTagView' }, description: 'Classification tags. Present only when non-empty.' },
      updated_at: { type: 'string', format: 'date-time' },
      sentences: { type: 'array', items: { $ref: '#/components/schemas/TextSentenceFull' }, description: 'Ordered by `sort_key` ascending.' },
      audio: { type: 'array', items: { $ref: '#/components/schemas/AudioMedia' }, description: 'TEXT-level audio (whole-passage recordings, each with `timings` + `download_url`). Present only when audio exists; sentence-level audio nests under `sentences[].audio`.' },
      speakers: { type: 'array', items: { $ref: '#/components/schemas/SpeakerFull' }, description: 'Full records for every speaker referenced by the included audio — one call serves text + sentences + audio + speakers.' },
    },
  }

  const TextSummary = {
    type: 'object',
    description: 'One item in the text list.',
    properties: {
      id: { type: 'string' },
      title: { $ref: '#/components/schemas/MultiString' },
      sentence_count: { type: 'integer' },
      updated_at: { type: 'string', format: 'date-time' },
      tags: { type: 'array', items: { $ref: '#/components/schemas/TextTagView' }, description: 'Classification tags. Present only when non-empty.' },
    },
  }

  const TextPatch = {
    type: 'object',
    description: 'Edit a text: `title`/`sources`/`citations`/`summary`/`work_id` overwrite (`null` clears the nullable ones); `dialects` are ADDITIVE links; `append_sentences` add after the last sentence; `sentence_order` (a full list of existing sentence ids) reassigns their order. Edit a single sentence via `PATCH …/sentences/{id}`.',
    properties: {
      title: StringOrMultiString,
      sources: { ...StringOrStringArray, description: 'Whole-array replace of the text\'s source slugs.' },
      citations: { type: 'array', items: { $ref: '#/components/schemas/SourceCitation' }, nullable: true, description: 'Whole-array replace of the citation loci; `null` clears.' },
      summary: { ...StringOrMultiString, nullable: true },
      dialects: { ...StringOrStringArray, description: 'ADDITIVE dialect links (found-or-created).' },
      work_id: { type: 'string', nullable: true, description: 'Overwrites the parallel-texts grouping key; `null` clears.' },
      append_sentences: { type: 'array', items: { $ref: '#/components/schemas/TextSentenceInput' } },
      sentence_order: { type: 'array', items: { type: 'string' }, description: 'Existing sentence ids in the desired order.' },
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
      sources: { type: 'array', items: { type: 'string' }, nullable: true, description: 'Source registry slugs.' },
      text_id: { type: 'string', nullable: true, description: 'Set when the sentence belongs to a longer connected `text`; `null` for a standalone example sentence (the usual case for imports).' },
      sort_key: { type: 'string', nullable: true, description: 'Fractional ordering index within its `text_id`; `null` for standalone example sentences.' },
      ends_paragraph: { type: 'integer', nullable: true, description: '1 when a paragraph break follows this sentence within a `text`; otherwise `null`.' },
      tokens: { type: 'object', additionalProperties: { type: 'array', items: { $ref: '#/components/schemas/SentenceTokenFull' } }, nullable: true, description: 'Stored interlinear tokens per orthography (the shared index for the gloss line, word→entry taps, and karaoke timings).' },
      citations: { type: 'array', items: { $ref: '#/components/schemas/SourceCitation' }, nullable: true, description: 'Source refs with a citation locus.' },
      example_label: { type: 'string', nullable: true, description: 'The author\'s own example number.' },
      discourse_role: { type: 'string', nullable: true, description: 'Discourse salience / information role.' },
      updated_at: { type: 'string', format: 'date-time' },
    },
  }

  const SenseFull = {
    type: 'object',
    description: 'A stored sense (read shape). Mirrors `SenseInput` plus a server-assigned `id`; example sentences come back under `sentences` (not `example_sentences`). Media arrays (`photos`/`videos`) are read-only here — write them via `POST …/senses/{senseId}/photos` / `…/videos`.',
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
      sources: { type: 'array', items: { type: 'string' }, nullable: true, description: 'Per-sense source slugs.' },
      sentences: { type: 'array', items: { $ref: '#/components/schemas/SentenceFull' }, description: 'The sense\'s example sentences. Present only when sentences exist. (Input field name is `example_sentences`.)' },
      photos: { type: 'array', items: { $ref: '#/components/schemas/PhotoMedia' }, description: 'Present only when photos exist. Write via `POST …/senses/{senseId}/photos`.' },
      videos: { type: 'array', items: { $ref: '#/components/schemas/VideoMedia' }, description: 'Present only when videos exist. Write via `POST …/senses/{senseId}/videos`.' },
      updated_at: { type: 'string', format: 'date-time' },
      created_at: { type: 'string', format: 'date-time' },
    },
  }

  const EntryMain = {
    type: 'object',
    description: 'The entry\'s top-level scalar fields. These are exactly the fields you POST at the top level of `EntryInput` (lexeme, phonetic, notes, sources, …) — on READ they live here, nested under `entry.main`.',
    properties: {
      lexeme: { $ref: '#/components/schemas/MultiString' },
      homograph: { type: 'string', nullable: true },
      phonetic: { type: 'string', nullable: true },
      interlinearization: { type: 'string', nullable: true },
      morphology: { type: 'string', nullable: true },
      notes: { ...MultiString, nullable: true, description: 'Rich text as MARKDOWN.' },
      linguistic_history: { ...MultiString, nullable: true },
      sources: { type: 'array', items: { type: 'string' }, nullable: true },
      citations: { type: 'array', items: { $ref: '#/components/schemas/SourceCitation' }, nullable: true },
      scientific_names: { type: 'array', items: { type: 'string' }, nullable: true },
      elicitation_id: { type: 'string', nullable: true },
      coordinates: { ...CoordinatesNullableRef, description: 'Where-spoken geometry (attestation/elicitation location) for this form, when set.' },
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
      dialects: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { $ref: '#/components/schemas/MultiString' }, coordinates: { ...CoordinatesNullableRef, description: 'The dialect\'s areal-extent geometry, when set (managed via the `…/dialects` endpoints, not entry payloads).' }, updated_at: { type: 'string', format: 'date-time' } } }, description: 'Present only when dialects exist.' },
      audios: { type: 'array', items: { $ref: '#/components/schemas/AudioMedia' }, description: 'Present only when audio exists. Write via `POST …/entries/{entryId}/audio`.' },
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
        id: '3f1b8c9a-0d2e-4a6b-9c1f-2e5d7a8b4c10',
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
  const file_id_param = { name: 'fileId', in: 'path', required: true, schema: { type: 'string' } }
  const orthography_code_param = { name: 'code', in: 'path', required: true, schema: { type: 'string' }, description: 'The orthography\'s immutable code (a BCP-47 tag, a custom slug, or `default` for the primary).' }
  const text_id_param = { name: 'textId', in: 'path', required: true, schema: { type: 'string' } }
  const audio_id_param = { name: 'audioId', in: 'path', required: true, schema: { type: 'string' } }
  const photo_id_param = { name: 'photoId', in: 'path', required: true, schema: { type: 'string' } }
  const video_id_param = { name: 'videoId', in: 'path', required: true, schema: { type: 'string' } }
  const relationship_id_param = { name: 'relationshipId', in: 'path', required: true, schema: { type: 'string' } }
  const section_id_param = { name: 'sectionId', in: 'path', required: true, schema: { type: 'string' } }
  const slot_id_param = { name: 'slotId', in: 'path', required: true, schema: { type: 'string' } }
  const glossing_code_param = { name: 'code', in: 'path', required: true, schema: { type: 'string' }, description: 'A glossing-abbreviation code (e.g. "3PL").' }

  // ── Media (audio / photos / videos) ──────────────────────────────────
  const HostedElsewhere = {
    type: 'object',
    required: ['type', 'video_id'],
    description: 'A video hosted on YouTube/Vimeo — no bytes are stored. Alternatively send a raw `hosted_url` (a watch/share URL) and the server parses it into this shape.',
    properties: {
      type: { type: 'string', enum: ['youtube', 'vimeo'] },
      video_id: { type: 'string', description: 'Provider id (YouTube watch id / Vimeo numeric id).' },
      start_at_seconds: { type: 'integer', nullable: true },
    },
  }
  const HostedMetadata = {
    type: 'object',
    description: 'Best-effort provider metadata cached when a hosted video is attached. Metadata unavailability never prevents the reference from being saved.',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      thumbnail_url: { type: 'string', format: 'uri' },
      duration_seconds: { type: 'number' },
    },
  }
  const SpeakerBrief = { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } }
  const SpeakerFull = {
    type: 'object',
    description: 'A full speaker record (audio/video attribution — shown on the contributors page).',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      decade: { type: 'integer', nullable: true, description: 'Birth decade, e.g. 1980.' },
      gender: { type: 'string', enum: ['m', 'f', 'o'], nullable: true },
      birthplace: { type: 'string', nullable: true },
    },
  }
  const MediaTimings = {
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'Karaoke word-timings: a map of sentence id → compact timing string `"offset,duration|offset,duration|…"` (milliseconds). Entries align 1:1 with that sentence\'s default-orthography tokens; each offset is relative to the END of the previous timed token (chainable across sentences for text-level audio); an empty entry marks an untimed token (punctuation).',
    example: { 'sentence-uuid-1': '0,320|40,280|', 'sentence-uuid-2': '120,300|' },
  }
  const AudioMedia = {
    type: 'object',
    description: 'A stored audio recording (the pronunciation/utterance). Attaches to an entry, sentence, or text. Requires attribution: a speaker and/or a registry `source`.',
    properties: {
      id: { type: 'string' },
      storage_path: { type: 'string' },
      download_url: { type: 'string', description: 'Absolute URL for the audio bytes (`GET …/media/{storage_path}`, same Bearer auth, 302-redirects to storage). Present in text reads.' },
      source: { type: 'string', nullable: true, description: 'A sources-registry slug (see `GET …/sources`) — the speaker-less attribution path.' },
      timings: { ...MediaTimings, nullable: true },
      entry_id: { type: 'string', nullable: true },
      sentence_id: { type: 'string', nullable: true },
      text_id: { type: 'string', nullable: true },
      speakers: { type: 'array', items: { $ref: '#/components/schemas/SpeakerBrief' }, description: 'Present only when a speaker is attached.' },
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' },
    },
  }
  const PhotoMedia = {
    type: 'object',
    description: 'A stored photo. Attaches to a sense or a sentence. `source` + `photographer` are the free-text attribution shown under the image (there is no separate caption field; unlike audio/video, a photo `source` is NOT a registry slug).',
    properties: {
      id: { type: 'string' },
      storage_path: { type: 'string' },
      serving_url: { type: 'string', description: 'lh3 image-serving hash (generated server-side).' },
      source: { type: 'string', nullable: true, description: 'Free-text attribution/caption prose.' },
      photographer: { type: 'string', nullable: true },
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' },
    },
  }
  const VideoMedia = {
    type: 'object',
    description: 'A stored or hosted video. Attaches to a sense, sentence, or text. Either `storage_path` (uploaded bytes) OR `hosted_elsewhere` (YouTube/Vimeo) is set. Requires attribution: a speaker and/or a registry `source`.',
    properties: {
      id: { type: 'string' },
      storage_path: { type: 'string', nullable: true },
      hosted_elsewhere: { ...HostedElsewhere, nullable: true },
      hosted_metadata: { ...HostedMetadata, nullable: true },
      source: { type: 'string', nullable: true, description: 'A sources-registry slug (see `GET …/sources`) — the speaker-less attribution path.' },
      videographer: { type: 'string', nullable: true },
      text_id: { type: 'string', nullable: true },
      speakers: { type: 'array', items: { $ref: '#/components/schemas/SpeakerBrief' }, description: 'Present only when a speaker is attached.' },
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' },
    },
  }

  const media_id_prop = { type: 'string', format: 'uuid', description: 'Optional client-generated UUID — the idempotency key. A re-POST of an existing id is a safe no-op (returns the existing media, `created: false`).' }
  const media_replace_prop = { type: 'boolean', description: 'Remove existing media of THIS medium on THIS owner first, then add — e.g. to keep exactly one pronunciation per headword across re-runs.' }
  const file_prop = { type: 'string', format: 'binary', description: 'The media file bytes.' }
  const url_prop = { type: 'string', description: 'A public http(s) URL the server fetches instead of an uploaded file (size-capped, see Limits).' }

  // Two accepted content types per attach: multipart file upload OR JSON (url / hosted link).
  function media_request_body({ multipart_props, json_props, multipart_required, json_required }: { multipart_props: Record<string, unknown>, json_props: Record<string, unknown>, multipart_required?: string[], json_required?: string[] }) {
    return {
      required: true,
      content: {
        'multipart/form-data': { schema: { type: 'object', required: multipart_required, properties: multipart_props } },
        'application/json': { schema: { type: 'object', required: json_required, properties: json_props } },
      },
    }
  }

  // Audio + video MUST carry attribution: speaker_id and/or source (a registry slug). Photos are exempt (their source is free-text caption).
  const attributed_speaker_prop = { type: 'string', description: 'An existing speaker id (list via `GET …/speakers`, create via `POST …/speakers`). REQUIRED unless `source` is provided.' }
  const attributed_source_prop = { type: 'string', description: 'A sources-registry slug — must already exist (list via `GET …/sources`, create via `POST …/sources`). REQUIRED unless `speaker_id` is provided.' }

  const audio_timings_multipart_prop = { type: 'string', description: 'Optional karaoke word-timings as a JSON string (see the `MediaTimings` schema). Can also be set/corrected later via `PATCH …/audio/{audioId}` (e.g. after forced alignment).' }
  const audio_timings_json_prop = { ...MediaTimings, description: `Optional. ${MediaTimings.description} Can also be set/corrected later via \`PATCH …/audio/{audioId}\` (e.g. after forced alignment).` }
  const audio_request_body = media_request_body({
    multipart_required: ['file'],
    multipart_props: { file: file_prop, speaker_id: attributed_speaker_prop, source: attributed_source_prop, timings: audio_timings_multipart_prop, id: media_id_prop, replace: media_replace_prop },
    json_required: ['url'],
    json_props: { url: url_prop, speaker_id: attributed_speaker_prop, source: attributed_source_prop, timings: audio_timings_json_prop, id: media_id_prop, replace: media_replace_prop },
  })
  const photo_request_body = media_request_body({
    multipart_required: ['file'],
    multipart_props: { file: file_prop, source: { type: 'string' }, photographer: { type: 'string' }, id: media_id_prop, replace: media_replace_prop },
    json_required: ['url'],
    json_props: { url: url_prop, source: { type: 'string', description: 'Free-text attribution/description shown under the photo (NOT a registry slug).' }, photographer: { type: 'string' }, id: media_id_prop, replace: media_replace_prop },
  })
  const video_request_body = media_request_body({
    multipart_props: { file: file_prop, hosted_url: { type: 'string', description: 'A YouTube/Vimeo watch URL (parsed to `hosted_elsewhere`) — use instead of a file for hosted video.' }, speaker_id: attributed_speaker_prop, source: attributed_source_prop, videographer: { type: 'string' }, id: media_id_prop, replace: media_replace_prop },
    json_props: { url: url_prop, hosted_url: { type: 'string', description: 'A YouTube/Vimeo watch URL — parsed to `hosted_elsewhere`.' }, hosted_elsewhere: { ...HostedElsewhere, description: 'Structured hosted-video link (alternative to `hosted_url`). Provide exactly one of `url` / `hosted_url` / `hosted_elsewhere`.' }, speaker_id: attributed_speaker_prop, source: attributed_source_prop, videographer: { type: 'string' }, id: media_id_prop, replace: media_replace_prop },
  })

  const RelationshipCustomType = {
    type: 'object',
    required: ['name'],
    properties: {
      name: { ...StringOrMultiString, description: 'Display label the dictionary creator authors (their language).' },
      inverse_name: { ...StringOrMultiString, description: 'Label shown from the `to` side for a DIRECTED custom type. Omit for symmetric.' },
      symmetric: { type: 'boolean', description: 'Defaults true unless an `inverse_name` is given.' },
    },
  }
  const RelationshipInput = {
    type: 'object',
    required: ['from_entry_id', 'to_entry_id'],
    description: 'A typed relationship between two entries (optionally narrowed to senses). Provide exactly one of `type` (global slug) or `custom_type`.',
    properties: {
      from_entry_id: { type: 'string' },
      from_sense_id: { type: 'string', description: 'Optional — narrows the `from` side to one sense (must belong to `from_entry_id`).' },
      to_entry_id: { type: 'string' },
      to_sense_id: { type: 'string', description: 'Optional — narrows the `to` side to one sense (must belong to `to_entry_id`).' },
      type: { type: 'string', enum: Object.keys(RELATIONSHIP_TYPES), description: 'A global relationship-type slug. Provide THIS or `custom_type`. Directed pairs (hypernym/hyponym, holonym/meronym, derived_from/root_of, borrowed_from/loaned_to) accept EITHER member — the inverse alias is canonicalized to its partner with endpoints flipped, so `hypernym` A→B and `hyponym` B→A dedupe to one row. `from` plays the named role of the stored slug (e.g. `from` is the hypernym/whole/derived word).' },
      custom_type: { ...RelationshipCustomType, description: 'A per-dictionary custom type — found-or-created (deduped by name). Provide THIS or `type`.' },
      note: StringOrMultiString,
      sources: { ...StringOrStringArray, description: 'Source slug(s) — each must already exist (create via `POST …/sources`).' },
    },
  }
  const RelationshipView = {
    type: 'object',
    description: 'One relationship as seen FROM a given entry: `direction`, and the label (`label_key` for globals / `name` for custom) already reflect the side being shown. `related` is the OTHER endpoint.',
    properties: {
      id: { type: 'string' },
      type: { type: 'string', description: 'Global slug, or the custom type id when `custom` is true.' },
      custom: { type: 'boolean' },
      symmetric: { type: 'boolean' },
      direction: { type: 'string', enum: ['forward', 'inverse'] },
      label_key: { type: 'string', description: 'Globals only: i18n key `relationship_type.<slug>` for the side being viewed.' },
      name: { $ref: '#/components/schemas/MultiString', description: 'Custom types only: the label for the side being viewed.' },
      related: { type: 'object', properties: { entry_id: { type: 'string' }, sense_id: { type: 'string' }, lexeme: { $ref: '#/components/schemas/MultiString' } } },
      note: { $ref: '#/components/schemas/MultiString' },
      sources: { type: 'array', items: { type: 'string' } },
    },
  }

  const MEDIA_RESPONSE = {
    audio: { key: 'audio', schema: 'AudioMedia' },
    photo: { key: 'photo', schema: 'PhotoMedia' },
    video: { key: 'video', schema: 'VideoMedia' },
  } as const

  function media_attach_op({ summary, description, owner_params, request_body, medium }: { summary: string, description: string, owner_params: unknown[], request_body: unknown, medium: keyof typeof MEDIA_RESPONSE }) {
    const { key, schema } = MEDIA_RESPONSE[medium]
    return {
      post: {
        summary,
        description,
        parameters: [dict_id_param, ...owner_params],
        requestBody: request_body,
        responses: {
          200: { description: `{ ${key}, created }`, content: { 'application/json': { schema: { type: 'object', properties: { [key]: { $ref: `#/components/schemas/${schema}` }, created: { type: 'boolean', description: 'false = idempotent no-op (the supplied `id` already existed).' } } } } } },
          400: { description: 'Bad input (no file/url, missing attribution — audio/video need speaker_id and/or source, unknown speaker, unknown source slug, bad hosted link)' },
          404: { description: 'Owner not found' },
          413: { description: 'File exceeds the upload size limit' },
          415: { description: 'The uploaded/fetched bytes are not valid media of this type (e.g. a `url` that returned an HTML error page)' },
          503: { description: 'Media storage not configured on the server' },
        },
      },
    }
  }
  function media_delete_op({ owner_label, owner_params, media_id_p, medium }: { owner_label: string, owner_params: unknown[], media_id_p: unknown, medium: keyof typeof MEDIA_RESPONSE }) {
    return {
      delete: {
        summary: `Delete a ${medium} from this ${owner_label}`,
        description: `Removes the ${medium} (FK cascade sweeps its links + speaker junctions). Verifies the ${medium} is linked to THIS ${owner_label}.`,
        parameters: [dict_id_param, ...owner_params, media_id_p],
        responses: { 200: { description: "{ result: 'deleted' }" }, 404: { description: `${medium} not linked to this ${owner_label}` } },
      },
    }
  }

  function audio_timings_patch_op({ owner_label, owner_params }: { owner_label: string, owner_params: unknown[] }) {
    return {
      patch: {
        summary: `Set/update an audio's timings on this ${owner_label}`,
        description: `Set, replace, or clear (\`null\`) the audio row's karaoke word-timings — e.g. writing corrected forced-alignment output back after upload. Whole-object replace. Verifies the audio is linked to THIS ${owner_label}.`,
        parameters: [dict_id_param, ...owner_params, audio_id_param],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['timings'], properties: { timings: { ...MediaTimings, nullable: true, description: `${MediaTimings.description} \`null\` clears.` } } } } } },
        responses: {
          200: { description: '{ audio }', content: { 'application/json': { schema: { type: 'object', properties: { audio: { $ref: '#/components/schemas/AudioMedia' } } } } } },
          400: { description: 'Malformed timings (must map sentence id → timing string)' },
          404: { description: `audio not linked to this ${owner_label}` },
        },
      },
    }
  }

  const media_paths = {
    '/api/v1/dictionaries/{id}/entries/{entryId}/audio': media_attach_op({ summary: 'Attach audio to an entry', description: 'Upload a pronunciation recording for the headword (multipart `file` or JSON `url`). Attribution required: `speaker_id` and/or `source` (a registry slug). Use `replace: true` for one-audio-per-headword imports.', owner_params: [entry_id_param], request_body: audio_request_body, medium: 'audio' }),
    '/api/v1/dictionaries/{id}/entries/{entryId}/audio/{audioId}': media_delete_op({ owner_label: 'entry', owner_params: [entry_id_param], media_id_p: audio_id_param, medium: 'audio' }),
    '/api/v1/dictionaries/{id}/senses/{senseId}/photos': media_attach_op({ summary: 'Attach a photo to a sense', description: 'Upload an illustrative photo for the sense (multipart `file` or JSON `url`), optionally with `source`/`photographer` (shown as the caption).', owner_params: [sense_id_param], request_body: photo_request_body, medium: 'photo' }),
    '/api/v1/dictionaries/{id}/senses/{senseId}/photos/{photoId}': media_delete_op({ owner_label: 'sense', owner_params: [sense_id_param], media_id_p: photo_id_param, medium: 'photo' }),
    '/api/v1/dictionaries/{id}/senses/{senseId}/videos': media_attach_op({ summary: 'Attach a video to a sense', description: 'Upload a video (`file`/`url`) OR link a hosted one (`hosted_url`/`hosted_elsewhere`). Attribution required: `speaker_id` and/or `source` (a registry slug).', owner_params: [sense_id_param], request_body: video_request_body, medium: 'video' }),
    '/api/v1/dictionaries/{id}/senses/{senseId}/videos/{videoId}': media_delete_op({ owner_label: 'sense', owner_params: [sense_id_param], media_id_p: video_id_param, medium: 'video' }),
    '/api/v1/dictionaries/{id}/sentences/{sentenceId}/audio': media_attach_op({ summary: 'Attach audio to a sentence', description: 'Upload audio for an example/text sentence (`file`/`url`). Attribution required: `speaker_id` and/or `source`.', owner_params: [sentence_id_param], request_body: audio_request_body, medium: 'audio' }),
    '/api/v1/dictionaries/{id}/sentences/{sentenceId}/audio/{audioId}': { ...media_delete_op({ owner_label: 'sentence', owner_params: [sentence_id_param], media_id_p: audio_id_param, medium: 'audio' }), ...audio_timings_patch_op({ owner_label: 'sentence', owner_params: [sentence_id_param] }) },
    '/api/v1/dictionaries/{id}/sentences/{sentenceId}/photos': media_attach_op({ summary: 'Attach a photo to a sentence', description: 'Upload a photo for a sentence (`file`/`url`), optionally with `source`/`photographer`.', owner_params: [sentence_id_param], request_body: photo_request_body, medium: 'photo' }),
    '/api/v1/dictionaries/{id}/sentences/{sentenceId}/photos/{photoId}': media_delete_op({ owner_label: 'sentence', owner_params: [sentence_id_param], media_id_p: photo_id_param, medium: 'photo' }),
    '/api/v1/dictionaries/{id}/sentences/{sentenceId}/videos': media_attach_op({ summary: 'Attach a video to a sentence', description: 'Upload (`file`/`url`) or link (`hosted_url`/`hosted_elsewhere`) a video for a sentence. Attribution required: `speaker_id` and/or `source`.', owner_params: [sentence_id_param], request_body: video_request_body, medium: 'video' }),
    '/api/v1/dictionaries/{id}/sentences/{sentenceId}/videos/{videoId}': media_delete_op({ owner_label: 'sentence', owner_params: [sentence_id_param], media_id_p: video_id_param, medium: 'video' }),
    '/api/v1/dictionaries/{id}/texts/{textId}/audio': media_attach_op({ summary: 'Attach audio to a text', description: 'Upload audio for a whole text/passage (`file`/`url`). Attribution required: `speaker_id` and/or `source`.', owner_params: [text_id_param], request_body: audio_request_body, medium: 'audio' }),
    '/api/v1/dictionaries/{id}/texts/{textId}/audio/{audioId}': { ...media_delete_op({ owner_label: 'text', owner_params: [text_id_param], media_id_p: audio_id_param, medium: 'audio' }), ...audio_timings_patch_op({ owner_label: 'text', owner_params: [text_id_param] }) },
    '/api/v1/dictionaries/{id}/texts/{textId}/videos': media_attach_op({ summary: 'Attach a video to a text', description: 'Upload (`file`/`url`) or link (`hosted_url`/`hosted_elsewhere`) a video for a text. Attribution required: `speaker_id` and/or `source`.', owner_params: [text_id_param], request_body: video_request_body, medium: 'video' }),
    '/api/v1/dictionaries/{id}/texts/{textId}/videos/{videoId}': media_delete_op({ owner_label: 'text', owner_params: [text_id_param], media_id_p: video_id_param, medium: 'video' }),
    '/api/v1/dictionaries/{id}/media/{storagePath}': {
      get: {
        summary: 'Download media bytes by storage_path',
        description: 'The stable download URL for stored media bytes (this is what `download_url` in read shapes points at). Verifies the `storage_path` belongs to a media row in THIS dictionary, then 302-redirects to the storage backend — follow redirects and keep sending the same Bearer key.',
        parameters: [dict_id_param, { name: 'storagePath', in: 'path', required: true, schema: { type: 'string' }, description: 'The media row\'s `storage_path` (slashes allowed, e.g. `{dictId}/audio/{ownerId}/file.mp3`).' }],
        responses: { 302: { description: 'Redirect to the bytes' }, 404: { description: 'No media row in this dictionary has that storage_path' } },
      },
    },
  }

  // ───────────────────────────────────────────────────────────────────────
  // Structured, entry-linked grammar (see .issues/structured-grammar.md) — LIVE.
  // ───────────────────────────────────────────────────────────────────────
  const GrammarSectionInput = {
    type: 'object',
    description: 'A node in the dictionary\'s hierarchical grammar. Usually documents ONE lexeme (a particle/affix/construction): link it with `entry_id` (+ optional `sense_id`) and it surfaces as "grammar notes" on that entry, while the section pulls the entry\'s lexeme/phonetic/audio. Prose is parallel-language MARKDOWN keyed by gloss/analysis language (the object-language forms come from the linked entry + referenced sentences, not from this prose). At least one of `title`/`body` is required.',
    properties: {
      id: client_id_prop,
      parent_id: { type: 'string', nullable: true, description: 'Parent section id; omit/null for a top-level section.' },
      after_section_id: { type: 'string', description: 'Insert immediately after this sibling (fractional ordering). Omit → append to the end of the parent\'s children.' },
      number_label: { type: 'string', description: 'Explicit outline number (e.g. "2.2.1.1") — e.g. to preserve a source grammar\'s numbering. Omit → derived from tree position.' },
      title: { ...StringOrMultiString, description: 'Section heading (markdown), per gloss/analysis language. Optional — omit for a headless, body-only section.' },
      body: { ...StringOrMultiString, description: 'Main documentation prose as MARKDOWN, per gloss/analysis language.' },
      usage_conditions: { ...StringOrMultiString, description: 'When to include vs. omit this form (markdown, per language) — distinct from `body`.' },
      slot_id: { type: 'string', nullable: true, description: 'A clause-template slot id (see `…/grammar/clause-slots`) positioning this particle within the clause.' },
      entry_id: { type: 'string', nullable: true, description: 'The headword this section documents (the bidirectional entry↔grammar link).' },
      sense_id: { type: 'string', nullable: true, description: 'Narrow the link to a specific sense of `entry_id`.' },
      example_sentence_ids: { type: 'array', items: { type: 'string' }, description: 'Existing sentence ids to attach as examples BY REFERENCE (not copies). One sentence can be a text line, a sense example, AND grammar evidence at once — inheriting its word→entry tokens and media timings. Manage later via `…/sections/{sectionId}/sentences`.' },
    },
    example: { title: 'Aspect particles', body: { en: 'The perfective particle *le* follows the verb…' }, entry_id: '…', slot_id: '…', example_sentence_ids: ['…'] },
  }

  const GrammarSectionPatch = {
    type: 'object',
    description: 'Field-merge edit of a grammar section: provided fields overwrite, omitted fields are unchanged. `parent_id` + `after_section_id` move/renest it.',
    properties: {
      parent_id: { type: 'string', nullable: true },
      after_section_id: { type: 'string' },
      number_label: { type: 'string', nullable: true },
      title: StringOrMultiString,
      body: { ...StringOrMultiString, nullable: true },
      usage_conditions: { ...StringOrMultiString, nullable: true },
      slot_id: { type: 'string', nullable: true },
      entry_id: { type: 'string', nullable: true },
      sense_id: { type: 'string', nullable: true },
    },
  }

  const SectionSentenceRef = {
    type: 'object',
    description: 'An example sentence attached to a grammar section BY REFERENCE.',
    properties: {
      id: { type: 'string', description: 'The link id (section_sentences row).' },
      sentence_id: { type: 'string' },
      sort_key: { type: 'string', nullable: true, description: 'Fractional order within the section.' },
    },
  }

  const GrammarSectionFull = {
    type: 'object',
    description: 'A grammar section (read shape) with its ordered example-sentence refs and child ids.',
    properties: {
      id: { type: 'string' },
      parent_id: { type: 'string', nullable: true },
      sort_key: { type: 'string', nullable: true },
      number_label: { type: 'string', nullable: true, description: 'Stored override, else derived from tree position.' },
      title: { $ref: '#/components/schemas/MultiString' },
      body: { ...MultiString, nullable: true },
      usage_conditions: { ...MultiString, nullable: true },
      slot_id: { type: 'string', nullable: true },
      entry_id: { type: 'string', nullable: true },
      sense_id: { type: 'string', nullable: true },
      example_sentences: { type: 'array', items: { $ref: '#/components/schemas/SectionSentenceRef' }, description: 'Present when examples are attached.' },
      child_ids: { type: 'array', items: { type: 'string' }, description: 'Ordered child section ids.' },
      updated_at: { type: 'string', format: 'date-time' },
    },
  }

  const ClauseSlotInput = {
    type: 'object',
    required: ['name'],
    description: 'One position in the language\'s clause template (e.g. pre-subject, pre-modal, modal, pre-verb, post-verb, phase, final). The ordered set of slots IS the template — used to render a particle-order diagram and to position grammar sections.',
    properties: {
      id: client_id_prop,
      code: { type: 'string', description: 'Short stable code, e.g. "pre_verb".' },
      name: { ...StringOrMultiString, description: 'Display label, per language. Required.' },
      after_slot_id: { type: 'string', description: 'Insert after this slot (fractional order); omit → append.' },
    },
  }

  const ClauseSlotFull = {
    type: 'object',
    description: 'A clause-template slot (read shape).',
    properties: {
      id: { type: 'string' },
      code: { type: 'string', nullable: true },
      name: { $ref: '#/components/schemas/MultiString' },
      sort_key: { type: 'string', nullable: true },
      updated_at: { type: 'string', format: 'date-time' },
    },
  }

  const TextTagInput = {
    type: 'object',
    required: ['name'],
    description: 'A classification tag attached to a TEXT (find-or-created, mirroring entry tags): genre, motif, or tale-type — enabling a folklore-style motif index + cross-text browse. Reuses the shared tag registry with `kind`/`code` classification columns.',
    properties: {
      name: { type: 'string', description: 'Tag label (found-or-created). Required.' },
      kind: { type: 'string', enum: ['motif', 'genre', 'tale_type'], nullable: true, description: 'Classification namespace; omit for a plain label.' },
      code: { type: 'string', description: 'Optional controlled-vocab code (e.g. an ATU/Thompson motif number).' },
    },
  }

  const TextTagView = {
    type: 'object',
    description: 'A text\'s classification tag (read shape).',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      kind: { type: 'string', nullable: true },
      code: { type: 'string', nullable: true },
    },
  }

  // ── Interlinear glossed text (IGT / Leipzig glossing) at the SENTENCE layer:
  // the aligned GLOSS line the section layer's example sentences reference. The
  // default-orthography token list is the SHARED index the gloss line, word→entry
  // taps, and `audio.timings` karaoke all align to 1:1. These schemas back the IGT
  // fields spread into the sentence-write shapes (see `sentence_igt_props`).
  const SourceCitation = {
    type: 'object',
    required: ['slug'],
    description: 'A source reference WITH a citation locus (page / example number, e.g. "1981:31"). A bare slug string is still accepted where a source ref is expected; this richer form preserves scholarly provenance.',
    properties: {
      slug: { type: 'string', description: 'An existing source-registry slug.' },
      locator: { type: 'string', description: 'Page / example number / "as quoted from X 1981:31" note.' },
    },
  }

  const Morpheme = {
    type: 'object',
    required: ['form'],
    description: 'Optional word-INTERNAL segmentation of a token, for polysynthetic/agglutinative data (isolating languages need only the token-level `gloss`).',
    properties: {
      form: { type: 'string', description: 'The morpheme\'s surface form.' },
      gloss: { ...MultiString, description: 'Aligned gloss for this morpheme, per analysis language.' },
      entry_id: { type: 'string', nullable: true, description: 'Optional link to a headword (independent of `gloss`).' },
      separator: { type: 'string', enum: ['-', '=', '~', '.'], description: 'Leipzig boundary preceding this morpheme: `-` affix, `=` clitic, `~` reduplication, `.` one-form-many-glosses. Omit for the root/first morpheme. Lets the gloss line render in faithful Leipzig notation.' },
    },
  }

  const SentenceTokenInput = {
    type: 'object',
    required: ['form'],
    description: 'A writable interlinear token — the GOLD alignment from a glossed source. `start`/`end` are OPTIONAL on write: omit them and the server derives offsets by walking the ORDERED `form`s against the sentence `text` with a LEFT-TO-RIGHT CURSOR that consumes each match in turn (a global search would collide — ~28% of real sentences repeat a form). Derivation therefore requires each `form` to be an exact substring of `text`, in order: keep surface forms byte-identical to the text (do not strip footnote/tone/OCR artifacts from the form but not the text, or vice-versa). On read, offsets are always present.',
    properties: {
      form: { type: 'string', description: 'Surface form exactly as it appears in the sentence text (byte-identical, so offset derivation can locate it).' },
      start: { type: 'integer', description: 'Char offset into the orthography\'s text. Optional on write (derived if omitted).' },
      end: { type: 'integer', description: 'Char offset, exclusive. Optional on write.' },
      gloss: { ...MultiString, description: 'The aligned interlinear gloss — the Leipzig gloss line, per analysis language. CONVENTION (locked): store language-neutral grammatical category codes (`3PL`, `PFV`, `CLF`) under the reserved `default` key, and per-language LEXICAL glosses (`tiger`, `虎`) under their language codes (`en`, `zh`). A reader on gloss-language X sees `gloss[X] ?? gloss.default`, so a neutral code kept under `default` survives every gloss-language switch (storing it under `en` would make it vanish for a `zh` reader). Independent of `entry_id` (grammatical morphemes/portmanteaux often have no headword but must still be glossable). A legend code found ANYWHERE in a gloss cell (matched as a substring, so portmanteaux like `eat PFV` / `can/ATT` still highlight) renders SMALL CAPS + tap-to-expand automatically — so no per-token "grammatical?" flag is needed.' },
      entry_id: { type: 'string', nullable: true, description: 'Optional link to the dictionary entry for this token (independent of, and optional to, `gloss`). Multi-word→one-gloss = one token spanning the char range.' },
      sense_id: { type: 'string', nullable: true },
      morphemes: { type: 'array', items: { $ref: '#/components/schemas/Morpheme' }, description: 'Optional word-internal segmentation.' },
      status: { type: 'string', enum: ['auto', 'confirmed', 'ignored'], description: 'Match state; supplied gold tokens default to `confirmed`. `ignored` = punctuation (keeps offset/timing arrays aligned).' },
    },
  }

  const SentenceTokenFull = {
    type: 'object',
    description: 'A stored interlinear token (read shape). The default-orthography token list is the shared index that the gloss line, word→entry taps, AND `audio.timings` karaoke all align to 1:1.',
    properties: {
      form: { type: 'string' },
      start: { type: 'integer' },
      end: { type: 'integer' },
      gloss: { ...MultiString, nullable: true },
      entry_id: { type: 'string', nullable: true },
      sense_id: { type: 'string', nullable: true },
      morphemes: { type: 'array', items: { $ref: '#/components/schemas/Morpheme' } },
      status: { type: 'string', nullable: true },
    },
  }

  const GlossingAbbreviationInput = {
    type: 'object',
    required: ['code', 'name'],
    description: 'One entry in the dictionary\'s glossing-abbreviations legend (mirrors clause-slots). Makes gloss lines self-documenting: a code found here — matched as a SUBSTRING of a gloss cell, so portmanteaux like `eat PFV` still highlight — is tap-to-expand AND renders SMALL CAPS (so no per-token "grammatical" flag is needed). Seed from the standard Leipzig set + custom codes.',
    properties: {
      code: { type: 'string', description: 'The abbreviation as it appears in glosses, e.g. "3PL", "PFV", "CLF". Required.' },
      name: { ...StringOrMultiString, description: 'Expansion, per analysis language, e.g. "third person plural". Required.' },
      category: { type: 'string', description: 'Optional grouping for the legend UI, e.g. person / number / tense / aspect / case.' },
    },
  }

  const GlossingAbbreviationFull = {
    type: 'object',
    description: 'A glossing-abbreviation legend entry (read shape).',
    properties: {
      code: { type: 'string' },
      name: { $ref: '#/components/schemas/MultiString' },
      category: { type: 'string', nullable: true },
      updated_at: { type: 'string', format: 'date-time' },
    },
  }

  const spec = {
    openapi: '3.1.0',
    tags: OPENAPI_TAGS,
    info: {
      title: 'Living Dictionaries Write API',
      version: '1.0.0',
      description: [
        'Programmatic, bulk-capable read/write access to a SINGLE Living Dictionary — an agent can do anything a human editor can (add/edit/delete entries with senses, glosses, example sentences, dialects, tags, speakers, sources, and connected texts).',
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
        '1. `GET /api/v1/dictionaries/{id}` → note `gloss_languages` (which locale codes to use; if your source glosses in a language not listed, add it first via `POST …/gloss-languages`). `entry_count` is updated asynchronously and lags — **do not use it to verify a fresh import** (it can read 0 right after a bulk POST). For a live count, paginate `/entries` instead.',
        '2. `POST /api/v1/dictionaries/{id}/entries` with `{ "entries": [ … ], "import_id": "my-import-2026" }` in batches of ≤1000 (and ≤~16MB/request — see Limits). **Generate a UUID (v4) yourself for each entry and send it as `id`.** That id IS your idempotency key: you already know it (record it in your ledger keyed by your source id), you use it directly for later `PATCH …/entries/{id}` edits, and a re-POST of the same id is a safe no-op. The whole batch shares an `import_id`, which tags every entry with a private tag of that name so you can find/clean the batch later.',
        '3. Read the per-item `results` array. Each item is `{ status: "created"|"exists"|"failed", entry_id?, sense_ids?, error? }` (one per input entry, in order). `exists` means an entry with that `id` was already present and was skipped — so retrying a timed-out batch never duplicates. Re-POST only the `failed` ones.',
        '4. Spot-verify with `GET /api/v1/dictionaries/{id}/entries/{entryId}` (returns the full nested entry — the READ shape), or bulk-read with `GET /api/v1/dictionaries/{id}/entries?include=senses`. Heads-up on the input→output asymmetry: top-level scalars you POST come back nested under `entry.main`, and `senses[].example_sentences` come back as `senses[].sentences`. See the `EntryResponse` schema. (`elicitation_id` is for word-list/elicitation ordering; it is persisted and queryable via `?elicitation_id=`, so use it for dedupe only if your source id is genuinely elicitation data — otherwise use your own `id` as above.)',
        '',
        '## Data model',
        'An **entry** is a headword (`lexeme`) plus metadata and one or more **senses**. A **sense** is one meaning: its `glosses` (short translations keyed by gloss-language), an optional longer `definition`, `parts_of_speech`, `semantic_domains`, and `example_sentences`. `parts_of_speech` values should come from the supported abbreviation list in the `SenseInput` schema (abbrevs and full English names are matched case-insensitively and stored as the canonical lowercase abbrev, e.g. "N"/"Noun" → "n"; anything else is stored verbatim). An **example sentence** has vernacular `text` + `translation`(s). `dialects` and `tags` are entry-level labels (referenced by name; created automatically if new). If you omit `senses`, one empty sense is created. An entry may carry `coordinates` — where-spoken geometry (points/regions) marking where THIS form was attested/elicited; a **dialect** has its own `coordinates` too, for the variety\'s areal extent (set via the `…/dialects` endpoints so one polygon isn\'t repeated across thousands of entries). See the `Coordinates` schema for the shape + limits. A **text** is a separate object: a connected passage/story (`title`) with its own ORDERED list of sentences (each with optional paragraph breaks) — use the `…/texts` endpoints for those; they are independent of entries.',
        '',
        '## Edits & deletes',
        '`PATCH …/entries/{entryId}` field-merges the entry: provided fields overwrite, omitted ones stay. `senses` are a true upsert by client `id`: an id already on the entry → field-merge that sense; an unknown id (or none) → create the sense WITH that id, so deterministic import ids (e.g. uuid5 of a stable external key) keep addressing the same sense across re-syncs. Example sentences upsert by id too; send `{ "id": "<existing-sentence-id>" }` alone to link an existing sentence without rewriting it (re-sent links are not duplicated; an unknown id-only reference fails). `dialects`/`tags` are added (never removed) by this call. `DELETE …/entries/{entryId}` removes the entry and its senses.',
        'For surgical, single-row fixes (e.g. correcting ONE OCR typo) read the ids from the entry READ shape (`senses[].id`, `senses[].sentences[].id`, `tags[].id`, `dialects[].id`) and use the dedicated routes:',
        '- `POST …/sentences` — create a standalone sentence, then attach its id to a grammar section and/or link it to a sense by id; `GET`/`PATCH`/`DELETE …/sentences/{sentenceId}` read, edit, or remove it.',
        '- `DELETE …/senses/{senseId}` — delete one sense (refused for an entry\'s LAST sense → delete the entry instead).',
        '- `PATCH …/tags/{tagId}` / `…/dialects/{dialectId}` — rename a tag/dialect (affects EVERY entry it\'s on); `DELETE` removes it globally (unlinks it everywhere).',
        '- `DELETE …/entries/{entryId}/tags/{tagId}` / `…/entries/{entryId}/dialects/{dialectId}` — unlink ONE tag/dialect from ONE entry (it survives on other entries).',
        'REPAIR & RE-SYNC SEMANTICS: PATCH is field-merge and NEVER deletes — re-syncing a corrected source over an earlier import updates fields but leaves stale senses/sentences/tags behind; remove those explicitly with the DELETE routes above. See the importing guide\'s repair section.',
        'BAD-IMPORT RECOVERY: `POST …/entries/batch-delete` removes EVERY entry from one bulk import via its `import_id` (the private tag stamped on the batch). Two-step by design: `{ "import_id": "…", "dry_run": true }` reports `{ count, sample_entry_ids }` with no writes; the real run must echo that count back as `confirm_count` (mismatch → 409, so a stale script can\'t nuke a re-imported batch). The emptied private tag is deleted too; orphaned standalone example sentences are left. See the importing guide\'s recovery section.',
        '',
        '## Scope (v1)',
        'v1 covers entries, senses, example sentences, **texts** (connected passages with ordered sentences), speakers, tags, dialects, sources, and **media** (audio, photos, video). Text-only imports never need to touch media.',
        '',
        '## Media (audio / photos / videos)',
        'Attach media with ONE call that uploads + links it: `POST` the bytes as multipart `file`, OR JSON `{ "url": "https://…" }` (the server fetches it). Each returns the created media object (with its `id`) and `created`.',
        '**Audio and video require attribution**: `speaker_id` (an existing speaker — create via `POST …/speakers`) and/or `source` (a sources-registry slug — create via `POST …/sources`, same strict create-first rule as entry sources). Use a speaker when you know who is speaking; use a source when the recording comes from a website/archive/publication. NEVER invent a placeholder speaker to satisfy this — speakers are real people (with birth decade/gender/birthplace shown on the contributors page); provenance belongs in a source.',
        '- **audio** → an entry (headword pronunciation), a sentence, or a text: `POST …/entries/{entryId}/audio`, `…/sentences/{sentenceId}/audio`, `…/texts/{textId}/audio`.',
        '- **photos** → a sense or a sentence: `POST …/senses/{senseId}/photos`, `…/sentences/{sentenceId}/photos`. Optional free-text `source`/`photographer` (shown as the on-image caption — for photos this is NOT a registry slug).',
        '- **videos** → a sense, sentence, or text: `POST …/senses/{senseId}/videos`, etc. Upload bytes OR link a hosted video via `hosted_url` (a YouTube/Vimeo watch URL) — preferred for large video, which would exceed the upload cap.',
        'Idempotency + replace: send your own `id` (UUID) so a re-POST is a no-op; send `replace: true` to first remove existing media of that type on that owner (e.g. exactly one pronunciation per headword). Remove media with `DELETE …/{audioId|photoId|videoId}`.',
        'Typical import: create the entry (get its `id` + `sense_ids`), then `POST …/entries/{entryId}/audio` with the pronunciation and `POST …/senses/{senseId}/photos` with the illustrative photo.',
        'Karaoke **timings**: sentence/text audio can carry per-word timings (`MediaTimings` schema — sentence id → compact timing string aligned to the sentence\'s stored tokens). Send `timings` on the audio POST, or set/correct them later via `PATCH …/sentences/{sentenceId}/audio/{audioId}` / `…/texts/{textId}/audio/{audioId}` (e.g. after running forced alignment on the uploaded bytes).',
        '**Reading media back**: `GET …/texts/{textId}` returns the text\'s audio (text- AND sentence-level, with `timings`, speakers, and a `download_url` per row) — one call serves text + sentences + audio + speakers. Download any stored media\'s bytes via `GET …/media/{storage_path}` (302-redirects to storage).',
        '',
        '## Limits',
        'Batch ≤1000 entries (or ≤1000 relationships) per request AND keep each request body under ~16MB — split larger imports. A single media upload (file or fetched url) is capped separately (~25MB); for larger video use a `hosted_url` link instead. Writes are per-item best-effort (read `results`).',
        '',
        '## Bulk reads — dictionary snapshots',
        'Mirroring or bulk-reading a whole dictionary? Don\'t paginate the API — every dictionary except secure ones has a downloadable gzipped SQLite snapshot of its full database (entries, senses, sentences, texts, media rows, speakers, …) at `https://snapshots.livingdictionaries.app/dictionaries/{id}.db.gz` (no auth; use the dictionary id, not the url slug, if they differ). It is rebuilt within ~30 minutes of any edit (a 30-minute sweep that only rebuilds when content actually changed) and served with `Cache-Control: max-age=120` — so treat it as at most ~30 minutes stale, and use the write API\'s responses (not the snapshot) to verify your own fresh writes. **How to load and query it (URL shape, gunzip, key tables): `GET /api/v1/guides/snapshot`.** Secure dictionaries have no public snapshot — paginate the API instead.',
        '',
        '## Feedback (agents welcome)',
        'If you hit a wall — a field you need that doesn\'t exist, a bug, or an awkward workflow — `POST /api/v1/dictionaries/{id}/feedback` with `{ "message": "…" }`. It reaches the Living Dictionaries team directly (read OR write keys). After sending, relay the response\'s `relay_to_human` sentence to your human so they know what you asked for; if we adopt it we notify them directly.',
        '',
        '## Structured grammar + interlinear glossing (IGT) — LIVE',
        'The structured, entry-linked GRAMMAR surface is implemented and live: grammar sections (hierarchical, parallel-language markdown, entry/sense links, usage conditions — a section may be headless/body-only), example sentences by reference (`POST …/sentences` to create → `…/grammar/sections/{sectionId}/sentences` to attach), clause-template slots (`…/grammar/clause-slots`), the glossing-abbreviations legend (`…/grammar/glossing-abbreviations`), the reverse entry→grammar lookup (`…/entries/{entryId}/grammar`), and text-classification tags (`…/texts/{textId}/tags`; tags are also included in text reads and `GET …/texts?tag=<name>` filters by exact case-insensitive name). There is no separate grammar-intro endpoint — the introductory prose is simply the first top-level section.',
        'Interlinear glossed text (IGT / Leipzig glossing) is live on every sentence write shape (`SentenceInput` / `TextSentenceInput` / `SentencePatch`): supply gold `tokens` per orthography (each `SentenceTokenInput` carrying the aligned per-token `gloss` line + optional `morphemes`; offsets derived if omitted — see the schema), plus `citations` (a source ref WITH a page/example `locator`), `example_label`, and `discourse_role`. `sources.orthography` declares which script a source\'s forms use. When `tokens` are omitted the server behaves as before. If you are importing IGT / corpus data and a shape is awkward, send `POST …/feedback` — that still shapes the build.',
        '',
        '## Uploaded resources & import guides',
        'When a dictionary team asks us to import their materials, the original files live at `GET …/files` (write scope) — each with the uploader\'s per-file `import_instructions` (authoritative) and an optional `source_note`. Download originals via `GET …/files/{fileId}`. **Before importing anything, fetch the matching format guide**: `GET /api/v1/guides` lists lean markdown guides (start with `/api/v1/guides/importing`, then the one for your source format — spreadsheets, flex-lift, pdf-scans). If the resource is a real citable work, create its `sources` registry row and link the file to it (`PATCH …/files/{fileId}` with `source_id`) so the original stays downloadable behind its citation.',
        '',
        '## Fetching this spec (progressive disclosure)',
        'This document is comprehensive and grows over time. If you only need part of it, fetch a slice instead of the whole thing: `GET /api/v1/openapi.json?view=index` returns a compact map (every path + its method summaries + tag, plus the list of schema names) — read that first; then `GET /api/v1/openapi.json?tag=<name>` returns just one group\'s paths WITH their full ($ref-complete) schemas. Tag names are in the top-level `tags` list (e.g. `entries`, `media`, `texts`, `dialects`, `sources`). Fetching with no query params returns everything (this document).',
        '',
        '## Clients',
        'Any standard HTTP client works (curl, Python `requests`/`urllib`, fetch, etc.) — there is nothing special about this API. Sending a descriptive `User-Agent` (e.g. naming your import tool) is good practice.',
      ].join('\n'),
    },
    servers: [{ url: origin }],
    security: [{ bearerAuth: [] }],
    paths: {
      ...media_paths,
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
          description: 'Entry summaries for verification / live counts. Ordered by `updated_at` ASC. Paginated via `limit` (default 100, max 500) + `offset`; `has_more` tells you when to fetch the next page. GOTCHA: `limit` is silently capped at 500 — advance `offset` by the number of entries RETURNED while `has_more` is true, never by your requested limit (a `returned < limit` break-condition silently truncates when limit > 500). (For idempotent imports, prefer a local `external_id`→`entry_id` ledger over paginating for dedupe.)',
          parameters: [
            dict_id_param,
            { name: 'elicitation_id', in: 'query', schema: { type: 'string' }, description: 'Exact match.' },
            { name: 'lexeme', in: 'query', schema: { type: 'string' }, description: 'Match the headword. Substring (case-insensitive) by default; pass `match=exact` for an exact, case-sensitive match against any orthography\'s spelling.' },
            { name: 'match', in: 'query', schema: { type: 'string', enum: ['substring', 'exact'], default: 'substring' }, description: 'How `lexeme` is matched. `exact` matches a whole spelling in any locale (use it to check whether a specific headword already exists).' },
            { name: 'updated_since', in: 'query', schema: { type: 'string', format: 'date-time' }, description: 'ISO timestamp, exclusive.' },
            { name: 'include', in: 'query', schema: { type: 'string', enum: ['senses'] }, description: 'Pass `senses` to attach each entry\'s senses (glosses/definition/POS/domains) in one batched query — the efficient way to bulk-read/export a dictionary\'s meanings without a per-entry request.' },
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
        get: { summary: 'Read one entry (full nested)', description: 'Returns the full nested entry (the READ shape — see `EntryResponse`). NOTE the input→output asymmetry: scalars you POST at the top level are read back under `entry.main`; `senses[].example_sentences` are read back as `senses[].sentences`. Pass `?include=relationships` to also attach `entry.relationships` (see `RelationshipView`).', parameters: [dict_id_param, entry_id_param, { name: 'include', in: 'query', schema: { type: 'string', enum: ['relationships'] }, description: 'Pass `relationships` to attach this entry\'s typed relationships as `entry.relationships`.' }], responses: { 200: { description: 'The full nested entry', content: { 'application/json': { schema: { $ref: '#/components/schemas/EntryResponse' } } } }, 404: { description: 'Not found' } } },
        patch: {
          summary: 'Update an entry (field-merge)',
          description: 'Field-merge: provided fields overwrite, omitted ones stay. `senses` are a true upsert by client `id` (id on this entry → field-merge; unknown id or none → create the sense WITH that id; an id on a different entry → 400); example sentences upsert by id (no duplicate links) / append without one; `dialects`/`tags` are additive links (this call never removes them). For surgical single-row edits/deletes — one sentence, sense, tag, or dialect — use the dedicated `…/sentences/{id}`, `…/senses/{id}`, `…/tags/{id}`, `…/dialects/{id}` routes (see "Edits & deletes"). Returns the updated entry in the READ shape (`EntryResponse`).',
          parameters: [dict_id_param, entry_id_param],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/EntryPatch' } } } },
          responses: { 200: { description: 'The updated nested entry', content: { 'application/json': { schema: { $ref: '#/components/schemas/EntryResponse' } } } }, 400: {}, 404: {} },
        },
        delete: { summary: 'Delete an entry (cascades senses/junctions)', parameters: [dict_id_param, entry_id_param], responses: { 200: { description: "{ result: 'deleted' }" }, 404: {} } },
      },
      '/api/v1/dictionaries/{id}/entries/batch-delete': {
        post: {
          summary: 'Delete every entry from one bulk import (dry-run + confirm)',
          description: 'Bad-import recovery: removes the whole batch identified by `import_id` (the private tag stamped on every entry of a bulk `POST …/entries`; matched case-insensitively). Two-step by design: call with `"dry_run": true` first — it reports `{ count, sample_entry_ids }` and writes NOTHING — then arm the real run by echoing that count back as `confirm_count` (a mismatch with the live count → 409, so a stale script can\'t delete a re-imported batch). Deletes cascade each entry\'s senses and links, the emptied private tag is removed too, and orphaned standalone example sentences are deliberately left in place. Unknown `import_id` → 404. Editor+.',
          parameters: [dict_id_param],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['import_id'], properties: {
            import_id: { type: 'string', description: 'The `import_id` used on the original bulk entry POST.' },
            dry_run: { type: 'boolean', description: 'true → report the blast radius only, no writes.' },
            confirm_count: { type: 'integer', description: 'Required for a real run: the `count` a dry-run just reported.' },
          } } } } },
          responses: { 200: { description: '{ import_id, count, sample_entry_ids, deleted, tag_deleted? }', content: { 'application/json': { schema: { type: 'object', properties: {
            import_id: { type: 'string' },
            count: { type: 'integer', description: 'Dry-run: entries that WOULD be deleted. Real run: entries actually deleted.' },
            sample_entry_ids: { type: 'array', items: { type: 'string' }, maxItems: 20 },
            deleted: { type: 'boolean' },
            tag_deleted: { type: 'boolean', description: 'Real run only: the emptied private import tag was removed.' },
          } } } } }, 400: { description: 'Missing import_id, or a real run without confirm_count' }, 404: { description: 'No private import tag with that name' }, 409: { description: 'confirm_count does not match the live count — re-run dry_run' } },
        },
      },
      '/api/v1/dictionaries/{id}/entries/{entryId}/tags/{tagId}': {
        delete: { summary: 'Unlink a tag from this entry', description: 'Removes ONE tag from ONE entry; the tag (and its links to other entries) survives. To delete the tag everywhere use `DELETE …/tags/{tagId}`.', parameters: [dict_id_param, entry_id_param, tag_id_param], responses: { 200: { description: "{ result: 'unlinked' }" }, 404: { description: 'Tag not linked to this entry' } } },
      },
      '/api/v1/dictionaries/{id}/relationships': {
        get: {
          summary: 'List an entry\'s relationships',
          description: 'Every relationship touching `entry_id` (both directions), shaped from that entry\'s viewpoint (`direction` + inverse label already resolved). Read access.',
          parameters: [dict_id_param, { name: 'entry_id', in: 'query', required: true, schema: { type: 'string' }, description: 'The entry to list relationships for.' }],
          responses: { 200: { description: '{ relationships: RelationshipView[] }', content: { 'application/json': { schema: { type: 'object', properties: { relationships: { type: 'array', items: { $ref: '#/components/schemas/RelationshipView' } } } } } } }, 400: { description: 'Missing entry_id' } },
        },
        post: {
          summary: 'Create relationships (single or batch)',
          description: 'Link two entries (optionally narrowed to senses) with a global or custom type. Body: ONE relationship object (response `{ relationship, created }`), or a batch — a bare array or `{ relationships: [...] }`, ≤1000/request (response `{ created, existed, failed, results }` with per-item results in input order — same contract as bulk entries; use batches for cognate ledgers and other large relationship sets). Idempotent either way: an identical relationship is a no-op (`created: false` / status `exists`), symmetric types also dedupe the reverse direction, and a batch is per-item best-effort (one bad item doesn\'t abort the rest — re-POST only the `failed` ones). Editor+.',
          parameters: [dict_id_param],
          requestBody: { required: true, content: { 'application/json': { schema: { oneOf: [
            { $ref: '#/components/schemas/RelationshipInput' },
            { type: 'array', items: { $ref: '#/components/schemas/RelationshipInput' } },
            { type: 'object', properties: { relationships: { type: 'array', items: { $ref: '#/components/schemas/RelationshipInput' } } }, required: ['relationships'] },
          ] } } } },
          responses: { 200: { description: 'Single: { relationship, created }. Batch: { created, existed, failed, results }.', content: { 'application/json': { schema: { oneOf: [
            { type: 'object', properties: { relationship: { $ref: '#/components/schemas/RelationshipView' }, created: { type: 'boolean', description: 'false = idempotent no-op (an identical relationship already existed).' } } },
            { type: 'object', properties: { created: { type: 'integer' }, existed: { type: 'integer', description: 'Idempotent no-ops (an identical relationship already existed).' }, failed: { type: 'integer' }, results: { type: 'array', description: 'Per-item, in input order.', items: { type: 'object', properties: { status: { type: 'string', enum: ['created', 'exists', 'failed'] }, relationship_id: { type: 'string' }, error: { type: 'string' } } } } } },
          ] } } } }, 400: { description: 'Bad input (single: missing/duplicate type, unknown entry/sense/source, self-link; batch: empty or >1000 items)' } },
        },
      },
      '/api/v1/dictionaries/{id}/relationships/{relationshipId}': {
        delete: { summary: 'Delete a relationship', description: 'Removes ONE relationship by id (tombstone → cascade). Editor+.', parameters: [dict_id_param, relationship_id_param], responses: { 200: { description: "{ result: 'deleted' }" }, 404: { description: 'Relationship not found' } } },
      },
      '/api/v1/dictionaries/{id}/entries/{entryId}/dialects/{dialectId}': {
        delete: { summary: 'Unlink a dialect from this entry', description: 'Removes ONE dialect from ONE entry; the dialect survives globally. To delete it everywhere use `DELETE …/dialects/{dialectId}`.', parameters: [dict_id_param, entry_id_param, dialect_id_param], responses: { 200: { description: "{ result: 'unlinked' }" }, 404: { description: 'Dialect not linked to this entry' } } },
      },
      '/api/v1/dictionaries/{id}/sentences': {
        post: {
          summary: 'Create a standalone sentence',
          description: 'Create a first-class sentence without attaching it to a sense or text. Use this for free-standing grammar examples, then attach the returned id to a grammar section (`POST …/grammar/sections/{sectionId}/sentences`) and/or link it to a sense (`PATCH …/entries/{entryId}` with `example_sentences: [{ id }]`). A client-supplied id makes retries idempotent.',
          parameters: [dict_id_param],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SentenceInput' } } } },
          responses: { 200: { description: '{ sentence, created }', content: { 'application/json': { schema: { type: 'object', properties: { sentence: { $ref: '#/components/schemas/SentenceFull' }, created: { type: 'boolean' } } } } } }, 400: { description: 'Missing content / bad id / unknown source' } },
        },
      },
      '/api/v1/dictionaries/{id}/sentences/{sentenceId}': {
        get: {
          summary: 'Read one sentence',
          description: 'Read any sentence by id, including a standalone grammar example.',
          parameters: [dict_id_param, sentence_id_param],
          responses: { 200: { description: '{ sentence }', content: { 'application/json': { schema: { type: 'object', properties: { sentence: { $ref: '#/components/schemas/SentenceFull' } } } } } }, 404: {} },
        },
        patch: {
          summary: 'Edit one sentence',
          description: 'Field-merge one sentence, whether it is sense-linked, text-owned, or standalone. Returns `{ sentence }`.',
          parameters: [dict_id_param, sentence_id_param],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SentencePatch' } } } },
          responses: { 200: { description: 'The updated sentence', content: { 'application/json': { schema: { type: 'object', properties: { sentence: { $ref: '#/components/schemas/SentenceFull' } } } } } }, 400: {}, 404: {} },
        },
        delete: { summary: 'Delete one sentence', description: 'Deletes the sentence and its sense/grammar links.', parameters: [dict_id_param, sentence_id_param], responses: { 200: { description: "{ result: 'deleted' }" }, 404: {} } },
      },
      '/api/v1/dictionaries/{id}/senses/{senseId}': {
        delete: { summary: 'Delete one sense', description: 'Deletes a single sense and its sentence/media links. Refused (400) when it is the entry\'s ONLY sense — delete the entry instead.', parameters: [dict_id_param, sense_id_param], responses: { 200: { description: "{ result: 'deleted' }" }, 400: { description: "Can't delete an entry's only sense" }, 404: {} } },
      },
      '/api/v1/dictionaries/{id}/texts': {
        get: {
          summary: 'List texts',
          description: 'Each text with its `sentence_count` and any classification `tags`. Pass `tag` for an exact, case-insensitive tag-name match.',
          parameters: [dict_id_param, { name: 'tag', in: 'query', schema: { type: 'string' }, description: 'Exact classification tag name, matched case-insensitively after trimming.' }],
          responses: { 200: { description: '{ texts }', content: { 'application/json': { schema: { type: 'object', properties: { texts: { type: 'array', items: { $ref: '#/components/schemas/TextSummary' } } } } } } } },
        },
        post: {
          summary: 'Create a text (with ordered sentences)',
          description: 'Create a connected text/story plus its ordered sentences (sort_keys assigned in array order). Supply your own `id` (UUID) for idempotency — a re-POST of an existing id is a no-op (`created: false`). A text-sentence is standalone (not attached to a sense).',
          parameters: [dict_id_param],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TextInput' } } } },
          responses: { 200: { description: '{ text, created }', content: { 'application/json': { schema: { type: 'object', properties: { text: { $ref: '#/components/schemas/TextFull' }, created: { type: 'boolean' } } } } } }, 400: { description: 'Missing title / bad id' } },
        },
      },
      '/api/v1/dictionaries/{id}/texts/{textId}': {
        get: { summary: 'Read one text (sentences + tags + audio + speakers)', description: 'The text with its ordered sentences, classification tags, attached audio (text- and sentence-level, each with `timings` + `download_url`), and the full records of every referenced speaker — one call serves a complete text read.', parameters: [dict_id_param, { name: 'textId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: '{ text }', content: { 'application/json': { schema: { type: 'object', properties: { text: { $ref: '#/components/schemas/TextFull' } } } } } }, 404: {} } },
        patch: {
          summary: 'Update a text (title / append / reorder)',
          description: 'Field-merge the title, append new sentences, and/or reorder existing sentences (`sentence_order`). Edit ONE sentence\'s text/translation/paragraph-break via `PATCH …/sentences/{id}`; delete one via `DELETE …/sentences/{id}`.',
          parameters: [dict_id_param, { name: 'textId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TextPatch' } } } },
          responses: { 200: { description: '{ text }', content: { 'application/json': { schema: { type: 'object', properties: { text: { $ref: '#/components/schemas/TextFull' } } } } } }, 400: {}, 404: {} },
        },
        delete: { summary: 'Delete a text (and its sentences)', parameters: [dict_id_param, { name: 'textId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: "{ result: 'deleted' }" }, 404: {} } },
      },
      '/api/v1/dictionaries/{id}/feedback': {
        post: {
          summary: 'Send feedback to the LD team',
          description: 'Blocked, missing a field, or something\'s awkward? Tell us here — it reaches the Living Dictionaries team directly (you do NOT need your human to relay it). Works with read OR write keys. Rate-limited. After sending, TELL YOUR HUMAN what you requested: the response includes a `relay_to_human` sentence to pass along (if we adopt it, we notify your human directly).',
          parameters: [dict_id_param],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['message'], properties: { message: { type: 'string', maxLength: 4000, description: 'What you need / what\'s wrong. Max 4000 characters.' }, kind: { type: 'string', enum: ['missing_field', 'bug', 'awkward', 'other'] } } } } } },
          responses: { 200: { description: '{ received: true, relay_to_human }' }, 400: { description: 'Empty/too-long message' }, 429: { description: 'Rate-limited (non-blocking — earlier feedback was received)' } },
        },
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
      '/api/v1/dictionaries/{id}/featured-entries': {
        get: { summary: 'List featured (starred) entries', description: 'Editor-starred favorites shown on the dictionary home page, in strip order. Returns `{ featured_entries: [{ id, entry_id, sort_key }] }`.', parameters: [dict_id_param], responses: { 200: { description: '{ featured_entries }' } } },
        post: { summary: 'Star an entry', description: 'Adds the entry to the END of the dictionary-home featured strip. Idempotent: re-starring returns the existing row with `created: false`. Editor+.', parameters: [dict_id_param], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['entry_id'], properties: { entry_id: { type: 'string' } } } } } }, responses: { 200: { description: '{ featured_entry, created }' }, 404: { description: 'Unknown entry' } } },
        patch: { summary: 'Reorder the featured strip', description: '`order` must list EVERY currently-starred entry id exactly once, in the desired display order. Editor+.', parameters: [dict_id_param], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['order'], properties: { order: { type: 'array', items: { type: 'string' }, description: 'Entry ids (not featured-row ids) in the desired order.' } } } } } }, responses: { 200: { description: '{ featured_entries } in the new order' }, 400: { description: 'Order incomplete / lists an unstarred entry' } } },
      },
      '/api/v1/dictionaries/{id}/featured-entries/{entryId}': {
        delete: { summary: 'Unstar an entry', description: 'Removes the entry from the dictionary-home featured strip (by ENTRY id — one star per entry).', parameters: [dict_id_param, entry_id_param], responses: { 200: { description: "{ result: 'deleted' }" }, 404: { description: 'Entry is not starred' } } },
      },
      '/api/v1/dictionaries/{id}/dialects': {
        get: { summary: 'List dialects', description: 'Each dialect with its `name` and `coordinates` (areal-extent geometry, or `null`).', parameters: [dict_id_param], responses: { 200: { description: '{ dialects }' } } },
        post: { summary: 'Find-or-create a dialect', description: 'Found-or-created by case-insensitive name. Optional `coordinates` set the variety\'s areal extent — applied on CREATE only (edit later via PATCH). Returns `{ dialect, created }`.', parameters: [dict_id_param], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, coordinates: { ...CoordinatesNullableRef, description: 'The variety\'s areal-extent geometry (points/regions). Applied only when the dialect is newly created.' } } } } } }, responses: { 200: { description: '{ dialect, created }' }, 400: { description: 'Invalid coordinates' } } },
      },
      '/api/v1/dictionaries/{id}/dialects/{dialectId}': {
        patch: { summary: 'Edit a dialect (name / coordinates)', description: 'Rename the dialect (plain string or locale map) and/or replace its `coordinates` (the variety\'s areal extent — whole-object replace; `null` clears; omit → untouched). Affects EVERY entry it is on. Returns `{ dialect }`.', parameters: [dict_id_param, dialect_id_param], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: StringOrMultiString, coordinates: { ...CoordinatesNullableRef, description: 'Replace the dialect\'s areal-extent geometry; `null` clears; omit → untouched.' } } } } } }, responses: { 200: { description: '{ dialect }' }, 400: { description: 'Name collides / invalid coordinates' }, 404: {} } },
        delete: { summary: 'Delete a dialect (globally)', description: 'Deletes the dialect and unlinks it from every entry. To remove it from just one entry use `DELETE …/entries/{entryId}/dialects/{dialectId}`.', parameters: [dict_id_param, dialect_id_param], responses: { 200: { description: "{ result: 'deleted' }" }, 404: {} } },
      },
      '/api/v1/dictionaries/{id}/gloss-languages': {
        post: { summary: 'Add a gloss language', description: 'Registers another locale code glosses/translations can be keyed by (e.g. importing a French-glossed source into an en/zh dictionary → add `fr` first). The code must be in Living Dictionaries\' supported glossing-languages list. Write key / manager+.', parameters: [dict_id_param], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['code'], properties: { code: { type: 'string', description: 'A supported gloss-language code, e.g. `fr`.' } } } } } }, responses: { 200: { description: '{ gloss_languages } — the updated full list', content: { 'application/json': { schema: { type: 'object', properties: { gloss_languages: { type: 'array', items: { type: 'string' } } } } } } }, 400: { description: 'Unsupported code or already present' } } },
      },
      '/api/v1/dictionaries/{id}/gloss-languages/{code}': {
        delete: { summary: 'Remove a gloss language', description: 'Refused while any sense/sentence still stores gloss/definition/translation text under the code (clear those first).', parameters: [dict_id_param, { name: 'code', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: '{ gloss_languages }' }, 400: { description: 'Not on this dictionary, or still in use' } } },
      },
      '/api/v1/dictionaries/{id}/orthographies': {
        get: { summary: 'List orthographies', description: 'The dictionary\'s ALTERNATE writing systems (the primary headword, keyed `default`, is implicit and excluded), each with `used_by` counts of entries/sentences that store text under it.', parameters: [dict_id_param], responses: { 200: { description: '{ orthographies }' } } },
        post: { summary: 'Add an orthography', description: 'Registers an alternate writing system. `code` is required, unique, and immutable; a `code` that is a known writing system auto-wires its Keyman keyboard. After creating it, write each spelling under that `code` key inside an entry\'s `lexeme` (or a sentence\'s `text`).', parameters: [dict_id_param], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/OrthographyInput' } } } }, responses: { 200: { description: '{ orthography }' }, 400: { description: 'Reserved/duplicate/invalid code' } } },
        put: { summary: 'Reorder orthographies', description: 'Sets the display order of the alternate orthographies. Send `{ order: [code, …] }` listing every alternate code exactly once.', parameters: [dict_id_param], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['order'], properties: { order: { type: 'array', items: { type: 'string' } } } } } } }, responses: { 200: { description: '{ orthographies }' }, 400: { description: 'Order must list every alternate code exactly once' } } },
      },
      '/api/v1/dictionaries/{id}/orthographies/{code}': {
        patch: { summary: 'Relabel an orthography', description: 'Edits `name` / `bcp` / `notes` (the `code` itself never changes). Works on the primary too — PATCH `default` to label the main headword + attach a keyboard.', parameters: [dict_id_param, orthography_code_param], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, bcp: { type: 'string', nullable: true }, notes: { type: 'string', nullable: true } } } } } }, responses: { 200: { description: '{ orthography }' }, 400: { description: 'Not found' } } },
        delete: { summary: 'Delete an orthography', description: 'Removes an alternate orthography. Refused while any entry/sentence still stores text under its `code` (clear those first). The primary `default` cannot be deleted.', parameters: [dict_id_param, orthography_code_param], responses: { 200: { description: '{ deleted, was_using }' }, 400: { description: 'In use, primary, or not found' } } },
      },
      '/api/v1/dictionaries/{id}/sources': {
        get: { summary: 'List sources', description: 'The dictionary\'s citation registry, each with `used_by` reference counts.', parameters: [dict_id_param], responses: { 200: { description: '{ sources }' } } },
        post: { summary: 'Create a source', description: 'Adds a citation record. `slug` is required and must be unique. Entries/sentences reference sources by slug, so create sources here BEFORE citing them on a write (an unknown slug rejects the write).', parameters: [dict_id_param], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SourceInput' } } } }, responses: { 200: { description: '{ source }' }, 400: { description: 'Missing/duplicate slug or invalid type' } } },
      },
      '/api/v1/dictionaries/{id}/sources/{sourceId}': {
        patch: { summary: 'Edit source metadata', description: 'Field-merges citation metadata (and optionally renames the `slug`). Avoid renaming a slug that is already in use — the rename does not rewrite referencing rows.', parameters: [dict_id_param, source_id_param], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SourceInput' } } } }, responses: { 200: { description: '{ source }' }, 400: { description: 'Slug collision or invalid type' }, 404: {} } },
        delete: { summary: 'Delete a source', description: 'Refuses with 409 while the source is still referenced. Pass `?remove_from_all=true` to strip the slug from every referencing entry/sentence/text first and then delete.', parameters: [dict_id_param, source_id_param, { name: 'remove_from_all', in: 'query', required: false, schema: { type: 'boolean' } }], responses: { 200: { description: "{ result: 'deleted', removed_from }" }, 409: { description: 'Still referenced (retry with remove_from_all)' }, 404: {} } },
      },
      '/api/v1/dictionaries/{id}/files': {
        get: { summary: 'List uploaded import resources', description: 'Every uploaded resource with its uploader-written `import_instructions` (authoritative — follow them), optional `source_note`, and request-batch summaries. Write scope required (file names + instructions are never public).', parameters: [dict_id_param], responses: { 200: { description: '{ files, requests }', content: { 'application/json': { schema: { type: 'object', properties: { files: { type: 'array', items: { $ref: '#/components/schemas/SourceFile' } }, requests: { type: 'array', items: { $ref: '#/components/schemas/ImportRequest' } } } } } } } } },
        post: { summary: 'Register an upload', description: 'Registers the file and returns `{ file, upload_url }` — PUT the raw bytes to `upload_url` (Content-Type must match `mimetype`), then `POST …/files/{fileId}/confirm`. 100MB cap per file.', parameters: [dict_id_param], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['filename', 'mimetype', 'size_bytes'], properties: { filename: { type: 'string' }, mimetype: { type: 'string' }, size_bytes: { type: 'integer' } } } } } }, responses: { 200: { description: '{ file, upload_url }' }, 400: { description: 'Missing fields or over the 100MB cap' } } },
      },
      '/api/v1/dictionaries/{id}/files/{fileId}': {
        get: { summary: 'Download the resource bytes', description: 'Streams the original file (Content-Disposition: attachment).', parameters: [dict_id_param, file_id_param], responses: { 200: { description: 'The file bytes' }, 404: {} } },
        patch: { summary: 'Update file metadata / link to a source', description: 'Update `import_instructions`, `source_note`, `filename`, or set `source_id` to an EXISTING dict source (create it first via `POST …/sources`) to file this resource under its permanent source — do this when the resource is a real citable work (a published dictionary scan, a thesis…), not for ad-hoc working spreadsheets. After an import is requested, only the original uploader or a site admin may update it; the update appends to/reopens the request thread and notifies its assignee.', parameters: [dict_id_param, file_id_param], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { filename: { type: 'string' }, import_instructions: { type: 'string', nullable: true }, source_note: { type: 'string', nullable: true }, source_id: { type: 'string', nullable: true } } } } } }, responses: { 200: { description: '{ file }' }, 400: { description: 'Unknown source_id / empty filename' }, 403: { description: 'Requested resource owned by another uploader' }, 404: {} } },
        delete: { summary: 'Delete an uploaded resource', description: 'Removes the row + stored bytes. After an import is requested, only the original uploader or a site admin may delete it; deletion appends to/reopens the original thread and notifies its assignee.', parameters: [dict_id_param, file_id_param], responses: { 200: { description: "{ result: 'deleted' }" }, 403: { description: 'Requested resource owned by another uploader' }, 404: {} } },
      },
      '/api/v1/dictionaries/{id}/files/{fileId}/confirm': {
        post: { summary: 'Confirm an upload landed', description: 'Verifies the bytes exist in storage (and enforces the size cap on what was actually stored). Call after the PUT.', parameters: [dict_id_param, file_id_param], responses: { 200: { description: '{ file }' }, 400: { description: 'No bytes found / oversize (removed)' }, 404: {} } },
      },
      '/api/v1/dictionaries/{id}/files/request-import': {
        post: { summary: 'Ask the Living Dictionaries team to import these files', description: 'Turns a batch of uploaded, instruction-carrying files into a request message for the LD team (humans normally do this from the Import page — agents rarely need it).', parameters: [dict_id_param], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['file_ids'], properties: { file_ids: { type: 'array', items: { type: 'string' } }, message: { type: 'string' } } } } } }, responses: { 200: { description: '{ ok, thread_id }' }, 400: { description: 'Unconfirmed / instruction-less / already-requested file' } } },
      },
      '/api/v1/dictionaries/{id}/files/requests/{threadId}': {
        patch: { summary: 'Update an import request note', description: 'Updates the once-per-batch overall note, appends the change to/reopens the original request thread, and notifies its current assignee. Original requester or site admin only.', parameters: [dict_id_param, { name: 'threadId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['request_note'], properties: { request_note: { type: 'string', nullable: true } } } } } }, responses: { 200: { description: '{ request }' }, 403: { description: 'Import request owned by another requester' }, 404: {} } },
      },
      '/api/v1/guides': {
        get: { summary: 'List the format-import guides', description: 'Public. Returns `{ guides: [{ slug, title, description, url }] }` in recommended reading order (`importing` first).', responses: { 200: { description: '{ guides }' } } },
      },
      '/api/v1/guides/{slug}': {
        get: { summary: 'Read one guide (markdown)', description: 'Public. Returns the guide as `text/markdown`.', parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Markdown text' }, 404: {} } },
      },
      // Structured grammar (tag: grammar) — see .issues/structured-grammar.md
      '/api/v1/dictionaries/{id}/grammar/sections': {
        get: { summary: 'List grammar sections', description: 'Returns the ordered section tree. Filter with `?entry_id=` (sections documenting one headword) or `?parent_id=` (one level; empty = top-level).', parameters: [dict_id_param, { name: 'entry_id', in: 'query', required: false, schema: { type: 'string' } }, { name: 'parent_id', in: 'query', required: false, schema: { type: 'string' } }], responses: { 200: { description: '{ sections }', content: { 'application/json': { schema: { type: 'object', properties: { sections: { type: 'array', items: { $ref: '#/components/schemas/GrammarSectionFull' } } } } } } } } },
        post: { summary: 'Create a grammar section', description: 'Create a section (optionally nested under `parent_id`, positioned after `after_section_id`), optionally linked to an entry/sense with pre-attached example sentences. Supply your own `id` for idempotency. At least one of `title`/`body` is required.', parameters: [dict_id_param], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GrammarSectionInput' } } } }, responses: { 200: { description: '{ section, created }', content: { 'application/json': { schema: { type: 'object', properties: { section: { $ref: '#/components/schemas/GrammarSectionFull' }, created: { type: 'boolean' } } } } } }, 400: { description: 'Empty section (needs a title or body) / bad parent/entry id' } } },
      },
      '/api/v1/dictionaries/{id}/grammar/sections/{sectionId}': {
        get: { summary: 'Read a grammar section', parameters: [dict_id_param, section_id_param], responses: { 200: { description: '{ section }', content: { 'application/json': { schema: { type: 'object', properties: { section: { $ref: '#/components/schemas/GrammarSectionFull' } } } } } }, 404: {} } },
        patch: { summary: 'Update / move a grammar section', description: 'Field-merge; `parent_id` + `after_section_id` re-nest/reorder.', parameters: [dict_id_param, section_id_param], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GrammarSectionPatch' } } } }, responses: { 200: { description: '{ section }' }, 404: {} } },
        delete: { summary: 'Delete a grammar section', description: 'Cascades to descendant sections and detaches its example-sentence links (the sentences themselves are untouched).', parameters: [dict_id_param, section_id_param], responses: { 200: { description: "{ result: 'deleted' }" }, 404: {} } },
      },
      '/api/v1/dictionaries/{id}/grammar/sections/{sectionId}/sentences': {
        post: { summary: 'Attach an example sentence to a section', description: 'Links an EXISTING sentence (by `sentence_id`) as evidence — a reference, not a copy. Order with `after_sentence_id`.', parameters: [dict_id_param, section_id_param], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['sentence_id'], properties: { sentence_id: { type: 'string' }, after_sentence_id: { type: 'string', description: 'Existing attached sentence id to insert after; omit → append.' } } } } } }, responses: { 200: { description: '{ link }', content: { 'application/json': { schema: { type: 'object', properties: { link: { $ref: '#/components/schemas/SectionSentenceRef' } } } } } }, 404: { description: 'Section or sentence not found' } } },
      },
      '/api/v1/dictionaries/{id}/grammar/sections/{sectionId}/sentences/{sentenceId}': {
        delete: { summary: 'Detach an example sentence from a section', description: 'Removes the reference only; the sentence survives.', parameters: [dict_id_param, section_id_param, sentence_id_param], responses: { 200: { description: "{ result: 'unlinked' }" }, 404: { description: 'Sentence not attached to this section' } } },
      },
      '/api/v1/dictionaries/{id}/grammar/clause-slots': {
        get: { summary: 'List clause-template slots', description: 'The ordered slot set defining the clause template.', parameters: [dict_id_param], responses: { 200: { description: '{ clause_slots }', content: { 'application/json': { schema: { type: 'object', properties: { clause_slots: { type: 'array', items: { $ref: '#/components/schemas/ClauseSlotFull' } } } } } } } } },
        post: { summary: 'Create a clause-template slot', description: 'Order with `after_slot_id`.', parameters: [dict_id_param], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ClauseSlotInput' } } } }, responses: { 200: { description: '{ clause_slot, created }' }, 400: {} } },
      },
      '/api/v1/dictionaries/{id}/grammar/clause-slots/{slotId}': {
        patch: { summary: 'Rename / reorder a clause slot', parameters: [dict_id_param, slot_id_param], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ClauseSlotInput' } } } }, responses: { 200: { description: '{ clause_slot }' }, 404: {} } },
        delete: { summary: 'Delete a clause slot', description: 'Sections referencing it have their `slot_id` cleared.', parameters: [dict_id_param, slot_id_param], responses: { 200: { description: "{ result: 'deleted' }" }, 404: {} } },
      },
      '/api/v1/dictionaries/{id}/entries/{entryId}/grammar': {
        get: { summary: 'List grammar sections documenting an entry', description: 'The reverse of a section\'s `entry_id` link — the "grammar notes" for this headword.', parameters: [dict_id_param, entry_id_param], responses: { 200: { description: '{ sections }', content: { 'application/json': { schema: { type: 'object', properties: { sections: { type: 'array', items: { $ref: '#/components/schemas/GrammarSectionFull' } } } } } } } } },
      },
      // Interlinear glossing legend (tag: grammar) — the abbreviations key (3PL → "third person plural")
      '/api/v1/dictionaries/{id}/grammar/glossing-abbreviations': {
        get: { summary: 'List glossing abbreviations', description: 'The dictionary\'s gloss legend that makes IGT gloss lines self-documenting.', parameters: [dict_id_param], responses: { 200: { description: '{ glossing_abbreviations }', content: { 'application/json': { schema: { type: 'object', properties: { glossing_abbreviations: { type: 'array', items: { $ref: '#/components/schemas/GlossingAbbreviationFull' } } } } } } } } },
        post: { summary: 'Add a glossing abbreviation (find-or-create)', description: 'Find-or-create by `code`. Seed the standard Leipzig set here, then add custom codes.', parameters: [dict_id_param], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GlossingAbbreviationInput' } } } }, responses: { 200: { description: '{ glossing_abbreviation, created }' }, 400: {} } },
      },
      '/api/v1/dictionaries/{id}/grammar/glossing-abbreviations/{code}': {
        patch: { summary: 'Edit a glossing abbreviation', parameters: [dict_id_param, glossing_code_param], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GlossingAbbreviationInput' } } } }, responses: { 200: { description: '{ glossing_abbreviation }' }, 404: {} } },
        delete: { summary: 'Delete a glossing abbreviation', parameters: [dict_id_param, glossing_code_param], responses: { 200: { description: "{ result: 'deleted' }" }, 404: {} } },
      },
      // Text classification tags / motif index (tag: texts)
      '/api/v1/dictionaries/{id}/texts/{textId}/tags': {
        get: { summary: 'List a text\'s classification tags', description: 'Genre / motif / tale-type tags on a text.', parameters: [dict_id_param, text_id_param], responses: { 200: { description: '{ tags }', content: { 'application/json': { schema: { type: 'object', properties: { tags: { type: 'array', items: { $ref: '#/components/schemas/TextTagView' } } } } } } } } },
        post: { summary: 'Tag a text (find-or-create)', description: 'Attaches a classification tag (reuses the entry-tag registry with `kind`/`code` classification columns).', parameters: [dict_id_param, text_id_param], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TextTagInput' } } } }, responses: { 200: { description: '{ tag, created }' }, 400: {} } },
      },
      '/api/v1/dictionaries/{id}/texts/{textId}/tags/{tagId}': {
        delete: { summary: 'Untag a text', description: 'Unlinks one tag from this text; the tag survives.', parameters: [dict_id_param, text_id_param, tag_id_param], responses: { 200: { description: "{ result: 'unlinked' }" }, 404: {} } },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', description: 'A Living Dictionaries API key (`ldk_…`) minted on the dictionary\'s Agents page.' },
      },
      schemas: {
        MultiString,
        LngLat,
        GeoPoint,
        GeoRegion,
        Coordinates,
        SentenceInput,
        SenseInput,
        EntryInput,
        SensePatch,
        SentencePatch,
        EntryPatch,
        OrthographyInput,
        SourceInput,
        SourceFile,
        ImportRequest,
        EntryWriteResult,
        EntriesWriteResponse,
        SenseSummary,
        EntrySummary,
        EntriesListResponse,
        SentenceFull,
        SenseFull,
        EntryMain,
        EntryFull,
        EntryResponse,
        TextSentenceInput,
        TextInput,
        TextSentenceFull,
        TextSummary,
        TextFull,
        TextPatch,
        HostedElsewhere,
        SpeakerBrief,
        SpeakerFull,
        MediaTimings,
        AudioMedia,
        PhotoMedia,
        VideoMedia,
        RelationshipCustomType,
        RelationshipInput,
        RelationshipView,
        GrammarSectionInput,
        GrammarSectionPatch,
        SectionSentenceRef,
        GrammarSectionFull,
        ClauseSlotInput,
        ClauseSlotFull,
        TextTagInput,
        TextTagView,
        SourceCitation,
        Morpheme,
        SentenceTokenInput,
        SentenceTokenFull,
        GlossingAbbreviationInput,
        GlossingAbbreviationFull,
      },
    },
  }

  // Tag every operation (derived from its path) so the spec groups cleanly and the
  // `?tag=` slice can filter — see OPENAPI_TAGS + select_openapi_view.
  for (const [path, ops] of Object.entries(spec.paths as Record<string, Record<string, { tags?: string[] }>>)) {
    const tag = tag_for_path(path)
    for (const method of Object.keys(ops))
      ops[method].tags = [tag]
  }

  return spec as Record<string, unknown>
}

/**
 * The operation groups. Order = the order a reader should skim them. Drives both
 * the OpenAPI `tags` list and the `?tag=<name>` slice served by `select_openapi_view`.
 */
export const OPENAPI_TAGS = [
  { name: 'dictionary', description: 'Read the dictionary\'s metadata (gloss languages, orthographies, entry count) — call this first.' },
  { name: 'entries', description: 'Create, read, update, and delete entries, their senses, and example sentences.' },
  { name: 'media', description: 'Attach or remove audio, photos, and videos on entries, senses, sentences, and texts.' },
  { name: 'texts', description: 'Connected passages/stories with their own ordered sentences, plus `…/texts/{textId}/tags` classification (genre/motif/tale-type).' },
  { name: 'grammar', description: 'Structured, hierarchical grammar sections: parallel-language markdown prose linked to entries/senses, example sentences by reference, clause-template slots, usage conditions, and the glossing-abbreviations legend.' },
  { name: 'relationships', description: 'Typed links between two entries (optionally narrowed to senses).' },
  { name: 'dialects', description: 'Dialect labels and their areal-extent geometry.' },
  { name: 'tags', description: 'Entry tags.' },
  { name: 'speakers', description: 'Speaker records for audio/video attribution.' },
  { name: 'sources', description: 'The citation/source registry entries and sentences reference by slug.' },
  { name: 'files', description: 'Uploaded import resources (original spreadsheets, FLEx/LIFT exports, PDF scans…) with per-file import instructions — list, download, upload, link to sources. Write scope required for everything (never public).' },
  { name: 'guides', description: 'Format-import guides (markdown): how to parse + import spreadsheets, FLEx/LIFT/Toolbox, PDF scans, and the overall import workflow.' },
  { name: 'orthographies', description: 'Alternate writing systems.' },
  { name: 'featured-entries', description: 'The starred entries shown on the dictionary home page.' },
  { name: 'feedback', description: 'Send feedback/requests to the Living Dictionaries team.' },
] as const

const PATH_SEGMENT_TAGS: Record<string, string> = {
  'entries': 'entries',
  'senses': 'entries',
  'sentences': 'entries',
  'relationships': 'relationships',
  'media': 'media',
  'texts': 'texts',
  'feedback': 'feedback',
  'speakers': 'speakers',
  'tags': 'tags',
  'featured-entries': 'featured-entries',
  'dialects': 'dialects',
  'orthographies': 'orthographies',
  'gloss-languages': 'dictionary',
  'sources': 'sources',
  'files': 'files',
}

/** Derive an operation's tag from its path (media wins over the owning resource). */
export function tag_for_path(path: string): string {
  if (path.startsWith('/api/v1/guides'))
    return 'guides'
  if (/\/(?:audio|photos|videos)(?:\/|$)/.test(path))
    return 'media'
  // Grammar wins over the owning resource, so the entry reverse-lookup
  // (`/entries/{entryId}/grammar`) groups with the grammar surface.
  if (/\/grammar(?:\/|$)/.test(path))
    return 'grammar'
  const rest = path.replace('/api/v1/dictionaries/{id}', '')
  if (rest === '' || rest === '/')
    return 'dictionary'
  const [segment] = rest.split('/').filter(Boolean)
  return PATH_SEGMENT_TAGS[segment] ?? 'other'
}

/**
 * Progressive disclosure for the (large + growing) spec. The default full spec is
 * ~100KB; an agent can fetch a compact map first, then just the group it needs:
 *  • `view=index` → `info` + a `{ path → { method → { summary, tags } } }` map +
 *    the schema NAMES only. No property bodies — a cheap first read.
 *  • `tag=<name>` → only that group's paths, WITH the full ($ref-complete) schemas.
 *  • neither → the complete spec (backward compatible default).
 */
export function select_openapi_view({ spec, view, tag }: { spec: Record<string, unknown>, view?: string | null, tag?: string | null }): Record<string, unknown> {
  if (view === 'index')
    return build_openapi_index(spec)
  if (tag)
    return filter_openapi_by_tag({ spec, tag })
  return spec
}

function build_openapi_index(spec: Record<string, unknown>): Record<string, unknown> {
  const full_paths = spec.paths as Record<string, Record<string, { summary?: string, tags?: string[] }>>
  const paths: Record<string, Record<string, { summary?: string, tags?: string[] }>> = {}
  for (const [path, ops] of Object.entries(full_paths)) {
    paths[path] = {}
    for (const [method, op] of Object.entries(ops))
      paths[path][method] = { summary: op.summary, tags: op.tags }
  }
  const info = spec.info as { title?: string, version?: string }
  const schema_names = Object.keys((spec.components as { schemas?: Record<string, unknown> }).schemas ?? {})
  return {
    openapi: spec.openapi,
    tags: spec.tags,
    info: {
      title: info.title,
      version: info.version,
      description: [
        'COMPACT INDEX of the Living Dictionaries Write API. Each path lists its method(s), one-line summary, and tag.',
        'Every request needs `Authorization: Bearer ldk_…` (an API key scoped to one dictionary).',
        'Fetch the operations WITH full request/response schemas for a group via `?tag=<name>` (e.g. `openapi.json?tag=entries`); the tag names are in the top-level `tags` list. Omit all query params for the complete spec. `schema_names` lists every component schema.',
      ].join('\n'),
    },
    servers: spec.servers,
    paths,
    schema_names,
  }
}

function filter_openapi_by_tag({ spec, tag }: { spec: Record<string, unknown>, tag: string }): Record<string, unknown> {
  const full_paths = spec.paths as Record<string, Record<string, { tags?: string[] }>>
  const paths: Record<string, Record<string, unknown>> = {}
  for (const [path, ops] of Object.entries(full_paths)) {
    const kept = Object.fromEntries(Object.entries(ops).filter(([, op]) => op.tags?.includes(tag)))
    if (Object.keys(kept).length)
      paths[path] = kept
  }
  const tags = (spec.tags as { name: string }[]).filter(t => t.name === tag)
  // Keep ALL component schemas so every `$ref` in the kept paths still resolves.
  return { ...spec, tags, paths }
}
