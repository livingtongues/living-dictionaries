/**
 * OpenAPI 3.1 spec for the agent-facing `/api/v1` write API. Served as JSON from
 * `/api/v1/openapi.json`; this is the COMPREHENSIVE surface an agent fetches and
 * self-configures from (the human-facing page stays a one-liner). Hand-curated
 * (not generated) so the prose is agent-oriented.
 */

import { RELATIONSHIP_TYPES } from '$lib/constants'
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

  const SentenceInput = {
    type: 'object',
    description: 'An example sentence.',
    properties: {
      id: client_id_prop,
      text: { ...StringOrMultiString, description: 'The sentence in the vernacular.' },
      translation: { ...StringOrMultiString, description: 'Translation(s), keyed by gloss-language code.' },
      sources: { ...StringOrStringArray, description: 'Source slug(s) — each must already exist (create via `POST …/sources`).' },
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
      example_sentences: { type: 'array', items: { $ref: '#/components/schemas/SentenceInput' } },
    },
  }

  const EntryInput = {
    type: 'object',
    required: ['lexeme'],
    description: 'A dictionary entry (headword) with nested senses.',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Optional client-generated UUID (any version — deterministic uuid5 ids work well) — THE idempotency key. Generate it yourself and a re-POST of the same entry is a safe no-op (`status: "exists"`) instead of a duplicate, and you already know the id for later `PATCH …/entries/{id}` edits (no round-trip to discover it). Omit → the server mints one. Must be a valid UUID if provided.' },
      lexeme: { ...StringOrMultiString, description: 'The headword. Required.' },
      phonetic: { type: 'string' },
      interlinearization: { type: 'string' },
      morphology: { type: 'string' },
      notes: { ...StringOrMultiString, description: 'Rich text stored as MARKDOWN (headings/bold/lists/links) — write markdown, not HTML.' },
      linguistic_history: StringOrMultiString,
      sources: { ...StringOrStringArray, description: 'Source slug(s) — each must already exist in this dictionary\'s registry (create via `POST …/sources`); an unknown slug rejects the write.' },
      scientific_names: StringOrStringArray,
      elicitation_id: { type: 'string', description: 'Source-side stable id for word-list/elicitation ordering. Persisted and queryable via `?elicitation_id=`; use it as a server-recoverable dedupe key ONLY if your source id is genuinely elicitation data — for generic idempotency, supply your own `id` instead.' },
      dialects: { ...StringOrStringArray, description: 'Dialect names — found-or-created on this dictionary.' },
      tags: { ...StringOrStringArray, description: 'Tag names — found-or-created.' },
      senses: { type: 'array', items: { $ref: '#/components/schemas/SenseInput' }, description: 'Defaults to one empty sense if omitted.' },
    },
  }

  const SensePatch = {
    allOf: [{ $ref: '#/components/schemas/SenseInput' }],
    description: 'A sense within a PATCH — a true upsert by client id. With an `id` already on this entry → field-merge that sense; with an unknown `id` (or none) → create the sense WITH that id (deterministic import ids keep addressing the same sense across re-syncs). An `id` belonging to a different entry is a 400. Example sentences upsert by id (existing links are not duplicated); without an id they are appended.',
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
    },
  }

  const EntryPatch = {
    type: 'object',
    description: 'Partial entry update. Provided fields overwrite; omitted ones are untouched. `dialects`/`tags` are ADDITIVE links. `senses` upsert by client id (unknown id → created with that id — see SensePatch).',
    properties: {
      lexeme: StringOrMultiString,
      phonetic: { type: 'string' },
      interlinearization: { type: 'string' },
      morphology: { type: 'string' },
      notes: { ...StringOrMultiString, description: 'Rich text stored as MARKDOWN (headings/bold/lists/links) — write markdown, not HTML.' },
      linguistic_history: StringOrMultiString,
      sources: { ...StringOrStringArray, description: 'Source slug(s) — each must already exist (create via `POST …/sources`). Replaces the entry\'s current source list.' },
      scientific_names: StringOrStringArray,
      elicitation_id: { type: 'string' },
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
      type: { type: 'string', enum: ['dictionary', 'wordlist', 'fieldwork', 'manuscript', 'other'] },
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
      phonetic: { type: 'string', nullable: true },
      elicitation_id: { type: 'string', nullable: true },
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
    },
  }

  const TextInput = {
    type: 'object',
    required: ['title'],
    description: 'A text (long connected passage/story) with ordered sentences.',
    properties: {
      id: client_id_prop,
      title: { ...StringOrMultiString, description: 'The text\'s title. Required.' },
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
      ends_paragraph: { type: 'integer', nullable: true },
      sort_key: { type: 'string', nullable: true, description: 'Fractional ordering index within the text.' },
    },
  }

  const TextFull = {
    type: 'object',
    description: 'A text with its ordered sentences (read shape).',
    properties: {
      id: { type: 'string' },
      title: { $ref: '#/components/schemas/MultiString' },
      updated_at: { type: 'string', format: 'date-time' },
      sentences: { type: 'array', items: { $ref: '#/components/schemas/TextSentenceFull' }, description: 'Ordered by `sort_key` ascending.' },
    },
  }

  const TextPatch = {
    type: 'object',
    description: 'Edit a text: `title` overwrites; `append_sentences` add after the last sentence; `sentence_order` (a full list of existing sentence ids) reassigns their order. Edit a single sentence via `PATCH …/sentences/{id}`.',
    properties: {
      title: StringOrMultiString,
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
      text_id: { type: 'string', nullable: true, description: 'Set when the sentence belongs to a longer connected `text`; `null` for a standalone example sentence (the usual case for imports).' },
      sort_key: { type: 'string', nullable: true, description: 'Fractional ordering index within its `text_id`; `null` for standalone example sentences.' },
      ends_paragraph: { type: 'integer', nullable: true, description: '1 when a paragraph break follows this sentence within a `text`; otherwise `null`.' },
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
      phonetic: { type: 'string', nullable: true },
      interlinearization: { type: 'string', nullable: true },
      morphology: { type: 'string', nullable: true },
      notes: { ...MultiString, nullable: true, description: 'Rich text as MARKDOWN.' },
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
  const orthography_code_param = { name: 'code', in: 'path', required: true, schema: { type: 'string' }, description: 'The orthography\'s immutable code (a BCP-47 tag, a custom slug, or `default` for the primary).' }
  const text_id_param = { name: 'textId', in: 'path', required: true, schema: { type: 'string' } }
  const audio_id_param = { name: 'audioId', in: 'path', required: true, schema: { type: 'string' } }
  const photo_id_param = { name: 'photoId', in: 'path', required: true, schema: { type: 'string' } }
  const video_id_param = { name: 'videoId', in: 'path', required: true, schema: { type: 'string' } }
  const relationship_id_param = { name: 'relationshipId', in: 'path', required: true, schema: { type: 'string' } }

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
  const SpeakerBrief = { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } }
  const AudioMedia = {
    type: 'object',
    description: 'A stored audio recording (the pronunciation/utterance). Attaches to an entry, sentence, or text. Requires attribution: a speaker and/or a registry `source`.',
    properties: {
      id: { type: 'string' },
      storage_path: { type: 'string' },
      source: { type: 'string', nullable: true, description: 'A sources-registry slug (see `GET …/sources`) — the speaker-less attribution path.' },
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

  const audio_request_body = media_request_body({
    multipart_required: ['file'],
    multipart_props: { file: file_prop, speaker_id: attributed_speaker_prop, source: attributed_source_prop, id: media_id_prop, replace: media_replace_prop },
    json_required: ['url'],
    json_props: { url: url_prop, speaker_id: attributed_speaker_prop, source: attributed_source_prop, id: media_id_prop, replace: media_replace_prop },
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

  const media_paths = {
    '/api/v1/dictionaries/{id}/entries/{entryId}/audio': media_attach_op({ summary: 'Attach audio to an entry', description: 'Upload a pronunciation recording for the headword (multipart `file` or JSON `url`). Attribution required: `speaker_id` and/or `source` (a registry slug). Use `replace: true` for one-audio-per-headword imports.', owner_params: [entry_id_param], request_body: audio_request_body, medium: 'audio' }),
    '/api/v1/dictionaries/{id}/entries/{entryId}/audio/{audioId}': media_delete_op({ owner_label: 'entry', owner_params: [entry_id_param], media_id_p: audio_id_param, medium: 'audio' }),
    '/api/v1/dictionaries/{id}/senses/{senseId}/photos': media_attach_op({ summary: 'Attach a photo to a sense', description: 'Upload an illustrative photo for the sense (multipart `file` or JSON `url`), optionally with `source`/`photographer` (shown as the caption).', owner_params: [sense_id_param], request_body: photo_request_body, medium: 'photo' }),
    '/api/v1/dictionaries/{id}/senses/{senseId}/photos/{photoId}': media_delete_op({ owner_label: 'sense', owner_params: [sense_id_param], media_id_p: photo_id_param, medium: 'photo' }),
    '/api/v1/dictionaries/{id}/senses/{senseId}/videos': media_attach_op({ summary: 'Attach a video to a sense', description: 'Upload a video (`file`/`url`) OR link a hosted one (`hosted_url`/`hosted_elsewhere`). Attribution required: `speaker_id` and/or `source` (a registry slug).', owner_params: [sense_id_param], request_body: video_request_body, medium: 'video' }),
    '/api/v1/dictionaries/{id}/senses/{senseId}/videos/{videoId}': media_delete_op({ owner_label: 'sense', owner_params: [sense_id_param], media_id_p: video_id_param, medium: 'video' }),
    '/api/v1/dictionaries/{id}/sentences/{sentenceId}/audio': media_attach_op({ summary: 'Attach audio to a sentence', description: 'Upload audio for an example/text sentence (`file`/`url`). Attribution required: `speaker_id` and/or `source`.', owner_params: [sentence_id_param], request_body: audio_request_body, medium: 'audio' }),
    '/api/v1/dictionaries/{id}/sentences/{sentenceId}/audio/{audioId}': media_delete_op({ owner_label: 'sentence', owner_params: [sentence_id_param], media_id_p: audio_id_param, medium: 'audio' }),
    '/api/v1/dictionaries/{id}/sentences/{sentenceId}/photos': media_attach_op({ summary: 'Attach a photo to a sentence', description: 'Upload a photo for a sentence (`file`/`url`), optionally with `source`/`photographer`.', owner_params: [sentence_id_param], request_body: photo_request_body, medium: 'photo' }),
    '/api/v1/dictionaries/{id}/sentences/{sentenceId}/photos/{photoId}': media_delete_op({ owner_label: 'sentence', owner_params: [sentence_id_param], media_id_p: photo_id_param, medium: 'photo' }),
    '/api/v1/dictionaries/{id}/sentences/{sentenceId}/videos': media_attach_op({ summary: 'Attach a video to a sentence', description: 'Upload (`file`/`url`) or link (`hosted_url`/`hosted_elsewhere`) a video for a sentence. Attribution required: `speaker_id` and/or `source`.', owner_params: [sentence_id_param], request_body: video_request_body, medium: 'video' }),
    '/api/v1/dictionaries/{id}/sentences/{sentenceId}/videos/{videoId}': media_delete_op({ owner_label: 'sentence', owner_params: [sentence_id_param], media_id_p: video_id_param, medium: 'video' }),
    '/api/v1/dictionaries/{id}/texts/{textId}/audio': media_attach_op({ summary: 'Attach audio to a text', description: 'Upload audio for a whole text/passage (`file`/`url`). Attribution required: `speaker_id` and/or `source`.', owner_params: [text_id_param], request_body: audio_request_body, medium: 'audio' }),
    '/api/v1/dictionaries/{id}/texts/{textId}/audio/{audioId}': media_delete_op({ owner_label: 'text', owner_params: [text_id_param], media_id_p: audio_id_param, medium: 'audio' }),
    '/api/v1/dictionaries/{id}/texts/{textId}/videos': media_attach_op({ summary: 'Attach a video to a text', description: 'Upload (`file`/`url`) or link (`hosted_url`/`hosted_elsewhere`) a video for a text. Attribution required: `speaker_id` and/or `source`.', owner_params: [text_id_param], request_body: video_request_body, medium: 'video' }),
    '/api/v1/dictionaries/{id}/texts/{textId}/videos/{videoId}': media_delete_op({ owner_label: 'text', owner_params: [text_id_param], media_id_p: video_id_param, medium: 'video' }),
  }

  return {
    openapi: '3.1.0',
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
        '1. `GET /api/v1/dictionaries/{id}` → note `gloss_languages` (which locale codes to use). `entry_count` is updated asynchronously and lags — **do not use it to verify a fresh import** (it can read 0 right after a bulk POST). For a live count, paginate `/entries` instead.',
        '2. `POST /api/v1/dictionaries/{id}/entries` with `{ "entries": [ … ], "import_id": "my-import-2026" }` in batches of ≤1000 (and ≤~16MB/request — see Limits). **Generate a UUID (v4) yourself for each entry and send it as `id`.** That id IS your idempotency key: you already know it (record it in your ledger keyed by your source id), you use it directly for later `PATCH …/entries/{id}` edits, and a re-POST of the same id is a safe no-op. The whole batch shares an `import_id`, which tags every entry with a private tag of that name so you can find/clean the batch later.',
        '3. Read the per-item `results` array. Each item is `{ status: "created"|"exists"|"failed", entry_id?, sense_ids?, error? }` (one per input entry, in order). `exists` means an entry with that `id` was already present and was skipped — so retrying a timed-out batch never duplicates. Re-POST only the `failed` ones.',
        '4. Spot-verify with `GET /api/v1/dictionaries/{id}/entries/{entryId}` (returns the full nested entry — the READ shape), or bulk-read with `GET /api/v1/dictionaries/{id}/entries?include=senses`. Heads-up on the input→output asymmetry: top-level scalars you POST come back nested under `entry.main`, and `senses[].example_sentences` come back as `senses[].sentences`. See the `EntryResponse` schema. (`elicitation_id` is for word-list/elicitation ordering; it is persisted and queryable via `?elicitation_id=`, so use it for dedupe only if your source id is genuinely elicitation data — otherwise use your own `id` as above.)',
        '',
        '## Data model',
        'An **entry** is a headword (`lexeme`) plus metadata and one or more **senses**. A **sense** is one meaning: its `glosses` (short translations keyed by gloss-language), an optional longer `definition`, `parts_of_speech`, `semantic_domains`, and `example_sentences`. `parts_of_speech` values should come from the supported abbreviation list in the `SenseInput` schema (abbrevs and full English names are matched case-insensitively and stored as the canonical lowercase abbrev, e.g. "N"/"Noun" → "n"; anything else is stored verbatim). An **example sentence** has vernacular `text` + `translation`(s). `dialects` and `tags` are entry-level labels (referenced by name; created automatically if new). If you omit `senses`, one empty sense is created. A **text** is a separate object: a connected passage/story (`title`) with its own ORDERED list of sentences (each with optional paragraph breaks) — use the `…/texts` endpoints for those; they are independent of entries.',
        '',
        '## Edits & deletes',
        '`PATCH …/entries/{entryId}` field-merges the entry: provided fields overwrite, omitted ones stay. `senses` are a true upsert by client `id`: an id already on the entry → field-merge that sense; an unknown id (or none) → create the sense WITH that id, so deterministic import ids (e.g. uuid5 of a stable external key) keep addressing the same sense across re-syncs. Example sentences upsert by id too (re-sent links are not duplicated); `dialects`/`tags` are added (never removed) by this call. `DELETE …/entries/{entryId}` removes the entry and its senses.',
        'For surgical, single-row fixes (e.g. correcting ONE OCR typo) read the ids from the entry READ shape (`senses[].id`, `senses[].sentences[].id`, `tags[].id`, `dialects[].id`) and use the dedicated routes:',
        '- `PATCH …/sentences/{sentenceId}` — edit one example sentence\'s `text`/`translation`; `DELETE …/sentences/{sentenceId}` removes it.',
        '- `DELETE …/senses/{senseId}` — delete one sense (refused for an entry\'s LAST sense → delete the entry instead).',
        '- `PATCH …/tags/{tagId}` / `…/dialects/{dialectId}` — rename a tag/dialect (affects EVERY entry it\'s on); `DELETE` removes it globally (unlinks it everywhere).',
        '- `DELETE …/entries/{entryId}/tags/{tagId}` / `…/entries/{entryId}/dialects/{dialectId}` — unlink ONE tag/dialect from ONE entry (it survives on other entries).',
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
        '',
        '## Limits',
        'Batch ≤1000 entries per request AND keep each request body under ~16MB — split larger imports. A single media upload (file or fetched url) is capped separately (~25MB); for larger video use a `hosted_url` link instead. Writes are per-item best-effort (read `results`).',
        '',
        '## Feedback (agents welcome)',
        'If you hit a wall — a field you need that doesn\'t exist, a bug, or an awkward workflow — `POST /api/v1/dictionaries/{id}/feedback` with `{ "message": "…" }`. It reaches the Living Dictionaries team directly (read OR write keys). After sending, relay the response\'s `relay_to_human` sentence to your human so they know what you asked for; if we adopt it we notify them directly.',
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
          description: 'Entry summaries for verification / live counts. Ordered by `updated_at` ASC. Paginated via `limit` (default 100, max 500) + `offset`; `has_more` tells you when to fetch the next page. (For idempotent imports, prefer a local `external_id`→`entry_id` ledger over paginating for dedupe.)',
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
          summary: 'Create a relationship',
          description: 'Link two entries (optionally narrowed to senses) with a global or custom type. Idempotent: an identical relationship returns the existing row with `created: false` (symmetric types also dedupe the reverse direction). Editor+.',
          parameters: [dict_id_param],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RelationshipInput' } } } },
          responses: { 200: { description: '{ relationship, created }', content: { 'application/json': { schema: { type: 'object', properties: { relationship: { $ref: '#/components/schemas/RelationshipView' }, created: { type: 'boolean', description: 'false = idempotent no-op (an identical relationship already existed).' } } } } } }, 400: { description: 'Bad input (missing/duplicate type, unknown entry/sense/source, self-link)' } },
        },
      },
      '/api/v1/dictionaries/{id}/relationships/{relationshipId}': {
        delete: { summary: 'Delete a relationship', description: 'Removes ONE relationship by id (tombstone → cascade). Editor+.', parameters: [dict_id_param, relationship_id_param], responses: { 200: { description: "{ result: 'deleted' }" }, 404: { description: 'Relationship not found' } } },
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
      '/api/v1/dictionaries/{id}/texts': {
        get: { summary: 'List texts', description: 'Each text with its `sentence_count`.', parameters: [dict_id_param], responses: { 200: { description: '{ texts }' } } },
        post: {
          summary: 'Create a text (with ordered sentences)',
          description: 'Create a connected text/story plus its ordered sentences (sort_keys assigned in array order). Supply your own `id` (UUID) for idempotency — a re-POST of an existing id is a no-op (`created: false`). A text-sentence is standalone (not attached to a sense).',
          parameters: [dict_id_param],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TextInput' } } } },
          responses: { 200: { description: '{ text, created }', content: { 'application/json': { schema: { type: 'object', properties: { text: { $ref: '#/components/schemas/TextFull' }, created: { type: 'boolean' } } } } } }, 400: { description: 'Missing title / bad id' } },
        },
      },
      '/api/v1/dictionaries/{id}/texts/{textId}': {
        get: { summary: 'Read one text (with ordered sentences)', parameters: [dict_id_param, { name: 'textId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: '{ text }', content: { 'application/json': { schema: { type: 'object', properties: { text: { $ref: '#/components/schemas/TextFull' } } } } } }, 404: {} } },
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
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['message'], properties: { message: { type: 'string', description: 'What you need / what\'s wrong.' }, kind: { type: 'string', enum: ['missing_field', 'bug', 'awkward', 'other'] } } } } } },
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
      '/api/v1/dictionaries/{id}/dialects': {
        get: { summary: 'List dialects', parameters: [dict_id_param], responses: { 200: { description: '{ dialects }' } } },
        post: { summary: 'Find-or-create a dialect', parameters: [dict_id_param], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } } } } }, responses: { 200: { description: '{ dialect, created }' } } },
      },
      '/api/v1/dictionaries/{id}/dialects/{dialectId}': {
        patch: { summary: 'Rename a dialect', description: 'Renames the dialect (plain string or locale map). Affects EVERY entry it is on. Returns `{ dialect }`.', parameters: [dict_id_param, dialect_id_param], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: StringOrMultiString } } } } }, responses: { 200: { description: '{ dialect }' }, 400: { description: 'Name collides with another dialect' }, 404: {} } },
        delete: { summary: 'Delete a dialect (globally)', description: 'Deletes the dialect and unlinks it from every entry. To remove it from just one entry use `DELETE …/entries/{entryId}/dialects/{dialectId}`.', parameters: [dict_id_param, dialect_id_param], responses: { 200: { description: "{ result: 'deleted' }" }, 404: {} } },
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
        OrthographyInput,
        SourceInput,
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
        TextFull,
        TextPatch,
        HostedElsewhere,
        SpeakerBrief,
        AudioMedia,
        PhotoMedia,
        VideoMedia,
        RelationshipCustomType,
        RelationshipInput,
        RelationshipView,
      },
    },
  }
}
