import type { EntryInput, EntryPatch, SenseInput, SentenceInput, SentencePatch } from './entry-input'
import { describe, expect, test } from 'vitest'
import { build_openapi_spec } from './openapi'

const spec = build_openapi_spec({ origin: 'https://example.test' })

function schema(name: string): { required?: string[], properties?: Record<string, unknown>, allOf?: { $ref: string }[] } {
  const { schemas } = spec.components as { schemas: Record<string, unknown> }
  return schemas[name] as { required?: string[], properties?: Record<string, unknown>, allOf?: { $ref: string }[] }
}

function property_keys(name: string): string[] {
  return Object.keys(schema(name).properties ?? {}).sort()
}

/**
 * Compile-time-enforced key inventories: `Record<keyof X, true>` makes TS fail to
 * compile if a field is ADDED to or REMOVED from the interface in `entry-input.ts`
 * without updating this object — and the runtime tests below then assert the
 * OpenAPI schema lists exactly these keys. So the published `/api/v1/openapi.json`
 * can't silently drift from the TS request shapes the server actually accepts.
 */
const ENTRY_INPUT_KEYS: Record<keyof EntryInput, true> = {
  external_id: true, lexeme: true, phonetic: true, interlinearization: true, morphology: true,
  notes: true, linguistic_history: true, sources: true, scientific_names: true, elicitation_id: true,
  dialects: true, tags: true, senses: true,
}
const SENSE_INPUT_KEYS: Record<keyof SenseInput, true> = {
  glosses: true, definition: true, parts_of_speech: true, semantic_domains: true,
  write_in_semantic_domains: true, noun_class: true, plural_form: true, variant: true, example_sentences: true,
}
const SENTENCE_INPUT_KEYS: Record<keyof SentenceInput, true> = {
  text: true, translation: true, sources: true,
}
const SENTENCE_PATCH_KEYS: Record<keyof SentencePatch, true> = {
  text: true, translation: true, sources: true,
}
const ENTRY_PATCH_KEYS: Record<keyof EntryPatch, true> = {
  lexeme: true, phonetic: true, interlinearization: true, morphology: true, notes: true,
  linguistic_history: true, sources: true, scientific_names: true, elicitation_id: true,
  dialects: true, tags: true, senses: true,
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
      '/api/v1/dictionaries/{id}/entries/{entryId}/tags/{tagId}': ['delete'],
      '/api/v1/dictionaries/{id}/entries/{entryId}/dialects/{dialectId}': ['delete'],
      '/api/v1/dictionaries/{id}/sentences/{sentenceId}': ['delete', 'patch'],
      '/api/v1/dictionaries/{id}/senses/{senseId}': ['delete'],
      '/api/v1/dictionaries/{id}/speakers': ['get', 'post'],
      '/api/v1/dictionaries/{id}/tags': ['get', 'post'],
      '/api/v1/dictionaries/{id}/tags/{tagId}': ['delete', 'patch'],
      '/api/v1/dictionaries/{id}/dialects': ['get', 'post'],
      '/api/v1/dictionaries/{id}/dialects/{dialectId}': ['delete', 'patch'],
      '/api/v1/dictionaries/{id}/sources': ['get', 'post'],
      '/api/v1/dictionaries/{id}/sources/{sourceId}': ['delete', 'patch'],
    })
  })

  test('is a valid OpenAPI 3.1 document with the server origin', () => {
    expect(spec.openapi).toBe('3.1.0')
    expect((spec.servers as { url: string }[])[0].url).toBe('https://example.test')
  })
})
