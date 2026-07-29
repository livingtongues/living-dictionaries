------------------------------------------------------------------
-- cron_runs — persisted wall-clock state for the in-process cron scheduler
-- (`$lib/db/server/cron-scheduler.ts`; roster: `$lib/db/server/crons.ts`).
--
-- WHY: crons used to be bare `setInterval`s that reset on every deploy, with a
-- "run once at boot" crutch so long intervals survived rapid-deploy days. That
-- coupled maintenance cadence to DEPLOY FREQUENCY, and the boot burst (r2
-- snapshot sweep + WAL checkpoints + media sweep firing together) spiked CPU
-- during the exact blue/green warmup window where the standby is the sole
-- backend — the Living 503, 2026-07-29. Persisting `last_run_at` makes cadence
-- pure wall-clock: on boot each cron schedules at `last_run + interval`; ran
-- recently → nothing happens.
--
-- Server-only bookkeeping: never synced to clients, tiny (one row per cron).
------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cron_runs (
  name        TEXT PRIMARY KEY,   -- roster name from crons.ts
  last_run_at INTEGER NOT NULL    -- epoch ms of the last run's START
);
