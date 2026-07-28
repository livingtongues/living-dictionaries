import type { EntryReview, EntryReviewApply, EntryReviewComparison, EntryReviewComparisonSide } from '$lib/db/schemas/dictionary.types'
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

/** One morpheme within a token's word-internal segmentation (agent input). */
export interface MorphemeInput {
  form: string
  gloss?: MultiString | string
  entry_id?: string
  separator?: '-' | '=' | '~' | '.'
}

/**
 * A writable interlinear (IGT) token — the GOLD alignment from a glossed source.
 * `start`/`end` are OPTIONAL: omit them and the server derives offsets by walking
 * the ordered `form`s against the sentence text with a LEFT-TO-RIGHT cursor.
 */
export interface SentenceTokenInput {
  form: string
  start?: number
  end?: number
  /** The Leipzig gloss line, per analysis language. Neutral category codes (`3PL`)
   *  go under the reserved `default` key (a bare string wraps to `default`). */
  gloss?: MultiString | string
  morphemes?: MorphemeInput[]
  entry_id?: string
  sense_id?: string
  status?: 'auto' | 'confirmed' | 'ignored'
}

/** `tokens` on a sentence write: orthography code → ordered token list. */
export type SentenceTokensInput = Record<string, SentenceTokenInput[]>

/** A source reference WITH a citation locus (agent input). */
export interface SourceCitationInput {
  slug: string
  locator?: string
}

/** The IGT / discourse fields shared by every sentence-write shape. */
export interface SentenceIgtFields {
  /** Gold interlinear tokens per orthography (usually just `default`). When the
   *  text for an orthography is omitted but its tokens are supplied, the server
   *  builds the text by joining the token forms with a space. */
  tokens?: SentenceTokensInput
  /** Source refs with a citation locus (page/example number) — complements `sources`. */
  citations?: SourceCitationInput[]
  /** The author's own example number (e.g. "(2a)"). */
  example_label?: string | null
  /** Discourse salience / information role (see `DISCOURSE_ROLES`). */
  discourse_role?: string | null
}

export interface SentenceInput extends SentenceIgtFields {
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
  /** `sources.slug` refs — per-sense provenance (each must already exist). */
  sources?: string[] | string
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
  /** Homograph number for identically-spelled headwords ("1", "2"; some sources
   *  use "a"/"b") — shown as a superscript after the lexeme. */
  homograph?: string
  phonetic?: string
  interlinearization?: string
  morphology?: string
  notes?: MultiString | string
  linguistic_history?: MultiString | string
  /** `sources.slug` refs — each must already exist (create via POST …/sources first). */
  sources?: string[] | string
  /** Source refs WITH a citation locus (page/example number) — complements `sources`. */
  citations?: SourceCitationInput[]
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
  /** EDITOR-ONLY "needs review" flag `{ category, note, comparisons? }` — queue this
   *  entry for a human reviewer WITHOUT showing the public. `category` is a free
   *  bucket label (drives the entries-list "Needs review" facet); `note` is the
   *  bespoke thing to check; `comparisons` carry competing values the banner diffs
   *  (and can apply with one click). Set it on import for anything you had to
   *  guess/salvage; a reviewer clears it. Never rendered to non-editors. */
  review?: EntryReview | null
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
  homograph?: string
  phonetic?: string
  interlinearization?: string
  morphology?: string
  notes?: MultiString | string
  linguistic_history?: MultiString | string
  sources?: string[] | string
  /** Source refs with a citation locus. MERGED with the row's existing citations
   *  (deduped by slug+locator) — `null` clears them all. */
  citations?: SourceCitationInput[]
  scientific_names?: string[] | string
  elicitation_id?: string
  /** Whole-object replace: `{ points?, regions? }` overwrites; `null` clears; omit → untouched. */
  coordinates?: Coordinates | null
  dialects?: string[] | string
  tags?: string[] | string
  /** EDITOR-ONLY "needs review" flag — `{ category, note }` sets/replaces it;
   *  `null` clears it (the "Resolve" action). Omit → untouched. Never public. */
  review?: EntryReview | null
  senses?: SensePatch[]
}

/**
 * Field-merge an existing example sentence (`PATCH …/sentences/{id}`). Provided
 * fields overwrite (string → `{ default: … }`); omitted ones stay.
 */
