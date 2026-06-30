import type { MultiString } from '$lib/types'

/** Cap per-request batch size; agents chunk larger imports. */
export const MAX_ENTRIES_PER_REQUEST = 1000
/** Default / max page size for the entries list endpoint. */
export const DEFAULT_LIST_LIMIT = 100
export const MAX_LIST_LIMIT = 500

/**
 * Public, agent-facing input shapes for the `/api/v1` write API. Deliberately
 * forgiving: every multilingual field accepts either a plain string (wrapped as
 * `{ default: … }`) or a locale-keyed object (`{ en: "hi", es: "hola" }`); every
 * list field accepts a single string or an array. The server maps these onto the
 * dict.db row shapes (see `db/server/v1-entry-write.ts`).
 */

export interface SentenceInput {
  /** Example sentence in the vernacular. string → `{ default: … }`. */
  text?: MultiString | string
  /** Translation(s), keyed by gloss-language code. */
  translation?: MultiString | string
}

export interface SenseInput {
  /** Glosses keyed by gloss-language code, e.g. `{ en: "water" }`. */
  glosses?: MultiString | string
  /** Full definition(s), keyed by language. */
  definition?: MultiString | string
  parts_of_speech?: string[] | string
  semantic_domains?: string[] | string
  write_in_semantic_domains?: string[] | string
  noun_class?: string
  plural_form?: MultiString | string
  variant?: MultiString | string
  example_sentences?: SentenceInput[]
}

export interface EntryInput {
  /** Optional caller reference echoed back in the report for id-mapping/idempotency. */
  external_id?: string
  /** The headword. Required. string → `{ default: … }`. */
  lexeme: MultiString | string
  phonetic?: string
  interlinearization?: string
  morphology?: string
  notes?: MultiString | string
  linguistic_history?: MultiString | string
  sources?: string[] | string
  scientific_names?: string[] | string
  /** Source-side stable id (linguistic elicitation id) — also handy for dedupe lookups. */
  elicitation_id?: string
  /** Dialect names — found-or-created on this dictionary. */
  dialects?: string[] | string
  /** Tag names — found-or-created on this dictionary. */
  tags?: string[] | string
  senses?: SenseInput[]
}

export interface EntriesWriteRequestBody {
  /** One or many entries. */
  entries: EntryInput[]
  /** Optional batch label → attaches a private tag of this name to every entry. */
  import_id?: string
}

/** A sense within a PATCH: with `id` → field-merge that sense; without → create a new one. */
export interface SensePatch extends SenseInput {
  id?: string
}

/**
 * Partial entry update. Provided scalar/JSON fields are merged (others untouched).
 * `dialects`/`tags` are ADDITIVE links (found-or-created, deduped). `senses` are
 * upserted by `id`; example sentences without an id are appended.
 */
export interface EntryPatch {
  lexeme?: MultiString | string
  phonetic?: string
  interlinearization?: string
  morphology?: string
  notes?: MultiString | string
  linguistic_history?: MultiString | string
  sources?: string[] | string
  scientific_names?: string[] | string
  elicitation_id?: string
  dialects?: string[] | string
  tags?: string[] | string
  senses?: SensePatch[]
}

/**
 * Field-merge an existing example sentence (`PATCH …/sentences/{id}`). Provided
 * fields overwrite (string → `{ default: … }`); omitted ones stay.
 */
export interface SentencePatch {
  text?: MultiString | string
  translation?: MultiString | string
}

export interface EntryWriteResult {
  external_id?: string
  status: 'created' | 'updated' | 'failed'
  entry_id?: string
  sense_ids?: string[]
  error?: string
}

export interface EntriesWriteResponseBody {
  created: number
  updated: number
  failed: number
  results: EntryWriteResult[]
}

/** Wrap a string as `{ default: … }`, pass through a locale map, drop empties. */
export function to_multistring(value: unknown, default_key = 'default'): MultiString | undefined {
  if (value === null || value === undefined)
    return undefined
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? { [default_key]: trimmed } : undefined
  }
  if (typeof value === 'object') {
    const out: MultiString = {}
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (typeof raw === 'string' && raw.trim())
        out[key] = raw
    }
    return Object.keys(out).length ? out : undefined
  }
  return undefined
}

/** Normalize a single-or-array string field to a trimmed, non-empty string[]. */
export function to_string_array(value: unknown): string[] | undefined {
  if (value === null || value === undefined)
    return undefined
  const list = Array.isArray(value) ? value : [value]
  const out = list
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
  return out.length ? out : undefined
}
