import type { Coordinates, MultiString } from '$lib/types'

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
  /** Optional client-generated UUID. Supply it so you know the id up front (for
   *  later edits) and so a re-POST is idempotent. Omit → the server mints one. */
  id?: string
  /** Example sentence in the vernacular. string → `{ default: … }`. */
  text?: MultiString | string
  /** Translation(s), keyed by gloss-language code. */
  translation?: MultiString | string
  /** `sources.slug` refs — each must already exist (create via POST …/sources first). */
  sources?: string[] | string
}

export interface SenseInput {
  /** Optional client-generated UUID (see EntryInput.id). Omit → server mints one. */
  id?: string
  /** Glosses keyed by gloss-language code, e.g. `{ en: "water" }`. */
  glosses?: MultiString | string
  /** Full definition(s), keyed by language. */
  definition?: MultiString | string
  /** POS abbreviation(s) from `$lib/mappings/parts-of-speech` (e.g. `n`, `v`). Abbrevs and
   *  full English names are matched case-insensitively and stored as the canonical lowercase
   *  abbrev; unrecognized values are stored verbatim (language-specific categories allowed). */
  parts_of_speech?: string[] | string
  semantic_domains?: string[] | string
  write_in_semantic_domains?: string[] | string
  noun_class?: string
  plural_form?: MultiString | string
  variant?: MultiString | string
  example_sentences?: SentenceInput[]
}

export interface EntryInput {
  /**
   * Optional client-generated UUID (any version — deterministic uuid5 ids work
   * well). This is the idempotency key: supply your own id and a re-POST of the
   * same entry is a safe no-op (`status: 'exists'`) instead of a duplicate, and
   * you already know the id for later `PATCH …/entries/{id}` edits — no server
   * round-trip to discover it. Omit → the server mints one. Must be a valid
   * UUID if provided.
   */
  id?: string
  /** The headword. Required. string → `{ default: … }`. */
  lexeme: MultiString | string
  phonetic?: string
  interlinearization?: string
  morphology?: string
  notes?: MultiString | string
  linguistic_history?: MultiString | string
  /** `sources.slug` refs — each must already exist (create via POST …/sources first). */
  sources?: string[] | string
  scientific_names?: string[] | string
  /** Source-side stable id (linguistic elicitation id) — also handy for dedupe lookups. */
  elicitation_id?: string
  /** Where-spoken geometry: the attestation/elicitation point(s) (and/or region[s])
   *  for this form. `{ points?, regions? }`; see the `Coordinates` schema. */
  coordinates?: Coordinates | null
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

/**
 * A sense within a PATCH — a true upsert by client id: an `id` already on the
 * entry → field-merge that sense; an unknown `id` (or none) → create the sense
 * WITH that id (deterministic import ids keep addressing the same sense across
 * re-syncs). An `id` belonging to a different entry is a 400.
 */
export interface SensePatch extends SenseInput {
  id?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True for a canonical RFC-4122 UUID string. */
export function is_uuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/**
 * Resolve a caller-supplied `id`: return it if a valid UUID, mint a fresh one if
 * absent, or throw on a malformed id (so the item is reported failed with a
 * clear message rather than silently getting a random id).
 */
export function resolve_client_id(id: unknown, { field = 'id' }: { field?: string } = {}): string {
  if (id === undefined || id === null || id === '')
    return crypto.randomUUID()
  if (!is_uuid(id))
    throw new Error(`${field} must be a valid UUID if provided`)
  return id
}

/**
 * Partial entry update. Provided scalar/JSON fields are merged (others untouched).
 * `dialects`/`tags` are ADDITIVE links (found-or-created, deduped). `senses` are
 * upserted by client `id` (unknown id → created with that id — see SensePatch);
 * example sentences upsert by id / append without one.
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
  /** Whole-object replace: `{ points?, regions? }` overwrites; `null` clears; omit → untouched. */
  coordinates?: Coordinates | null
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
  /** `sources.slug` refs — each must already exist. */
  sources?: string[] | string
  /** For a text-sentence: 1/true → a paragraph break follows it; 0/false → none. */
  ends_paragraph?: boolean | number
}

export interface EntryWriteResult {
  /**
   * `created` — a new entry was written. `exists` — an entry with the
   * client-supplied `id` was already present, so this item was skipped
   * (idempotent no-op; use PATCH to edit). `updated` — reserved for the PATCH
   * path. `failed` — see `error`.
   */
  status: 'created' | 'exists' | 'updated' | 'failed'
  /** The entry id (the client-supplied one when given). Absent only on a pre-id failure. */
  entry_id?: string
  sense_ids?: string[]
  error?: string
}

export interface EntriesWriteResponseBody {
  created: number
  /** Items skipped because their client-supplied `id` already existed. */
  skipped: number
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
