import type { V1DialectPostRequestBody } from '../../../routes/api/v1/dictionaries/[id]/dialects/+server'
import type { V1DialectPatchRequestBody } from '../../../routes/api/v1/dictionaries/[id]/dialects/[dialectId]/+server'
import type { EntryInput, EntryPatch, SenseInput, SentenceInput, SentencePatch } from './entry-input'
import { describe, expect, test } from 'vitest'
import { build_openapi_spec, OPENAPI_TAGS, select_openapi_view, tag_for_path } from './openapi'

const spec = build_openapi_spec({ origin: 'https://example.test' })

function schema(name: string): { required?: string[], properties?: Record<string, unknown>, allOf?: { $ref: string }[] } {
  const { schemas } = spec.components as { schemas: Record<string, unknown> }
  return schemas[name] as { required?: string[], properties?: Record<string, unknown>, allOf?: { $ref: string }[] }
}

function property_keys(name: string): string[] {
  return Object.keys(schema(name).properties ?? {}).sort()
}

/** Inline request-body schema property keys for a given path + method (dialect bodies are
 * declared inline in the paths, not as named component schemas). */
function request_body_property_keys({ path, method }: { path: string, method: string }): string[] {
  const paths = spec.paths as Record<string, Record<string, { requestBody?: { content?: Record<string, { schema?: { properties?: Record<string, unknown> } }> } }>>
  const request_schema = paths[path]?.[method]?.requestBody?.content?.['application/json']?.schema
  return Object.keys(request_schema?.properties ?? {}).sort()
}

/**
 * Compile-time-enforced key inventories: `Record<keyof X, true>` makes TS fail to
 * compile if a field is ADDED to or REMOVED from the interface in `entry-input.ts`
 * without updating this object — and the runtime tests below then assert the
 * OpenAPI schema lists exactly these keys. So the published `/api/v1/openapi.json`
 * can't silently drift from the TS request shapes the server actually accepts.
 */
const ENTRY_INPUT_KEYS: Record<keyof EntryInput, true> = {
  id: true, lexeme: true, homograph: true, phonetic: true, interlinearization: true, morphology: true,
  notes: true, linguistic_history: true, sources: true, citations: true, scientific_names: true, elicitation_id: true,
  coordinates: true, dialects: true, tags: true, senses: true,
}
const SENSE_INPUT_KEYS: Record<keyof SenseInput, true> = {
  id: true, glosses: true, definition: true, parts_of_speech: true, semantic_domains: true,
  write_in_semantic_domains: true, noun_class: true, plural_form: true, variant: true, sources: true, example_sentences: true,
}
const SENTENCE_INPUT_KEYS: Record<keyof SentenceInput, true> = {
  id: true, text: true, translation: true, sources: true,
  tokens: true, citations: true, example_label: true, discourse_role: true,
}
const SENTENCE_PATCH_KEYS: Record<keyof SentencePatch, true> = {
  text: true, translation: true, sources: true, ends_paragraph: true,
  tokens: true, citations: true, example_label: true, discourse_role: true,
}
const ENTRY_PATCH_KEYS: Record<keyof EntryPatch, true> = {
  lexeme: true, homograph: true, phonetic: true, interlinearization: true, morphology: true, notes: true,
  linguistic_history: true, sources: true, citations: true, scientific_names: true, elicitation_id: true,
  coordinates: true, dialects: true, tags: true, senses: true,
}
// Dialect request bodies live in the route files (no named component schema); TS fails
// to compile if a key is added/removed without updating these, and the runtime test then
// asserts the published OpenAPI inline request body lists exactly the same keys.
const DIALECT_POST_KEYS: Record<keyof V1DialectPostRequestBody, true> = {
  name: true, coordinates: true,
}
const DIALECT_PATCH_KEYS: Record<keyof V1DialectPatchRequestBody, true> = {
  name: true, coordinates: true,
}

function expected(keys: Record<string, true>): string[] {
  return Object.keys(keys).sort()
}

