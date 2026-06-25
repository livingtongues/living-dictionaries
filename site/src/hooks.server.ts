import { env } from '$env/dynamic/private'
import { start_chat_reping_cron_once } from '$lib/db/server/chat-reping-cron'
import { start_log_retention_cron_once } from '$lib/db/server/log-retention-cron'
import { start_r2_snapshot_builder } from '$lib/db/server/r2-snapshot-builder'
import { get_shared_db } from '$lib/db/server/shared-db'
import { ensure_all_admins_in_team_chat } from '$lib/server/chat/ensure-team-membership'

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
