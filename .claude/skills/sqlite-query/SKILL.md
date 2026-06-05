---
name: sqlite-query
description: Query the live browser wa-sqlite DBs (admin shared.db + per-dict dict.db) via the local dev proxy. Use to inspect or debug local data — dirty rows, sync watermarks, entries/senses, catalog, messages, users — without opening DevTools.
---

## When to use me

When you need to read (or write) data from the SQLite databases running **in the admin/editor's
browser tab** during local development. This hits the actual live local wa-sqlite data — the same
DB the UI reads from — so it's the fastest way to confirm what synced, what's `dirty`, and what a
write produced.

Two DBs are reachable:
- **`shared.db`** — the admin's global catalog (dictionaries, users, roles, messages). Reachable
  whenever an `/admin/*` page is open and logged in as an admin.
- **per-dict `dict.db`** — one dictionary's content (entries, senses, audio, …). Reachable whenever
  a `/[dictionaryId]` page is open (any role, viewers included). Address it with `--dict <id>`.

## Prerequisites

- The Vite dev server is running (`pnpm dev` in `/home/jacob/code/living-dictionaries`, port 3041).
  **Jacob runs the dev server — never start it yourself.**
- For `shared.db`: an `/admin/*` page open + logged in as an admin (the admin layout opens the DB and
  registers it with the proxy in dev).
- For a `dict.db`: a `/<dictionaryId>` page open (the dict layout opens the SharedWorker DB and
  registers it as `<email>::dict::<dictionaryId>`).

## Port mapping

Each Vite server gets its own proxy ports, derived from the **actual bound** Vite port. LD uses the
4050-range so it never clashes with tutor (4000-range) or house (4020-range) when several run locally.

| Script | Vite port | WS proxy | HTTP proxy |
|--------|-----------|----------|------------|
| `pnpm dev` | 3041 | 4050 | 4051 |
| `pnpm prod` | 3042 | 4052 | 4053 |

## Usage

**IMPORTANT: always use the absolute path to the script.**

### Status — which instances are up and which browser DBs are connected

```bash
/home/jacob/code/living-dictionaries/scripts/sqlite-query.sh --status
```

### Query the admin `shared.db` (auto-selects first available instance)

```bash
/home/jacob/code/living-dictionaries/scripts/sqlite-query.sh "SELECT id, name FROM dictionaries LIMIT 5"
```

### Query a dictionary's `dict.db`

```bash
/home/jacob/code/living-dictionaries/scripts/sqlite-query.sh --dict my-dictionary "SELECT count(*) FROM entries"
```

### Parameterized query

```bash
/home/jacob/code/living-dictionaries/scripts/sqlite-query.sh "SELECT * FROM dictionary_roles WHERE dictionary_id = ?" my-dictionary
```

### Target a specific instance

```bash
/home/jacob/code/living-dictionaries/scripts/sqlite-query.sh --port 4053 "SELECT * FROM users LIMIT 3"
```

## Writes (and why the UI updates)

The proxy isn't read-only. An `INSERT`/`UPDATE`/`DELETE` runs through the connection's `execute()`:
- On a **`dict.db`** write, the SharedWorker fires a `tables_changed` broadcast, so any open tab
  showing that dict **live-updates** — no refresh needed.
- On a **`shared.db`** write, the admin tab's reactive stores are notified directly.

To make a write actually **sync to the server**, set `dirty = 1` and bump `updated_at` on the row
(the sync engine flushes dirty rows). Express deletes as
`INSERT INTO deletes (table_name, id, updated_at) VALUES (...)` — the cascade trigger does the real
DELETE. (`REPLACE INTO` without a leading `INSERT` is treated as a read by the write-detector; use
`INSERT OR REPLACE INTO` instead.)

## `shared.db` tables (admin global catalog)

Schema: `site/src/lib/db/schemas/shared.ts`; migrations: `site/src/lib/db/schemas/shared-migrations/`.