describe(build_openapi_spec, () => {
  test('schema properties stay aligned with the entry-input.ts request shapes', () => {
    expect(property_keys('EntryInput')).toEqual(expected(ENTRY_INPUT_KEYS))
    expect(property_keys('SenseInput')).toEqual(expected(SENSE_INPUT_KEYS))
    expect(property_keys('SentenceInput')).toEqual(expected(SENTENCE_INPUT_KEYS))
    expect(property_keys('SentencePatch')).toEqual(expected(SENTENCE_PATCH_KEYS))
    expect(property_keys('EntryPatch')).toEqual(expected(ENTRY_PATCH_KEYS))
  })

  test('dialect inline request bodies stay aligned with the V1Dialect*RequestBody route shapes', () => {
    expect(request_body_property_keys({ path: '/api/v1/dictionaries/{id}/dialects', method: 'post' }))
      .toEqual(expected(DIALECT_POST_KEYS))
    expect(request_body_property_keys({ path: '/api/v1/dictionaries/{id}/dialects/{dialectId}', method: 'patch' }))
      .toEqual(expected(DIALECT_PATCH_KEYS))
  })

  test('lexeme is the only required EntryInput field', () => {
    expect(schema('EntryInput').required).toEqual(['lexeme'])
  })

  test('SensePatch extends SenseInput and adds an optional id', () => {
    const sense_patch = schema('SensePatch')
    expect(sense_patch.allOf).toEqual([{ $ref: '#/components/schemas/SenseInput' }])
    expect(Object.keys(sense_patch.properties ?? {})).toEqual(['id'])
  })

  test('exposes every v1 path + method', () => {
    const paths = spec.paths as Record<string, Record<string, unknown>>
    const path_methods = Object.fromEntries(
      Object.entries(paths).map(([path, ops]) => [path, Object.keys(ops).sort()]),
    )
    expect(path_methods).toEqual({
      '/api/v1/dictionaries/{id}': ['get'],
      '/api/v1/dictionaries/{id}/entries': ['get', 'post'],
      '/api/v1/dictionaries/{id}/entries/{entryId}': ['delete', 'get', 'patch'],
      '/api/v1/dictionaries/{id}/entries/batch-delete': ['post'],
      '/api/v1/dictionaries/{id}/entries/{entryId}/tags/{tagId}': ['delete'],
      '/api/v1/dictionaries/{id}/entries/{entryId}/dialects/{dialectId}': ['delete'],
      '/api/v1/dictionaries/{id}/relationships': ['get', 'post'],
      '/api/v1/dictionaries/{id}/relationships/{relationshipId}': ['delete'],
      '/api/v1/dictionaries/{id}/sentences': ['post'],
      '/api/v1/dictionaries/{id}/sentences/{sentenceId}': ['delete', 'get', 'patch'],
      '/api/v1/dictionaries/{id}/sentences/{sentenceId}/tokens/actions': ['post'],
      '/api/v1/dictionaries/{id}/suggestions': ['get'],
      '/api/v1/dictionaries/{id}/suggestions/actions': ['post'],
      '/api/v1/dictionaries/{id}/senses/{senseId}': ['delete'],
      '/api/v1/dictionaries/{id}/texts': ['get', 'post'],
      '/api/v1/dictionaries/{id}/texts/{textId}': ['delete', 'get', 'patch'],
      // Structured grammar (.issues/structured-grammar.md): live. No grammar-intro
      // PATCH — the introductory prose is simply the first top-level section.
      '/api/v1/dictionaries/{id}/grammar/sections': ['get', 'post'],
      '/api/v1/dictionaries/{id}/grammar/sections/{sectionId}': ['delete', 'get', 'patch'],
      '/api/v1/dictionaries/{id}/grammar/sections/{sectionId}/sentences': ['post'],
      '/api/v1/dictionaries/{id}/grammar/sections/{sectionId}/sentences/{sentenceId}': ['delete'],
      '/api/v1/dictionaries/{id}/grammar/clause-slots': ['get', 'post'],
      '/api/v1/dictionaries/{id}/grammar/clause-slots/{slotId}': ['delete', 'patch'],
      '/api/v1/dictionaries/{id}/grammar/glossing-abbreviations': ['get', 'post'],
      '/api/v1/dictionaries/{id}/grammar/glossing-abbreviations/{code}': ['delete', 'patch'],
      '/api/v1/dictionaries/{id}/entries/{entryId}/grammar': ['get'],
      '/api/v1/dictionaries/{id}/texts/{textId}/tags': ['get', 'post'],
      '/api/v1/dictionaries/{id}/texts/{textId}/tags/{tagId}': ['delete'],
      '/api/v1/dictionaries/{id}/feedback': ['post'],
      '/api/v1/dictionaries/{id}/files': ['get', 'post'],
      '/api/v1/dictionaries/{id}/files/{fileId}': ['delete', 'get', 'patch'],
      '/api/v1/dictionaries/{id}/files/{fileId}/confirm': ['post'],
      '/api/v1/dictionaries/{id}/files/request-import': ['post'],
      '/api/v1/dictionaries/{id}/files/requests/{threadId}': ['patch'],
      '/api/v1/guides': ['get'],
      '/api/v1/guides/{slug}': ['get'],
      '/api/v1/dictionaries/{id}/speakers': ['get', 'post'],
      '/api/v1/dictionaries/{id}/tags': ['get', 'post'],
      '/api/v1/dictionaries/{id}/tags/{tagId}': ['delete', 'patch'],
      '/api/v1/dictionaries/{id}/featured-entries': ['get', 'patch', 'post'],
      '/api/v1/dictionaries/{id}/featured-entries/{entryId}': ['delete'],
      '/api/v1/dictionaries/{id}/dialects': ['get', 'post'],
      '/api/v1/dictionaries/{id}/dialects/{dialectId}': ['delete', 'patch'],
      '/api/v1/dictionaries/{id}/gloss-languages': ['post'],
      '/api/v1/dictionaries/{id}/gloss-languages/{code}': ['delete'],
      '/api/v1/dictionaries/{id}/orthographies': ['get', 'post', 'put'],
      '/api/v1/dictionaries/{id}/orthographies/{code}': ['delete', 'patch'],
      '/api/v1/dictionaries/{id}/sources': ['get', 'post'],
      '/api/v1/dictionaries/{id}/sources/{sourceId}': ['delete', 'patch'],
      '/api/v1/dictionaries/{id}/entries/{entryId}/audio': ['post'],
      '/api/v1/dictionaries/{id}/entries/{entryId}/audio/{audioId}': ['delete'],
      '/api/v1/dictionaries/{id}/senses/{senseId}/photos': ['post'],
      '/api/v1/dictionaries/{id}/senses/{senseId}/photos/{photoId}': ['delete'],
      '/api/v1/dictionaries/{id}/senses/{senseId}/videos': ['post'],
      '/api/v1/dictionaries/{id}/senses/{senseId}/videos/{videoId}': ['delete'],
      '/api/v1/dictionaries/{id}/sentences/{sentenceId}/audio': ['post'],
      '/api/v1/dictionaries/{id}/sentences/{sentenceId}/audio/{audioId}': ['delete', 'patch'],
      '/api/v1/dictionaries/{id}/sentences/{sentenceId}/photos': ['post'],
      '/api/v1/dictionaries/{id}/sentences/{sentenceId}/photos/{photoId}': ['delete'],
      '/api/v1/dictionaries/{id}/sentences/{sentenceId}/videos': ['post'],
      '/api/v1/dictionaries/{id}/sentences/{sentenceId}/videos/{videoId}': ['delete'],
      '/api/v1/dictionaries/{id}/texts/{textId}/audio': ['post'],
      '/api/v1/dictionaries/{id}/texts/{textId}/audio/{audioId}': ['delete', 'patch'],
      '/api/v1/dictionaries/{id}/texts/{textId}/videos': ['post'],
      '/api/v1/dictionaries/{id}/texts/{textId}/videos/{videoId}': ['delete'],
      '/api/v1/dictionaries/{id}/media/{storagePath}': ['get'],
    })
  })

  test('the whole grammar + text-tag surface is live (no draft ops remain)', () => {
    const paths = spec.paths as Record<string, Record<string, { 'summary'?: string, 'x-status'?: string }>>
    const grammar_entries = Object.entries(paths).filter(([path]) =>
      /\/grammar(?:\/|$)/.test(path) || /\/texts\/\{textId\}\/tags(?:\/|$)/.test(path))
    expect(grammar_entries).toHaveLength(11)

    // There is no bare grammar-intro path anymore.
    expect(paths['/api/v1/dictionaries/{id}/grammar']).toBeUndefined()

    // Every grammar / text-tag op is live (no draft marker, no [DRAFT] prefix).
    for (const op of grammar_entries.flatMap(([, ops]) => Object.values(ops))) {
      expect(op['x-status']).toBeUndefined()
      expect(op.summary).not.toMatch(/^\[DRAFT\]/)
    }
  })

  test('grammar + IGT sentence-write schemas are all live; no schema carries x-status draft', () => {
    const live = ['GrammarSectionInput', 'GrammarSectionPatch', 'GrammarSectionFull', 'SectionSentenceRef', 'ClauseSlotInput', 'ClauseSlotFull', 'TextTagInput', 'TextTagView', 'GlossingAbbreviationInput', 'GlossingAbbreviationFull', 'SourceCitation', 'Morpheme', 'SentenceTokenInput', 'SentenceTokenFull']
    for (const name of live)
      expect((schema(name) as { 'x-status'?: string })['x-status']).toBeUndefined()

    // The IGT fields are integrated into the sentence-write shapes (not a standalone draft schema).
    for (const name of ['SentenceInput', 'SentencePatch', 'TextSentenceInput']) {
      const props = (schema(name) as { properties: Record<string, unknown> }).properties
      expect(props).toHaveProperty('tokens')
      expect(props).toHaveProperty('citations')
      expect(props).toHaveProperty('discourse_role')
    }
    expect((schema('SourceInput') as { properties: Record<string, unknown> }).properties).toHaveProperty('orthography')

    // No draft schemas remain anywhere.
    const { schemas } = spec.components as { schemas: Record<string, { 'x-status'?: string }> }
    for (const def of Object.values(schemas))
      expect(def['x-status']).toBeUndefined()
  })

  test('publishes sentence linking and text-tag read shapes', () => {
    expect(property_keys('SentenceFull')).toContain('sources')
    expect(property_keys('TextSummary')).toEqual(['id', 'sentence_count', 'tags', 'title', 'updated_at'])
    expect(property_keys('TextFull')).toContain('tags')

    const paths = spec.paths as Record<string, Record<string, { parameters?: { name: string }[] }>>
    expect(paths['/api/v1/dictionaries/{id}/texts'].get.parameters?.map(parameter => parameter.name)).toContain('tag')
  })

  test('is a valid OpenAPI 3.1 document with the server origin', () => {
    expect(spec.openapi).toBe('3.1.0')
    expect((spec.servers as { url: string }[])[0].url).toBe('https://example.test')
  })

  test('every operation is tagged with a known tag', () => {
    const tag_names = new Set<string>(OPENAPI_TAGS.map(t => t.name))
    const paths = spec.paths as Record<string, Record<string, { tags?: string[] }>>
    for (const [path, ops] of Object.entries(paths)) {
      for (const [method, op] of Object.entries(ops)) {
        expect(op.tags, `${method} ${path}`).toHaveLength(1)
        expect(tag_names.has((op.tags ?? [])[0]), `${method} ${path} → ${op.tags}`).toBeTruthy()
      }
    }
  })
})

