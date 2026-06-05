---
description: Scan `client_logs` on the living VPS for recent errors/crashes, group into clusters, investigate each cluster in the codebase, propose fixes.
---

# Scan and Fix Errors

Runs the bug-triage workflow against the `client_logs` table on the living VPS.
Reads recent client-side error / crash reports, finds patterns, investigates
root causes in the codebase, proposes fixes.

> ## Status — pipeline is LIVE (post-deploy)
>
> The full telemetry pipeline is wired: `lib/debug/remote-log.ts` (client
> capture) → `/api/log` (endpoint, IP rate-limit, clamping) → `client_logs`
> in `shared.db`, with `init_remote_logging()` running from the root
> `+layout.svelte` `onMount`. See `.knowledge/architecture/client-logs.md`.
>
> Until the `living` VPS is actually deployed (cutover), there's no production
> `client_logs` to scan — but the pipeline itself is complete. In dev, logs
> land in `site/.data/shared.db` and can be queried with the local
> better-sqlite3 one-liner (see prod-db.md / client-logs.md).

## Default scope

Last **24 hours**, levels `error` / `unhandled_rejection` / `crash`. Honor any
overrides in the user's message ("last 7 days", "all levels", a specific
`user_id`, "only `crash` level", etc.).

## Background — how logs will get there (post-port)

`site/src/lib/debug/remote-log.ts` is initialized once from `+layout.svelte`
`onMount`. It hooks `window.error`, `unhandledrejection`, patches
`console.error`, and exposes `log_event(...)` for explicit logging. Buffered
to `localStorage.debug_log_pending` (single source of truth — survives
crashes). Flushes every 5s via `POST /api/log`, and on `pagehide` /
`visibilitychange:hidden` via `navigator.sendBeacon` — the beacon path catches
iOS WebView teardown that would wipe a normal fetch.

Server inserts into `client_logs` on the VPS's `shared.db`. Clients never
receive these rows (`client_logs` is excluded from `SYNCABLE_TABLE_NAMES` in
`site/src/lib/db/sync/types.ts`).

Schema in `site/src/lib/db/schemas/shared.ts` (the `client_logs` Drizzle
table) + `shared-migrations/20260525_initial.sql`. Key columns:

| column | notes |
|---|---|
| `received_at` | server ISO timestamp (indexed DESC; use for ORDER BY) |
| `client_time` | client ISO, may skew |
| `level` | `'error' \| 'warn' \| 'info' \| 'unhandled_rejection' \| 'crash'` |
| `message`, `stack` | clamped server-side (2k / 16k chars) |
| `url`, `user_agent`, `platform`, `app_version`, `build_target` | enrichment |
| `user_id` | nullable — pre-login crashes preserved (no FK) |
| `context` | JSON blob with `session_id`, `breadcrumbs[]`, free-form extras |

## Querying — use SSH + docker exec

The `sqlite3` CLI is NOT installed on the VPS host. Query via the `sveltekit`
Docker container using `better-sqlite3` through Node. See `prod-db.md` for the
canonical SSH + docker DB pattern + safety rules. Always pass
`{ readonly: true }` here — the agent never writes `client_logs`.

Host path: `/opt/hosting/data/shared.db`. Container path:
`/workspace/site/.data/shared.db`. Use the container path inside `docker exec`.

## Workflow

### 1. Read the cluster view

Group recent errors by `message` + first 200 chars of `stack` so a user hitting
one error 50 times is one cluster, not 50 incidents.

```bash
ssh living 'docker exec sveltekit node -e "
const Database = require(\"better-sqlite3\");
const db = new Database(\"/workspace/site/.data/shared.db\", { readonly: true });
const since = new Date(Date.now() - 24*60*60*1000).toISOString();
const rows = db.prepare(\`
  SELECT message,
         substr(coalesce(stack, '"'"''"'"'), 1, 200) AS stack_head,
         COUNT(*) AS n,
         MIN(received_at) AS first_seen,
         MAX(received_at) AS last_seen,
         COUNT(DISTINCT user_id) AS users,
         COUNT(DISTINCT app_version) AS versions,
         GROUP_CONCAT(DISTINCT platform) AS platforms
  FROM client_logs
  WHERE received_at >= ?
    AND level IN ('"'"'error'"'"', '"'"'unhandled_rejection'"'"', '"'"'crash'"'"')
  GROUP BY message, stack_head
  ORDER BY n DESC, last_seen DESC
\`).all(since);
console.log(JSON.stringify(rows, null, 2));
"'
```

Report back a numbered cluster summary to the user before diving into investigation. Format:

```
1. (47×) Cannot read properties of undefined (reading 'lexeme')
   first 2026-06-12 06:12:08, last 2026-06-12 22:01:14
   3 users, 1 version, platforms: web
2. (12×) Network error: ...
   ...
```

### 2. Dig into a cluster

For each cluster the user wants to investigate (or top N by default), pull the
full stack + context of the most recent instance:

```bash
ssh living 'docker exec sveltekit node -e "
const Database = require(\"better-sqlite3\");
const db = new Database(\"/workspace/site/.data/shared.db\", { readonly: true });
const row = db.prepare(\`
  SELECT received_at, level, message, stack, url, user_agent, app_version, context, user_id
  FROM client_logs
  WHERE message = ?
  ORDER BY received_at DESC LIMIT 1
\`).get(\"MESSAGE_TEXT_HERE\");
console.log(JSON.stringify(row, null, 2));
"'
```

Parse `context` (it's a JSON string). Useful fields:
- `session_id` — group all entries from the same browser session via `WHERE json_extract(context, '$.session_id') = ?`
- `breadcrumbs[]` — last ~20 user actions / route changes preceding the error
- `filename`, `lineno`, `colno` — for `window.error` entries (only)

### 3. Investigate in the codebase

Grep for the message + nearby symbols in `site/src/`. Cross-reference with the
breadcrumb route to narrow the file. LD's typical hot spots: per-dict DB sync
(`lib/db/dict-client/`), entries list, search, the SharedWorker boot.

```bash
# Example: error message mentions `lexeme` — find the source
grep -rn "lexeme" /home/jacob/code/living-dictionaries/site/src/lib/ /home/jacob/code/living-dictionaries/site/src/routes/ 2>&1 | head -10
```

### 4. Propose a fix

When you have a hypothesis:
1. State the cluster and the user-visible symptom
2. State the root cause (point at file + line)
3. Propose the fix (code change or design decision)
4. If the fix is small + obvious, implement it. If bigger, write an issue to `.issues/` and link the cluster.

## Tips

- **`level = 'info'` heartbeats** (every 30s while a tab is open) are noisy but useful — filter them out for triage but use them to estimate session lifetimes when you need to know "did this user keep using the app after the crash?".
- **`session_id` in `context`** lets you reconstruct one user's experience: pull all rows with the same `session_id` ORDER BY `received_at` to see the sequence of events.
- **Anonymous logs** (`user_id IS NULL`) are usually pre-login crashes or broken-auth states — still informative, often the highest-priority cluster.
- **Per-dict context** — for entry/sense errors, the `breadcrumbs[]` usually identifies which dictionary; once you know `dict_id`, you can pull the actual `dictionaries/<dict_id>.db` to reproduce against real data (see `prod-db.md`).
- **Rate limit**: each IP should be capped (port the limit from house when wiring the endpoint). Watch for `rate_limited: true` responses indicating a runaway client.

## Related

- `prod-db.md` — canonical SSH + docker DB pattern + safety rules
- `debug-vps.md` — when investigation reveals a server-side issue (Caddy / Docker / env)
