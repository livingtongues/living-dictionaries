import type { HandleServerError } from '@sveltejs/kit'
import { dev } from '$app/environment'
import { env } from '$env/dynamic/private'
import { start_chat_reping_cron_once } from '$lib/db/server/chat-reping-cron'
import { start_log_retention_cron_once } from '$lib/db/server/log-retention-cron'
import { get_logs_db, split_client_logs_from_shared } from '$lib/db/server/logs-db'
import { start_r2_snapshot_builder } from '$lib/db/server/r2-snapshot-builder'
import { get_shared_db } from '$lib/db/server/shared-db'
import { start_wal_checkpoint_cron_once } from '$lib/db/server/wal-checkpoint-cron'
import { ensure_all_admins_in_team_chat } from '$lib/server/chat/ensure-team-membership'
import { is_cross_origin_form_forbidden } from '$lib/server/csrf'
import { boot_i18n_catalog } from '$lib/server/i18n/boot'
import { log_server_event } from '$lib/server/log-server-event'
import { json } from '@sveltejs/kit'

// Force shared.db open + SQL migrations at server boot rather than lazily on the
// first request (avoids a fresh container racing a migration inside a live
// request). The handle below stays a pass-through.
get_shared_db()

// One-time boot migration (2026-07-05): move raw `client_logs` out of shared.db
// into their own `logs.db` (rollups stay in shared.db so trends + backups keep
// history without the raw-log bytes). Idempotent + crash-safe — a no-op once the
// table is gone. Runs in dev too so local + prod share one storage topology.
split_client_logs_from_shared({ shared_db: get_shared_db(), logs_db: get_logs_db() })

// Make every allow-listed admin a member of the team-chat channels (creating any
// missing admin user rows), so posting in "All Admins" reaches everyone before
// they've ever opened the chat. Idempotent (ON CONFLICT DO NOTHING) — safe on
// every boot + both blue/green containers.
ensure_all_admins_in_team_chat()

// Mirror the code's English i18n catalog into `i18n_keys` (new/changed/removed
// keys) and, on a virgin DB, seed translations from the committed locale files.
boot_i18n_catalog()

// Per-dictionary `dictionaries/{id}.db.gz` snapshot builder. Sweeps every 30 min
// in-process, backs up + gzips + PUTs each changed dict to the public R2
// snapshots bucket (viewers read from there). Gated by R2_SNAPSHOT_BUILDER_ENABLED
// so only the designated builder node runs it (no-op in dev / web nodes).
// Also skipped on blue-green standby containers (IS_STANDBY=true) — only the
// primary runs singleton background jobs. See vps-setup
// .issues/blue-green-fleet-rollout.md.
if (env.R2_SNAPSHOT_BUILDER_ENABLED === 'true' && env.IS_STANDBY !== 'true')
  start_r2_snapshot_builder()

// Two-tier client_logs retention + the forever log_daily_metrics rollup. Always
// runs on the active node — only self-gates on IS_STANDBY + dev/build (no enable flag).
start_log_retention_cron_once()

// Periodic `wal_checkpoint(TRUNCATE)` on the central DBs (shared.db / logs.db /
// logs-archive.db) so their WAL files can't ratchet up unbounded under steady
// sync/read load. Primary-only (IS_STANDBY-gated) + singleton + dev/build-dormant.
// Per-dictionary DBs are deliberately out of scope pending investigation.
start_wal_checkpoint_cron_once()

// Admin team-chat gentle re-ping cron. Hourly, sends exactly one more nudge for
// chat pings unread ~1 day. IS_STANDBY-guarded + singleton-guarded; notify_admin
// is a no-op under NTFY_DISABLED so dev stays quiet.
start_chat_reping_cron_once()

/**
 * Adapter-node enforces `BODY_SIZE_LIMIT` by THROWING mid-body-read, which
 * surfaces as an opaque 500 `crash` in telemetry (e.g. a 17 MB body POSTed to
 * `/api/auth/email/send-code`). Pre-check the `content-length` here — identical
 * to adapter-node's own check — and return a clean 413 instead, so an oversized
 * body is a client error, not a fake server crash. We deliberately keep the 16 M
 * limit; this only changes the SHAPE of the rejection.
 */
