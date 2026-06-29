---
name: check-logs
description: Read the LD client_logs telemetry — browser errors/crashes/sessions AND server-side events — to debug an issue, see what a user did, or verify telemetry. Read this whenever you need to look at the logs for ANY reason, in local dev (site/.data/shared.db) or production (the living VPS).
---

# Check Logs (Living Dictionaries)

LD runs **no** third-party analytics or error tracking. The `client_logs` table in `shared.db` is the
**only** structured window into what users do and what breaks — it's our Sentry + Google Analytics in
one table. Read this skill whenever you need to get into the logs, regardless of what you're doing
with them (chasing a bug, reconstructing a session, confirming an event fired).

`client_logs` holds **both** sides:
- **Browser logs** (`source = 'client'`) — uncaught `window.error`, `unhandledrejection`, patched
  `console.error` (level `error`), plus explicit `log_event()` / `log_warning()` (level `warn`) /
  `track()` / `track_timing()` / heartbeats / `session_start` (carries `db_tier` capability
  telemetry) / `visibility_*` / `navigation`. **`console.warn` is deliberately NOT captured** — most
  warns are operational/3rd-party noise; only `warn` rows shipped via the explicit `log_warning()`
  (e.g. data-integrity "row missing primary key") or the i18n missing-key hook reach `client_logs`.
- **Server telemetry** (`source = 'server'`) — anything routed through `log_server_event(...)`
  (API failures, sync errors, cron outcomes). These would otherwise vanish into ephemeral
  `docker logs`. NULL `source` = legacy client rows.

> Pipeline: `src/lib/debug/remote-log.ts` (client capture, buffered in `localStorage.debug_log_pending`,
> flushed every 5s via `POST /api/log`, on `pagehide` via `sendBeacon`) → `insert_client_log()` →
> `client_logs`. Excluded from `SYNCABLE_TABLE_NAMES` (server-only; clients never read it back).

## Where the table lives

| Environment | DB file | How to query |
|---|---|---|
| **Local dev** | `site/.data/shared.db` | `better-sqlite3` one-liner (below) |
| **Production** | container `/data/shared.db` (host `/opt/hosting/data/shared.db`) | `ssh living` → `docker exec` (below) |

> **Pre-cutover:** the new VPS serves `new.livingdictionaries.app` off `svelte-5-migration`; the apex
> `livingdictionaries.app` is still the old Vercel/Supabase app. Production `client_logs` only fills
> as real traffic lands on `new.*`. Until then, dev is where the rows are.

Always open `{ readonly: true }` — never write `client_logs`.

## Columns

| column | notes |
|---|---|
| `received_at` | server ISO timestamp (indexed DESC — **ORDER BY / filter on this**) |
| `client_time` | client ISO, may skew |
| `level` | `error` \| `warn` \| `info` \| `unhandled_rejection` \| `crash` |
| `message`, `stack` | clamped server-side (2k / 16k). Analytics events store the event name as `message` on an `info` row. |
| `source` | `client` \| `server` (NULL legacy = client) |
| `url`, `user_agent`, `platform`, `app_version`, `build_target` | enrichment (`build_target`: `production`/`preview`/`development`) |
| `user_id` | nullable — pre-login crashes preserved (no FK) |
| `country`/`region`/`city`/`latitude`/`longitude` | approximate Cloudflare-edge geo |
| `context` | JSON string: `session_id`, `breadcrumbs[]`, `db_tier`, per-event extras |

## How to query

**Local dev** — point better-sqlite3 at the dev file:

```bash
node -e 'const db=require("/home/jacob/code/living-dictionaries/site/node_modules/better-sqlite3")("/home/jacob/code/living-dictionaries/site/.data/shared.db",{readonly:true});const since=new Date(Date.now()-24*60*60*1000).toISOString();console.log(JSON.stringify(db.prepare(`SELECT level,message,COUNT(*) n FROM client_logs WHERE received_at>=? AND level IN ('"'"'error'"'"','"'"'unhandled_rejection'"'"','"'"'crash'"'"') GROUP BY message ORDER BY n DESC`).all(since),null,2))'
```

