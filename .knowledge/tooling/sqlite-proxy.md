# sqlite-proxy / live-share (dev SQL into the live browser DBs)

Dev-only HTTP+WS proxy letting the agent CLI run SQL against the wa-sqlite DBs in the
admin/editor's **browser**. Code: `site/sqlite-proxy/*`, `site/src/lib/db/client/live-share.svelte.ts`,
`scripts/sqlite-query.sh`. Usage: `.claude/skills/sqlite-query/SKILL.md`. This page only records
what those don't say.

## It's a shared pattern across three repos
tutor → house → living-dictionaries all carry the same proxy + `live_share` + `sqlite-query.sh`.
Port ranges are deliberately disjoint so all three can run locally at once:

| Repo | Vite (dev/prod) | WS / HTTP (dev) |
|------|-----------------|-----------------|
| tutor | 7878 / … | 4000 / 4001 |
| house | 5000 / 5001 | 4020 / 4021 |
| living-dictionaries | 3041 / 3042 | 4050 / 4051 |

Formula (each repo): `ws = BASE_WS + (actual_vite_port - BASE_VITE)*2`, `http = ws+1`. The math is
duplicated in three files per repo (vite-plugin, live-share, the `.sh`) — keep them in sync. Ports
derive from the **actually bound** vite port (not the configured one) so `pnpm dev`/`pnpm prod`
instances don't collide.

## Why LD diverges from house/tutor: multiple DBs per tab
house/tutor have ONE wa-sqlite DB per browser, so their `live_share.start({ connection, client_id })`
is single-target. **LD has many**: the admin `shared.db` (main-thread) plus N per-dict `dict.db`s
(each behind the SharedWorker). So LD's `live_share` is a **multi-target registry** keyed by a
composite `client_id`:
- `shared.db` → `<email>`
- a dict's `dict.db` → `<email>::dict::<dict_id>`

The CLI's `--dict <id>` flag selects the matching client. This kept the 5 `sqlite-proxy/*.ts` files
**byte-identical to house** (the proxy keys clients by an opaque string; all the addressing lives in
`live_share` + the `.sh`). No new SharedWorker RPC was needed for Phase 2 because `DictConnection`
already implements the `SqliteConnection` interface — its `.query()`/`.execute()` tunnel through the
worker's existing `query`/`exec` messages.

## Why writes are handled two different ways (the Q2 decision, 2026-06-05)
`live_share` detects a write (INSERT/UPDATE/DELETE, via `extract_table_name`) and runs it through
`connection.execute()` instead of `.query()` so the **UI live-updates** from a CLI mutation:
- **dict.db** (SharedWorker): `execute()` already fans out a `tables_changed` broadcast → every open
  tab re-queries. Nothing else needed.
- **main-thread DBs** (LD admin, house, tutor): there's no broadcast, so `live_share` *also* calls a
  `notify(table)` callback wired to `live_db.notify_table` at the registration site.

To actually **sync** a CLI write to the server, the row still needs `dirty=1` + bumped `updated_at`
(the engine flushes dirty rows); deletes go through `INSERT INTO deletes`. The proxy only makes the
write + refreshes the local UI — it doesn't mark sectors dirty for you.

## Phase 2 reach is wired but unverified end-to-end
Static gates + a headless mock-proxy CLI smoke pass; the live browser round-trip (and the dict
write→broadcast→UI path) still needs an eyeball on a running dev server. Tracked in
`.issues/port-sqlite-proxy.md`.
