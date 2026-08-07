import type { CronDef } from './cron-scheduler'
import { spawn_analytics_snapshot_job } from './analytics-snapshot'
import { run_chat_reping_sweep } from './chat-reping-cron'
import { run_cron_heartbeat_sweep } from './cron-heartbeat-cron'
import { prime_host_stats_baseline, sample_host_stats_once } from './host-stats-cron'
import { run_monthly_metrics_announcement } from './monthly-metrics-announce'
import { media_sweep_disabled_reason, run_media_sweep } from './media-sweep-cron'
import { run_notification_digest_sweep } from './notification-digest-cron'
import { r2_snapshot_disabled_reason, run_r2_snapshot_sweep } from './r2-snapshot-builder'
import { run_wal_checkpoint_sweep } from './wal-checkpoint-cron'
import { run_audio_derivative_sweep } from './audio-derivative-sweep'

/**
 * THE cron roster — the single source of truth for every background job this
 * machine runs and how often. Cadence is pure WALL CLOCK, decoupled from deploy
 * frequency (see `cron-scheduler.ts`); wired up in `hooks.server.ts` via
 * `start_crons_once({ defs: CRONS })`.
 *
 * KEEP THIS FILE BORING AND DECLARATIVE: one object literal per cron, `every:`
 * always a single `seconds()/minutes()/hours()/days()` call. Horse's
 * fleet-crons view parses this file STATICALLY (no network, no secrets) from
 * the repo checkout — clever indirection here breaks that view.
 */

export function seconds(n: number): number { return n * 1000 }
export function minutes(n: number): number { return n * 60_000 }
export function hours(n: number): number { return n * 3_600_000 }
export function days(n: number): number { return n * 86_400_000 }

export const CRONS: CronDef[] = [
  {
    name: 'audio-derivative',
    description: 'Fork the niced daily audio backfill child: convert any playback derivative the upload path missed',
    // A BACKFILL, not the path. Audio is converted on upload
    // (`/api/audio/generate-derivative`); this only catches what that missed.
    // It shipped as a 5-minute IN-PROCESS cron on 2026-08-03 and took the
    // typical worst 5-minute event-loop stall from 65 ms to 623 ms for a whole
    // day — a full ledger scan plus up to 160 synchronous DB-file opens per run,
    // on the thread that answers requests. Now: once a day, in a nice-19 child.
    // 04:10 PT sits after the 03:30 maintenance child so the two never overlap.
    every_ms: days(1),
    at: { hour: 4, minute: 10, tz: 'America/Los_Angeles' },
    run: async () => { await run_audio_derivative_sweep() },
  },
  {
    name: 'wal-checkpoint',
    description: 'TRUNCATE-checkpoint shared/logs/archive WALs so they never ratchet up under multi-connection load',
    // 15 not 5: only ~5 MB of WAL accrues per 5 min here, and a checkpoint costs
    // O(frames) while holding readers off — so a SLOWER cadence means a LONGER
    // stall. This is the balance point, not a saving (Jacob, 2026-07-29).
    every_ms: minutes(15),
    run: run_wal_checkpoint_sweep,
  },
  {
    name: 'host-stats',
    description: 'Log one whole-box CPU/RAM/disk host_stats event for the /admin/health resources panel',
    every_ms: minutes(5),
    run: sample_host_stats_once,
    on_start: prime_host_stats_baseline,
  },
  {
    name: 'log-retention',
    description: 'Fork the niced daily maintenance child: retention sweep (rollups, archive, prune, VACUUM) then the analytics checkpoint',
    // THE daily maintenance moment, pinned to the quietest hour rather than
    // drifting to wherever a reboot left it. ALL of its heavy work happens in
    // ONE niced child process at 03:30 Pacific: first the retention sweep
    // (rollups → archive → prune → conditional VACUUM), then the 30-day analytics
    // scan of a 2 GB logs.db per audience. Neither runs in the serving process —
    // the sweep alone held its event loop for 115 s on 2026-08-01 and cost two
    // signed-in editors a 502 (`.issues/retention-sweep-blocks-request-thread.md`).
    every_ms: days(1),
    at: { hour: 3, minute: 30, tz: 'America/Los_Angeles' },
    // The monthly summary posts from THIS process: the child freezes the month's
    // `monthly_metrics` row, but pings need SES/ntfy, which only exist in this
    // runtime. A no-op on every day except the first of a month.
    run: async () => {
      await spawn_analytics_snapshot_job({ reason: 'cron', sweep_retention: true })
      await run_monthly_metrics_announcement()
    },
  },
  {
    name: 'r2-snapshot-builder',
    description: 'Backup + gzip + upload every dirty dictionary DB to the public R2 snapshots bucket',
    every_ms: minutes(30), // mirrors R2_SNAPSHOT_INTERVAL_MS
    run: run_r2_snapshot_sweep,
    disabled_reason: r2_snapshot_disabled_reason,
  },
  {
    name: 'media-sweep',
    description: 'Daily media ledger rollup + weekly R2 reconcile / orphan cleanup / variant self-heal (forked child)',
    // Was hourly and no-opped 23×/day: the body is already a daily rollup + a
    // 6.5-day reconcile, so the tick was pure polling.
    every_ms: days(1),
    run: async () => { await run_media_sweep() },
    disabled_reason: media_sweep_disabled_reason,
  },
  {
    name: 'notification-digest',
    description: 'Once/day at 8am Pacific: one summary per on-duty admin of unread platform events',
    every_ms: days(1),
    at: { hour: 8, minute: 0, tz: 'America/Los_Angeles' },
    run: run_notification_digest_sweep,
  },
  {
    name: 'chat-reping',
    description: 'One gentle extra nudge for admin team-chat pings unread ~1 day',
    every_ms: days(1),
    at: { hour: 8, minute: 5, tz: 'America/Los_Angeles' },
    run: run_chat_reping_sweep,
  },
  {
    name: 'cron-heartbeat',
    description: 'One coalesced daily liveness row per cron, so a dead cron and a quiet night stop looking identical',
    // 03:00 PT — half an hour ahead of log-retention, so the night's heartbeats
    // are already in the raw window that same sweep rolls up.
    every_ms: days(1),
    at: { hour: 3, minute: 0, tz: 'America/Los_Angeles' },
    run: run_cron_heartbeat_sweep,
  },
]