| Table | Notes |
|-------|-------|
| `dictionaries` | Dictionary catalog rows (the `/[dictionaryId]` metadata, long-form `about` etc.) |
| `dictionary_roles` | Per-dict numeric permission grants (`AdminLevel`) |
| `dictionary_partners` | Partner orgs linked to a dictionary |
| `invites` | Pending editor invites |
| `users` | All users |
| `email_aliases` | Reply aliases |
| `message_threads`, `messages`, `message_attachments` | Admin support inbox (mirror of house's messages sector) |
| `db_metadata` | Key-value (sync watermarks, db_id) |
| `deletes` | Tombstones for sync |
| `migrations` | Schema migration tracking |
| `email_codes`, `client_logs` | Server-only on the live shared.db; created empty on the client — **don't query here** |

## `dict.db` tables (one dictionary's content)

Schema: `site/src/lib/db/schemas/dictionary.ts`; migrations: `site/src/lib/db/schemas/dictionary-migrations/`.

| Table | Notes |
|-------|-------|
| `entries` | Headwords / lexemes |
| `senses` | Meanings under an entry |
| `sentences`, `senses_in_sentences` | Example sentences + their sense links |
| `dialects`, `entry_dialects` | Dialect lookups + entry junctions |
| `tags`, `entry_tags` | Tag lookups + entry junctions |
| `speakers` | Speakers |
| `audio`, `audio_speakers` | Audio + speaker junctions |
| `photos`, `sense_photos`, `sentence_photos` | Images + junctions |
| `videos`, `sense_videos`, `sentence_videos`, `video_speakers` | Videos + junctions |
| `texts` | Free-text / story content |
| `db_metadata`, `deletes`, `migrations` | Sync metadata / tombstones / migration tracking |

## Common queries

```bash
LD=/home/jacob/code/living-dictionaries/scripts/sqlite-query.sh

# Rows pending upload (admin catalog)
"$LD" "SELECT id, name FROM dictionaries WHERE dirty = 1"

# Sync watermarks per sector
"$LD" "SELECT key, value FROM db_metadata WHERE key LIKE 'synced_up_to:%'"

# A dict's entry/sense counts
"$LD" --dict my-dictionary "SELECT (SELECT count(*) FROM entries) AS entries, (SELECT count(*) FROM senses) AS senses"

# Dict rows pending upload
"$LD" --dict my-dictionary "SELECT id, updated_at FROM entries WHERE dirty = 1 ORDER BY updated_at DESC LIMIT 10"

# Tombstones in a dict
"$LD" --dict my-dictionary "SELECT table_name, id, updated_at FROM deletes ORDER BY updated_at DESC LIMIT 10"
```

## How it works

A dev-only Vite plugin (`site/sqlite-proxy/`) starts an HTTP + WebSocket server pair beside the dev
server (it `apply: 'serve'`, so it never ships to production):
1. Each browser DB connects to the WS and registers a `client_id` — `<email>` for `shared.db`,
   `<email>::dict::<dict_id>` for a dict (`site/src/lib/db/client/live-share.svelte.ts`).
2. The proxy exposes `GET /clients` + `POST /query?client=ID` for the CLI.
3. The CLI picks the matching client (admin vs `--dict`), relays `{sql, params}`, and the browser
   runs it against wa-sqlite and ships rows back as JSON, pretty-printed as a table.

## Querying the SERVER's DBs directly (not the browser)

The proxy is for the BROWSER's wa-sqlite. To query the canonical server copies, use `better-sqlite3`
directly — the files live under `site/.data/` in dev (`shared.db` + `dictionaries/<id>.db`):

```bash
node -e 'const db=require("better-sqlite3")("/home/jacob/code/living-dictionaries/site/.data/shared.db",{readonly:true});console.log(db.prepare("SELECT count(*) FROM dictionaries").get())'
```

For the live VPS, snapshot first (`VACUUM INTO`) then query the snapshot — see the `prod-db` /
`backup-vps-db` commands.