describe(tag_for_path, () => {
  test('maps paths to their group (media wins over the owning resource)', () => {
    expect(tag_for_path('/api/v1/dictionaries/{id}')).toBe('dictionary')
    expect(tag_for_path('/api/v1/dictionaries/{id}/entries')).toBe('entries')
    expect(tag_for_path('/api/v1/dictionaries/{id}/entries/{entryId}/audio')).toBe('media')
    expect(tag_for_path('/api/v1/dictionaries/{id}/senses/{senseId}/photos/{photoId}')).toBe('media')
    expect(tag_for_path('/api/v1/dictionaries/{id}/senses/{senseId}')).toBe('entries')
    expect(tag_for_path('/api/v1/dictionaries/{id}/dialects/{dialectId}')).toBe('dialects')
    expect(tag_for_path('/api/v1/dictionaries/{id}/featured-entries')).toBe('featured-entries')
  })

  test('grammar paths (incl. the entry reverse-lookup) group under grammar; text tags stay in texts', () => {
    expect(tag_for_path('/api/v1/dictionaries/{id}/grammar/sections')).toBe('grammar')
    expect(tag_for_path('/api/v1/dictionaries/{id}/grammar/clause-slots/{slotId}')).toBe('grammar')
    expect(tag_for_path('/api/v1/dictionaries/{id}/entries/{entryId}/grammar')).toBe('grammar')
    expect(tag_for_path('/api/v1/dictionaries/{id}/texts/{textId}/tags')).toBe('texts')
  })
})

