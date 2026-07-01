import type { HandleServerError } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { start_chat_reping_cron_once } from '$lib/db/server/chat-reping-cron'
import { start_log_retention_cron_once } from '$lib/db/server/log-retention-cron'
import { start_r2_snapshot_builder } from '$lib/db/server/r2-snapshot-builder'
import { get_shared_db } from '$lib/db/server/shared-db'
import { ensure_all_admins_in_team_chat } from '$lib/server/chat/ensure-team-membership'
import { log_server_event } from '$lib/server/log-server-event'

// Force shared.db open + SQL migrations at server boot rather than lazily on the
// first request (avoids a fresh container racing a migration inside a live
// request). The handle below stays a pass-through.
get_shared_db()

// Make every allow-listed admin a member of the team-chat channels (creating any
// missing admin user rows), so posting in "All Admins" reaches everyone before
// they've ever opened the chat. Idempotent (ON CONFLICT DO NOTHING) — safe on
// every boot + both blue/green containers.
ensure_all_admins_in_team_chat()

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

// Admin team-chat gentle re-ping cron. Hourly, sends exactly one more nudge for
// chat pings unread ~1 day. IS_STANDBY-guarded + singleton-guarded; notify_admin
// is a no-op under NTFY_DISABLED so dev stays quiet.
start_chat_reping_cron_once()

/** @type {import('@sveltejs/kit').Handle} */
export function handle({ event, resolve }) {
  return resolve(event)
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
export const handleError: HandleServerError = ({ error, event, status, message }) => {
  // A client that disconnects mid-request surfaces here as a Node HTTP
  // `abortIncoming` error (`message === 'aborted'`) at status 500 — a benign
  // socket close, NOT a server crash. Keep it at `info` so it stays visible for
  // debugging without inflating the crash count.
  const is_client_abort = error instanceof Error && error.message === 'aborted'
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
