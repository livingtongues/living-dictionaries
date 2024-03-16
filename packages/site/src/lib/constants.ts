/* eslint-disable no-magic-numbers */
export const DICTIONARIES_WITH_VARIANTS = ['babanki', 'torwali', 'ksingmul', 'tutelo-saponi', 'tseltal'];

export enum ResponseCodes {
  OK = 200,
  INTERNAL_SERVER_ERROR = 500,
  NOT_FOUND = 404,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  MOVED_PERMANENTLY = 301,
  TEMPORARY_REDIRECT = 307,
  MOVED_PERMANENTLY_PRESERVE_REQUEST = 308
}
