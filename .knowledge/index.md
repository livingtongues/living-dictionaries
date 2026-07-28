# Knowledge wiki — Living Dictionaries

Durable decisions/gotchas that augment the code (not discoverable by reading a single file).
Active plans live in `.issues/`. The legacy-platform → SQLite/VPS migration is complete and its
code fully torn down (2026-07; deploys run from `main`) — the one-page historical record is
[supabase-cutover.md](./supabase-cutover.md); cross-project conventions are
[shared-stack-conventions.md](./shared-stack-conventions.md).

## Business frame
- [portfolio-context.md](./portfolio-context.md) — Jacob's actual priorities for Living
  Dictionaries (winning = the language-documentation flywheel; AI-agent story +
  texts→sentences→entries pipeline; loop guidance). Read this before deciding what to nudge
  Jacob about.

## Categories
- [db/](./db/index.md) — the living SQLite/local-first architecture docs: schema + migration
  recipes, sync invariants, the OPFS leader-worker model, and build/deploy gotchas.
- [testing/](./testing/index.md) — verification conventions: the puppeteer-core deep-flow
  harness and its headless-browser gotchas.
- [tooling/](./tooling/index.md) — dev tooling that augments the app: the sqlite-proxy /
  `live_share` / `sqlite-query.sh` stack for querying the live browser DBs.
- [domain/](./domain/index.md) — app-domain knowledge: related-entries model, R2 media serving,
  and the dictionary import process.
- [admin/](./admin/index.md) — the `/admin` super-admin area: the house feature port
  (schema-graph canvas, server-authoritative team chat, ntfy dashboard, message triage) and
  which files stay near-identical to `house`.
- [api/](./api/index.md) — public/programmatic APIs: the agent-friendly `/api/v1` bulk
  write API + per-dictionary API keys (reuses the human `merge_dict_row` write path).
- [server/](./server/index.md) — how the single Node process behaves under load: what actually
  protects the container's health check from synchronous work on a request path (measured from the
  2026-07-27 `/og` outages), and how to measure it without fooling yourself.
- [svelte/](./svelte/index.md) — Svelte 5 runtime-internals gotchas: the
  `current_sources` dependency-exclusion rule that freezes lazily-created stores
  (why `construct_outside_reaction` exists).
- [workflow/](./workflow/index.md) — multi-agent working discipline: the shared-working-tree
  rules from the 2026-07-12 codemod clobber (check `horse list` + `git status` before bulk
  reverts; JSONL-replay recovery).

## Pointers to the reference repo
The **target** architecture (SQLite shared.db + per-dict dict.db, wa-sqlite/better-sqlite3,
sync engine, R2 snapshots, JWT/Google/OTP auth) is fully written up in the sibling
**`living-dictionaries-example`** repo's `.knowledge/architecture/*` and
`.knowledge/decisions/*`. Read those when a milestone reaches that system — don't duplicate
them here (avoids staleness); summarize only the decisions we make differently this time.
