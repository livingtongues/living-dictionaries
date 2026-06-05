/**
 * Codes for `SyncVersionError`. Imported by the sync endpoint + engine + tests
 * so nobody hard-codes the string literal.
 */
export const CLIENT_BEHIND = 'CLIENT_BEHIND'
export const SERVER_BEHIND = 'SERVER_BEHIND'
export type SyncVersionErrorCode = typeof CLIENT_BEHIND | typeof SERVER_BEHIND

/**
 * Thrown by `process_sync` when the client's and server's bundled
 * `latest_migration` filenames disagree. The `code` field is mapped to an
 * HTTP status by the sync endpoint:
 *
 * - CLIENT_BEHIND (409): user's app bundle is older than the server.
 *   Routed to `/versions` with a toast to update.
 *
 * - SERVER_BEHIND (503): user's bundle is newer than the server
 *   (rare — only during a deploy mid-push). Sync fails with a warn-level
 *   log; next trigger retries once the server catches up.
 */
export class SyncVersionError extends Error {
  code: SyncVersionErrorCode
  client_latest: string
  server_latest: string
  constructor({ code, client_latest, server_latest }: {
    code: SyncVersionErrorCode
    client_latest: string
    server_latest: string
  }) {
    super(`Migration version mismatch (${code}): client=${client_latest} server=${server_latest}`)
    this.name = 'SyncVersionError'
    this.code = code
    this.client_latest = client_latest
    this.server_latest = server_latest
  }
}

/** Client-side counterpart — thrown on HTTP 409. */
export class ClientBehindError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ClientBehindError'
  }
}

/** Client-side counterpart — thrown on HTTP 503. */
export class ServerBehindError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ServerBehindError'
  }
}

/** Thrown by the dict.db `/changes` endpoint when delta cursor is too far back. */
export class SnapshotExpiredError extends Error {
  constructor(message = 'Local snapshot too stale — refetch full snapshot') {
    super(message)
    this.name = 'SnapshotExpiredError'
  }
}
