export const DICTIONARIES_WITH_VARIANTS = ['babanki', 'torwali', 'ksingmul', 'tutelo-saponi', 'tseltal', 'namtrik-de-totoro', 'werikyana', 'woleaia', 'guwar', 'sugtstun-test', 'yaruro-colombiano', 'rusitene']

/** Format a count with thousands separators: 1240 → "1,240". */
export function format_number(value: number): string {
  return value.toLocaleString('en-US')
}

/**
 * Format a fraction as a percentage: 0.123 → "12.3%". `signed` prefixes a `+` on
 * non-negative values (for growth deltas). `digits` controls decimal places.
 */
export function format_pct(fraction: number, { signed = false, digits = 1 }: { signed?: boolean, digits?: number } = {}): string {
  const pct = fraction * 100
  const sign = signed && pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(digits)}%`
}

export const GITHUB_REPO_URL = 'https://github.com/livingtongues/living-dictionaries'

// localStorage key prefix for the per-user browser admin wa-sqlite DB id (admin sync engine).
export const ADMIN_DB_ID_FOR_USER_PREFIX = 'admin_db_id_for_user_'

export enum ResponseCodes {
  OK = 200,
  INTERNAL_SERVER_ERROR = 500,
  NOT_FOUND = 404,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  MOVED_PERMANENTLY = 301,
  TEMPORARY_REDIRECT = 307,
  MOVED_PERMANENTLY_PRESERVE_REQUEST = 308,
  TOO_MANY_REQUESTS = 429,
  FORBIDDEN = 403,
  PAYLOAD_TOO_LARGE = 413,
  UNSUPPORTED_MEDIA_TYPE = 415,
  CONFLICT = 409,
  GONE = 410,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
}

export const MINIMUM_ABOUT_LENGTH = 200

// invalidate() key that re-runs the [dictionaryId] layout loads (universal + server) after a catalog edit
export const DICTIONARY_UPDATED_LOAD_TRIGGER = 'dictionary:updated'

/** Allowed values for a `sources.type` (the citation kind). */
export const SOURCE_TYPES = ['dictionary', 'wordlist', 'fieldwork', 'manuscript', 'other'] as const
export type SourceType = typeof SOURCE_TYPES[number]

/**
 * Controlled vocabulary for `sentences.discourse_role` — the salience band /
 * information type a clause carries in narrative (storyline vs backgrounded,
 * etc.). Nullable + extensible (a suggested vocab, not enforced); a grammar
 * section can point at the role a particle signals. Labels are i18n keys
 * `discourse_role.<value>`.
 */
export const DISCOURSE_ROLES = ['storyline', 'backgrounded', 'flashback', 'setting', 'evaluation', 'reported_speech'] as const
export type DiscourseRole = typeof DISCOURSE_ROLES[number]

/**
 * Kind of a `tags` row when it classifies TEXTS (motif / genre / tale-type) via
 * the `text_tags` junction. NULL = a plain entry tag (the legacy use). The tag's
 * `code` column then holds the controlled index code (e.g. an ATU/Thompson motif
 * number). Labels are i18n keys `tag_kind.<value>`.
 */
export const TAG_KINDS = ['motif', 'genre', 'tale_type'] as const
export type TagKind = typeof TAG_KINDS[number]

/**
 * Admin-curated classification of every dictionary (`dictionaries.bucket`) —
 * who we serve ('public'/'unlisted'/'secure') vs what we tolerate
 * ('conlang'/'glossary' — media storage to be disabled) vs 'delete' (queued
 * for teardown). NULL = unclassified/new. See `.issues/dictionary-buckets-cleanup.md`.
 */
export const DICTIONARY_BUCKETS = ['public', 'unlisted', 'secure', 'conlang', 'glossary', 'delete'] as const
export type DictionaryBucket = typeof DICTIONARY_BUCKETS[number]

/**
 * Buckets denied the agent `/api/v1` API. The API is for communities documenting
 * endangered/under-represented languages, so constructed languages and glossaries
 * cannot mint keys (no key = no access; the v1 routes themselves need no guard).
 */
export const API_UNAVAILABLE_BUCKETS = ['conlang', 'glossary'] as const

export const API_UNAVAILABLE_MESSAGE = 'The Living Dictionaries API is available only to communities documenting endangered and under-represented languages. It isn\'t available for constructed languages or glossaries.'

export function is_api_unavailable_bucket(bucket: string | null | undefined): boolean {
  return !!bucket && (API_UNAVAILABLE_BUCKETS as readonly string[]).includes(bucket)
}

/**
 * Controlled global vocabulary for `entry_relationships.type`. Labels (and the
 * inverse-side label of directed types) are i18n keys `relationship_type.<slug>`
 * — never hard-code display text here. `symmetric` types read the same from
 * either endpoint; directed types show `inverse_slug`'s label from the `to` side.
 * Per-dictionary CUSTOM types live in the `relationship_types` table instead.
 *
 * A directed pair exposes BOTH member slugs as valid POST types (so an agent can
 * author in whichever direction reads naturally), but is CANONICALIZED on write:
 * the `canonical`-tagged member is rewritten to its partner slug with its endpoints
 * flipped, so reversed duplicates collapse and every stored row uses one slug per
 * concept-pair (clean faceting). Only the canonical members are ever stored.
 */
export const RELATIONSHIP_TYPES = {
  // Symmetric — same label from either endpoint.
  synonym: { symmetric: true, inverse_slug: 'synonym' },
  antonym: { symmetric: true, inverse_slug: 'antonym' },
  cognate: { symmetric: true, inverse_slug: 'cognate' },
  dialectal_variant: { symmetric: true, inverse_slug: 'dialectal_variant' },
  see_also: { symmetric: true, inverse_slug: 'see_also' },
  spelling_variant: { symmetric: true, inverse_slug: 'spelling_variant' },
  // Directed — canonical members (stored as-is; `from` plays the named role).
  hypernym: { symmetric: false, inverse_slug: 'hyponym' },
  holonym: { symmetric: false, inverse_slug: 'meronym' },
  derived_from: { symmetric: false, inverse_slug: 'root_of' },
  borrowed_from: { symmetric: false, inverse_slug: 'loaned_to' },
  // Directed — inverse aliases (canonicalized to `canonical` + flipped on write).
  hyponym: { symmetric: false, inverse_slug: 'hypernym', canonical: 'hypernym' },
  meronym: { symmetric: false, inverse_slug: 'holonym', canonical: 'holonym' },
  root_of: { symmetric: false, inverse_slug: 'derived_from', canonical: 'derived_from' },
  loaned_to: { symmetric: false, inverse_slug: 'borrowed_from', canonical: 'borrowed_from' },
} as const satisfies Record<string, { symmetric: boolean, inverse_slug: string, canonical?: string }>

export type GlobalRelationshipType = keyof typeof RELATIONSHIP_TYPES

export function is_global_relationship_type(value: unknown): value is GlobalRelationshipType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(RELATIONSHIP_TYPES, value)
}

/** Per-dictionary OPFS file path prefix (rooted in OPFS) for the wa-sqlite browser DB. */
export const DICT_DB_OPFS_PREFIX = 'dictionaries/'

/** R2 object key template for per-dictionary snapshots (public snapshots bucket). */
export function r2_dict_snapshot_key(dictionary_id: string): string {
  return `dictionaries/${dictionary_id}.db.gz`
}

/** R2 snapshot rebuild interval for the in-process builder cron. */
export const R2_SNAPSHOT_INTERVAL_MS = 30 * 60 * 1000

/** Snapshot freshness threshold for the `/changes` snapshot_expired sentinel. */
export const SNAPSHOT_EXPIRED_DAYS = 60

/** Total OPFS budget for viewer-only dict.db files (editor dicts are exempt). */
export const VIEWER_OPFS_BUDGET_BYTES = 200 * 1024 * 1024

/** Max bytes accepted for a v1 media upload (multipart file or fetched-from-url). Large videos should use `hosted_elsewhere` links instead. */
export const MAX_MEDIA_UPLOAD_BYTES = 25 * 1024 * 1024

/** Timeout for the server-side fetch of a media `url` supplied to a v1 media endpoint. */
export const MEDIA_FETCH_TIMEOUT_MS = 30_000

export const ACCESS_TOKEN_COOKIE_NAME = 'sb-access-token'
export const REFRESH_TOKEN_COOKIE_NAME = 'sb-refresh-token'

export const USER_LOCAL_STORAGE_KEY = 'ld_user'
