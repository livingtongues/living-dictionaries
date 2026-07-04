# Knowledge wiki — Living Dictionaries

Durable decisions/gotchas that augment the code (not discoverable by reading a single file).
Active plans live in `.issues/`. The Supabase/Vercel → SQLite/VPS migration and production
cutover are complete (2026-07; deploys run from `main`); the durable cross-project conventions
are `migration/shared-stack-conventions.md`.

## Categories
- [migration/](./migration/index.md) — gotchas and decisions for the Vercel/Supabase →
  VPS/SQLite evolution (build/deploy, lockfile discipline, what's deferred).
- [testing/](./testing/index.md) — verification conventions: the puppeteer-core deep-flow
  harness and its headless-browser gotchas.
- [tooling/](./tooling/index.md) — dev tooling that augments the app: the sqlite-proxy /
  `live_share` / `sqlite-query.sh` stack for querying the live browser DBs.
- [domain/](./domain/index.md) — app-domain knowledge: related-entries model, media serving
  URLs (GCS + lh3 magic URLs), the dictionary import process.
- [admin/](./admin/index.md) — the `/admin` super-admin area: the house feature port
  (schema-graph canvas, server-authoritative team chat, ntfy dashboard, message triage) and
  which files stay near-identical to `house`.
- [api/](./api/index.md) — public/programmatic APIs: the agent-friendly `/api/v1` bulk
  write API + per-dictionary API keys (reuses the human `merge_dict_row` write path).
- [svelte/](./svelte/index.md) — Svelte 5 runtime-internals gotchas: the
  `current_sources` dependency-exclusion rule that freezes lazily-created stores
  (why `construct_outside_reaction` exists).

## Pointers to the reference repo
The **target** architecture (SQLite shared.db + per-dict dict.db, wa-sqlite/better-sqlite3,
sync engine, R2 snapshots, JWT/Google/OTP auth) is fully written up in the sibling
**`living-dictionaries-example`** repo's `.knowledge/architecture/*` and
`.knowledge/decisions/*`. Read those when a milestone reaches that system — don't duplicate
them here (avoids staleness); summarize only the decisions we make differently this time.
