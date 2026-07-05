# `entry_count` was stale/zero for never-written dicts — RESOLVED 2026-07-05

Surfaced by the pre-cutover schema audit (`squash-sql-migrations-pre-cutover.md`, 2026-07-04).

## What was actually wrong (premise corrected)

The original premise ("nothing maintains the column; the schema comment claims a nonexistent push
endpoint + heal cron") was **stale**. The maintenance path **already exists**:
`mirror_dictionary_cursor` (`site/src/lib/db/server/v1-route-context.ts`) recounts `entry_count` on
**every** editor push + v1 API write, and the schema comment (`shared.ts` `entry_count`) already
names it accurately.

The real gap was narrower: the cutover stamped `entry_count` once, and a dictionary **never written
since** never re-triggers the recount — so archival dicts (e.g. `river` = 0 vs 8693 actual) stayed
stale. Read by public `/dictionaries`, the admin list, and the v1 API.

## Fix (done — see `.issues/log-review-fixes-2026-07-05.md`, TD3)

- `reconcile_dictionary_catalog()` (`site/src/lib/db/server/reconcile-dictionaries.ts`) recounts
  `entry_count` for every dict against its dict.db and runs at snapshot-builder boot, so a deploy
  self-heals never-written dicts. (It also bumps a behind `updated_at`, which fixed the sibling
  snapshot-cursor P1.)
- One-time prod backfill run via the same function.

## Verify

- Public `/dictionaries`, admin list, and v1 API all show `river` = 8693.