export interface SentencePatch extends SentenceIgtFields {
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

/**
 * Coerce an `EntryInput.review` / `EntryPatch.review` value into a stored
 * `EntryReview` (`{ category, note }`). `null` → `null` (clear); `undefined` or
 * an empty/blank object → `undefined` (omit/untouched); otherwise trimmed, with
 * `category` defaulting to `other` when only a note is supplied. The API guide
 * defines the human-facing note contract; source provenance belongs in the
 * entry's `citations`, not in this value.
 */
export function to_review(value: unknown): EntryReview | null | undefined {
  if (value === null) return null
  if (value === undefined || typeof value !== 'object') return undefined
  const source = value as Record<string, unknown>
  const category = typeof source.category === 'string' ? source.category.trim() : ''
  const note = typeof source.note === 'string' ? source.note.trim() : ''
  const comparisons = to_review_comparisons(source.comparisons)
  if (!category && !note && !comparisons) return undefined
  return { category: category || 'other', note, ...(comparisons ? { comparisons } : {}) }
}

const APPLY_TARGETS: EntryReviewApply['target'][] = ['entry.lexeme', 'entry.phonetic', 'sense.glosses', 'sense.definition']

/**
 * Coerce `review.comparisons` — the competing values the banner diffs. Drops
 * any item missing a field label or either side's value, and drops an `apply`
 * target that couldn't be written (unknown target, or a sense target with no
 * `sense_id`/`key`).
 */
export function to_review_comparisons(value: unknown): EntryReviewComparison[] | undefined {
  if (!Array.isArray(value)) return undefined
  const comparisons: EntryReviewComparison[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const source = item as Record<string, unknown>
    const field = typeof source.field === 'string' ? source.field.trim() : ''
    const a = to_comparison_side(source.a)
    const b = to_comparison_side(source.b)
    if (!field || !a || !b) continue
    const apply = to_review_apply(source.apply)
    comparisons.push({ field, a, b, ...(apply ? { apply } : {}) })
  }
  return comparisons.length ? comparisons : undefined
}

function to_comparison_side(value: unknown): EntryReviewComparisonSide | undefined {
  if (!value || typeof value !== 'object') return undefined
  const source = value as Record<string, unknown>
  const label = typeof source.label === 'string' ? source.label.trim() : ''
  const side_value = typeof source.value === 'string' ? source.value.trim() : ''
  if (!side_value) return undefined
  return { label, value: side_value }
}

function to_review_apply(value: unknown): EntryReviewApply | undefined {
  if (!value || typeof value !== 'object') return undefined
  const source = value as Record<string, unknown>
  const target = APPLY_TARGETS.find(known => known === source.target)
  if (!target) return undefined
  const sense_id = typeof source.sense_id === 'string' ? source.sense_id.trim() : ''
  const key = typeof source.key === 'string' ? source.key.trim() : ''
  if (target.startsWith('sense.') && (!sense_id || !key)) return undefined
  if (target === 'entry.lexeme' && !key) return undefined
  return { target, ...(sense_id ? { sense_id } : {}), ...(key ? { key } : {}) }
}

if (import.meta.vitest) {
  describe(to_review, () => {
    it('returns null for null (clear/resolve)', () => {
      expect(to_review(null)).toBe(null)
    })
    it('returns undefined for undefined / non-objects / empty', () => {
      expect(to_review(undefined)).toBe(undefined)
      expect(to_review('nope')).toBe(undefined)
      expect(to_review({})).toBe(undefined)
      expect(to_review({ category: '  ', note: '' })).toBe(undefined)
    })
    it('trims and keeps a full review', () => {
      expect(to_review({ category: ' truncated ', note: ' check source ' })).toEqual({ category: 'truncated', note: 'check source' })
    })
    it('defaults category to `other` when only a note is given', () => {
      expect(to_review({ note: 'freeform concern' })).toEqual({ category: 'other', note: 'freeform concern' })
    })
    it('keeps comparisons alongside the note', () => {
      expect(to_review({
        category: 'definition-differs',
        note: 'Which should the entry say?',
        comparisons: [{
          field: 'Definition',
          a: { label: 'Main dictionary (p62)', value: 'to point at an animate thing' },
          b: { label: 'Finder list (p345)', value: 'to point at an inanimate thing' },
          apply: { target: 'sense.definition', sense_id: '11111111-2222-3333-4444-555555555555', key: 'en' },
        }],
      })).toEqual({
        category: 'definition-differs',
        note: 'Which should the entry say?',
        comparisons: [{
          field: 'Definition',
          a: { label: 'Main dictionary (p62)', value: 'to point at an animate thing' },
          b: { label: 'Finder list (p345)', value: 'to point at an inanimate thing' },
          apply: { target: 'sense.definition', sense_id: '11111111-2222-3333-4444-555555555555', key: 'en' },
        }],
      })
    })
    it('keeps a review that is only comparisons', () => {
      const review = to_review({ comparisons: [{ field: 'Pronunciation guide', a: { label: 'A', value: 'äʼ-bä' }, b: { label: 'B', value: 'äʼ-bā' } }] })
      expect(review?.category).toBe('other')
      expect(review?.comparisons).toHaveLength(1)
    })
  })

  describe(to_review_comparisons, () => {
    it('returns undefined for a non-array or an all-invalid array', () => {
      expect(to_review_comparisons(undefined)).toBe(undefined)
      expect(to_review_comparisons([{ field: 'Definition' }])).toBe(undefined)
      expect(to_review_comparisons([{ a: { value: 'x' }, b: { value: 'y' } }])).toBe(undefined)
    })
    it('trims labels and values', () => {
      expect(to_review_comparisons([{ field: ' Definition ', a: { label: ' Main ', value: ' one ' }, b: { label: ' Finder ', value: ' two ' } }]))
        .toEqual([{ field: 'Definition', a: { label: 'Main', value: 'one' }, b: { label: 'Finder', value: 'two' } }])
    })
    it('drops an unwritable apply target but keeps the comparison', () => {
      const [comparison] = to_review_comparisons([{
        field: 'Definition',
        a: { label: 'Main', value: 'one' },
        b: { label: 'Finder', value: 'two' },
        apply: { target: 'sense.definition', key: 'en' },
      }])
      expect(comparison.apply).toBe(undefined)
    })
    it('drops an unknown apply target', () => {
      const [comparison] = to_review_comparisons([{
        field: 'Notes',
        a: { label: 'Main', value: 'one' },
        b: { label: 'Finder', value: 'two' },
        apply: { target: 'entry.notes', key: 'en' },
      }])
      expect(comparison.apply).toBe(undefined)
    })
  })
}
