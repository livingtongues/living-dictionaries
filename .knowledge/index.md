# Knowledge wiki — Living Dictionaries (vps-migration)

Durable decisions/gotchas that augment the code (not discoverable by reading a single file).
Active plans live in `.issues/`; the migration master plan is `.issues/vps-migration.md`.

## Categories
- [migration/](./migration/index.md) — gotchas and decisions for the Vercel/Supabase →
  VPS/SQLite evolution (build/deploy, lockfile discipline, what's deferred).
- [testing/](./testing/index.md) — verification conventions: the puppeteer-core deep-flow
  harness and its headless-browser gotchas.

## Pointers to the reference repo
The **target** architecture (SQLite shared.db + per-dict dict.db, wa-sqlite/better-sqlite3,
sync engine, R2 snapshots, JWT/Google/OTP auth) is fully written up in the sibling
**`living-dictionaries-example`** repo's `.knowledge/architecture/*` and
`.knowledge/decisions/*`. Read those when a milestone reaches that system — don't duplicate
them here (avoids staleness); summarize only the decisions we make differently this time.
