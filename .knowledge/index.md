# Knowledge wiki — Living Dictionaries (svelte-5-migration)

Durable decisions/gotchas that augment the code (not discoverable by reading a single file).
Active plans live in `.issues/`. The migration is done + staging is live; the remaining
production cutover is `.issues/cutover.md`, and the durable cross-project conventions are
`migration/shared-stack-conventions.md`.

## Categories
- [migration/](./migration/index.md) — gotchas and decisions for the Vercel/Supabase →
  VPS/SQLite evolution (build/deploy, lockfile discipline, what's deferred).
- [testing/](./testing/index.md) — verification conventions: the puppeteer-core deep-flow
  harness and its headless-browser gotchas.
- [tooling/](./tooling/index.md) — dev tooling that augments the app: the sqlite-proxy /
  `live_share` / `sqlite-query.sh` stack for querying the live browser DBs.
- [domain/](./domain/index.md) — app-domain knowledge: related-entries model, media serving
  URLs (GCS + lh3 magic URLs), the dictionary import process.

## Pointers to the reference repo
The **target** architecture (SQLite shared.db + per-dict dict.db, wa-sqlite/better-sqlite3,
sync engine, R2 snapshots, JWT/Google/OTP auth) is fully written up in the sibling
**`living-dictionaries-example`** repo's `.knowledge/architecture/*` and
`.knowledge/decisions/*`. Read those when a milestone reaches that system — don't duplicate
them here (avoids staleness); summarize only the decisions we make differently this time.
