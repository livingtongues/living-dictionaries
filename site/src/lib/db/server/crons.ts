import type { CronDef } from './cron-scheduler'
import { run_chat_reping_sweep } from './chat-reping-cron'
import { prime_host_stats_baseline, sample_host_stats_once } from './host-stats-cron'
import { warm_analytics_caches } from './log-analytics'
import { run_log_retention_sweep } from './log-retention-cron'
import { media_sweep_disabled_reason, run_media_sweep } from './media-sweep-cron'
import { run_notification_digest_sweep } from './notification-digest-cron'
import { r2_snapshot_disabled_reason, run_r2_snapshot_sweep } from './r2-snapshot-builder'
import { run_system_outbox_sweep } from './system-outbox-cron'
import { run_wal_checkpoint_sweep } from './wal-checkpoint-cron'

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
    name: 'wal-checkpoint',
    description: 'TRUNCATE-checkpoint shared/logs/archive WALs so they never ratchet up under multi-connection load',
    every_ms: minutes(5),
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
    description: 'Roll client_logs into daily metrics, archive past the hot window, prune the archive, re-warm analytics',
    every_ms: hours(6),
    run: () => run_log_retention_sweep({ after_sweep: warm_analytics_caches }),
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
    description: 'Daily media ledger rollup + weekly R2 reconcile / orphan cleanup / variant self-heal',
    every_ms: hours(1),
    run: run_media_sweep,
    disabled_reason: media_sweep_disabled_reason,
  },
  {
    name: 'notification-digest',
    description: 'Once/day at 8am Pacific: one summary per on-duty admin of unread platform events',
    every_ms: hours(1),
    run: run_notification_digest_sweep,
  },
  {
    name: 'chat-reping',
    description: 'One gentle extra nudge for admin team-chat pings unread ~1 day',
    every_ms: hours(1),
    run: run_chat_reping_sweep,
  },
  {
    name: 'system-outbox',
    description: 'Drain agent-enqueued System chat messages (chat_system_outbox) — snappy on-demand delivery',
    every_ms: seconds(20),
    run: run_system_outbox_sweep,
  },
]