describe(select_openapi_view, () => {
  test('no view/tag → the full spec unchanged', () => {
    expect(select_openapi_view({ spec, view: null, tag: null })).toBe(spec)
  })

  test('view=index → summaries + schema names only, no property bodies', () => {
    const index = select_openapi_view({ spec, view: 'index' }) as {
      paths: Record<string, Record<string, { summary?: string, tags?: string[] }>>
      schema_names: string[]
      components?: unknown
    }
    // Same set of paths as the full spec…
    expect(Object.keys(index.paths).sort()).toEqual(Object.keys(spec.paths as object).sort())
    // …but each operation is just { summary, tags } — no requestBody/responses.
    const get_entries = index.paths['/api/v1/dictionaries/{id}/entries'].get
    expect(Object.keys(get_entries).sort()).toEqual(['summary', 'tags'])
    // Schema NAMES only, no bodies.
    expect(index.schema_names).toContain('EntryInput')
    expect(index.schema_names).toContain('Coordinates')
    expect(index.components).toBeUndefined()
  })

  test('tag=dialects → only dialect paths, full schemas retained for $ref resolution', () => {
    const sliced = select_openapi_view({ spec, tag: 'dialects' }) as {
      paths: Record<string, unknown>
      tags: { name: string }[]
      components: { schemas: Record<string, unknown> }
    }
    expect(Object.keys(sliced.paths).sort()).toEqual([
      '/api/v1/dictionaries/{id}/dialects',
      '/api/v1/dictionaries/{id}/dialects/{dialectId}',
    ])
    expect(sliced.tags).toEqual([OPENAPI_TAGS.find(t => t.name === 'dialects')])
    // All schemas kept so `#/components/schemas/Coordinates` still resolves.
    expect(sliced.components.schemas.Coordinates).toBeDefined()
    expect(sliced.components.schemas.EntryInput).toBeDefined()
  })

  test('tag=media → collects the audio/photo/video paths across owners', () => {
    const sliced = select_openapi_view({ spec, tag: 'media' }) as { paths: Record<string, unknown> }
    const paths = Object.keys(sliced.paths)
    expect(paths).toContain('/api/v1/dictionaries/{id}/entries/{entryId}/audio')
    expect(paths).toContain('/api/v1/dictionaries/{id}/texts/{textId}/videos')
    expect(paths).toContain('/api/v1/dictionaries/{id}/media/{storagePath}')
    expect(paths.every(p => /\/(?:audio|photos|videos|media)(?:\/|$)/.test(p))).toBeTruthy()
  })
})