**Production** — `sqlite3` is NOT on the VPS host; query through the app container. The VPS runs
**blue/green** (since 2026-06-24): exec into the **primary `sveltekit_blue`** (`sveltekit_green` is the
standby sharing the same `/data` mount, so either works for read-only queries — there is **no** plain
`sveltekit` container). Quote escaping inside `docker exec` is brutal, so write the query to a local
temp `.js` and pipe it through stdin:

```bash
cat > /tmp/lq.js <<'EOF'
const db = require('better-sqlite3')('/data/shared.db', { readonly: true })
const since = new Date(Date.now() - 24*60*60*1000).toISOString()
const rows = db.prepare(`...query...`).all(since)
console.log(JSON.stringify(rows, null, 2))
EOF
ssh living 'docker exec -i sveltekit_blue node' < /tmp/lq.js
```

(Container DB path is **`/data/shared.db`** — `DATA_DIR=/data`, mount `/opt/hosting/data:/data`.)

### 1. Cluster the errors

Group by `message` + first 200 chars of `stack` so one user hitting an error 50× is one cluster, not
50 incidents:

```sql
SELECT message,
       substr(coalesce(stack,''),1,200) AS stack_head,
       COUNT(*) AS n,
       MIN(received_at) AS first_seen, MAX(received_at) AS last_seen,
       COUNT(DISTINCT user_id) AS users,
       COUNT(DISTINCT app_version) AS versions,
       GROUP_CONCAT(DISTINCT platform) AS platforms
FROM client_logs
WHERE received_at >= ?           -- e.g. last 24h
  AND level IN ('error','unhandled_rejection','crash')
GROUP BY message, stack_head
ORDER BY n DESC, last_seen DESC
```

Report a numbered cluster summary before diving in:

```
1. (47×) Cannot read properties of undefined (reading 'lexeme')
   first 2026-06-12 06:12, last 2026-06-12 22:01 · 3 users · 1 version · web
2. (12×) RPC timed out (no leader responded)
   ...
```

### 2. Drill into one cluster

Pull the full stack + context of the most recent instance:

```sql
SELECT received_at, level, message, stack, url, user_agent, app_version, context, user_id
FROM client_logs
WHERE message = ?
ORDER BY received_at DESC LIMIT 1
```

`context` is a JSON string — parse it. Useful fields: `session_id`, `breadcrumbs[]` (last ~20 user
actions / route changes before the error), and for `window.error` rows `filename`/`lineno`/`colno`.

### 3. Reconstruct a session

Pull every row from one browser run, in order, to see the sequence that led to the error:

```sql
SELECT received_at, level, message FROM client_logs
WHERE json_extract(context,'$.session_id') = ?
ORDER BY received_at
```

### 4. Find it in the codebase

Grep the message + nearby symbols in `site/src/`, cross-referenced with the breadcrumb route. LD hot
spots: per-dict DB sync (`lib/db/dict-client/`), the leader/worker boot, entries list, search.

## Tips

- **Filter `build_target = 'production'`** to drop local/preview test noise.
- **`level='info'` heartbeats** (every 30s a tab is visible) are noisy — exclude them for triage, but
  use them to estimate session lifetimes ("did the user keep going after the crash?").
- **`session_id`** in `context` is the thread that stitches one user's experience together.
- **Anonymous rows** (`user_id IS NULL`) are usually pre-login crashes / broken-auth — often the
  highest-priority cluster.
- **Per-dict errors** — `breadcrumbs[]` usually names the dictionary; once you know `dict_id` you can
  query that dict's `dictionaries/<dict_id>.db` against real data (see the **database** skill's
  production-VPS section).
- **Known noise filtered at the source** (won't appear): `ResizeObserver loop`, `[GSI_LOGGER]`,
  `Sync already in progress` — see `NOISE_MESSAGE_PATTERNS` in `remote-log.ts`.

## Beyond client_logs

For raw server stdout/stderr, Caddy access logs, container state, deploy/env issues — things that
never made it into `client_logs` — see **`.claude/commands/debug-vps.md`**. To query the content DBs
(per-dict entries/senses) or run the full read-only daily review, see the **database** skill and the
`/log-and-fix` command.
