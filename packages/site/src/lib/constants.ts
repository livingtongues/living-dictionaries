export const DICTIONARIES_WITH_VARIANTS = ['babanki', 'torwali', 'ksingmul', 'tutelo-saponi', 'tseltal', 'namtrik-de-totoro']

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
}

export const MINIMUM_ABOUT_LENGTH = 200

export const ACCESS_TOKEN_COOKIE_NAME = 'sb-access-token'
export const REFRESH_TOKEN_COOKIE_NAME = 'sb-refresh-token'

export const USER_LOCAL_STORAGE_KEY = 'ld_user'
