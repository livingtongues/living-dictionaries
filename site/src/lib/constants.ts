/** localStorage prefix for the admin's wa-sqlite DB id (per user). */
export const ADMIN_DB_ID_FOR_USER_PREFIX = 'admin_db_id_for_user_'

/** Per-dictionary OPFS file path prefix (rooted in OPFS). */
export const DICT_DB_OPFS_PREFIX = 'dictionaries/'

/** R2 object key template for per-dictionary snapshots. */
export function r2_dict_snapshot_key(dictionary_id: string): string {
  return `dictionaries/${dictionary_id}.db.gz`
}

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
  CONFLICT = 409,
  GONE = 410,
  PAYLOAD_TOO_LARGE = 413,
  UNSUPPORTED_MEDIA_TYPE = 415,
  UNPROCESSABLE_ENTITY = 422,
  SERVICE_UNAVAILABLE = 503,
}

/** Snapshot freshness threshold for `/changes` snapshot_expired sentinel. */
export const SNAPSHOT_EXPIRED_DAYS = 60

/** R2 snapshot rebuild interval. */
export const R2_SNAPSHOT_INTERVAL_MS = 30 * 60 * 1000

/** OPFS visitor LRU eviction budget (editors exempt). */
export const VIEWER_OPFS_BUDGET_BYTES = 200 * 1024 * 1024