const BODY_SIZE_LIMIT_BYTES = parse_byte_size(env.BODY_SIZE_LIMIT)

/** @type {import('@sveltejs/kit').Handle} */
export function handle({ event, resolve }) {
  // CSRF: SvelteKit's built-in guard is disabled in svelte.config.js so we can
  // exempt token-authed /api/v1 uploads. Re-apply it here (prod only, matching
  // SvelteKit — cross-origin dev tooling stays unblocked) for every other request.
  if (!dev && is_cross_origin_form_forbidden(event)) {
    const message = `Cross-site ${event.request.method} form submissions are forbidden`
    if (event.request.headers.get('accept') === 'application/json')
      return json({ message }, { status: 403 })
    return new Response(message, { status: 403, headers: { 'content-type': 'text/plain' } })
  }

  if (BODY_SIZE_LIMIT_BYTES !== null) {
    const content_length = Number(event.request.headers.get('content-length'))
    if (Number.isFinite(content_length) && content_length > BODY_SIZE_LIMIT_BYTES) {
      return new Response(`Payload too large: ${content_length} bytes exceeds the ${BODY_SIZE_LIMIT_BYTES}-byte limit.`, {
        status: 413,
        headers: { 'content-type': 'text/plain' },
      })
    }
  }
  return resolve(event)
}

/** Parse an adapter-node BODY_SIZE_LIMIT ("512K" / "16M" / "1G" / a raw byte count). Returns null when unset/`Infinity`. */
function parse_byte_size(raw: string | undefined): number | null {
  if (!raw || raw === 'Infinity')
    return null
  const match = /^(?<num>\d+)(?<unit>[KMG]?)$/i.exec(raw.trim())
  if (!match?.groups)
    return null
  const exponent = { K: 1, M: 2, G: 3 }[match.groups.unit.toUpperCase()] ?? 0
  return Number(match.groups.num) * 1024 ** exponent
}

/**
 * Capture the REAL cause of any server-side load/render failure into the
 * telemetry pipeline (`source='server'`), with the route + status. SvelteKit
 * calls this for unexpected errors thrown during SSR — e.g. a `[dictionaryId]`
 * layout-load failure that the universal `+layout.ts` re-throws as a 500. The
 * browser only ever sees a bare "Internal Error" with an empty stack
 * (`+error.svelte`), and `console.error` isn't patched on the server, so without
 * this the cause vanished into ephemeral `docker logs` (which rotate away on
 * redeploy — exactly what made the 2026-06-26 dict-load 500s unrecoverable).
 *
 * Returns the safe shape SvelteKit shows the client; never throws (the logger
 * swallows its own errors).
 */
/** Pre-refactor route prefixes that stale cached clients still poll → 404 noise, never logged. */
const STALE_CLIENT_404_PREFIXES = ['/api/admin/chat/']
export function is_stale_client_404(pathname: string): boolean {
  return STALE_CLIENT_404_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

export const handleError: HandleServerError = ({ error, event, status, message }) => {
  // A client that disconnects mid-request surfaces here as a Node HTTP
  // `abortIncoming` error (`message === 'aborted'`) at status 500 — a benign
  // socket close, NOT a server crash. Keep it at `info` so it stays visible for
  // debugging without inflating the crash count.
  const is_client_abort = error instanceof Error && error.message === 'aborted'
  // Stale cached clients keep polling routes that were renamed/removed (chat
  // moved to `/api/chat/*`); their 404s are pure noise, not a live fault —
  // drop them so they don't look like a 404 storm (2026-07-04 review, ~380/day).
  if (status === 404 && is_stale_client_404(event.url.pathname))
    return { message }
  // 4xx (expected: missing route, auth gate) are not crashes; 5xx are.
  const level = is_client_abort ? 'info' : status >= 500 ? 'crash' : status === 404 ? 'info' : 'warn'
  log_server_event({
    level,
    message: error instanceof Error ? error.message : message,
    error,
    context: { route: event.route.id, path: event.url.pathname, status },
  })
  return { message }
}
