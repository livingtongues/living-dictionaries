export const DICTIONARIES_WITH_VARIANTS = ['babanki', 'torwali', 'ksingmul', 'tutelo-saponi', 'tseltal', 'namtrik-de-totoro', 'werikyana', 'woleaia', 'guwar', 'sugtstun-test', 'yaruro-colombiano', 'rusitene']

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
  CONFLICT = 409,
  GONE = 410,
  SERVICE_UNAVAILABLE = 503,
}

export const MINIMUM_ABOUT_LENGTH = 200

/** Per-dictionary OPFS file path prefix (rooted in OPFS) for the wa-sqlite browser DB. */
export const DICT_DB_OPFS_PREFIX = 'dictionaries/'

/** Snapshot freshness threshold for the `/changes` snapshot_expired sentinel. */
export const SNAPSHOT_EXPIRED_DAYS = 60

/** Total OPFS budget for viewer-only dict.db files (editor dicts are exempt). */
export const VIEWER_OPFS_BUDGET_BYTES = 200 * 1024 * 1024

export const ACCESS_TOKEN_COOKIE_NAME = 'sb-access-token'
export const REFRESH_TOKEN_COOKIE_NAME = 'sb-refresh-token'

export const USER_LOCAL_STORAGE_KEY = 'ld_user'
