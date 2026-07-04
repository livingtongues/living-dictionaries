# `entry_count` is stale/zero — nothing maintains the column

Surfaced by the pre-cutover schema audit (`squash-sql-migrations-pre-cutover.md`, 2026-07-04).

## The bug

`river.entry_count` reads **0** while the dictionary actually has **8693** entries. The count is
wrong (or zero) across dictionaries because **nothing maintains the column**:

- The Drizzle schema comment claims a **push endpoint + a heal cron** keep it current — **neither
  exists** in the codebase.
- The stale value is **read by user-facing surfaces**: public `/dictionaries`, the admin dictionary
  list, and the **v1 API**. So users and API-consuming agents see a wrong entry count.

## Options (pick one)

1. **Backfill + maintain** — one-time backfill (`COUNT(*)` per dictionary → `entry_count`), then keep
   it current: increment/decrement on entry create/delete, or a periodic heal job. Fast reads, must
   stay in sync.
2. **Drop the column, compute on read** — remove `entry_count`, replace reads with a live `COUNT(*)`
   (or a cached/materialized count). No drift risk; slightly more work per read. Given the leader-worker
   OPFS model, verify where the count is actually needed (server vs client snapshot).

## Verify after fix

- Public `/dictionaries`, admin list, and v1 API all show the true count for a known dictionary
  (river = 8693).
- Whichever path is chosen, remove/correct the stale Drizzle comment about the nonexistent
  push-endpoint/heal-cron so future agents aren't misled.
